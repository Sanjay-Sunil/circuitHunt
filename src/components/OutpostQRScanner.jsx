import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { ref, get } from 'firebase/database';
import { db } from '../lib/firebase';
import { useMarket } from '../context/MarketContext';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Camera, 
  CameraOff, 
  SwitchCamera, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Zap, 
  ZapOff,
  Scan
} from 'lucide-react';

function playSuccessBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch {
    // Ignore audio error
  }
}

export function matchOutpost(decodedText, outpostsData) {
  if (!decodedText || !outpostsData) return null;
  const raw = String(decodedText).trim();
  const lower = raw.toLowerCase();

  const outpostsList = Array.isArray(outpostsData)
    ? outpostsData
    : Object.entries(outpostsData).map(([key, val]) => ({ key, ...val }));

  // 1. Direct slug exact match
  let matched = outpostsList.find(o => o.slug && o.slug.trim() === raw);
  if (matched) return matched;

  // 2. Direct slug case-insensitive match
  matched = outpostsList.find(o => o.slug && o.slug.toLowerCase().trim() === lower);
  if (matched) return matched;

  // 3. Substring match (e.g. URL with slug: https://.../outpost/UUID or UUID inside text)
  matched = outpostsList.find(o => o.slug && lower.includes(o.slug.toLowerCase().trim()));
  if (matched) return matched;

  // 4. Match by outpost key (e.g. "outpost1")
  matched = outpostsList.find(o => o.key && o.key.toLowerCase() === lower);
  if (matched) return matched;

  // 5. Match by outpost name (e.g. "Outpost 1")
  matched = outpostsList.find(o => o.name && o.name.toLowerCase().trim() === lower);
  if (matched) return matched;

  // 6. Partial match by sanitized name
  const sanitized = lower.replace(/[-_]/g, ' ');
  matched = outpostsList.find(o => o.name && o.name.toLowerCase().replace(/[-_]/g, ' ') === sanitized);
  if (matched) return matched;

  return null;
}

export default function OutpostQRScanner() {
  const { setActiveOutpost } = useMarket();
  const navigate = useNavigate();

  const [outposts, setOutposts] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [cameraFacingMode, setCameraFacingMode] = useState('environment'); // 'environment' or 'user'
  
  const [status, setStatus] = useState('idle'); // 'idle' | 'requesting' | 'scanning' | 'processing' | 'success' | 'error' | 'permission_denied'
  const [errorMessage, setErrorMessage] = useState('');
  const [matchedOutpostName, setMatchedOutpostName] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const isMountedRef = useRef(true);
  const readerId = "circuit-hunt-qr-reader";

  // Pre-fetch outposts
  useEffect(() => {
    get(ref(db, 'outposts')).then(snap => {
      if (snap.exists() && isMountedRef.current) {
        const val = snap.val();
        const list = Object.entries(val).map(([key, item]) => ({
          key,
          ...item
        }));
        setOutposts(list);
      }
    }).catch(err => {
      console.error("Failed to load outposts:", err);
    });
  }, []);

  // Handle successful decode
  const handleScanSuccess = useCallback(async (decodedText) => {
    if (status === 'processing' || status === 'success') return;
    setStatus('processing');

    if (navigator.vibrate) {
      try {
        navigator.vibrate([40, 30, 80]);
      } catch {
        // ignore
      }
    }
    playSuccessBeep();

    // Fetch fresh outposts if empty
    let currentOutposts = outposts;
    if (!currentOutposts || currentOutposts.length === 0) {
      try {
        const snap = await get(ref(db, 'outposts'));
        if (snap.exists()) {
          currentOutposts = Object.entries(snap.val()).map(([key, item]) => ({ key, ...item }));
          setOutposts(currentOutposts);
        }
      } catch (err) {
        console.error("Error fetching outposts on scan:", err);
      }
    }

    const matched = matchOutpost(decodedText, currentOutposts);

    if (matched) {
      setMatchedOutpostName(matched.name || 'Outpost');
      setStatus('success');

      // Stop scanner before redirecting
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
        } catch {
          // ignore
        }
      }

      // Set active outpost and navigate
      setActiveOutpost(matched);
      setTimeout(() => {
        if (isMountedRef.current) {
          navigate('/market');
        }
      }, 650);
    } else {
      setStatus('error');
      setErrorMessage(`Unrecognized QR code (${decodedText.slice(0, 20)}${decodedText.length > 20 ? '...' : ''}). Please scan an official Outpost QR code.`);
    }
  }, [outposts, status, navigate, setActiveOutpost]);

  // Stop scanner safely
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn("Scanner stop/clear error:", err);
      }
      scannerRef.current = null;
    }
  }, []);

  // Start scanner
  const startScanner = useCallback(async (cameraIdOverride = null, facingModeOverride = null) => {
    try {
      await stopScanner();

      if (!isMountedRef.current) return;
      setStatus('requesting');
      setErrorMessage('');

      // Create instance
      const html5Qr = new Html5Qrcode(readerId);
      scannerRef.current = html5Qr;

      // Discover cameras
      let availableCameras = [];
      try {
        availableCameras = await Html5Qrcode.getCameras();
        if (isMountedRef.current && availableCameras.length > 0) {
          setCameras(availableCameras);
        }
      } catch {
        // Ignored, might still work with facingMode
      }

      const qrboxFunction = (viewfinderWidth, viewfinderHeight) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const edge = Math.floor(minEdge * 0.72);
        return {
          width: Math.max(edge, 200),
          height: Math.max(edge, 200)
        };
      };

      const config = {
        fps: 15,
        qrbox: qrboxFunction,
        aspectRatio: 1.0,
      };

      const cameraConstraint = cameraIdOverride 
        ? { deviceId: { exact: cameraIdOverride } } 
        : { facingMode: facingModeOverride || cameraFacingMode };

      try {
        await html5Qr.start(
          cameraConstraint,
          config,
          (decodedText) => handleScanSuccess(decodedText),
          () => {} // silent scan frame failure
        );
      } catch (firstErr) {
        // Fallback: If environment facing mode failed, try user facing mode or first camera
        console.warn("Primary camera start failed, trying fallback...", firstErr);
        if (availableCameras.length > 0) {
          const fallbackId = availableCameras[0].id;
          setSelectedCameraId(fallbackId);
          await html5Qr.start(
            { deviceId: { exact: fallbackId } },
            config,
            (decodedText) => handleScanSuccess(decodedText),
            () => {}
          );
        } else {
          // Try generic facingMode: user
          await html5Qr.start(
            { facingMode: 'user' },
            config,
            (decodedText) => handleScanSuccess(decodedText),
            () => {}
          );
        }
      }

      if (isMountedRef.current) {
        setStatus('scanning');

        // Check if torch/flashlight is supported
        try {
          const capabilities = html5Qr.getRunningTrackCapabilities?.();
          if (capabilities && capabilities.torch) {
            setTorchSupported(true);
          } else {
            setTorchSupported(false);
          }
        } catch {
          setTorchSupported(false);
        }
      }
    } catch (err) {
      console.error("Camera access error:", err);
      if (isMountedRef.current) {
        if (err?.name === 'NotAllowedError' || String(err).includes('Permission')) {
          setStatus('permission_denied');
          setErrorMessage('Camera access was denied. Please allow camera permissions in your browser or scan a photo of the QR code.');
        } else {
          setStatus('error');
          setErrorMessage('Unable to access camera. Please check your camera connection or upload an image file.');
        }
      }
    }
  }, [cameraFacingMode, handleScanSuccess, stopScanner]);

  // Flip Camera
  const handleFlipCamera = async () => {
    if (cameras.length > 1) {
      const currentIndex = cameras.findIndex(c => c.id === selectedCameraId);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextCamera = cameras[nextIndex];
      setSelectedCameraId(nextCamera.id);
      await startScanner(nextCamera.id);
    } else {
      const nextFacing = cameraFacingMode === 'environment' ? 'user' : 'environment';
      setCameraFacingMode(nextFacing);
      await startScanner(null, nextFacing);
    }
  };

  // Toggle Torch
  const handleToggleTorch = async () => {
    if (!scannerRef.current || !torchSupported) return;
    try {
      const newTorchState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: newTorchState }]
      });
      setTorchOn(newTorchState);
    } catch (err) {
      console.warn("Toggle torch error:", err);
    }
  };

  // Handle Image File Upload Scan
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setStatus('processing');
      setErrorMessage('');

      // Create temporary or reuse scanner
      let qrInstance = scannerRef.current;
      if (!qrInstance) {
        qrInstance = new Html5Qrcode(readerId);
      }

      const decodedText = await qrInstance.scanFile(file, true);
      handleScanSuccess(decodedText);
    } catch (err) {
      console.error("File scan error:", err);
      setStatus('error');
      setErrorMessage('No valid QR code detected in the uploaded image. Please try a clearer image or use live camera.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Auto-start camera on mount
  useEffect(() => {
    isMountedRef.current = true;
    startScanner();

    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, []);

  return (
    <div className="w-full space-y-4">
      {/* Scanner Viewport Container */}
      <div className="relative w-full rounded-3xl overflow-hidden bg-neutral-950 border border-neutral-800 shadow-2xl min-h-[320px] flex flex-col items-center justify-center">
        
        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*" 
          onChange={handleFileUpload} 
          className="hidden" 
        />

        {/* The DOM element required by html5-qrcode */}
        <div 
          id={readerId} 
          className={`w-full overflow-hidden transition-opacity duration-300 ${status === 'scanning' ? 'opacity-100' : 'opacity-40'}`}
          style={{ minHeight: '320px' }}
        />

        {/* Live Viewfinder HUD Overlay */}
        {status === 'scanning' && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
            {/* Viewfinder Target Reticle */}
            <div className="relative w-56 h-56 sm:w-64 sm:h-64 border border-white/20 rounded-3xl overflow-hidden backdrop-blur-[1px]">
              
              {/* 4 Corner Markers */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl"></div>
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl"></div>
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl"></div>
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl"></div>

              {/* Animated Laser Scanning Beam */}
              <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-scanline" />
            </div>

            {/* Live Indicator Pill */}
            <div className="mt-4 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-white shadow-lg">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold tracking-wide text-neutral-200">Point at Outpost QR code</span>
            </div>
          </div>
        )}

        {/* State: Requesting Camera */}
        {status === 'requesting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/90 text-white p-6 text-center z-10">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mb-3" />
            <h4 className="font-bold text-lg text-neutral-100">Starting Camera...</h4>
            <p className="text-xs text-neutral-400 mt-1 max-w-xs">Initializing high-speed scanner and camera stream</p>
          </div>
        )}

        {/* State: Processing / Matched */}
        {status === 'processing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm text-white p-6 text-center z-10">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-400 mb-3" />
            <h4 className="font-bold text-xl text-neutral-100">Reading Outpost QR...</h4>
            <p className="text-xs text-neutral-400 mt-1">Verifying cryptographic outpost signature</p>
          </div>
        )}

        {/* State: Success Match */}
        {status === 'success' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-950/90 backdrop-blur-md text-white p-6 text-center z-20 animate-in fade-in duration-200">
            <div className="h-16 w-16 bg-emerald-500/20 border-2 border-emerald-400 rounded-full flex items-center justify-center mb-3 shadow-[0_0_24px_rgba(52,211,153,0.5)]">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
            </div>
            <Badge className="bg-emerald-400 text-black font-bold uppercase tracking-wider mb-2">Verified</Badge>
            <h3 className="font-extrabold text-2xl text-white tracking-tight">{matchedOutpostName}</h3>
            <p className="text-sm text-emerald-200/80 mt-1">Entering outpost market...</p>
          </div>
        )}

        {/* State: Permission Denied */}
        {status === 'permission_denied' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 text-white p-6 text-center z-10 space-y-4">
            <div className="h-14 w-14 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-400">
              <CameraOff className="w-8 h-8" />
            </div>
            <div>
              <h4 className="font-bold text-lg text-white">Camera Access Required</h4>
              <p className="text-xs text-neutral-400 mt-1.5 max-w-xs leading-relaxed">
                Please allow camera permissions in your browser or select an image file with the QR code.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              <Button 
                onClick={() => startScanner()} 
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs h-9 px-4 rounded-xl"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Allow Camera
              </Button>
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                className="bg-neutral-900 border-neutral-700 text-neutral-200 hover:bg-neutral-800 text-xs h-9 px-4 rounded-xl"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Upload Photo
              </Button>
            </div>
          </div>
        )}

        {/* State: Camera Idle (stopped) */}
        {status === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 text-white p-6 text-center z-10 space-y-4">
            <div className="h-14 w-14 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-center text-neutral-400">
              <Scan className="w-8 h-8" />
            </div>
            <div>
              <h4 className="font-bold text-lg text-white">Scanner Paused</h4>
              <p className="text-xs text-neutral-400 mt-1">Click below to activate device camera.</p>
            </div>
            <Button 
              onClick={() => startScanner()} 
              className="bg-white text-black hover:bg-neutral-200 font-bold text-sm h-10 px-6 rounded-2xl"
            >
              <Camera className="w-4 h-4 mr-2" />
              Open Camera
            </Button>
          </div>
        )}
      </div>

      {/* Error Alert Message */}
      {errorMessage && (
        <div className="flex items-start gap-3 p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs leading-relaxed animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{errorMessage}</p>
          </div>
          <button 
            onClick={() => {
              setErrorMessage('');
              startScanner();
            }} 
            className="text-red-300 font-bold underline hover:text-red-200 shrink-0 ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Camera Control Action Buttons */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          {status === 'scanning' ? (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={stopScanner}
              className="text-xs font-semibold rounded-2xl border-gray-200 hover:bg-gray-100 text-gray-700"
            >
              <CameraOff className="w-3.5 h-3.5 mr-1.5" />
              Pause
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => startScanner()}
              className="text-xs font-semibold rounded-2xl border-gray-200 hover:bg-gray-100 text-gray-700"
            >
              <Camera className="w-3.5 h-3.5 mr-1.5" />
              Start Camera
            </Button>
          )}

          {/* Flip / Switch Camera Button */}
          {status === 'scanning' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleFlipCamera}
              className="text-xs font-semibold rounded-2xl border-gray-200 hover:bg-gray-100 text-gray-700"
              title="Switch front/back camera"
            >
              <SwitchCamera className="w-3.5 h-3.5 mr-1.5" />
              Flip
            </Button>
          )}

          {/* Flashlight / Torch Toggle */}
          {status === 'scanning' && torchSupported && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleToggleTorch}
              className={`text-xs font-semibold rounded-2xl border-gray-200 ${torchOn ? 'bg-amber-100 text-amber-900 border-amber-300' : 'hover:bg-gray-100 text-gray-700'}`}
              title="Toggle flashlight"
            >
              {torchOn ? <ZapOff className="w-3.5 h-3.5 mr-1.5" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />}
              {torchOn ? 'Flash Off' : 'Flash On'}
            </Button>
          )}
        </div>

        {/* Upload QR Photo Button */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => fileInputRef.current?.click()}
          className="text-xs font-semibold text-gray-600 hover:text-black rounded-2xl"
        >
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          Scan Image File
        </Button>
      </div>

      <style>{`
        #${readerId} video {
          border-radius: 1.5rem !important;
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
          max-height: 380px !important;
        }
        #${readerId} img[alt="Info icon"] {
          display: none !important;
        }
        #${readerId} {
          border: none !important;
        }
        @keyframes scanline {
          0% {
            top: 5%;
            opacity: 0.85;
          }
          50% {
            opacity: 1;
          }
          100% {
            top: 92%;
            opacity: 0.85;
          }
        }
        .animate-scanline {
          animation: scanline 2.2s ease-in-out infinite alternate;
        }
      `}</style>
    </div>
  );
}

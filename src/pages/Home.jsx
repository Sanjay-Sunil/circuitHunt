import { useState, useEffect } from 'react';
import { useTeam } from '../context/TeamContext';
import { db, auth } from '../lib/firebase';
import { ref, get } from 'firebase/database';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { useMarket } from '../context/MarketContext';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

export default function Home() {
  const { team } = useTeam();
  const [circuit, setCircuit] = useState(null);
  const [components, setComponents] = useState({});
  const [gameConfig, setGameConfig] = useState(null);
  const navigate = useNavigate();
  const { setActiveOutpost } = useMarket();

  useEffect(() => {
    if (team?.circuitId) {
      get(ref(db, `circuits/${team.circuitId}`)).then(snap => setCircuit(snap.val()));
    }
    get(ref(db, 'components')).then(snap => setComponents(snap.val() || {}));
    get(ref(db, 'gameConfig')).then(snap => setGameConfig(snap.val() || {}));
  }, [team]);

  useEffect(() => {
    let scanner;
    if (team?.status === 'playing' && document.getElementById('reader')) {
      scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scanner.render(async (decodedText) => {
        scanner.clear();
        const outpostsSnap = await get(ref(db, 'outposts'));
        if (outpostsSnap.exists()) {
          const outposts = Object.values(outpostsSnap.val());
          const matched = outposts.find(o => o.slug === decodedText);
          if (matched) {
            setActiveOutpost(matched);
            navigate('/market');
          } else {
            alert('Invalid QR code');
          }
        }
      }, (error) => {
        // ignore scan errors
      });
    }
    return () => {
      if (scanner) scanner.clear().catch(e => console.error(e));
    };
  }, [team, circuit, gameConfig, navigate, setActiveOutpost]);

  if (!team || !circuit) return <div className="min-h-screen bg-muted flex items-center justify-center font-medium">Loading...</div>;

  const requiredCount = circuit.required.length;
  const ownedCount = circuit.required.filter(id => team.inventory?.[id]?.owned).length;
  const isFinished = team.status === 'finished';

  return (
    <div className="min-h-screen bg-muted p-4 md:p-6 lg:p-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Header Profile Card */}
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
          <div className="bg-black p-8 text-white flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">{team.teamName}</h1>
              <p className="text-gray-400 font-medium mt-1">₹{team.balance} Available Balance</p>
            </div>
            <div className="h-16 w-16 bg-white/10 rounded-full flex items-center justify-center text-2xl font-bold">
              {team.teamName.charAt(0).toUpperCase()}
            </div>
          </div>
          <CardContent className="p-6">
            <div className="flex justify-between items-end mb-4">
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Your Mission</p>
                <h2 className="text-2xl font-bold mt-1">{circuit.name}</h2>
              </div>
              <Badge variant={isFinished ? "success" : "default"} className="px-4 py-1 text-sm">
                {isFinished ? "Mission Accomplished" : `${ownedCount} / ${requiredCount} Collected`}
              </Badge>
            </div>
            
            <div className="space-y-3 mt-6">
              {circuit.required.map(id => {
                const isOwned = team.inventory?.[id]?.owned;
                return (
                  <div key={id} className={`flex items-center p-4 rounded-2xl border ${isOwned ? 'bg-black text-white border-black' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                    <div className="flex-1">
                      <p className="font-bold text-lg">{components[id]?.name || id}</p>
                    </div>
                    {isOwned && <Badge variant="success" className="ml-2">Acquired</Badge>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* QR Scanner Card */}
        {!isFinished && (
          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-2">Scan Outpost QR</h3>
              <p className="text-gray-500 text-sm mb-6">Scan an outpost QR code to enter the marketplace.</p>
              
              {gameConfig?.status === 'ended' ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-center font-bold">
                  This event has ended.
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden border border-gray-200">
                  <div id="reader" className="w-full"></div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* TEMP DEV OUTPOST BUTTONS */}
        {!isFinished && (
          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4 text-red-500">Dev Mode: Test Outposts</h3>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map(num => (
                  <Button 
                    key={num} 
                    variant="outline" 
                    onClick={async () => {
                      const snap = await get(ref(db, 'outposts'));
                      if (snap.exists()) {
                        const outposts = Object.values(snap.val());
                        const outpost = outposts.find(o => o.name === `Outpost ${num}`);
                        if (outpost) {
                          setActiveOutpost(outpost);
                          navigate('/market');
                        } else {
                          alert(`Outpost ${num} not found in database.`);
                        }
                      }
                    }}
                  >
                    Test Outpost {num}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        )}

        <div className="text-center pb-8">
          <Button variant="ghost" onClick={() => auth.signOut()}>Log Out</Button>
        </div>
      </div>
    </div>
  );
}

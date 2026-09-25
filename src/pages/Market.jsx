import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTeam } from '../context/TeamContext';
import { useMarket } from '../context/MarketContext';
import { auth, db } from '../lib/firebase';
import { ref, get, runTransaction, serverTimestamp } from 'firebase/database';
import { getActiveWindowIndex, getPrice, WINDOW_DURATION_MS } from '../lib/priceEngine';
import { calculateSwapDelta, checkCircuitCompletion } from '../lib/gameLogic';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { 
  Thermometer, 
  Volume2, 
  SlidersHorizontal, 
  Zap, 
  CircleDot, 
  Lightbulb, 
  Radio, 
  Sun, 
  Activity, 
  Cpu,
  ArrowLeft
} from 'lucide-react';

const COMPONENT_ICONS = {
  temp_sensor: { icon: Thermometer, bg: 'bg-rose-50 text-rose-600 border-rose-100' },
  buzzer: { icon: Volume2, bg: 'bg-purple-50 text-purple-600 border-purple-100' },
  potentiometer: { icon: SlidersHorizontal, bg: 'bg-blue-50 text-blue-600 border-blue-100' },
  capacitor: { icon: Zap, bg: 'bg-amber-50 text-amber-600 border-amber-100' },
  push_button: { icon: CircleDot, bg: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
  led: { icon: Lightbulb, bg: 'bg-yellow-50 text-yellow-600 border-yellow-100' },
  ultrasonic_sensor: { icon: Radio, bg: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
  photoresistor: { icon: Sun, bg: 'bg-orange-50 text-orange-600 border-orange-100' },
  resistor: { icon: Activity, bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
};

function ComponentIcon({ compId }) {
  const conf = COMPONENT_ICONS[compId] || { icon: Cpu, bg: 'bg-gray-100 text-gray-700 border-gray-200' };
  const Icon = conf.icon;
  return (
    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 border ${conf.bg}`}>
      <Icon className="w-6 h-6" />
    </div>
  );
}

export default function Market() {
  const { team } = useTeam();
  const { activeOutpost } = useMarket();
  const navigate = useNavigate();
  
  const [gameConfig, setGameConfig] = useState(null);
  const [components, setComponents] = useState({});
  const [circuit, setCircuit] = useState(null);
  const [activeWindow, setActiveWindow] = useState(null);
  const [tab, setTab] = useState('buy');
  const [loadingAction, setLoadingAction] = useState(false);
  const [countdownStr, setCountdownStr] = useState('');

  useEffect(() => {
    get(ref(db, 'gameConfig')).then(snap => setGameConfig(snap.val()));
    get(ref(db, 'components')).then(snap => setComponents(snap.val() || {}));
  }, []);

  useEffect(() => {
    if (team?.circuitId) {
      get(ref(db, `circuits/${team.circuitId}`)).then(snap => setCircuit(snap.val()));
    }
  }, [team?.circuitId]);

  useEffect(() => {
    if (!gameConfig?.gameStartTimestamp || gameConfig.status !== 'running') return;
    
    const updateWindow = () => {
      const now = Date.now();
      const idx = getActiveWindowIndex(gameConfig.gameStartTimestamp, now);
      setActiveWindow(idx);
      
      const windowDuration = WINDOW_DURATION_MS;
      const elapsed = now - gameConfig.gameStartTimestamp;
      const nextChange = windowDuration - (elapsed % windowDuration);
      
      const m = Math.floor(nextChange / 60000);
      const s = Math.floor((nextChange % 60000) / 1000);
      setCountdownStr(`${m}m ${s}s`);
    };
    
    updateWindow();
    const interval = setInterval(updateWindow, 1000);
    return () => clearInterval(interval);
  }, [gameConfig]);

  if (!activeOutpost) return <Navigate to="/home" replace />;
  if (!team) return null;
  if (team.status === 'finished') return <Navigate to="/finished" replace />;

  if (gameConfig && gameConfig.status !== 'running') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <Card className="max-w-md w-full bg-white text-center p-8 rounded-[2.5rem] border-none shadow-xl">
          <h2 className="text-2xl font-bold mb-4">{gameConfig.status === 'ended' ? 'This event has ended.' : "The event hasn't started yet."}</h2>
          <Button onClick={() => navigate('/home')} className="w-full">Return to Home</Button>
        </Card>
      </div>
    );
  }

  const handleSell = async (componentId, boughtPrice) => {
    if (loadingAction) return;
    setLoadingAction(true);
    const teamRef = ref(db, `teams/${auth.currentUser.uid}`);
    try {
      await runTransaction(teamRef, (currentTeam) => {
        if (!currentTeam) return currentTeam;
        if (!currentTeam.inventory || !currentTeam.inventory[componentId]?.owned) return; 

        currentTeam.inventory[componentId].owned = false;
        currentTeam.balance += boughtPrice;
        
        const logId = Date.now().toString();
        if (!currentTeam.logs) currentTeam.logs = {};
        currentTeam.logs[logId] = {
          type: "sell", outpostId: activeOutpost.slug, componentId, amount: boughtPrice, balanceAfter: currentTeam.balance, timestamp: Date.now()
        };
        return currentTeam;
      });
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleBuy = async (componentId, price) => {
    if (loadingAction) return;
    if (team.balance < price) return alert("Insufficient funds!");
    setLoadingAction(true);
    const teamRef = ref(db, `teams/${auth.currentUser.uid}`);
    let finished = false;
    try {
      await runTransaction(teamRef, (currentTeam) => {
        if (!currentTeam) return currentTeam;
        if (currentTeam.balance < price) return; 
        
        currentTeam.balance -= price;
        if (!currentTeam.inventory) currentTeam.inventory = {};
        currentTeam.inventory[componentId] = { owned: true, boughtPrice: price, outpostId: activeOutpost.slug };
        
        const logId = Date.now().toString();
        if (!currentTeam.logs) currentTeam.logs = {};
        currentTeam.logs[logId] = {
          type: "buy", outpostId: activeOutpost.slug, componentId, amount: -price, balanceAfter: currentTeam.balance, timestamp: Date.now()
        };
        
        if (circuit && checkCircuitCompletion(circuit.required, currentTeam.inventory)) {
          currentTeam.status = "finished";
          currentTeam.finishedAt = serverTimestamp();
          finished = true;
        }
        return currentTeam;
      });
      if (finished) navigate('/finished');
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSwap = async (componentId, currentPrice, boughtPrice) => {
    if (loadingAction) return;
    if (currentPrice > boughtPrice && team.balance < (currentPrice - boughtPrice)) {
      return alert("Insufficient funds to cover the swap difference!");
    }
    setLoadingAction(true);
    const teamRef = ref(db, `teams/${auth.currentUser.uid}`);
    let finished = false;
    try {
      await runTransaction(teamRef, (currentTeam) => {
        if (!currentTeam) return currentTeam;
        if (currentPrice > boughtPrice && currentTeam.balance < (currentPrice - boughtPrice)) return;
        
        currentTeam.balance += boughtPrice;
        currentTeam.balance -= currentPrice;
        
        if (!currentTeam.inventory) currentTeam.inventory = {};
        currentTeam.inventory[componentId] = { owned: true, boughtPrice: currentPrice, outpostId: activeOutpost.slug };
        
        const logId = Date.now().toString();
        if (!currentTeam.logs) currentTeam.logs = {};
        currentTeam.logs[logId] = {
          type: "swap", oldPrice: boughtPrice, newPrice: currentPrice, amount: currentPrice - boughtPrice, balanceAfter: currentTeam.balance, timestamp: Date.now()
        };
        
        if (circuit && checkCircuitCompletion(circuit.required, currentTeam.inventory)) {
          currentTeam.status = "finished";
          currentTeam.finishedAt = serverTimestamp();
          finished = true;
        }
        return currentTeam;
      });
      if (finished) navigate('/finished');
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const inventoryItems = team.inventory ? Object.keys(team.inventory).filter(id => team.inventory[id].owned) : [];

  return (
    <div className="min-h-screen bg-muted p-4 md:p-6 lg:p-8 font-sans pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <Button variant="outline" className="rounded-full h-10 w-10 p-0" onClick={() => navigate('/home')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="text-right">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Prices change in</p>
            <Badge variant="outline" className="font-mono text-sm">{countdownStr}</Badge>
          </div>
        </div>

        {/* Store Title */}
        <div className="px-2">
          <h1 className="text-4xl font-extrabold tracking-tight">{activeOutpost.name}</h1>
          <p className="text-xl font-medium text-gray-500 mt-1">₹{team.balance} Available Balance</p>
        </div>

        {/* Custom Tabs */}
        <div className="flex bg-gray-200/50 p-1 rounded-full w-full max-w-sm">
          <button 
            onClick={() => setTab('buy')} 
            className={`flex-1 py-2 px-4 rounded-full text-sm font-bold transition-all ${tab === 'buy' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-black'}`}
          >
            Buy & Swap
          </button>
          <button 
            onClick={() => setTab('sell')} 
            className={`flex-1 py-2 px-4 rounded-full text-sm font-bold transition-all ${tab === 'sell' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-black'}`}
          >
            Sell
          </button>
        </div>

        {/* Listings */}
        <div className="space-y-3 mt-6">
          {tab === 'buy' && Object.keys(activeOutpost.prices).map(compId => {
            const price = getPrice(activeOutpost, compId, activeWindow);
            if (price === undefined) return null;
            
            const isOwned = team.inventory?.[compId]?.owned;
            const boughtPrice = isOwned ? team.inventory[compId].boughtPrice : 0;
            const swapData = isOwned ? calculateSwapDelta(price, boughtPrice) : null;
            const isMissionItem = circuit?.required?.includes(compId);
            
            return (
              <Card key={compId} className="border-none shadow-sm rounded-3xl bg-white overflow-hidden flex items-center justify-between p-4 sm:p-5">
                <div className="flex items-center min-w-0 flex-1 mr-3">
                  <ComponentIcon compId={compId} />
                  <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base sm:text-lg text-gray-900 truncate">
                        {components[compId]?.name || compId}
                      </h3>
                      {isMissionItem && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Mission
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 font-medium text-sm mt-0.5">
                      ₹{price} <span className="text-xs text-gray-400">/ unit</span>
                    </p>
                  </div>
                </div>
                <div className="shrink-0">
                  {!isOwned ? (
                    <Button disabled={loadingAction} onClick={() => handleBuy(compId, price)} className="rounded-full px-6 text-sm font-bold">
                      Buy
                    </Button>
                  ) : (
                    <Button 
                      disabled={loadingAction} 
                      onClick={() => handleSwap(compId, price, boughtPrice)}
                      variant={swapData.color === 'green' ? 'success' : 'default'}
                      className={`rounded-full px-5 text-sm font-bold ${swapData.color === 'green' ? 'bg-green-500 hover:bg-green-600 text-white' : swapData.color === 'red' ? 'bg-red-500 hover:bg-red-600 text-white' : ''}`}
                    >
                      Swap {swapData.label}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}

          {tab === 'sell' && inventoryItems.map(compId => {
            const stocksIt = activeOutpost.prices[compId] !== undefined;
            if (!stocksIt) return null;
            const boughtPrice = team.inventory[compId].boughtPrice;
            
            return (
              <Card key={compId} className="border-none shadow-sm rounded-3xl bg-white overflow-hidden flex items-center justify-between p-4 sm:p-5">
                <div className="flex items-center min-w-0 flex-1 mr-3">
                  <ComponentIcon compId={compId} />
                  <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                    <h3 className="font-bold text-base sm:text-lg text-gray-900 truncate">
                      {components[compId]?.name || compId}
                    </h3>
                    <p className="text-gray-500 font-medium text-sm mt-0.5">
                      Bought at: <span className="font-semibold text-gray-700">₹{boughtPrice}</span>
                    </p>
                  </div>
                </div>
                <div className="shrink-0">
                  <Button variant="outline" disabled={loadingAction} onClick={() => handleSell(compId, boughtPrice)} className="rounded-full px-5 border-gray-300 font-bold text-sm">
                    Sell +₹{boughtPrice}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { ref, get, set, onValue, serverTimestamp, update } from 'firebase/database';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const [gameConfig, setGameConfig] = useState({});
  const [teams, setTeams] = useState({});
  const [circuits, setCircuits] = useState({});
  const [expandedTeam, setExpandedTeam] = useState(null);
  
  const [startingBalanceInput, setStartingBalanceInput] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const configRef = ref(db, 'gameConfig');
    const unsubConfig = onValue(configRef, snap => {
      if (snap.exists()) {
        const val = snap.val();
        setGameConfig(val);
        setStartingBalanceInput(prev => prev === '' ? (val.startingBalance?.toString() || '200') : prev);
      }
    });

    const teamsRef = ref(db, 'teams');
    const unsubTeams = onValue(teamsRef, snap => {
      setTeams(snap.exists() ? snap.val() : {});
    });
    
    get(ref(db, 'circuits')).then(snap => setCircuits(snap.exists() ? snap.val() : {}));

    return () => {
      unsubConfig();
      unsubTeams();
    };
  }, []);

  const handleStartClock = () => {
    if (window.confirm("Are you sure you want to start the global clock? This is irreversible.")) {
      update(ref(db, 'gameConfig'), {
        status: 'running',
        gameStartTimestamp: serverTimestamp()
      });
    }
  };

  const handleEndGame = () => {
    if (window.confirm("Are you sure you want to END the game? This stops all transactions.")) {
      update(ref(db, 'gameConfig'), {
        status: 'ended'
      });
    }
  };

  const handleSaveBalance = () => {
    const val = parseInt(startingBalanceInput, 10);
    if (!isNaN(val)) {
      set(ref(db, 'gameConfig/startingBalance'), val);
      alert('Starting balance updated for future registrations.');
    }
  };

  const handleResetGame = async () => {
    const code = prompt("CRITICAL WARNING: This will permanently wipe all teams, logs, and game progress to start a fresh game. Type 'RESET' to confirm.");
    if (code === 'RESET') {
      const updates = {};
      updates['/teams'] = null;
      updates['/meta/circuitAssignmentCounts'] = null;
      updates['/adminSession'] = null;
      updates['/gameConfig/status'] = 'not_started';
      updates['/gameConfig/gameStartTimestamp'] = null;
      
      try {
        await update(ref(db), updates);
        alert("Game has been completely wiped and reset!");
      } catch (e) {
        alert("Error resetting game: " + e.message);
      }
    }
  };

  const sortedTeams = Object.entries(teams).map(([uid, team]) => ({ uid, ...team })).sort((a, b) => {
    if (a.status === 'finished' && b.status === 'finished') {
      return a.finishedAt - b.finishedAt;
    }
    if (a.status === 'finished') return -1;
    if (b.status === 'finished') return 1;
    return b.balance - a.balance;
  });

  return (
    <div className="min-h-screen bg-muted p-4 md:p-8 font-sans pb-24">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">Admin Dashboard</h1>
            <p className="text-gray-500 mt-1">Control center for Circuit Hunt</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/admin/qr')}>Print QR Codes</Button>
        </div>
        
        {/* Control Panels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Game Status */}
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-black text-white p-6">
              <CardTitle className="text-xl">Game Status</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <span className="font-semibold text-gray-500 uppercase tracking-widest text-sm">Current State</span>
                <Badge variant={gameConfig.status === 'running' ? 'success' : gameConfig.status === 'ended' ? 'destructive' : 'secondary'} className="px-3 py-1">
                  {gameConfig.status?.replace('_', ' ')?.toUpperCase()}
                </Badge>
              </div>
              {gameConfig.status === 'not_started' && (
                <Button onClick={handleStartClock} className="w-full h-12 bg-green-500 hover:bg-green-600 text-white">
                  Start Global Clock
                </Button>
              )}
              {gameConfig.status === 'running' && (
                <Button onClick={handleEndGame} variant="destructive" className="w-full h-12">
                  End Game
                </Button>
              )}
              {gameConfig.status === 'ended' && (
                <p className="text-sm font-medium text-center text-gray-400">Game has concluded.</p>
              )}
            </CardContent>
          </Card>

          {/* Starting Balance */}
          <Card className="border-none shadow-sm rounded-3xl bg-white">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-xl">Starting Balance</CardTitle>
              <CardDescription>Funds given to new teams</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={startingBalanceInput} 
                  onChange={e => setStartingBalanceInput(e.target.value)} 
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-mono focus:outline-none focus:ring-2 focus:ring-black"
                />
                <Button onClick={handleSaveBalance} className="h-auto rounded-2xl px-6">Save</Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-none shadow-sm rounded-3xl bg-red-50">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-xl text-red-600">Danger Zone</CardTitle>
              <CardDescription className="text-red-400">Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <Button onClick={handleResetGame} variant="destructive" className="w-full h-12 rounded-2xl bg-red-600 hover:bg-red-700">
                Wipe & Reset Game
              </Button>
              <p className="text-xs text-red-400 font-medium text-center mt-3">Deletes all teams and logs.</p>
            </CardContent>
          </Card>

        </div>
        
        {/* Leaderboard */}
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-black text-white p-6">
            <CardTitle className="text-2xl">Teams Leaderboard</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Team</th>
                  <th className="px-6 py-4">Circuit</th>
                  <th className="px-6 py-4">Progress</th>
                  <th className="px-6 py-4">Balance</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4 text-right">Logs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedTeams.map(team => {
                  const circ = circuits[team.circuitId];
                  const reqCount = circ ? circ.required.length : 0;
                  const ownedCount = circ ? circ.required.filter(id => team.inventory?.[id]?.owned).length : 0;
                  const logs = team.logs ? Object.values(team.logs).sort((a,b) => b.timestamp - a.timestamp) : [];

                  return (
                    <React.Fragment key={team.uid}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-base text-gray-900">{team.teamName}</div>
                          <div className="text-gray-500 text-xs mt-1">{team.leaderName}{team.members?.length > 0 ? `, ${team.members.join(', ')}` : ''}</div>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-600">{circ ? circ.name : team.circuitId}</td>
                        <td className="px-6 py-4">
                          <span className={`font-bold ${ownedCount === reqCount && reqCount > 0 ? 'text-green-500' : 'text-gray-900'}`}>
                            {ownedCount} / {reqCount}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-gray-900">
                          ₹{team.balance}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="ml-2 h-6 px-2 text-xs" 
                            onClick={() => {
                              const newBal = prompt(`Enter new balance for ${team.teamName}:`, team.balance);
                              if (newBal !== null) {
                                const val = parseInt(newBal, 10);
                                if (!isNaN(val)) set(ref(db, `teams/${team.uid}/balance`), val);
                              }
                            }}
                          >
                            Edit
                          </Button>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={team.status === 'finished' ? 'success' : 'secondary'}>
                            {team.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 font-mono text-gray-500">
                          {team.finishedAt ? new Date(team.finishedAt).toLocaleTimeString() : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button 
                            variant={expandedTeam === team.uid ? 'default' : 'outline'} 
                            size="sm" 
                            onClick={() => setExpandedTeam(expandedTeam === team.uid ? null : team.uid)}
                            className="rounded-full"
                          >
                            {expandedTeam === team.uid ? 'Hide' : 'View'}
                          </Button>
                        </td>
                      </tr>
                      {expandedTeam === team.uid && (
                        <tr>
                          <td colSpan="7" className="bg-gray-50 p-6 shadow-inner">
                            <h4 className="font-bold text-gray-900 mb-4 uppercase tracking-widest text-xs">Transaction Log</h4>
                            {logs.length === 0 ? <p className="text-gray-500 text-sm">No transactions yet.</p> : (
                              <div className="space-y-3">
                                {logs.map(log => (
                                  <div key={log.timestamp} className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-sm">
                                    <span className="font-mono text-gray-400 text-xs">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    <Badge variant="outline" className={
                                      log.type === 'buy' ? 'text-blue-600 border-blue-200 bg-blue-50' : 
                                      log.type === 'sell' ? 'text-orange-600 border-orange-200 bg-orange-50' : 
                                      'text-purple-600 border-purple-200 bg-purple-50'
                                    }>
                                      {log.type.toUpperCase()}
                                    </Badge>
                                    <span className="font-bold text-gray-700">{log.componentId}</span>
                                    <span className="text-gray-400">@</span>
                                    <span className="font-medium text-gray-600">{log.outpostId}</span>
                                    <span className="flex-1"></span>
                                    <span className={`font-mono font-bold ${log.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                      {log.amount > 0 ? '+' : ''}₹{log.amount}
                                    </span>
                                    <span className="font-mono text-gray-500 ml-4">
                                      Bal: ₹{log.balanceAfter}
                                    </span>
                                    {log.type === 'swap' && (
                                      <span className="text-xs text-gray-400 ml-2">
                                        (₹{log.oldPrice} → ₹{log.newPrice})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

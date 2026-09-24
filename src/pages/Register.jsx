import { useState } from 'react';
import { db, auth } from '../lib/firebase';
import { ref, runTransaction, get } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';

export default function Register() {
  const [teamName, setTeamName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [memberString, setMemberString] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const uid = auth.currentUser.uid;

      const countsRef = ref(db, 'meta/circuitAssignmentCounts');
      let assignedCircuit = 'circuit_1';
      
      await runTransaction(countsRef, (currentData) => {
        if (!currentData) {
          assignedCircuit = 'c1';
          return { c1: 1, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0, c7: 0, c8: 0 };
        }
        
        let minCount = Infinity;
        let selected = null;
        for (const [circuit, count] of Object.entries(currentData)) {
          if (count < minCount) {
            minCount = count;
            selected = circuit;
          }
        }
        assignedCircuit = selected;
        currentData[selected] = (currentData[selected] || 0) + 1;
        return currentData;
      });
      
      const circuitSnap = await get(ref(db, `circuits/${assignedCircuit}`));
      const startingBalance = circuitSnap.val()?.budget || 200;

      const teamRef = ref(db, `teams/${uid}`);
      await runTransaction(teamRef, (currentTeam) => {
        if (currentTeam === null) {
          return {
            uid,
            teamName,
            leaderName,
            members: memberString.split(',').map(m => m.trim()).filter(Boolean),
            circuitId: assignedCircuit,
            balance: startingBalance,
            inventory: {},
            logs: {},
            status: 'playing',
            finishedAt: null
          };
        }
        return currentTeam;
      });
      
      navigate('/mission', { state: { justRegistered: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md bg-white border-none shadow-xl rounded-[2.5rem]">
        <CardHeader className="text-center pt-8 pb-4">
          <CardTitle className="text-3xl font-extrabold tracking-tight">Register Team</CardTitle>
          <CardDescription>Enter your team details to begin</CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Team Name</label>
              <input 
                type="text" 
                value={teamName} 
                onChange={e => setTeamName(e.target.value)} 
                required 
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all"
                placeholder="e.g. Cyber Ninjas"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Leader Name</label>
              <input 
                type="text" 
                value={leaderName} 
                onChange={e => setLeaderName(e.target.value)} 
                required 
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Members (comma separated)</label>
              <input 
                type="text" 
                value={memberString} 
                onChange={e => setMemberString(e.target.value)} 
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all"
                placeholder="Jane, Smith, Alex"
              />
            </div>
            
            {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}
            
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full h-12 mt-4 text-base font-semibold"
            >
              {loading ? 'Registering...' : 'Register Team'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

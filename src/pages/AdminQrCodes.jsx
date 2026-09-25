import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { ref, get } from 'firebase/database';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';

export default function AdminQrCodes() {
  const [outposts, setOutposts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Note: The passcode gating wrapper will be applied in App.jsx (Module 6)
    get(ref(db, 'outposts')).then(snap => {
      if (snap.exists()) {
        setOutposts(Object.values(snap.val()));
      }
    });
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <div className="no-print" style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 className="text-3xl font-extrabold mb-2">Outpost QR Codes</h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
          <button 
            onClick={() => navigate('/admin/dashboard')} 
            style={{ padding: '0.8rem 1.5rem', background: '#111', color: 'white', borderRadius: '0.75rem', fontWeight: 'bold', cursor: 'pointer', border: 'none' }}
          >
            Back to Dashboard
          </button>
          <button 
            onClick={() => window.print()} 
            style={{ padding: '0.8rem 1.5rem', background: '#2563eb', color: 'white', borderRadius: '0.75rem', fontWeight: 'bold', cursor: 'pointer', border: 'none' }}
          >
            Print All QR Codes
          </button>
        </div>
        <p style={{ marginTop: '1rem', color: '#666', fontSize: '0.875rem' }}>
          These codes contain raw outpost slugs/UUIDs. Scanning via the player camera will automatically redirect teams to the corresponding outpost market.
        </p>
      </div>

      <div className="print-container">
        {outposts.map(outpost => (
          <div key={outpost.slug} className="qr-card">
            <h1 style={{ fontSize: '3rem', marginBottom: '3rem' }}>{outpost.name}</h1>
            <QRCodeSVG value={outpost.slug} size={500} />
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-container {
            width: 100%;
          }
          .qr-card {
            page-break-after: always;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            padding: 0;
          }
          body {
            margin: 0;
            padding: 0;
            background: white;
            color: black;
          }
        }
        @media screen {
          .qr-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin: 2rem auto;
            border: 1px solid #ccc;
            padding: 4rem;
            border-radius: 8px;
            background: white;
            color: black;
            max-width: 600px;
          }
        }
      `}</style>
    </div>
  );
}

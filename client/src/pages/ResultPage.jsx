import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣'];

export default function ResultPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const rankings = state?.rankings ?? [];
  const endReason = state?.endReason;
  const myUserId = localStorage.getItem('userId');

  useEffect(() => {
    localStorage.removeItem('roomCode');
  }, []);

  const endReasonText = endReason === 'all_shops_destroyed'
    ? 'Quái thú đã phá hủy toàn bộ ngôi làng!'
    : 'Toàn bộ lương thực đã được thu thập!';

  return (
    <div style={{
      background: '#0f0f1a', minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: '#fff', padding: 24
    }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
      <h2 style={{ color: '#FFD700', marginBottom: 8 }}>Kết thúc ván đấu!</h2>
      <p style={{ color: '#888', marginBottom: 32 }}>{endReasonText}</p>

      <div style={{
        background: '#1e1e3a', borderRadius: 16,
        padding: 24, width: '100%', maxWidth: 400
      }}>
        {rankings.map((r, i) => (
          <div key={r.userId} style={{
            display: 'flex', alignItems: 'center',
            padding: '12px 0',
            borderBottom: i < rankings.length - 1 ? '1px solid #2a2a4a' : 'none',
            background: r.userId === myUserId ? 'rgba(83,74,183,0.15)' : 'transparent',
            borderRadius: 8, paddingLeft: 8
          }}>
            <span style={{ fontSize: 28, marginRight: 12 }}>
              {MEDALS[r.rank - 1] || '❓'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                {r.username}
                {r.isTied && r.rank === 1 && (
                  <span style={{
                    background: '#FFD700',
                    color: '#000',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4
                  }}>
                    HÒA
                  </span>
                )}
                {r.userId === myUserId && (
                  <span style={{ color: '#5DCAA5', fontSize: 12 }}>
                    (bạn)
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: '#888' }}>
                {r.finalFood} bao lương thực
              </div>
            </div>
            <div style={{ color: '#FFD700', fontWeight: 700 }}>
              +{r.goldReward} vàng
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate('/lobby')}
        style={{
          marginTop: 24, background: '#534AB7', color: '#fff',
          border: 'none', borderRadius: 8, padding: '12px 32px',
          fontSize: 15, fontWeight: 700, cursor: 'pointer'
        }}
      >
        Chơi lại
      </button>
    </div>
  );
}
import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket/socketClient';
import GameCanvas from '../components/GameCanvas';

export default function GamePage() {
  const [gameState, setGameState] = useState(null);
  const [myTurn, setMyTurn] = useState(false);
  const [phase, setPhase] = useState('');
  const [log, setLog] = useState([]);
  const [stackAlert, setStackAlert] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const sceneRef = useRef(null);
  const countdownRef = useRef(null);

  function addLog(msg) {
    setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20));
  }

  function startCountdown(seconds) {
    setCountdown(seconds);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function stopCountdown() {
    clearInterval(countdownRef.current);
    setCountdown(0);
  }

  // Lấy từ localStorage (đã lưu khi login/join room)
  const myUserId = localStorage.getItem('userId');
  const roomCode = localStorage.getItem('roomCode');

  useEffect(() => {
    socket.connect();

    // Nhận state game ban đầu
    socket.on('game:started', ({ state }) => {
      setGameState(state);
      addLog('Ván game bắt đầu!');
    });

    // Cập nhật state
    socket.on('game:stateUpdate', ({ state }) => {
      setGameState(state);
      const me = state.players.find(p => p.userId === myUserId);
      setMyTurn(me?.isMyTurn ?? false);
      setPhase(state.phase);
    });

    // Bắt đầu lượt
    socket.on('game:turnStarted', ({ currentPlayer, drawnCard, state }) => {
      setGameState(state);
      const isMe = currentPlayer === myUserId;
      setMyTurn(isMe);
      setPhase(state.phase);
      if (isMe) addLog('Đến lượt bạn!');
      if (drawnCard) addLog(`Rút bài: ${drawnCard.name}`);
    });

    // Xúc xắc đã đổ — highlight ô
    socket.on('game:diceRolled', ({ userId, result, paths, state }) => {
      setGameState(state);
      addLog(`${userId === myUserId ? 'Bạn' : userId} đổ được ${result}`);
      if (userId === myUserId && sceneRef.current) {
        sceneRef.current.highlightPaths(paths);
      }
    });

    // Animate di chuyển
    socket.on('game:playerMoved', async ({ userId, path, state }) => {
      if (sceneRef.current) {
        await sceneRef.current.animateMove(userId, path);
      }
      setGameState(state);
      addLog(`${userId === myUserId ? 'Bạn' : userId} di chuyển`);
    });

    // Stack window mở
    socket.on('stack:windowOpen', ({ message, windowMs }) => {
      setStackAlert(message);
      startCountdown(windowMs / 1000);
    });

    socket.on('stack:resolved', ({ message }) => {
      setStackAlert(null);
      stopCountdown();
      addLog(message);
    });

    // Combat
    socket.on('game:combatResolved', ({ results }) => {
      results.forEach(r => {
        if (r.type === 'pickup') addLog(`Nhặt được lương thực!`);
        if (r.type === 'steal') addLog(`Cướp lương thực!`);
        if (r.type === 'domino') addLog(`Hiệu ứng Domino!`);
      });
    });

    // Quái thú
    socket.on('game:monsterEvent', ({ message }) => {
      addLog(`🔴 ${message}`);
    });

    // Game kết thúc
    socket.on('game:over', ({ rankings }) => {
      const winner = rankings[0];
      addLog(`Kết thúc! ${winner.username} chiến thắng với ${winner.finalFood} bao!`);
    });

    return () => {
      socket.off('game:started');
      socket.off('game:stateUpdate');
      socket.off('game:turnStarted');
      socket.off('game:diceRolled');
      socket.off('game:playerMoved');
      socket.off('stack:windowOpen');
      socket.off('stack:resolved');
      socket.off('game:combatResolved');
      socket.off('game:monsterEvent');
      socket.off('game:over');
      socket.disconnect();
    };
  }, []);

  function handleRollDice() {
    socket.emit('game:rollDice', { roomCode, userId: myUserId });
  }

  function handleCellClick(cellId) {
    socket.emit('game:movePlayer', { roomCode, userId: myUserId, targetCellId: cellId });
  }

  function handleEndTurn() {
    socket.emit('game:turnEnd', { roomCode, userId: myUserId });
  }

  const myPlayer = gameState?.players.find(p => p.userId === myUserId);

  return (
    <div style={{ display: 'flex', gap: 16, padding: 16,
      background: '#0f0f1a', minHeight: '100vh', color: '#fff' }}>

      {/* Bàn cờ */}
      <div>
        {gameState && (
          <GameCanvas
            gameState={gameState}
            myUserId={myUserId}
            onCellClick={handleCellClick}
            sceneRef={sceneRef}
          />
        )}
      </div>

      {/* Panel bên phải */}
      <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Thông tin người chơi */}
        <div style={{ background: '#1e1e3a', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Người chơi</div>
          {gameState?.players.map(p => (
            <div key={p.userId} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '4px 0',
              color: p.userId === myUserId ? '#FFD700' : '#aaa',
              fontWeight: p.isMyTurn ? 600 : 400
            }}>
              <span>{p.isMyTurn ? '▶ ' : ''}{p.username}</span>
              <span>{p.foodCount} bao</span>
            </div>
          ))}
        </div>

        {/* Stack alert */}
        {stackAlert && (
          <div style={{ background: '#4a1b0c', border: '1px solid #D85A30',
            borderRadius: 8, padding: 12 }}>
            <div style={{ color: '#F0997B', fontWeight: 600, marginBottom: 4 }}>
              ⚡ Stack window: {countdown}s
            </div>
            <div style={{ fontSize: 13 }}>{stackAlert}</div>
          </div>
        )}

        {/* Tay bài */}
        <div style={{ background: '#1e1e3a', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            Tay bài ({myPlayer?.handCards.length ?? 0}/6)
          </div>
          {myPlayer?.handCards.map(card => (
            <div key={card.card_code} style={{
              background: card.timing === '+' ? '#085041' : '#3C3489',
              borderRadius: 6, padding: '6px 10px', marginBottom: 6,
              fontSize: 12, cursor: 'pointer'
            }}>
              <div style={{ fontWeight: 600 }}>{card.name}</div>
              <div style={{ opacity: 0.7 }}>{card.description}</div>
            </div>
          ))}
        </div>

        {/* Nút hành động */}
        {myTurn && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {phase === 'draw' && (
              <button onClick={handleRollDice} style={btnStyle('#378ADD')}>
                Đổ xúc xắc
              </button>
            )}
            {phase === 'interact' && (
              <button onClick={handleEndTurn} style={btnStyle('#1D9E75')}>
                Kết thúc lượt
              </button>
            )}
          </div>
        )}

        {/* Log */}
        <div style={{ background: '#1e1e3a', borderRadius: 8, padding: 12,
          flex: 1, overflow: 'auto', maxHeight: 200 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12 }}>Log</div>
          {log.map((entry, i) => (
            <div key={i} style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>
              {entry}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const btnStyle = (bg) => ({
  background: bg, color: '#fff', border: 'none',
  borderRadius: 8, padding: '10px 16px',
  fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%'
});

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket/socketClient';
import { SOCKET_EVENTS } from '../../../shared/constants/EVENTS';

const CHARACTERS = [
    { id: 'char_ty',   name: 'Tý',   animal: 'Chuột', timing: '+' },
    { id: 'char_suu',  name: 'Sửu',  animal: 'Trâu',  timing: '-' },
    { id: 'char_dan',  name: 'Dần',  animal: 'Hổ',    timing: '+' },
    { id: 'char_mao',  name: 'Mão',  animal: 'Mèo',   timing: '+' },
    { id: 'char_thin', name: 'Thìn', animal: 'Rồng',  timing: '+' },
    { id: 'char_ty2',  name: 'Tỵ',   animal: 'Rắn',   timing: '+' },
    { id: 'char_ngo',  name: 'Ngọ',  animal: 'Ngựa',  timing: '-' },
    { id: 'char_mui',  name: 'Mùi',  animal: 'Dê',    timing: '+' },
    { id: 'char_than', name: 'Thân', animal: 'Khỉ',   timing: '+' },
    { id: 'char_dau',  name: 'Dậu',  animal: 'Gà',    timing: '-' },
    { id: 'char_tuat', name: 'Tuất', animal: 'Chó',   timing: '-' },
    { id: 'char_hoi',  name: 'Hợi',  animal: 'Lợn',   timing: '-' },
];

export default function LobbyPage() {
    const navigate = useNavigate();
    const [room, setRoom] = useState(null);
    const [joinCode, setJoinCode] = useState('');
    const [selectedChar, setSelectedChar] = useState('char_ty');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const myUserId = localStorage.getItem('userId');
    const myUsername = localStorage.getItem('username');

    useEffect(() => {
        socket.connect();

        socket.on(SOCKET_EVENTS.ROOM_UPDATED, ({ success, room, error }) => {
            setLoading(false);
            if (!success) { setError(error); return; }
            setRoom(room);
            localStorage.setItem('roomCode', room.roomCode);
            setError('');
        });

        socket.on(SOCKET_EVENTS.GAME_STARTED, ({ state }) => {
            console.log('Received game:started, navigating...');
            localStorage.setItem('gameState', JSON.stringify(state));
            navigate('/game');
        });

        return () => {
            socket.off(SOCKET_EVENTS.ROOM_UPDATED);
            socket.off(SOCKET_EVENTS.GAME_START);
        };
    }, []);

    function handleCreate() {
        setLoading(true);
        socket.emit(SOCKET_EVENTS.CREATE_ROOM, {
        userId: myUserId,
        username: myUsername,
        characterId: selectedChar
        });
    }

    function handleJoin() {
        if (!joinCode.trim()) { setError('Nhập room code'); return; }
        setLoading(true);
        socket.emit(SOCKET_EVENTS.JOIN_ROOM, {
        roomCode: joinCode.toUpperCase(),
        userId: myUserId,
        username: myUsername,
        characterId: selectedChar
        });
    }

    function handleStartGame() {
        socket.emit(SOCKET_EVENTS.GAME_START, {
        roomCode: room.roomCode,
        players: room.players
        });
    }

    const isHost = room?.players.find(p => p.userId === myUserId)?.isHost;
    const canStart = room?.players.length >= 2;

    return (
        <div style={styles.page}>
        <h2 style={styles.title}>Cuộc Đua 12 Con Giáp</h2>

        {/* Chọn nhân vật */}
        <div style={styles.section}>
            <div style={styles.sectionTitle}>Chọn nhân vật</div>
            <div style={styles.charGrid}>
            {CHARACTERS.map(c => (
                <div
                key={c.id}
                onClick={() => setSelectedChar(c.id)}
                style={{
                    ...styles.charCard,
                    border: selectedChar === c.id
                    ? '2px solid #FFD700'
                    : '2px solid transparent',
                    background: c.timing === '+'
                    ? '#0f2e22'
                    : '#1e1040'
                }}
                >
                <div style={{ fontSize: 22 }}>
                    {c.animal === 'Chuột' ? '🐭' :
                    c.animal === 'Trâu'  ? '🐂' :
                    c.animal === 'Hổ'    ? '🐯' :
                    c.animal === 'Mèo'   ? '🐱' :
                    c.animal === 'Rồng'  ? '🐲' :
                    c.animal === 'Rắn'   ? '🐍' :
                    c.animal === 'Ngựa'  ? '🐴' :
                    c.animal === 'Dê'    ? '🐐' :
                    c.animal === 'Khỉ'   ? '🐒' :
                    c.animal === 'Gà'    ? '🐓' :
                    c.animal === 'Chó'   ? '🐕' : '🐷'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                <div style={{
                    fontSize: 10,
                    color: c.timing === '+' ? '#5DCAA5' : '#AFA9EC'
                }}>
                    {c.timing === '+' ? 'Tức thời' : 'Chủ động'}
                </div>
                </div>
            ))}
            </div>
        </div>

        {/* Tạo hoặc vào phòng */}
        {!room && (
            <div style={styles.section}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <button
                onClick={handleCreate}
                disabled={loading}
                style={styles.btnPrimary}
                >
                {loading ? 'Đang tạo...' : 'Tạo phòng mới'}
                </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Nhập room code..."
                maxLength={6}
                style={styles.input}
                />
                <button
                onClick={handleJoin}
                disabled={loading}
                style={styles.btnSecondary}
                >
                Vào phòng
                </button>
            </div>
            {error && <div style={styles.error}>{error}</div>}
            </div>
        )}

        {/* Danh sách người trong phòng */}
        {room && (
            <div style={styles.section}>
            <div style={styles.sectionTitle}>
                Phòng: <span style={{ color: '#FFD700', letterSpacing: 2 }}>
                {room.roomCode}
                </span>
            </div>
            <div style={{ marginBottom: 12 }}>
                {room.players.map((p, i) => (
                <div key={p.userId} style={styles.playerRow}>
                    <span>{p.isHost ? '👑 ' : `${i + 1}. `}</span>
                    <span style={{ fontWeight: 600 }}>{p.username}</span>
                    <span style={{ color: '#888', fontSize: 12, marginLeft: 8 }}>
                    {CHARACTERS.find(c => c.id === p.characterId)?.name}
                    </span>
                    {p.userId === myUserId && (
                    <span style={{ color: '#5DCAA5', fontSize: 12, marginLeft: 4 }}>
                        (bạn)
                    </span>
                    )}
                </div>
                ))}
                {Array.from({ length: room.maxPlayers - room.players.length }).map((_, i) => (
                <div key={i} style={{ ...styles.playerRow, color: '#444' }}>
                    Đang chờ...
                </div>
                ))}
            </div>

            {isHost && (
                <button
                onClick={handleStartGame}
                disabled={!canStart}
                style={{
                    ...styles.btnPrimary,
                    opacity: canStart ? 1 : 0.5,
                    cursor: canStart ? 'pointer' : 'not-allowed'
                }}
                >
                {canStart
                    ? 'Bắt đầu game!'
                    : `Cần ít nhất 2 người (${room.players.length}/${room.maxPlayers})`}
                </button>
            )}
            {!isHost && (
                <div style={{ color: '#888', textAlign: 'center' }}>
                Chờ host bắt đầu...
                </div>
            )}
            </div>
        )}
        </div>
    );
    }

    const styles = {
    page: {
        background: '#0f0f1a', minHeight: '100vh',
        color: '#fff', padding: '24px', maxWidth: 600,
        margin: '0 auto'
    },
    title: {
        textAlign: 'center', fontSize: 24, fontWeight: 700,
        color: '#FFD700', marginBottom: 24
    },
    section: {
        background: '#1e1e3a', borderRadius: 12,
        padding: 16, marginBottom: 16
    },
    sectionTitle: {
        fontWeight: 600, fontSize: 15, marginBottom: 12
    },
    charGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8
    },
    charCard: {
        borderRadius: 8, padding: '8px 4px',
        textAlign: 'center', cursor: 'pointer',
        transition: 'transform 0.1s'
    },
    playerRow: {
        padding: '8px 0',
        borderBottom: '1px solid #2a2a4a',
        display: 'flex', alignItems: 'center'
    },
    input: {
        flex: 1, background: '#0f0f1a', border: '1px solid #3a3a5a',
        borderRadius: 8, padding: '10px 14px', color: '#fff',
        fontSize: 16, letterSpacing: 3, fontWeight: 700
    },
    btnPrimary: {
        background: '#534AB7', color: '#fff', border: 'none',
        borderRadius: 8, padding: '12px 24px',
        fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%'
    },
    btnSecondary: {
        background: '#1D9E75', color: '#fff', border: 'none',
        borderRadius: 8, padding: '10px 20px',
        fontSize: 14, fontWeight: 600, cursor: 'pointer'
    },
    error: {
        color: '#F0997B', fontSize: 13, marginTop: 8
    }
};

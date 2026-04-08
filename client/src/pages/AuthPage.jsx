import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export default function AuthPage() {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [form, setForm] = useState({ username: '', email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit() {
        setLoading(true);
        setError('');
        try {
        const url = isLogin
            ? `${API}/api/auth/login`
            : `${API}/api/auth/register`;

        const payload = isLogin
            ? { email: form.email, password: form.password }
            : { username: form.username, email: form.email, password: form.password };

        const { data } = await axios.post(url, payload);

        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', data.user._id);
        localStorage.setItem('username', data.user.username);

        navigate('/lobby');
        } catch (err) {
        setError(err.response?.data?.error ?? 'Có lỗi xảy ra');
        } finally {
        setLoading(false);
        }
    }

    return (
        <div style={{
        background: '#0f0f1a', minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff'
        }}>
        <div style={{
            background: '#1e1e3a', borderRadius: 16,
            padding: 32, width: 360
        }}>
            <h2 style={{ textAlign: 'center', color: '#FFD700', marginBottom: 24 }}>
            {isLogin ? 'Đăng nhập' : 'Đăng ký'}
            </h2>

            {!isLogin && (
            <input
                placeholder="Username"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                style={inputStyle}
            />
            )}
            <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            style={inputStyle}
            />
            <input
            placeholder="Mật khẩu"
            type="password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={inputStyle}
            />

            {error && (
            <div style={{ color: '#F0997B', fontSize: 13, marginBottom: 12 }}>
                {error}
            </div>
            )}

            <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
                width: '100%', background: '#534AB7', color: '#fff',
                border: 'none', borderRadius: 8, padding: 12,
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                opacity: loading ? 0.7 : 1
            }}
            >
            {loading ? 'Đang xử lý...' : (isLogin ? 'Đăng nhập' : 'Đăng ký')}
            </button>

            <div
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            style={{
                textAlign: 'center', marginTop: 16,
                color: '#7F77DD', cursor: 'pointer', fontSize: 14
            }}
            >
            {isLogin ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
            </div>
        </div>
        </div>
    );
}

const inputStyle = {
    width: '100%', background: '#0f0f1a',
    border: '1px solid #3a3a5a', borderRadius: 8,
    padding: '10px 14px', color: '#fff', fontSize: 14,
    marginBottom: 12, boxSizing: 'border-box'
};

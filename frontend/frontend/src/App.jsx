import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import { useAuth } from './context/AuthContext';
import api from './utils/api';
import Dashboard from './pages/Dashboard';
import TripDetailPage from './pages/TripDetailPage';
import { useTheme } from './context/ThemeContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="page">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const AuthPage = () => {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [message, setMessage] = useState('');
  const { theme, toggleTheme } = useTheme();

  if (user) return <Navigate to="/dashboard" replace />;

  const onChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        setMessage('Logged in');
      } else {
        await register(form.email, form.password, form.name);
        setMessage('Registered and logged in');
      }
    } catch (err) {
      setMessage(err.response?.data?.error || 'Auth failed');
    }
  };

  const handleHealth = async () => {
    try {
      const { data } = await api.get('/health');
      setMessage(`Health: ${data.status} - ${data.message}`);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Health check failed');
    }
  };

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>TripBoard</h1>
          <p className="subtitle">Collaborative trip planner</p>
        </div>
        <div className="flex gap-2">
          <button className="ghost" onClick={toggleTheme}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button className="ghost" onClick={handleHealth}>
            Ping API
          </button>
        </div>
      </header>

      {message && <div className="message">{message}</div>}

      <section className="panel">
        <div className="panel-header">
          <h2>{mode === 'login' ? 'Login' : 'Register'}</h2>
          <button
            className="link"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setMessage('');
            }}
          >
            {mode === 'login' ? 'Need an account? Register' : 'Have an account? Login'}
          </button>
        </div>
        <form className="form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label>
              Name
              <input name="name" value={form.name} onChange={onChange} required />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" value={form.email} onChange={onChange} required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              required
              minLength={6}
            />
          </label>
          <button type="submit">{mode === 'login' ? 'Login' : 'Register'}</button>
        </form>
      </section>
    </div>
  );
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trips/:id"
        element={
          <ProtectedRoute>
            <TripDetailPage />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;

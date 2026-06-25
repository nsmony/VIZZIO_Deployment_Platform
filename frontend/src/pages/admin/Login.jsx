import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../api';
import '../../styles/Login.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const result = await login(username, password);
    setLoading(false);
    if (result.token) {
      localStorage.setItem('vizzio_token', result.token);
      localStorage.setItem('vizzio_username', result.user?.username || username);
      if (result.user?.role && result.user.role.toLowerCase() !== 'admin') {
        localStorage.setItem('vizzio_role', result.user.role);
        navigate('/user');
      } else {
        localStorage.setItem('vizzio_role', result.user?.role || 'admin');
        navigate('/dashboard');
      }
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-box">
          <div className="login-header">
            <h1>VIZZIO</h1>
            <p>Deployment Platform</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                maxLength={50}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                maxLength={128}
                required
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>
          <div className="login-footer">
            <p>Demo credentials:</p>
            <p>Admin — admin / password</p>
            <p>User — user / password</p>
          </div>
        </div>
      </div>
    </div>
  );
}


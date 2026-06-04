import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/Login.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!username || !password) {
      setError('Enter both username and password');
      return;
    }

    localStorage.setItem('vizzio_token', 'demo-token');
    navigate('/dashboard');
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>VIZZIO Login</h1>
        <form onSubmit={handleSubmit}>
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="primary-btn">Sign In</button>
        </form>
      </section>
    </main>
  );
}

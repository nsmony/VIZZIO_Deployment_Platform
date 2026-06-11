import { useEffect, useState } from 'react';
import { verifyInviteToken, completeInvite } from '../api';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function InviteConfirm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [email, setEmail] = useState(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) return setError('Missing token');
    verifyInviteToken(token)
      .then((data) => {
        if (data?.error) setError(data.error);
        else setEmail(data.email);
      })
      .catch((e) => setError(e.message || 'Verification failed'));
  }, [token]);

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Invite problem</h2>
        <p>{error}</p>
        <p>Please ask the admin to resend the invite.</p>
      </main>
    );
  }

  if (!email) return <div>Checking invite...</div>;

  return (
    <main style={{ padding: 24 }}>
      <h2>Join VIZZIO</h2>
      <p>Setting up an account for: <strong>{email}</strong></p>
      <div style={{ maxWidth: 420 }}>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div style={{ marginTop: 12 }}>
          <button
            onClick={async () => {
              try {
                await completeInvite(token, name, password);
                alert('Account created. You may now log in.');
                navigate('/admin/login');
              } catch (err) {
                setError(err.message || 'Failed to complete registration');
              }
            }}
          >
            Create account
          </button>
        </div>
      </div>
    </main>
  );
}

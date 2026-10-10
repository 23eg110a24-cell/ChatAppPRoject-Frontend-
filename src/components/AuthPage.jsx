import { useState } from 'react';
import { api } from '../api';

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    usernameOrEmail: '',
    username: '',
    email: '',
    displayName: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isLogin = mode === 'login';
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = isLogin
        ? await api.login(form.usernameOrEmail.trim(), form.password)
        : await api.register(form.username.trim(), form.email.trim(), form.password, form.displayName.trim());
      onAuth(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError('');
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <h1>{isLogin ? 'Welcome back' : 'Create account'}</h1>
        <p className="muted">
          {isLogin ? 'Enter your credentials to access your chats.' : 'Pick a username to start chatting.'}
        </p>

        <div className="tabs">
          <button type="button" className={isLogin ? 'tab tab-on' : 'tab'} onClick={() => switchMode('login')}>
            Sign in
          </button>
          <button type="button" className={!isLogin ? 'tab tab-on' : 'tab'} onClick={() => switchMode('register')}>
            Register
          </button>
        </div>

        {isLogin ? (
          <label>
            Username or email
            <input
              value={form.usernameOrEmail}
              onChange={set('usernameOrEmail')}
              placeholder="ada or ada@example.com"
              autoComplete="username"
              required
            />
          </label>
        ) : (
          <>
            <label>
              Username
              <input
                value={form.username}
                onChange={set('username')}
                placeholder="ada"
                autoComplete="username"
                minLength={3}
                maxLength={32}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="ada@example.com"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Display name (optional)
              <input
                value={form.displayName}
                onChange={set('displayName')}
                placeholder="Ada Lovelace"
                maxLength={60}
              />
            </label>
          </>
        )}

        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            placeholder="At least 8 characters"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            minLength={isLogin ? undefined : 8}
            maxLength={72}
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Please wait...' : isLogin ? 'Sign in' : 'Create account'}
        </button>

        <p className="muted center">
          {isLogin ? 'No account yet? ' : 'Already registered? '}
          <button type="button" className="link" onClick={() => switchMode(isLogin ? 'register' : 'login')}>
            {isLogin ? 'Register' : 'Sign in'}
          </button>
        </p>
      </form>
    </div>
  );
}

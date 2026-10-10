import { useCallback, useEffect, useState } from 'react';
import { api, getToken, onUnauthorized, setToken } from './api';
import AuthPage from './components/AuthPage';
import Chat from './components/Chat';

export default function App() {
  const [me, setMe] = useState(null);
  const [checking, setChecking] = useState(() => Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setMe(null);
  }, []);

  // Any 401 from the API (expired or revoked token) drops back to the login page.
  useEffect(() => {
    onUnauthorized(logout);
  }, [logout]);

  // Restore the session after a reload.
  useEffect(() => {
    if (!getToken()) return undefined;
    let cancelled = false;
    api
      .me()
      .then((user) => {
        if (!cancelled) setMe(user);
      })
      .catch((err) => {
        if (!cancelled && err.status === 401) setToken(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleAuth(response) {
    setToken(response.token);
    setMe(response.user);
  }

  if (checking) {
    return (
      <div className="auth-wrap">
        <p className="muted">Loading...</p>
      </div>
    );
  }
  return me ? <Chat me={me} onLogout={logout} /> : <AuthPage onAuth={handleAuth} />;
}

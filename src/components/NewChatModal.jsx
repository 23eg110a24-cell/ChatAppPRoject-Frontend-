import { useEffect, useState } from 'react';
import Avatar from './Avatar';
import { api } from '../api';

function PeopleTab({ online, onOpenDirect }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await api.users(query.trim());
        if (!cancelled) {
          setUsers(result);
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <>
      <input
        className="search"
        placeholder="Search people"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoFocus
      />
      {error && <p className="error">{error}</p>}
      <div className="list">
        {users.map((user) => {
          const isOnline = online.has(user.id);
          return (
            <button type="button" key={user.id} className="list-row" onClick={() => onOpenDirect(user.id)}>
              <Avatar initials={user.initials} online={isOnline} size={30} />
              <span className="list-name">
                {user.displayName || user.username} <span className="muted">@{user.username}</span>
              </span>
              <span className="muted small">{isOnline ? 'Online' : 'Offline'}</span>
            </button>
          );
        })}
        {users.length === 0 && !error && <p className="muted pad">No people found.</p>}
      </div>
    </>
  );
}

function ChannelsTab({ myRoomIds, onOpenRoom }) {
  const [query, setQuery] = useState('');
  const [channels, setChannels] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await api.channels(query.trim());
        if (!cancelled) setChannels(result);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, reload]);

  async function create(event) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      const room = await api.createChannel(name.trim(), null);
      setName('');
      setError('');
      onOpenRoom(room);
    } catch (err) {
      setError(err.message);
    }
  }

  async function join(channel) {
    try {
      const room = myRoomIds.has(channel.id) ? channel : await api.joinChannel(channel.id);
      setReload(reload + 1);
      onOpenRoom(room);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <form className="inline-form" onSubmit={create}>
        <input
          className="search"
          placeholder="New channel name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
        />
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
          Create
        </button>
      </form>
      <input
        className="search"
        placeholder="Search channels"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {error && <p className="error">{error}</p>}
      <div className="list">
        {channels.map((channel) => (
          <button type="button" key={channel.id} className="list-row" onClick={() => join(channel)}>
            <Avatar initials={channel.name.slice(0, 2).toUpperCase()} size={30} />
            <span className="list-name">
              # {channel.name} <span className="muted">{channel.members.length} members</span>
            </span>
            <span className="muted small">{myRoomIds.has(channel.id) ? 'Open' : 'Join'}</span>
          </button>
        ))}
        {channels.length === 0 && !error && <p className="muted pad">No channels found.</p>}
      </div>
    </>
  );
}

export default function NewChatModal({ online, myRoomIds, onClose, onOpenDirect, onOpenRoom }) {
  const [tab, setTab] = useState('people');

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>New chat</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="tabs">
          <button type="button" className={tab === 'people' ? 'tab tab-on' : 'tab'} onClick={() => setTab('people')}>
            People
          </button>
          <button
            type="button"
            className={tab === 'channels' ? 'tab tab-on' : 'tab'}
            onClick={() => setTab('channels')}
          >
            Channels
          </button>
        </div>
        {tab === 'people' ? (
          <PeopleTab online={online} onOpenDirect={onOpenDirect} />
        ) : (
          <ChannelsTab myRoomIds={myRoomIds} onOpenRoom={onOpenRoom} />
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import Avatar from './Avatar';
import { formatRowTime, isChannel, partnerOf, roomInitials, roomTitle } from '../utils';

function RoomRow({ room, active, online, onSelect }) {
  const partner = partnerOf(room);
  const status = isChannel(room) ? undefined : partner ? online.has(partner.id) : false;
  return (
    <button type="button" className={active ? 'row row-on' : 'row'} onClick={() => onSelect(room.id)}>
      <Avatar initials={roomInitials(room)} online={status} />
      <span className="row-body">
        <span className="row-top">
          <span className="row-title">{roomTitle(room)}</span>
          <span className="row-time">{formatRowTime(room.lastMessageAt)}</span>
        </span>
        <span className="row-preview">{room.lastMessagePreview || 'No messages yet'}</span>
      </span>
    </button>
  );
}

export default function Sidebar({ me, rooms, activeId, online, onSelect, onNewChat, onLogout }) {
  const [query, setQuery] = useState('');

  const term = query.trim().toLowerCase();
  const visible = term ? rooms.filter((room) => roomTitle(room).toLowerCase().includes(term)) : rooms;
  const channels = visible.filter(isChannel);
  const directs = visible.filter((room) => !isChannel(room));

  return (
    <aside className="sidebar">
      <div className="me">
        <Avatar initials={me.initials} online={true} />
        <span className="me-text">
          <span className="me-name">{me.displayName || me.username}</span>
          <span className="muted small">@{me.username}</span>
        </span>
        <button type="button" className="btn btn-ghost" onClick={onLogout}>
          Sign out
        </button>
      </div>

      <div className="search-row">
        <input
          className="search"
          placeholder="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="button" className="btn btn-primary" onClick={onNewChat}>
          New chat
        </button>
      </div>

      <div className="rooms">
        {channels.length > 0 && <h2 className="section">Channels</h2>}
        {channels.map((room) => (
          <RoomRow key={room.id} room={room} active={room.id === activeId} online={online} onSelect={onSelect} />
        ))}

        {directs.length > 0 && <h2 className="section">Direct messages</h2>}
        {directs.map((room) => (
          <RoomRow key={room.id} room={room} active={room.id === activeId} online={online} onSelect={onSelect} />
        ))}

        {visible.length === 0 && (
          <p className="muted pad">{term ? 'No matches.' : 'No conversations yet. Press "New chat" to start one.'}</p>
        )}
      </div>
    </aside>
  );
}

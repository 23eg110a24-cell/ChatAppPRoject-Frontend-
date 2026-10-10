import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import { formatTime, isChannel, partnerOf, roomInitials, roomTitle } from '../utils';

function subtitleFor(room, online) {
  if (isChannel(room)) {
    const onlineCount = room.members.filter((member) => online.has(member.id)).length;
    return `${room.members.length} members · ${onlineCount} online`;
  }
  const partner = partnerOf(room);
  return partner && online.has(partner.id) ? 'Online' : 'Offline';
}

function typingText(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing...`;
  return `${names.join(', ')} are typing...`;
}

// Rendered with key={room.id} by the parent, so all local state resets when switching rooms.
export default function ChatPane({
  room,
  me,
  entry,
  online,
  typingNames,
  connected,
  onSend,
  onTyping,
  onLoadOlder,
  onBack,
}) {
  const [text, setText] = useState('');
  const listRef = useRef(null);
  const stickToBottom = useRef(true);
  const scrollAnchor = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);

  const items = entry ? entry.items : [];
  const partner = partnerOf(room);
  const status = isChannel(room) ? undefined : partner ? online.has(partner.id) : false;

  // Keep the view pinned to the newest message, or hold position after loading older ones.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (scrollAnchor.current !== null) {
      el.scrollTop = el.scrollHeight - scrollAnchor.current;
      scrollAnchor.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [items.length]);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  function handleScroll() {
    const el = listRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function loadOlder() {
    const el = listRef.current;
    scrollAnchor.current = el.scrollHeight - el.scrollTop;
    const added = await onLoadOlder();
    if (!added) scrollAnchor.current = null;
  }

  function handleChange(event) {
    const value = event.target.value;
    setText(value);
    const now = Date.now();
    if (value && now - lastTypingSent.current > 2500) {
      lastTypingSent.current = now;
      onTyping(true);
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      lastTypingSent.current = 0;
      onTyping(false);
    }, 3000);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const content = text.trim();
    if (!content) return;
    clearTimeout(typingTimer.current);
    lastTypingSent.current = 0;
    onTyping(false);
    stickToBottom.current = true;
    setText('');
    onSend(content);
  }

  return (
    <section className="chat">
      <header className="chat-head">
        <button type="button" className="btn btn-ghost back" onClick={onBack}>
          Back
        </button>
        <Avatar initials={roomInitials(room)} online={status} />
        <span className="chat-head-text">
          <span className="chat-title">{roomTitle(room)}</span>
          <span className="muted small">
            {subtitleFor(room, online)}
            {!connected && ' · reconnecting...'}
          </span>
        </span>
      </header>

      <div className="messages" ref={listRef} onScroll={handleScroll}>
        {entry && entry.hasMore && (
          <button type="button" className="btn btn-ghost load-older" onClick={loadOlder}>
            Load older messages
          </button>
        )}
        {!entry || !entry.loaded ? (
          <p className="muted center">Loading...</p>
        ) : items.length === 0 ? (
          <p className="muted center">No messages yet. Say hello.</p>
        ) : null}

        {items.map((message, index) => {
          if (message.type === 'SYSTEM' || !message.sender) {
            return (
              <div key={message.id} className="system">
                {message.content}
              </div>
            );
          }
          const mine = message.sender.id === me.id;
          const previous = items[index - 1];
          const showName =
            isChannel(room) && !mine && (!previous || !previous.sender || previous.sender.id !== message.sender.id);
          return (
            <div key={message.id} className={mine ? 'msg msg-me' : 'msg'}>
              {showName && <span className="msg-name">{message.sender.displayName || message.sender.username}</span>}
              <div className="bubble">{message.content}</div>
              <span className="msg-time">{formatTime(message.createdAt)}</span>
            </div>
          );
        })}
      </div>

      <div className="typing">{typingText(typingNames)}</div>

      <form className="composer" onSubmit={handleSubmit}>
        <input
          value={text}
          onChange={handleChange}
          placeholder="Write a message"
          maxLength={4000}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}

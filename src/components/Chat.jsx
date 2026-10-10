import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken } from '../api';
import { connectSocket } from '../socket';
import { sortRooms } from '../utils';
import Sidebar from './Sidebar';
import ChatPane from './ChatPane';
import NewChatModal from './NewChatModal';

const PAGE_SIZE = 50;
const TYPING_TTL_MS = 4000;
const ROOM_POLL_MS = 10000;

export default function Chat({ me, onLogout }) {
  const [rooms, setRooms] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState({}); // roomId -> { items, loaded, hasMore }
  const [online, setOnline] = useState(() => new Set());
  const [typing, setTyping] = useState({}); // roomId -> { userId: displayName }
  const [showNew, setShowNew] = useState(false);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState('');

  const clientRef = useRef(null);
  const subsRef = useRef(new Map()); // roomId -> [messageSub, typingSub]
  const typingTimers = useRef(new Map());
  const noticeTimer = useRef(null);
  const messagesRef = useRef({});
  const autoSelected = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  });

  const showNotice = useCallback((text) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 5000);
  }, []);

  // ---- rooms -------------------------------------------------------------------------------

  const loadRooms = useCallback(async () => {
    try {
      setRooms(sortRooms(await api.rooms()));
    } catch (err) {
      if (err.status !== 401) showNotice(err.message);
    }
  }, [showNotice]);

  useEffect(() => {
    loadRooms();
    // The backend does not push "you were added to a room", so pick those up by polling.
    const timer = setInterval(loadRooms, ROOM_POLL_MS);
    return () => clearInterval(timer);
  }, [loadRooms]);

  const upsertRoom = useCallback((room) => {
    setRooms((previous) => {
      const existing = previous.find((r) => r.id === room.id);
      const merged = existing
        ? { ...room, lastMessagePreview: room.lastMessagePreview ?? existing.lastMessagePreview }
        : room;
      return sortRooms([...previous.filter((r) => r.id !== room.id), merged]);
    });
  }, []);

  // ---- messages ----------------------------------------------------------------------------

  const loadHistory = useCallback(
    async (roomId, before) => {
      setMessages((previous) =>
        previous[roomId] ? previous : { ...previous, [roomId]: { items: [], loaded: false, hasMore: false } },
      );
      try {
        const page = await api.history(roomId, before, PAGE_SIZE);
        const known = new Set((messagesRef.current[roomId]?.items || []).map((m) => m.id));
        const added = page.filter((m) => !known.has(m.id)).length;

        setMessages((previous) => {
          const current = previous[roomId] || { items: [], loaded: false, hasMore: false };
          const byId = new Map(current.items.map((m) => [m.id, m]));
          page.forEach((m) => byId.set(m.id, m));
          const items = [...byId.values()].sort((a, b) => a.id - b.id);
          const hasMore = before
            ? page.length === PAGE_SIZE
            : current.loaded
              ? current.hasMore
              : page.length === PAGE_SIZE;
          return { ...previous, [roomId]: { items, loaded: true, hasMore } };
        });
        return added;
      } catch (err) {
        showNotice(err.message);
        return 0;
      }
    },
    [showNotice],
  );

  const selectRoom = useCallback(
    (roomId) => {
      setActiveId(roomId);
      if (!messagesRef.current[roomId]?.loaded) loadHistory(roomId);
    },
    [loadHistory],
  );

  const loadOlder = useCallback(() => {
    const entry = messagesRef.current[activeId];
    if (!entry || entry.items.length === 0) return Promise.resolve(0);
    return loadHistory(activeId, entry.items[0].id);
  }, [activeId, loadHistory]);

  // On a wide screen open the first conversation automatically.
  useEffect(() => {
    if (autoSelected.current || activeId !== null || rooms.length === 0) return;
    autoSelected.current = true;
    if (window.matchMedia('(min-width: 701px)').matches) selectRoom(rooms[0].id);
  }, [rooms, activeId, selectRoom]);

  // ---- typing indicators -------------------------------------------------------------------

  const removeTyping = useCallback((roomId, userId) => {
    const key = `${roomId}:${userId}`;
    clearTimeout(typingTimers.current.get(key));
    typingTimers.current.delete(key);
    setTyping((previous) => {
      const forRoom = previous[roomId];
      if (!forRoom || !(userId in forRoom)) return previous;
      const rest = { ...forRoom };
      delete rest[userId];
      return { ...previous, [roomId]: rest };
    });
  }, []);

  const handleTypingEvent = useCallback(
    (event) => {
      if (event.userId === me.id) return;
      if (!event.typing) {
        removeTyping(event.roomId, event.userId);
        return;
      }
      setTyping((previous) => ({
        ...previous,
        [event.roomId]: { ...(previous[event.roomId] || {}), [event.userId]: event.displayName },
      }));
      const key = `${event.roomId}:${event.userId}`;
      clearTimeout(typingTimers.current.get(key));
      typingTimers.current.set(
        key,
        setTimeout(() => removeTyping(event.roomId, event.userId), TYPING_TTL_MS),
      );
    },
    [me.id, removeTyping],
  );

  const handleMessageEvent = useCallback(
    (message) => {
      setMessages((previous) => {
        const current = previous[message.roomId];
        if (!current || current.items.some((m) => m.id === message.id)) return previous;
        return { ...previous, [message.roomId]: { ...current, items: [...current.items, message] } };
      });
      setRooms((previous) =>
        sortRooms(
          previous.map((room) =>
            room.id === message.roomId
              ? { ...room, lastMessageAt: message.createdAt, lastMessagePreview: message.content }
              : room,
          ),
        ),
      );
      if (message.sender) removeTyping(message.roomId, message.sender.id);
    },
    [removeTyping],
  );

  // ---- websocket ---------------------------------------------------------------------------

  const loadPresence = useCallback(async () => {
    try {
      setOnline(new Set(await api.presence()));
    } catch {
      // presence is cosmetic; ignore failures
    }
  }, []);

  useEffect(() => {
    let active = true;
    const subs = subsRef.current;

    const client = connectSocket({
      token: getToken(),
      onConnect: () => {
        if (!active) return;
        setConnected(true);
        client.subscribe('/topic/presence', (frame) => {
          const event = JSON.parse(frame.body);
          setOnline((previous) => {
            const next = new Set(previous);
            if (event.online) next.add(event.userId);
            else next.delete(event.userId);
            return next;
          });
        });
        client.subscribe('/user/queue/errors', (frame) => showNotice(frame.body));
        loadPresence();
      },
      onDisconnect: () => {
        if (!active) return;
        subs.clear(); // subscriptions die with the connection; the rooms effect re-creates them
        setConnected(false);
      },
      onError: (text) => {
        if (active) showNotice(text);
      },
    });
    clientRef.current = client;

    return () => {
      active = false;
      subs.clear();
      clientRef.current = null;
      client.deactivate();
    };
  }, [loadPresence, showNotice]);

  // Keep one message topic and one typing topic subscribed per room.
  useEffect(() => {
    const client = clientRef.current;
    if (!connected || !client) return;
    const subs = subsRef.current;
    const wanted = new Set(rooms.map((room) => room.id));

    rooms.forEach((room) => {
      if (subs.has(room.id)) return;
      const messageSub = client.subscribe(`/topic/rooms/${room.id}`, (frame) =>
        handleMessageEvent(JSON.parse(frame.body)),
      );
      const typingSub = client.subscribe(`/topic/rooms/${room.id}/typing`, (frame) =>
        handleTypingEvent(JSON.parse(frame.body)),
      );
      subs.set(room.id, [messageSub, typingSub]);
    });

    subs.forEach((pair, roomId) => {
      if (wanted.has(roomId)) return;
      pair.forEach((sub) => sub.unsubscribe());
      subs.delete(roomId);
    });
  }, [connected, rooms, handleMessageEvent, handleTypingEvent]);

  // After a reconnect, fetch whatever was missed in the open conversation.
  useEffect(() => {
    if (connected && activeId !== null) loadHistory(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  useEffect(() => {
    const timers = typingTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      clearTimeout(noticeTimer.current);
    };
  }, []);

  // ---- actions -----------------------------------------------------------------------------

  const sendMessage = useCallback(
    async (content) => {
      const client = clientRef.current;
      if (client && client.connected) {
        client.publish({ destination: `/app/rooms/${activeId}/send`, body: JSON.stringify({ content }) });
        return;
      }
      try {
        handleMessageEvent(await api.sendMessage(activeId, content));
      } catch (err) {
        showNotice(err.message);
      }
    },
    [activeId, handleMessageEvent, showNotice],
  );

  const sendTyping = useCallback(
    (isTyping) => {
      const client = clientRef.current;
      if (client && client.connected && activeId !== null) {
        client.publish({
          destination: `/app/rooms/${activeId}/typing`,
          body: JSON.stringify({ typing: isTyping }),
        });
      }
    },
    [activeId],
  );

  const openDirect = useCallback(
    async (userId) => {
      try {
        const room = await api.openDirect(userId);
        upsertRoom(room);
        selectRoom(room.id);
        setShowNew(false);
        loadRooms(); // pull the real last-message preview for an existing conversation
      } catch (err) {
        showNotice(err.message);
      }
    },
    [upsertRoom, selectRoom, loadRooms, showNotice],
  );

  const openRoom = useCallback(
    (room) => {
      upsertRoom(room);
      selectRoom(room.id);
      setShowNew(false);
      loadRooms();
    },
    [upsertRoom, selectRoom, loadRooms],
  );

  // ---- render ------------------------------------------------------------------------------

  const myRoomIds = useMemo(() => new Set(rooms.map((room) => room.id)), [rooms]);
  const activeRoom = rooms.find((room) => room.id === activeId) || null;
  const typingNames = activeRoom ? Object.values(typing[activeRoom.id] || {}) : [];

  return (
    <div className={activeRoom ? 'app has-room' : 'app'}>
      <Sidebar
        me={me}
        rooms={rooms}
        activeId={activeId}
        online={online}
        onSelect={selectRoom}
        onNewChat={() => setShowNew(true)}
        onLogout={onLogout}
      />

      {activeRoom ? (
        <ChatPane
          key={activeRoom.id}
          room={activeRoom}
          me={me}
          entry={messages[activeRoom.id]}
          online={online}
          typingNames={typingNames}
          connected={connected}
          onSend={sendMessage}
          onTyping={sendTyping}
          onLoadOlder={loadOlder}
          onBack={() => setActiveId(null)}
        />
      ) : (
        <section className="chat chat-empty">
          <p className="muted">Select a conversation, or press "New chat" to start one.</p>
        </section>
      )}

      {showNew && (
        <NewChatModal
          online={online}
          myRoomIds={myRoomIds}
          onClose={() => setShowNew(false)}
          onOpenDirect={openDirect}
          onOpenRoom={openRoom}
        />
      )}

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}

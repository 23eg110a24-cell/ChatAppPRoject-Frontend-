import { Client } from '@stomp/stompjs';
import { WS_URL } from './api';

// Opens a STOMP connection authenticated with the same bearer token as the REST API.
// Reconnects automatically; the caller must re-subscribe inside onConnect.
export function connectSocket({ token, onConnect, onDisconnect, onError }) {
  const client = new Client({
    brokerURL: WS_URL,
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => onConnect && onConnect(),
    onWebSocketClose: () => onDisconnect && onDisconnect(),
    onStompError: (frame) => onError && onError(frame.headers['message'] || 'Connection error'),
  });
  client.activate();
  return client;
}

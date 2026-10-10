// Backend timestamps carry microseconds ("...20.797713Z"); trim to milliseconds so every
// browser parses them.
function parse(iso) {
  if (!iso) return null;
  const date = new Date(String(iso).replace(/(\.\d{3})\d+/, '$1'));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTime(iso) {
  const date = parse(iso);
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Time for today, short date for anything older (sidebar rows).
export function formatRowTime(iso) {
  const date = parse(iso);
  if (!date) return '';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function activityTime(room) {
  const date = parse(room.lastMessageAt) || parse(room.createdAt);
  return date ? date.getTime() : 0;
}

export function sortRooms(rooms) {
  return [...rooms].sort((a, b) => activityTime(b) - activityTime(a));
}

export function isChannel(room) {
  return room.type === 'CHANNEL';
}

export function partnerOf(room) {
  if (isChannel(room) || room.partnerId == null) return null;
  return room.members.find((member) => member.id === room.partnerId) || null;
}

export function roomTitle(room) {
  if (isChannel(room)) return `# ${room.name}`;
  const partner = partnerOf(room);
  return partner ? partner.displayName || partner.username : 'Direct message';
}

export function roomInitials(room) {
  if (isChannel(room)) return room.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '#';
  const partner = partnerOf(room);
  return partner ? partner.initials : '??';
}

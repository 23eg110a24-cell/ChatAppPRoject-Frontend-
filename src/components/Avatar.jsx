// Dark circle with initials. `online` is true/false for people and undefined for channels
// (no status dot).
export default function Avatar({ initials, online, size = 36 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.31) }}>
      {initials}
      {online !== undefined && <span className={`dot ${online ? 'dot-on' : 'dot-off'}`} />}
    </span>
  );
}

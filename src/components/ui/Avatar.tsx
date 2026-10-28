/** A player's Google picture, or their initial when there isn't one (or it fails to load). */
export default function Avatar({ name, photoURL, size = 32 }: { name: string; photoURL?: string; size?: number }) {
  if (photoURL) {
    return (
      <img className="avatar" src={photoURL} alt="" width={size} height={size} referrerPolicy="no-referrer"
        onError={(e) => { e.currentTarget.style.display = 'none'; }} />
    );
  }
  return (
    <span className="avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden>
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

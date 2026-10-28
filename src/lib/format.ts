/** Display helpers. Nothing here touches React or the backend. */

export const money = (n: number | null | undefined): string =>
  n === null || n === undefined ? '$—' : `$${Math.round(n).toLocaleString()}`;

export function timeAgo(at: number | Date, now = Date.now()): string {
  const ms = now - (at instanceof Date ? at.getTime() : at);
  const s = Math.floor(ms / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}

export const clockTime = (at: number | Date): string =>
  new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const shortDate = (at: Date): string => at.toLocaleDateString();

/** "Alex" from "Alex Kim" — enough to tell players apart without eating the whole row. */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] || name;

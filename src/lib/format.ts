/** Display helpers. Nothing here touches React or the backend. */
import { langTag, t } from '../i18n';

export const money = (n: number | null | undefined): string =>
  n === null || n === undefined ? '$—' : `$${Math.round(n).toLocaleString()}`;

export function timeAgo(at: number | Date, now = Date.now()): string {
  const ms = now - (at instanceof Date ? at.getTime() : at);
  const s = Math.floor(ms / 1000);
  if (s < 10) return t.time.justNow;
  if (s < 60) return t.time.seconds(s);
  if (s < 3600) return t.time.minutes(Math.floor(s / 60));
  if (s < 86_400) return t.time.hours(Math.floor(s / 3600));
  return t.time.days(Math.floor(s / 86_400));
}

export const clockTime = (at: number | Date): string =>
  new Date(at).toLocaleTimeString(langTag, { hour: '2-digit', minute: '2-digit' });

export const shortDate = (at: Date): string => at.toLocaleDateString(langTag);

/** "Alex" from "Alex Kim" — enough to tell players apart without eating the whole row. */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] || name;

/** How many can play a game, for its card and its lobby: "1–6 players", "4 players". */
export function playersLabel(game: { minPlayers: number; maxPlayers: number; solo: boolean }): string {
  return game.minPlayers === game.maxPlayers
    ? t.common.players(game.maxPlayers)
    : t.common.playersRange(game.solo ? 1 : game.minPlayers, game.maxPlayers);
}

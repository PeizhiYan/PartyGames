// App-level errors, so the UI never depends on a backend's error codes.
import { GameRuleError } from '../types';
import { t } from '../i18n';

export class NotSignedInError extends Error {
  constructor() { super(t.errors.notSignedIn); }
}
export class PermissionDeniedError extends Error {
  constructor(message = t.errors.permission) { super(message); }
}
export class OfflineError extends Error {
  constructor() { super(t.errors.offline); }
}
export class NotFoundError extends Error {
  constructor(message = t.errors.roomGone) { super(message); }
}
export class BackendError extends Error {
  constructor(message: string, readonly cause?: unknown) { super(message); }
}

/** A message to show the user. Game rule errors are already written for players. */
export function errorMessage(e: unknown): string {
  if (e instanceof GameRuleError) return e.message;
  return e instanceof Error ? e.message : String(e);
}

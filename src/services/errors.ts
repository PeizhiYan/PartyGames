// App-level errors, so the UI never depends on a backend's error codes.
import { GameRuleError } from '../domain/types';

export class NotSignedInError extends Error {
  constructor() { super('You are not signed in.'); }
}
export class PermissionDeniedError extends Error {
  constructor(message = 'You do not have permission to do that.') { super(message); }
}
export class OfflineError extends Error {
  constructor() { super('This needs an internet connection.'); }
}
export class NotFoundError extends Error {
  constructor(message = 'That room is gone.') { super(message); }
}
export class BackendError extends Error {
  constructor(message: string, readonly cause?: unknown) { super(message); }
}

/** A message to show the user. Game rule errors are already written for players. */
export function errorMessage(e: unknown): string {
  if (e instanceof GameRuleError) return e.message;
  return e instanceof Error ? e.message : String(e);
}

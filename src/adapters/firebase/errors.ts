import { FirebaseError } from 'firebase/app';
import { GameRuleError } from '../../domain/types';
import { BackendError, NotFoundError, PermissionDeniedError } from '../../services/errors';

/** Translate Firebase errors into app-level errors. Game rule errors pass straight through. */
export function mapError(e: unknown): Error {
  if (e instanceof GameRuleError || e instanceof NotFoundError) return e;
  if (e instanceof FirebaseError) {
    if (e.code === 'permission-denied') return new PermissionDeniedError();
    if (e.code === 'not-found') return new NotFoundError();
    return new BackendError(e.message, e);
  }
  return e instanceof Error ? e : new BackendError(String(e), e);
}

export async function wrap<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw mapError(e);
  }
}

import type { Backend } from '../../services/types';
import { initFirebase } from './app';
import { createAccountRepo, createAdminRepo } from './admin';
import { createAuthService } from './auth';
import { createRoomRepo } from './rooms';
import { createHanoiLeaderboard } from './hanoi';

export function createFirebaseBackend(): Backend {
  const ctx = initFirebase();
  return {
    name: 'firebase',
    auth: createAuthService(ctx),
    rooms: createRoomRepo(ctx),
    admin: createAdminRepo(ctx),
    account: createAccountRepo(ctx),
    hanoiLeaderboard: createHanoiLeaderboard(ctx),
  };
}

/**
 * The boards a room can be played on.
 *
 * Each declares its own ring, so they differ in length and in how many colour groups there are —
 * Vancouver and New York are the long forty-space game, Japan and China are shorter and reach a
 * monopoly sooner. Adding one is a file here plus an entry in `BOARDS`.
 */
import { china } from './china';
import { japan } from './japan';
import { newYork } from './newyork';
import type { BoardDef } from './types';
import { vancouver } from './vancouver';

export const BOARDS: BoardDef[] = [vancouver, newYork, japan, china];

export const DEFAULT_BOARD_ID = vancouver.id;

export const findBoard = (id: string | undefined): BoardDef | undefined =>
  BOARDS.find((b) => b.id === id);

/** The board a room is set to, falling back to the default so an unknown id can never strand a game. */
export const boardOf = (id: string | undefined): BoardDef => findBoard(id) ?? vancouver;

export * from './types';

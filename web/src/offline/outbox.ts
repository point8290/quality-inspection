import { db } from './db';
import type { DeadLetterOp, OutboxOp } from './db';

/**
 * Branchless Dexie calls, on purpose. Every decision about *when* to enqueue, dequeue or
 * dead-letter lives in the sync saga, where it is unit-tested by stepping the generator.
 * Keeping this module free of logic is what makes "verified manually" an honest claim.
 */

export function enqueue(op: OutboxOp) {
  return db.outbox.add(op);
}

/** Ordered by the auto-increment key, so ops replay in the order they were made. */
export function listPending() {
  return db.outbox.orderBy('seq').toArray();
}

export function dequeue(seq: number) {
  return db.outbox.delete(seq);
}

export function moveToDeadLetter(op: OutboxOp, entry: DeadLetterOp) {
  return db.transaction('rw', db.outbox, db.deadLetter, async () => {
    await db.deadLetter.put(entry);
    await db.outbox.delete(op.seq as number);
  });
}

export function listDeadLetter() {
  return db.deadLetter.toArray();
}

export function discardDeadLetter(opId: string) {
  return db.deadLetter.delete(opId);
}

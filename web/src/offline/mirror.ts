import type { Inspection } from '../api/types';
import { db } from './db';
import type { ReferenceSnapshot } from './db';

/** Branchless Dexie calls — see the note in outbox.ts. */

const REFERENCE_KEY = 'reference';
const CURSOR_KEY = 'updatedSince';

export function putInspections(rows: Inspection[]) {
  return db.inspections.bulkPut(rows);
}

export function putInspection(row: Inspection) {
  return db.inspections.put(row);
}

/** Newest first, matching the list's default ordering. */
export function readInspections() {
  return db.inspections.orderBy('updatedAt').reverse().toArray();
}

export function putReference(snapshot: ReferenceSnapshot) {
  return db.reference.put({ key: REFERENCE_KEY, value: snapshot });
}

export function readReference() {
  return db.reference.get(REFERENCE_KEY);
}

export function readCursor() {
  return db.meta.get(CURSOR_KEY);
}

export function writeCursor(value: string) {
  return db.meta.put({ key: CURSOR_KEY, value });
}

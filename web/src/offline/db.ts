import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { CreateInspectionPayload, DefectType, Inspection, Severity } from '../api/types';

/**
 * A pending mutation. `seq` is a Dexie auto-increment, which is what gives the outbox FIFO
 * order for free — and ordering is a correctness requirement, not a nicety: a CREATE and the
 * RESOLVE of the same inspection share an id, so the create has to replay first.
 */
export type OutboxOp =
  | {
      seq?: number;
      opId: string;
      type: 'CREATE';
      inspectionId: string;
      payload: CreateInspectionPayload;
    }
  | {
      seq?: number;
      opId: string;
      type: 'RESOLVE';
      inspectionId: string;
      payload: { resolutionNote: string };
    };

/** An op the server rejected with a 400 — unfixable by retrying, so it needs a human. */
export type DeadLetterOp = {
  opId: string;
  type: OutboxOp['type'];
  inspectionId: string;
  reason: string;
  failedAt: string;
};

export type ReferenceSnapshot = {
  defectTypes: DefectType[];
  severities: Severity[];
};

class OfflineDatabase extends Dexie {
  /** Read mirror, so the list and summary render with no network. */
  declare inspections: Table<Inspection, string>;
  /** Dropdown data, cached so the log form works offline. */
  declare reference: Table<{ key: string; value: ReferenceSnapshot }, string>;
  declare outbox: Table<OutboxOp, number>;
  declare deadLetter: Table<DeadLetterOp, string>;
  /** Small key/value store — currently just the delta-pull cursor. */
  declare meta: Table<{ key: string; value: string }, string>;

  constructor() {
    super('quality-inspection-tracker');

    this.version(1).stores({
      inspections: 'id, updatedAt, status',
      reference: 'key',
      outbox: '++seq, opId, inspectionId',
      deadLetter: 'opId',
      meta: 'key',
    });
  }
}

export const db = new OfflineDatabase();

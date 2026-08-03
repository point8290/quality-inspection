import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../db';

export const WEBHOOK_EVENT_STATUS = {
  /** Logged, not yet processed — or a previous attempt crashed midway. */
  RECEIVED: 'RECEIVED',
  PROCESSED: 'PROCESSED',
  /** Dead letter: inspectable and replayable, never silently lost. */
  FAILED: 'FAILED',
} as const;

/**
 * The inbound event log that makes the webhook **persist-then-process** (DESIGN.md §3.1):
 * every signature-valid event is durably recorded before we act on it, so a processing
 * failure becomes an inspectable dead letter rather than a dropped message.
 */
export class WebhookEvent extends Model<
  InferAttributes<WebhookEvent>,
  InferCreationAttributes<WebhookEvent>
> {
  declare id: CreationOptional<string>;
  /** SAP's event id — the idempotency key, unique in the database. */
  declare eventId: string;
  declare source: CreationOptional<string>;
  declare payload: string;
  declare status: CreationOptional<string>;
  declare deliveryCount: CreationOptional<number>;
  declare error: CreationOptional<string | null>;
  declare inspectionId: CreationOptional<string | null>;
  declare receivedAt: CreationOptional<Date>;
  declare processedAt: CreationOptional<Date | null>;
}

WebhookEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    eventId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    source: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'SAP',
    },
    payload: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: WEBHOOK_EVENT_STATUS.RECEIVED,
    },
    deliveryCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    inspectionId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    receivedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'webhook_events',
    // receivedAt / processedAt are the meaningful timestamps here, so the generic
    // createdAt/updatedAt pair would just be noise.
    timestamps: false,
  },
);

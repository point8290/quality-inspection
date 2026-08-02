import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../db';
import { DefectType } from './defectType';
import { Severity } from './severity';

export const INSPECTION_STATUS = {
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
} as const;

export class Inspection extends Model<
  InferAttributes<Inspection>,
  InferCreationAttributes<Inspection>
> {
  // UUID rather than autoincrement: the offline client mints this id before the row exists,
  // which is what makes a replayed create idempotent (DESIGN.md §5).
  declare id: CreationOptional<string>;
  // DATEONLY, so Sequelize hands back the literal 'YYYY-MM-DD' — no timezone in play.
  declare inspectionDate: string;
  declare machineId: string;
  declare defectTypeId: number;
  declare severityId: number;
  declare remarks: CreationOptional<string | null>;
  declare status: CreationOptional<string>;
  declare resolutionNote: CreationOptional<string | null>;
  declare resolvedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Populated by `include`; NonAttribute keeps them out of the insert/update column list.
  declare defectType?: NonAttribute<DefectType>;
  declare severity?: NonAttribute<Severity>;
}

Inspection.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    inspectionDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    machineId: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    defectTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    severityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    remarks: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    // Workflow state with no metadata, so it stays a string rather than a lookup table.
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: INSPECTION_STATUS.OPEN,
    },
    resolutionNote: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'inspections',
  },
);

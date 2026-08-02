import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../db';

/**
 * Lookup table, not an enum: severity carries metadata (a label to show, a rank to sort by)
 * and can grow, so it lives in the database (WALKTHROUGH.md). `code` is the business key the
 * API speaks in; `id` never leaves the backend.
 */
export class Severity extends Model<InferAttributes<Severity>, InferCreationAttributes<Severity>> {
  declare id: CreationOptional<number>;
  declare code: string;
  declare label: string;
  declare rank: number;
}

Severity.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    label: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    // 0 is the most severe, so "sort by severity" is a plain ascending sort on an integer.
    rank: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    tableName: 'severities',
    // Reference rows are seeded, not edited by users — audit columns would be noise.
    timestamps: false,
  },
);

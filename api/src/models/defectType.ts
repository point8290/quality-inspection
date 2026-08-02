import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../db';

/**
 * Lookup table for the kinds of defect a supervisor can log. `isActive` retires a code
 * without deleting history: existing inspections keep pointing at it, but it stops appearing
 * in the dropdown.
 */
export class DefectType extends Model<
  InferAttributes<DefectType>,
  InferCreationAttributes<DefectType>
> {
  declare id: CreationOptional<number>;
  declare code: string;
  declare label: string;
  declare isActive: CreationOptional<boolean>;
  declare sortOrder: CreationOptional<number>;
}

DefectType.init(
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
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'defect_types',
    timestamps: false,
  },
);

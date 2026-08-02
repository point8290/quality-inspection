import { Options, Sequelize } from 'sequelize';

// require (not import) because config/config.js is CommonJS shared with sequelize-cli.
const configs = require('../config/config.js') as Record<string, Options>;

const environment = process.env.NODE_ENV ?? 'development';
const config = configs[environment];

if (!config) {
  throw new Error(`No database config for NODE_ENV="${environment}" in config/config.js`);
}

// One Sequelize instance for the whole process; models register themselves against it.
export const sequelize = new Sequelize(config);

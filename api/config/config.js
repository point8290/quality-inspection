const fs = require('fs');
const path = require('path');

// Plain CommonJS because sequelize-cli has to read this file directly. src/db.ts requires
// the same file, so the CLI and the running app can never drift onto different databases.
const dataDir = path.resolve(__dirname, '..', 'data');

// The data/ directory is gitignored, so a fresh clone won't have it — sqlite3 will create
// the file but not the folder.
fs.mkdirSync(dataDir, { recursive: true });

const sqlite = (fileName) => ({
  dialect: 'sqlite',
  storage: path.join(dataDir, fileName),
  logging: false,
});

module.exports = {
  development: sqlite('dev.sqlite'),
  test: sqlite('test.sqlite'),
  production: sqlite('prod.sqlite'),
};

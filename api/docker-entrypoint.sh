#!/bin/sh
set -e

# Both commands are idempotent: migrations are tracked in SequelizeMeta and seeders in
# SequelizeData, so restarting the container re-applies nothing and can't double-seed.
echo "→ Applying migrations"
npx sequelize-cli db:migrate

echo "→ Seeding reference and demo data"
npx sequelize-cli db:seed:all

echo "→ Starting API"
exec node dist/index.js

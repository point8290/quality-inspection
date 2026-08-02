import { app } from './app';
import { sequelize } from './db';

const port = Number(process.env.PORT ?? 4000);

async function start() {
  // Fail loudly at boot if the database is unreachable, rather than on the first request.
  await sequelize.authenticate();

  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start the API:', error);
  process.exit(1);
});

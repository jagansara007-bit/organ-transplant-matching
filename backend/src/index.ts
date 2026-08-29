import app from './app';
import { checkDatabaseConnection } from './config/db';
import { connectRedis } from './config/redis';
import { runMigrations } from './db/migrate';

const PORT = parseInt(process.env.PORT || '5000', 10);

const startServer = async () => {
  console.log('Initializing Organ Transplant Matching System API...');

  const dbOk = await checkDatabaseConnection();
  if (dbOk) {
    console.log('✅ PostgreSQL Database connected successfully.');
    await runMigrations();
  } else {
    console.warn('⚠️ Could not connect to PostgreSQL Database at startup.');
  }

  const redisOk = await connectRedis();
  if (redisOk) {
    console.log('✅ Redis Cache Client connected successfully.');
  } else {
    console.warn('⚠️ Could not connect to Redis Client at startup.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Organ Transplant Backend Server running on http://0.0.0.0:${PORT}`);
  });
};

startServer().catch(err => {
  console.error('Fatal error starting backend server:', err);
  process.exit(1);
});

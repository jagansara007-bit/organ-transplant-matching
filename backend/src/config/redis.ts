import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || '6379';

export const redisClient = createClient({
  url: `redis://${redisHost}:${redisPort}`,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries >= 1) {
        return false; // Stop retrying if Redis server is offline
      }
      return 1000;
    }
  }
});

redisClient.on('error', (err) => {
  // Silent warning for offline local environments
});

export const connectRedis = async (): Promise<boolean> => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const checkRedisConnection = async (): Promise<boolean> => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    const pong = await redisClient.ping();
    return pong === 'PONG';
  } catch (error) {
    return false;
  }
};

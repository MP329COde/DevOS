import { createClient } from 'redis';

export type RedisClient = ReturnType<typeof createClient>;

export interface RedisClients {
  cache: RedisClient;
  publisher: RedisClient;
  subscriber: RedisClient;
}

export function createRedisClients(redisUrl = process.env.REDIS_URL): RedisClients {
  if (!redisUrl) {
    throw new Error('REDIS_URL must be configured');
  }

  const cache = createClient({ url: redisUrl });
  const publisher = createClient({ url: redisUrl });
  const subscriber = createClient({ url: redisUrl });

  return { cache, publisher, subscriber };
}

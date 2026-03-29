import Redis from 'ioredis';

let redis;

export async function connectRedis() {
    try {
        redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
        redis.on('connect', () => console.log('Redis connected'));
        redis.on('error', (err) => console.error('Redis error:', err));
    } catch (err) {
        console.error('Redis connection error:', err);
    }
    }

export { redis };

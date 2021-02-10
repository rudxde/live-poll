import redis from 'redis';
import { promisify } from 'util';

export class RedisAsyncClient {
    private constructor(
        public redisClient: redis.RedisClient,
    ) { }

    static createClient(options?: redis.ClientOpts): RedisAsyncClient {
        return new RedisAsyncClient(redis.createClient(options));
    }

    duplicate(options?: redis.ClientOpts): RedisAsyncClient {
        return new RedisAsyncClient(this.redisClient.duplicate(options));
    }

    async publish(channel: string, value: string): Promise<number> {
        return promisify(this.redisClient.publish).bind(this.redisClient)(channel, value);
    }

    async get(key: string): Promise<string | null> {
        return promisify(this.redisClient.get).bind(this.redisClient)(key);
    }

    async set(key: string, value: string): Promise<void> {
        await promisify(this.redisClient.set).bind(this.redisClient)(key, value);
    }

    async subscribe(...channels: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            this.redisClient.subscribe(...channels, (err: Error | null, reply: string) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(reply);
            });
        });
    }

    async unsubscribe(...channels: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            this.redisClient.unsubscribe(...channels, (err: Error | null, reply: string) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(reply);
            });
        });
    }

    async incr(key: string): Promise<number> {
        return promisify(this.redisClient.incr).bind(this.redisClient)(key);
    }
    async decr(key: string): Promise<number> {
        return promisify(this.redisClient.decr).bind(this.redisClient)(key);
    }
}

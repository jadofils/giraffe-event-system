import redisClient from '../config/redis';
import { AppDataSource } from '../config/Database';
import { Repository, EntityTarget, ObjectLiteral } from 'typeorm';

export class CacheService {
  private static readonly DEFAULT_TTL = 3600; // 1 hour in seconds

  /**
   * Get single entity from cache or database
   */
  static async getOrSetSingle<T extends ObjectLiteral>(
    key: string,
    repository: Repository<T>,
    queryFn: () => Promise<T | null>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T | null> {
    try {
      const cachedData = await redisClient.get(key);
      
      if (cachedData) {
        console.log(`Cache hit for key: ${key}`);
        return JSON.parse(cachedData);
      }

      console.log(`Cache miss for key: ${key}`);
      const data = await queryFn();

      if (data) {
        await redisClient.set(key, JSON.stringify(data), {
          EX: ttl
        });
      }

      return data;
    } catch (error) {
      console.error('Cache error:', error);
      return await queryFn();
    }
  }

  /**
   * Get multiple entities from cache or database
   */
  static async getOrSetMultiple<T extends ObjectLiteral>(
    key: string,
    repository: Repository<T>,
    queryFn: () => Promise<T[]>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T[]> {
    try {
      const cachedData = await redisClient.get(key);
      
      if (cachedData) {
        console.log(`Cache hit for key: ${key}`);
        return JSON.parse(cachedData);
      }

      console.log(`Cache miss for key: ${key}`);
      const data = await queryFn();

      if (data.length > 0) {
        await redisClient.set(key, JSON.stringify(data), {
          EX: ttl
        });
      }

      return data;
    } catch (error) {
      console.error('Cache error:', error);
      return await queryFn();
    }
  }

  /**
   * Invalidate cache for a specific key
   */
  static async invalidate(key: string): Promise<void> {
    try {
      await redisClient.del(key);
      console.log(`Cache invalidated for key: ${key}`);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Invalidate cache for multiple keys
   */
  static async invalidateMultiple(keys: string[]): Promise<void> {
    try {
      await Promise.all(keys.map(key => redisClient.del(key)));
      console.log(`Cache invalidated for keys: ${keys.join(', ')}`);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Set data in cache
   */
  static async set<T>(
    key: string,
    data: T,
    ttl: number = this.DEFAULT_TTL
  ): Promise<void> {
    try {
      await redisClient.set(key, JSON.stringify(data), {
        EX: ttl
      });
      console.log(`Data cached for key: ${key}`);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Get data from cache
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Get Map from cache or database
   */
  static async getOrSetMap<K, V>(
    key: string,
    queryFn: () => Promise<Map<K, V>>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<Map<K, V>> {
    try {
      const cachedData = await redisClient.get(key);
      
      if (cachedData) {
        console.log(`Cache hit for key: ${key}`);
        return new Map(Object.entries(JSON.parse(cachedData))) as Map<K, V>;
      }

      console.log(`Cache miss for key: ${key}`);
      const data = await queryFn();

      if (data.size > 0) {
        await redisClient.set(key, JSON.stringify(Object.fromEntries(data)), {
          EX: ttl
        });
      }

      return data;
    } catch (error) {
      console.error('Cache error:', error);
      return await queryFn();
    }
  }
} 
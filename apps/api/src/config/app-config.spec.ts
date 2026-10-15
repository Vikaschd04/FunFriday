import { describe, expect, it } from 'vitest';
import { ConfigError, parseConfig } from './app-config.js';

const valid = {
  DATABASE_URL: 'postgresql://user:s3cret-pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  WEB_ORIGIN: 'http://localhost:3000, https://app.example.com/',
};

describe('parseConfig', () => {
  it('applies safe defaults and normalises origins', () => {
    const config = parseConfig(valid);
    expect(config.port).toBe(4000);
    expect(config.host).toBe('127.0.0.1');
    expect(config.nodeEnv).toBe('development');
    expect(config.webOrigins).toEqual(['http://localhost:3000', 'https://app.example.com']);
    expect(config.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('rejects wrong protocols and missing values, naming keys only', () => {
    let error: unknown;
    try {
      parseConfig({
        ...valid,
        DATABASE_URL: 'mysql://user:s3cret-pass@host/db',
        REDIS_URL: undefined,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ConfigError);
    const configError = error as ConfigError;
    expect(configError.invalidKeys.sort()).toEqual(['DATABASE_URL', 'REDIS_URL']);
    expect(configError.message).not.toContain('s3cret-pass');
  });

  it('rejects an out-of-range port', () => {
    expect(() => parseConfig({ ...valid, API_PORT: '70000' })).toThrow(ConfigError);
  });
});

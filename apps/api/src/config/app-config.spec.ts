import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConfigError, parseConfig } from './app-config.js';

const valid = {
  DATABASE_URL: 'postgresql://user:s3cret-pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  WEB_ORIGIN: 'http://localhost:3000, https://app.example.com/',
  AUTH_SECRET: 'unit-test-secret-unit-test-secret-0123456789',
};

describe('parseConfig', () => {
  it('applies safe defaults and normalises origins', () => {
    const config = parseConfig(valid);
    expect(config.port).toBe(4000);
    expect(config.host).toBe('127.0.0.1');
    expect(config.nodeEnv).toBe('development');
    expect(config.webOrigins).toEqual(['http://localhost:3000', 'https://app.example.com']);
    expect(config.apiPublicUrl).toBe('http://localhost:4000');
    expect(config.devMailboxEnabled).toBe(false);
    expect(config.trustProxy).toBe(0);
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

  it('requires a long AUTH_SECRET and never echoes it', () => {
    let error: unknown;
    try {
      parseConfig({ ...valid, AUTH_SECRET: 'short-secret-value' });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).invalidKeys).toEqual(['AUTH_SECRET']);
    expect((error as ConfigError).message).not.toContain('short-secret-value');
    expect(() => parseConfig({ ...valid, AUTH_SECRET: undefined })).toThrow(ConfigError);
  });

  it('parses the dev mailbox flag and refuses it in production', () => {
    expect(parseConfig({ ...valid, DEV_MAILBOX_ENABLED: 'true' }).devMailboxEnabled).toBe(true);
    expect(() => parseConfig({ ...valid, DEV_MAILBOX_ENABLED: 'yes' })).toThrow(ConfigError);
    let error: unknown;
    try {
      parseConfig({ ...valid, NODE_ENV: 'production', DEV_MAILBOX_ENABLED: 'true' });
    } catch (caught) {
      error = caught;
    }
    expect((error as ConfigError).invalidKeys).toEqual(['DEV_MAILBOX_ENABLED']);
    expect(parseConfig({ ...valid, NODE_ENV: 'production' }).devMailboxEnabled).toBe(false);
  });

  it('validates API_PUBLIC_URL as an http(s) URL and keeps only its origin', () => {
    expect(parseConfig({ ...valid, API_PUBLIC_URL: 'https://api.example.com/' }).apiPublicUrl).toBe(
      'https://api.example.com',
    );
    expect(() => parseConfig({ ...valid, API_PUBLIC_URL: 'ftp://x.example.com' })).toThrow(
      ConfigError,
    );
  });

  describe('AUTH_SECRET quality', () => {
    const exampleSecret = /^AUTH_SECRET=(.+)$/m.exec(
      readFileSync(new URL('../../../../.env.example', import.meta.url), 'utf8'),
    )![1]!;

    it('rejects the exact .env.example value and common placeholders', () => {
      expect(exampleSecret.length).toBeGreaterThanOrEqual(32);
      for (const bad of [
        exampleSecret,
        'please-CHANGEME-please-CHANGEME-please-0123',
        'my-example-secret-my-example-secret-0123456',
        'a-placeholder-value-a-placeholder-value-01',
        'x'.repeat(64),
      ]) {
        expect(() => parseConfig({ ...valid, AUTH_SECRET: bad })).toThrow(ConfigError);
      }
    });

    it('accepts the CI secret outside production but requires 43+ characters in production', () => {
      const ci = 'ci-only-auth-secret-not-for-real-use-0123456789abcdef';
      expect(parseConfig({ ...valid, AUTH_SECRET: ci }).authSecret).toBe(ci);
      expect(parseConfig({ ...valid, NODE_ENV: 'production', AUTH_SECRET: ci }).authSecret).toBe(
        ci,
      );
      const thirtyTwo = 'k3Jf9sLq2Vx8Zr5TnB7mYc1WdE4gHa6U';
      expect(parseConfig({ ...valid, AUTH_SECRET: thirtyTwo }).authSecret).toBe(thirtyTwo);
      expect(() =>
        parseConfig({ ...valid, NODE_ENV: 'production', AUTH_SECRET: thirtyTwo }),
      ).toThrow(ConfigError);
    });
  });

  describe('dev mailbox exposure', () => {
    it('requires a loopback API_HOST when enabled', () => {
      for (const host of ['127.0.0.1', '::1', 'localhost']) {
        expect(
          parseConfig({ ...valid, DEV_MAILBOX_ENABLED: 'true', API_HOST: host }).devMailboxEnabled,
        ).toBe(true);
      }
      let error: unknown;
      try {
        parseConfig({ ...valid, DEV_MAILBOX_ENABLED: 'true', API_HOST: '0.0.0.0' });
      } catch (caught) {
        error = caught;
      }
      expect((error as ConfigError).invalidKeys).toEqual(['API_HOST']);
      // Disabled mailbox may bind anywhere.
      expect(() => parseConfig({ ...valid, API_HOST: '0.0.0.0' })).not.toThrow();
    });
  });

  describe('TRUST_PROXY hop count', () => {
    it('parses 0-5, keeps true/false compatible and rejects anything else', () => {
      expect(parseConfig({ ...valid, TRUST_PROXY: '2' }).trustProxy).toBe(2);
      expect(parseConfig({ ...valid, TRUST_PROXY: 'true' }).trustProxy).toBe(1);
      expect(parseConfig({ ...valid, TRUST_PROXY: 'false' }).trustProxy).toBe(0);
      for (const bad of ['6', '-1', 'all', '1.5']) {
        expect(() => parseConfig({ ...valid, TRUST_PROXY: bad })).toThrow(ConfigError);
      }
    });
  });
});

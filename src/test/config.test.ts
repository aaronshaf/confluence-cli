import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Effect } from 'effect';
import { ConfigManager } from '../lib/config.js';
import { ConfigError, FileSystemError, ValidationError } from '../lib/errors.js';

describe('ConfigManager', () => {
  let testDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Create a temporary directory for test config
    testDir = join(tmpdir(), `cn-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // Override config path
    originalEnv = process.env.CN_CONFIG_PATH;
    process.env.CN_CONFIG_PATH = testDir;
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }

    // Restore environment
    if (originalEnv !== undefined) {
      process.env.CN_CONFIG_PATH = originalEnv;
    } else {
      delete process.env.CN_CONFIG_PATH;
    }
  });

  describe('validateUrl', () => {
    test('accepts valid Confluence Cloud URLs', () => {
      expect(ConfigManager.validateUrl('https://example.atlassian.net')).toBe(true);
      expect(ConfigManager.validateUrl('https://my-company.atlassian.net')).toBe(true);
    });

    test('rejects invalid URLs', () => {
      expect(ConfigManager.validateUrl('http://example.atlassian.net')).toBe(false);
      expect(ConfigManager.validateUrl('https://example.com')).toBe(false);
      expect(ConfigManager.validateUrl('https://atlassian.net')).toBe(false);
      expect(ConfigManager.validateUrl('example.atlassian.net')).toBe(false);
    });
  });

  describe('validateEmail', () => {
    test('accepts valid email addresses', () => {
      expect(ConfigManager.validateEmail('user@example.com')).toBe(true);
      expect(ConfigManager.validateEmail('test.user@company.co.uk')).toBe(true);
    });

    test('rejects invalid email addresses', () => {
      expect(ConfigManager.validateEmail('invalid')).toBe(false);
      expect(ConfigManager.validateEmail('user@')).toBe(false);
      expect(ConfigManager.validateEmail('@example.com')).toBe(false);
      expect(ConfigManager.validateEmail('user @example.com')).toBe(false);
    });
  });

  describe('hasConfig', () => {
    test('returns false when no config exists', () => {
      const manager = new ConfigManager();
      expect(manager.hasConfig()).toBe(false);
    });

    test('returns true when config exists', () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(
        configPath,
        JSON.stringify({ confluenceUrl: 'https://test.atlassian.net', email: 'test@example.com', apiToken: 'token' }),
      );

      const manager = new ConfigManager();
      expect(manager.hasConfig()).toBe(true);
    });
  });

  describe('getConfig', () => {
    test('returns null when no config exists', async () => {
      const manager = new ConfigManager();
      const config = await manager.getConfig();
      expect(config).toBeNull();
    });

    test('returns config when it exists', async () => {
      const configPath = join(testDir, 'config.json');
      const testConfig = {
        confluenceUrl: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'test-token',
      };
      writeFileSync(configPath, JSON.stringify(testConfig));

      const manager = new ConfigManager();
      const config = await manager.getConfig();

      expect(config).not.toBeNull();
      expect(config?.confluenceUrl).toBe(testConfig.confluenceUrl);
      expect(config?.email).toBe(testConfig.email);
      expect(config?.apiToken).toBe(testConfig.apiToken);
    });

    test('returns null for invalid JSON', async () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, 'invalid json');

      const manager = new ConfigManager();
      const config = await manager.getConfig();
      expect(config).toBeNull();
    });
  });

  describe('getConfigEffect', () => {
    test('fails with ConfigError when no config exists', async () => {
      const manager = new ConfigManager();

      const result = await Effect.runPromise(Effect.either(manager.getConfigEffect()));

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(ConfigError);
      }
    });

    test('succeeds with config when it exists', async () => {
      const configPath = join(testDir, 'config.json');
      const testConfig = {
        confluenceUrl: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'test-token',
      };
      writeFileSync(configPath, JSON.stringify(testConfig));

      const manager = new ConfigManager();
      const result = await Effect.runPromise(Effect.either(manager.getConfigEffect()));

      expect(result._tag).toBe('Right');
      if (result._tag === 'Right') {
        expect(result.right.confluenceUrl).toBe(testConfig.confluenceUrl);
      }
    });
  });

  describe('setConfig', () => {
    test('saves valid config', async () => {
      const manager = new ConfigManager();
      const testConfig = {
        confluenceUrl: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'test-token',
      };

      await manager.setConfig(testConfig);

      const config = await manager.getConfig();
      expect(config?.confluenceUrl).toBe(testConfig.confluenceUrl);
      expect(config?.email).toBe(testConfig.email);
    });

    test('throws for invalid config', async () => {
      const manager = new ConfigManager();
      const invalidConfig = {
        confluenceUrl: 'invalid-url',
        email: 'test@example.com',
        apiToken: 'test-token',
      };

      expect(async () => {
        await manager.setConfig(invalidConfig as any);
      }).toThrow();
    });
  });

  describe('setConfigEffect', () => {
    test('succeeds with valid config', async () => {
      const manager = new ConfigManager();
      const testConfig = {
        confluenceUrl: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'test-token',
      };

      const result = await Effect.runPromise(Effect.either(manager.setConfigEffect(testConfig)));

      expect(result._tag).toBe('Right');
    });

    test('fails with ValidationError for invalid config', async () => {
      const manager = new ConfigManager();
      const invalidConfig = {
        confluenceUrl: 'invalid-url',
        email: 'test@example.com',
        apiToken: 'test-token',
      };

      const result = await Effect.runPromise(Effect.either(manager.setConfigEffect(invalidConfig as any)));

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(ValidationError);
      }
    });
  });
});

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Effect, pipe, Schema } from 'effect';
import { ConfigError, FileSystemError, ParseError, ValidationError } from './errors.js';

/**
 * Schema for Confluence Cloud URL validation
 * Only accepts https://*.atlassian.net URLs per ADR-0012
 */
const ConfluenceUrlSchema = Schema.String.pipe(
  Schema.pattern(/^https:\/\/.+\.atlassian\.net$/),
  Schema.annotations({
    message: () => 'URL must be a Confluence Cloud URL (https://*.atlassian.net)',
  }),
);

/**
 * Schema for email validation
 */
const EmailSchema = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  Schema.annotations({
    message: () => 'Invalid email format',
  }),
);

/**
 * Configuration schema for cn CLI
 */
const ConfigSchema = Schema.Struct({
  confluenceUrl: ConfluenceUrlSchema,
  email: EmailSchema,
  apiToken: Schema.String.pipe(Schema.minLength(1)),
});

export type Config = Schema.Schema.Type<typeof ConfigSchema>;

/**
 * ConfigManager handles reading and writing the cn CLI configuration
 * Configuration is stored in ~/.cn/config.json with 600 permissions
 */
export class ConfigManager {
  private configDir: string;
  private configFile: string;

  constructor() {
    this.configDir = process.env.CN_CONFIG_PATH ? process.env.CN_CONFIG_PATH : join(homedir(), '.cn');
    this.configFile = join(this.configDir, 'config.json');

    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }
  }

  /**
   * Get the path to the config file
   */
  getConfigPath(): string {
    return this.configFile;
  }

  /**
   * Check if configuration exists
   */
  hasConfig(): boolean {
    return existsSync(this.configFile);
  }

  /**
   * Effect-based configuration retrieval with detailed error handling
   */
  getConfigEffect(): Effect.Effect<Config, ConfigError | FileSystemError | ParseError | ValidationError> {
    return pipe(
      Effect.sync(() => existsSync(this.configFile)),
      Effect.flatMap(
        (fileExists): Effect.Effect<Config, ConfigError | FileSystemError | ParseError | ValidationError> => {
          if (fileExists) {
            return pipe(
              Effect.try(() => readFileSync(this.configFile, 'utf-8')),
              Effect.mapError((error) => new FileSystemError(`Failed to read config file: ${error}`)),
              Effect.flatMap((configData) =>
                Effect.try(() => JSON.parse(configData)).pipe(
                  Effect.mapError((error) => new ParseError(`Invalid JSON in config file: ${error}`)),
                ),
              ),
              Effect.flatMap((config) =>
                Schema.decodeUnknown(ConfigSchema)(config).pipe(
                  Effect.mapError((error) => new ValidationError(`Invalid config schema: ${error}`)),
                ),
              ),
            ) as Effect.Effect<Config, ConfigError | FileSystemError | ParseError | ValidationError>;
          }

          return Effect.fail(new ConfigError('No configuration found. Please run "cn setup" first.'));
        },
      ),
    );
  }

  /**
   * Async wrapper for getConfigEffect
   */
  async getConfig(): Promise<Config | null> {
    if (existsSync(this.configFile)) {
      try {
        const configData = readFileSync(this.configFile, 'utf-8');
        const config = JSON.parse(configData);
        return Schema.decodeUnknownSync(ConfigSchema)(config);
      } catch {
        // Invalid config file - return null to indicate no valid config
        return null;
      }
    }
    return null;
  }

  /**
   * Effect-based configuration update
   */
  setConfigEffect(config: Config): Effect.Effect<void, ValidationError | FileSystemError> {
    return pipe(
      Schema.decodeUnknown(ConfigSchema)(config),
      Effect.mapError((error) => new ValidationError(`Invalid config: ${error}`)),
      Effect.flatMap((validated) =>
        Effect.try(() => {
          writeFileSync(this.configFile, JSON.stringify(validated, null, 2), 'utf-8');
          chmodSync(this.configFile, 0o600);
        }).pipe(Effect.mapError((error) => new FileSystemError(`Failed to save config: ${error}`))),
      ),
    );
  }

  /**
   * Async wrapper for setConfigEffect
   */
  async setConfig(config: Config): Promise<void> {
    const validated = Schema.decodeUnknownSync(ConfigSchema)(config);
    writeFileSync(this.configFile, JSON.stringify(validated, null, 2), 'utf-8');
    chmodSync(this.configFile, 0o600);
  }

  /**
   * Validate a Confluence URL
   */
  static validateUrl(url: string): boolean {
    return /^https:\/\/.+\.atlassian\.net$/.test(url);
  }

  /**
   * Validate an email address
   */
  static validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

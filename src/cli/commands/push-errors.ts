import chalk from 'chalk';
import { EXIT_CODES, PageNotFoundError, VersionConflictError } from '../../lib/errors.js';

/**
 * Error thrown during push operations
 */
export class PushError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
  ) {
    super(message);
    this.name = 'PushError';
  }
}

/**
 * Handle push errors - formats error and throws PushError
 */
export function handlePushError(error: unknown, filePath: string): never {
  if (error instanceof PageNotFoundError) {
    console.error('');
    console.error(chalk.red(`Page not found on Confluence (ID: ${error.pageId}).`));
    console.log(chalk.gray('The page may have been deleted.'));
    throw new PushError(`Page not found: ${error.pageId}`, EXIT_CODES.PAGE_NOT_FOUND);
  }

  if (error instanceof VersionConflictError) {
    console.error('');
    console.error(chalk.red('Version conflict: remote version has changed.'));
    console.log(chalk.gray(`Run "cn pull --page ${filePath}" to get the latest version.`));
    throw new PushError('Version conflict', EXIT_CODES.VERSION_CONFLICT);
  }

  console.error('');
  console.error(chalk.red('Push failed'));
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(chalk.red(message));
  throw new PushError(message, EXIT_CODES.GENERAL_ERROR);
}

import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import chalk from 'chalk';

/**
 * Open a URL in the default browser.
 * Uses spawn with arguments array to prevent command injection.
 */
export function openUrl(url: string): void {
  const os = platform();
  let command: string;
  let args: string[];

  switch (os) {
    case 'darwin':
      command = 'open';
      args = [url];
      break;
    case 'win32':
      command = 'cmd';
      args = ['/c', 'start', '', url];
      break;
    default:
      command = 'xdg-open';
      args = [url];
  }

  const child = spawn(command, args, { stdio: 'ignore', detached: true });
  child.on('error', (error) => {
    console.error(chalk.red(`Failed to open browser: ${error.message}`));
    console.log(chalk.gray(`URL: ${url}`));
  });
  child.unref();
}

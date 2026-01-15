import { input, password } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { ConfluenceClient } from '../../lib/confluence-client/index.js';
import { ConfigManager, type Config } from '../../lib/config.js';
import { EXIT_CODES } from '../../lib/errors.js';

/**
 * Interactive setup command for configuring Confluence credentials
 */
export async function setup(): Promise<void> {
  console.log(chalk.bold('\nConfluence CLI Setup\n'));
  console.log(chalk.gray('This wizard will help you configure your Confluence credentials.'));
  console.log(chalk.gray('You can create an API token at: https://id.atlassian.com/manage/api-tokens\n'));

  const configManager = new ConfigManager();

  // Check for existing config
  const existingConfig = await configManager.getConfig();
  if (existingConfig) {
    console.log(chalk.yellow('Existing configuration found:'));
    console.log(`  URL: ${existingConfig.confluenceUrl}`);
    console.log(`  Email: ${existingConfig.email}`);
    console.log('');
  }

  // Get Confluence URL
  let confluenceUrl: string;
  while (true) {
    confluenceUrl = await input({
      message: 'Confluence URL:',
      default: existingConfig?.confluenceUrl,
      validate: (value) => {
        if (!value) return 'URL is required';
        if (!ConfigManager.validateUrl(value)) {
          return 'URL must be a Confluence Cloud URL (https://*.atlassian.net)';
        }
        return true;
      },
    });

    // Normalize URL (remove trailing slash)
    confluenceUrl = confluenceUrl.replace(/\/$/, '');
    break;
  }

  // Get email
  let email: string;
  while (true) {
    email = await input({
      message: 'Email:',
      default: existingConfig?.email,
      validate: (value) => {
        if (!value) return 'Email is required';
        if (!ConfigManager.validateEmail(value)) {
          return 'Invalid email format';
        }
        return true;
      },
    });
    break;
  }

  // Get API token
  const apiToken = await password({
    message: 'API Token:',
    mask: '*',
    validate: (value) => {
      if (!value) return 'API token is required';
      return true;
    },
  });

  // Create config object
  const config: Config = {
    confluenceUrl,
    email,
    apiToken,
  };

  // Verify connection
  const spinner = ora('Verifying connection...').start();

  try {
    const client = new ConfluenceClient(config);
    await client.verifyConnection();
    spinner.succeed('Connected to Confluence successfully!');
  } catch (error) {
    spinner.fail('Connection failed');

    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('Invalid credentials')) {
        console.error(chalk.red('\nAuthentication failed. Please check your email and API token.'));
        console.log(chalk.gray('Make sure you are using an API token, not your account password.'));
        console.log(chalk.gray('Create a token at: https://id.atlassian.com/manage/api-tokens'));
      } else if (error.message.includes('403') || error.message.includes('Access denied')) {
        console.error(chalk.red('\nPermission denied. Your account may not have access to Confluence.'));
      } else if (error.message.includes('Network error') || error.message.includes('ENOTFOUND')) {
        console.error(chalk.red('\nCould not connect to the Confluence URL.'));
        console.log(chalk.gray('Please verify the URL is correct and accessible.'));
      } else {
        console.error(chalk.red(`\nError: ${error.message}`));
      }
    }

    process.exit(EXIT_CODES.AUTH_ERROR);
  }

  // Save configuration
  const saveSpinner = ora('Saving configuration...').start();

  try {
    await configManager.setConfig(config);
    saveSpinner.succeed(`Configuration saved to ${configManager.getConfigPath()}`);
  } catch (error) {
    saveSpinner.fail('Failed to save configuration');
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }

  console.log('');
  console.log(chalk.green('Setup complete!'));
  console.log(chalk.gray('You can now use "cn sync --init <SPACE_KEY>" to sync a Confluence space.'));
}

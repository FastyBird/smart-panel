/**
 * CLI logging utilities with colored output
 */

import chalk from 'chalk';

export const logger = {
	info: (message: string): void => {
		console.log(chalk.blue('ℹ'), message);
	},

	success: (message: string): void => {
		console.log(chalk.green('✓'), message);
	},

	warning: (message: string): void => {
		console.log(chalk.yellow('⚠'), message);
	},

	error: (message: string): void => {
		console.error(chalk.red('✗'), message);
	},

	step: (message: string): void => {
		console.log(chalk.cyan('→'), message);
	},

	debug: (message: string): void => {
		if (process.env.DEBUG) {
			console.log(chalk.gray('⋯'), chalk.gray(message));
		}
	},

	blank: (): void => {
		console.log();
	},

	header: (title: string): void => {
		console.log();
		console.log(chalk.bold.white(title));
		console.log(chalk.gray('─'.repeat(title.length)));
	},

	list: (items: string[]): void => {
		items.forEach((item) => {
			console.log(chalk.gray('  •'), item);
		});
	},

	keyValue: (key: string, value: string): void => {
		console.log(chalk.gray('  •'), chalk.white(key + ':'), value);
	},

	box: (title: string, content: string[]): void => {
		const maxLength = Math.max(title.length, ...content.map((line) => line.length));
		const border = '─'.repeat(maxLength + 2);

		console.log();
		console.log(chalk.gray('┌' + border + '┐'));
		console.log(chalk.gray('│'), chalk.bold.white(title.padEnd(maxLength)), chalk.gray('│'));
		console.log(chalk.gray('├' + border + '┤'));
		content.forEach((line) => {
			console.log(chalk.gray('│'), line.padEnd(maxLength), chalk.gray('│'));
		});
		console.log(chalk.gray('└' + border + '┘'));
	},
};

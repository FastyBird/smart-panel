import inquirer from 'inquirer';
import { Command, CommandRunner } from 'nest-commander';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { AUTH_MODULE_NAME } from '../auth.constants';
import { TokensService } from '../services/tokens.service';

@Command({
	name: 'auth:reset',
	description: 'Reset an application owner or administrator password and revoke its credentials',
	arguments: '<username>',
})
@Injectable()
export class ResetPasswordCommand extends CommandRunner {
	private readonly logger = createExtensionLogger(AUTH_MODULE_NAME, 'ResetPasswordCommand');

	constructor(
		private readonly service: UsersService,
		private readonly tokensService: TokensService,
	) {
		super();
	}

	async run(passedParams: string[], _options?: Record<string, any>): Promise<void> {
		const username = passedParams[0];

		if (!username) {
			console.error('\x1b[31m❌ Error: username is required\n');
			console.error('Usage: auth:reset <username>');
			process.exit(1);
		}
		const user = await this.service.findByUsername(username);

		if (user === null || (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN)) {
			this.logger.warn('No owner or administrator account found.');

			console.log('\n\x1b[31m🚨 No owner or administrator account found. Cannot reset password.\n');

			return;
		}

		console.log(`\n\x1b[33m🔹 Resetting password for privileged account: \x1b[1m${user.username}\x1b[0m\n`);
		const { password } = await inquirer.prompt<{ password: string }>([
			{
				type: 'password',
				name: 'password',
				message: 'New password:',
				mask: '*',
				validate: (value: string) => value.length > 0 || 'Password is required',
			},
		]);

		await this.service.update(user.id, {
			password,
		});
		await this.tokensService.revokeUserCredentials(user.id);

		console.log(
			`\n\x1b[32m✅ Successfully reset password and revoked active sessions and personal tokens for: \x1b[1m${user.username}\x1b[0m\n`,
		);

		this.logger.log(`Password reset and user credentials revoked successfully for user=${user.username}`);
	}
}

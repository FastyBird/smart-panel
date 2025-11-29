import { Command, CommandRunner } from 'nest-commander';

import { Injectable, Logger } from '@nestjs/common';

import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';

@Command({
	name: 'auth:reset',
	description: 'Reset application owner password',
	arguments: '<username> <password>',
})
@Injectable()
export class ResetPasswordCommand extends CommandRunner {
	private readonly logger = new Logger(ResetPasswordCommand.name);

	constructor(private readonly service: UsersService) {
		super();
	}

	async run(passedParams: string[], _options?: Record<string, any>): Promise<void> {
		const username = passedParams[0];
		const password = passedParams[1];

		if (!username || !password) {
			console.error('\x1b[31m❌ Error: username and password are required\n');
			console.error('Usage: auth:reset <username> <password>');
			process.exit(1);
		}
		const user = await this.service.findByUsername(username);

		if (user === null || user.role !== UserRole.OWNER) {
			this.logger.warn(`[AUTH] No owner account found.`);

			console.log('\n\x1b[31m🚨 No owner account found. Cannot reset password.\n');

			return;
		}

		console.log(`\n\x1b[33m🔹 Resetting password for owner: \x1b[1m${user.username}\x1b[0m\n`);

		await this.service.update(user.id, {
			password,
		});

		console.log(`\n\x1b[32m✅ Successfully reset password for: \x1b[1m${user.username}\x1b[0m\n`);

		this.logger.log(`[AUTH] Password reset successfully for owner=${user.username}`);
	}
}

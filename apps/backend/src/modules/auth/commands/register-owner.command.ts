import { Command, CommandRunner } from 'nest-commander';

import { Injectable, Logger } from '@nestjs/common';

import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';

interface RegisterOwnerOptions {
	username?: string;
	password?: string;
}

@Command({
	name: 'auth:onboarding',
	description: 'Create application owner account',
	arguments: '<username> <password>',
})
@Injectable()
export class RegisterOwnerCommand extends CommandRunner {
	private readonly logger = new Logger(RegisterOwnerCommand.name);

	constructor(private readonly service: UsersService) {
		super();
	}

	async run(passedParams: string[], options?: RegisterOwnerOptions): Promise<void> {
		const username = passedParams[0] || options?.username;
		const password = passedParams[1] || options?.password;

		if (!username || !password) {
			console.error('\x1b[31m❌ Error: username and password are required\n');
			console.error('Usage: auth:onboarding <username> <password>');
			process.exit(1);
		}
		const owner = await this.service.findOwner();

		if (owner !== null) {
			this.logger.warn(`[AUTH] Owner already registered.`);

			console.log('\n\x1b[31m🚨 Owner account already registered. New owner account can not be created.\n');

			return;
		}

		console.log(`\n\x1b[33m🔹 Creating new owner account: \x1b[1m${username}\x1b[0m\n`);

		const user = await this.service.create({
			username,
			password,
			role: UserRole.OWNER,
		});

		console.log(`\n\x1b[32m✅ Successfully created owner account: \x1b[1m${user.username}\x1b[0m\n`);

		this.logger.log(`[AUTH] Successfully created application owner=${user.username}`);
	}
}

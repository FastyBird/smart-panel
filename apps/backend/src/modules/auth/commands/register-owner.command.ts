import bcrypt from 'bcrypt';
import { Command, Positional } from 'nestjs-command';

import { Injectable, Logger } from '@nestjs/common';

import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';

@Injectable()
export class RegisterOwnerCommand {
	private readonly logger = new Logger(RegisterOwnerCommand.name);

	constructor(private readonly service: UsersService) {}

	@Command({
		command: 'auth:onboarding <username> <password>',
		describe: 'Create application owner account',
	})
	async reset(
		@Positional({
			name: 'username',
			describe: 'the owner username',
			type: 'string',
		})
		username: string,
		@Positional({
			name: 'password',
			describe: 'the owner password',
			type: 'string',
		})
		password: string,
	) {
		const owner = await this.service.findOwner();

		if (owner !== null) {
			this.logger.warn(`[AUTH] Owner already registered.`);

			console.log('\n\x1b[31m🚨 Owner account already registered. New owner account can not be created.\n');

			return;
		}

		console.log(`\n\x1b[33m🔹 Creating new owner account: \x1b[1m${username}\x1b[0m\n`);

		const user = await this.service.create({
			username,
			password: await bcrypt.hash(password, 10),
			role: UserRole.OWNER,
		});

		console.log(`\n\x1b[32m✅ Successfully created owner account: \x1b[1m${user.username}\x1b[0m\n`);

		this.logger.log(`[AUTH] Successfully created application owner=${user.username}`);
	}
}

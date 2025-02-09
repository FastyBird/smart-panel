import bcrypt from 'bcrypt';
import { Command, Positional } from 'nestjs-command';

import { Injectable, Logger } from '@nestjs/common';

import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';

@Injectable()
export class ResetPasswordCommand {
	private readonly logger = new Logger(ResetPasswordCommand.name);

	constructor(private readonly service: UsersService) {}

	@Command({
		command: 'auth:reset <username> <password>',
		describe: 'Reset application owner password',
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
			describe: 'the new password',
			type: 'string',
		})
		password: string,
	) {
		const user = await this.service.findByUsername(username);

		if (user === null || user.role !== UserRole.OWNER) {
			this.logger.warn(`[AUTH] No owner account found.`);

			console.log('\n\x1b[31m🚨 No owner account found. Cannot reset password.\n');

			return;
		}

		console.log(`\n\x1b[33m🔹 Resetting password for owner: \x1b[1m${user.username}\x1b[0m\n`);

		await this.service.update(user.id, {
			password: await bcrypt.hash(password, 10),
		});

		console.log(`\n\x1b[32m✅ Successfully reset password for: \x1b[1m${user.username}\x1b[0m\n`);

		this.logger.log(`[AUTH] Password reset successfully for owner=${user.username}`);
	}
}

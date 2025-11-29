import { Command, CommandRunner } from 'nest-commander';

import { Injectable, Logger } from '@nestjs/common';

import { UsersService } from '../services/users.service';

@Command({
	name: 'users:list',
	description: 'List system users',
})
@Injectable()
export class ListUsersCommand extends CommandRunner {
	private readonly logger = new Logger(ListUsersCommand.name);

	constructor(private readonly service: UsersService) {
		super();
	}

	async run(passedParams: string[], options?: Record<string, any>): Promise<void> {
		const users = await this.service.findAll();

		if (users.length === 0) {
			this.logger.warn(`[USERS] No registered users found.`);

			console.log('\x1b[33m⚠️ No registered users found.\x1b[0m');

			return;
		}

		console.log('\x1b[32m\x1b[1m\n📋 Registered Users:\n\x1b[0m');
		console.log('\x1b[36m───────────────────────────────────────────────────\x1b[0m');

		users.forEach((user, index) => {
			console.log(`${'\x1b[35m' + (index + 1) + '.\x1b[0m'} \x1b[1m${user.username}\x1b[0m`);
		});

		this.logger.debug(`[USERS] Successfully displayed user list.`);
	}
}

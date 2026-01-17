import inquirer from 'inquirer';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { SeedTools, Seeder } from '../../seed/services/seed.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { USERS_MODULE_NAME, UserRole } from '../users.constants';

import { UsersService } from './users.service';

// Default seed file name
const DEFAULT_USERS_FILE = 'users.json';

@Injectable()
export class UsersSeederService implements Seeder {
	private readonly logger = createExtensionLogger(USERS_MODULE_NAME, 'UsersSeederService');

	constructor(
		private readonly usersService: UsersService,
		private readonly seedTools: SeedTools,
	) {}

	async seed(): Promise<void> {
		const { seed } = await inquirer.prompt<{ seed: boolean }>([
			{
				type: 'confirm',
				name: 'seed',
				message: 'Would you like to seed the database with demo data for the Users module?',
				default: true,
			},
		]);

		if (!seed) {
			this.logger.log('[SEED] Skipping Users module.');

			return;
		}

		this.logger.log('[SEED] Seeding users module...');

		let seededUsers = 0;

		const users = this.seedTools.loadJsonData(DEFAULT_USERS_FILE);

		if (!users.length) {
			this.logger.warn('[SEED] No users found in users.json');
			return;
		}

		for (const user of users) {
			try {
				// Check if user with this username already exists
				const existingUser = await this.usersService.findByUsername(user.username as string);

				if (existingUser) {
					this.logger.debug(`[SEED] User with username=${user.username} already exists, skipping`);
					continue;
				}

				// Create the user
				const createDto: CreateUserDto = {
					id: user.id as string | undefined,
					username: user.username as string,
					password: user.password as string,
					email: (user.email as string | null) ?? null,
					first_name: (user.first_name as string | null) ?? null,
					last_name: (user.last_name as string | null) ?? null,
					role: user.role as UserRole | undefined,
				};

				await this.usersService.create(createDto);

				seededUsers++;

				this.logger.debug(`[SEED] Created user: ${user.username}`);
			} catch (error) {
				const err = error as Error;

				this.logger.error(`[SEED] Failed to create user: ${JSON.stringify(user)}`, {
					message: err.message,
					stack: err.stack,
				});
			}
		}

		this.logger.log(`[SEED] Successfully seeded ${seededUsers} users.`);
	}
}

import * as fs from 'fs';
import inquirer from 'inquirer';
import * as path from 'path';
import { DataSource } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { getEnvValue } from '../../../common/utils/config.utils';

export interface Seeder {
	seed(): Promise<void>;
}

@Injectable()
export class SeedTools {
	private readonly logger = new Logger(SeedTools.name);

	constructor(private readonly configService: NestConfigService) {}

	private getSeedPath(): string {
		return getEnvValue<string>(
			this.configService,
			'FB_SEED_DATA_PATH',
			path.resolve(__dirname, '../../../../../../var/data/seed'),
		);
	}

	loadJsonData(filename: string): Record<string, any>[] {
		const sanitizedFilename = filename.replace(/^\/+/, '');

		const filePath = path.join(this.getSeedPath(), sanitizedFilename);

		try {
			if (!fs.existsSync(filePath)) {
				this.logger.warn(`[SEED] File not found: ${filePath}`);
				return [];
			}

			const jsonData = fs.readFileSync(filePath, 'utf8');

			const parsed = JSON.parse(jsonData) as unknown;

			if (!Array.isArray(parsed)) {
				this.logger.error(`[SEED] Content of the file: ${filePath} is not a valid array`);

				return;
			}

			return parsed as Record<string, any>[];
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[SEED] Failed to load file: ${filePath}`, { message: err.message, stack: err.stack });

			return [];
		}
	}
}

@Injectable()
export class SeedService {
	private readonly logger = new Logger(SeedService.name);
	private readonly seeders: { seeder: Seeder; priority: number }[] = [];

	constructor(private readonly dataSource: DataSource) {}

	registerSeeder(seeder: Seeder, priority = 10) {
		this.seeders.push({ seeder, priority });
	}

	async seed() {
		try {
			this.logger.log('[SEED] Starting database seeding process...');

			const { truncate } = await inquirer.prompt<{ truncate: boolean }>([
				{
					type: 'confirm',
					name: 'truncate',
					message:
						'Do you want to truncate the database before seeding? (WARNING: This will delete all existing data!)',
					default: false,
				},
			]);

			if (truncate) {
				this.logger.warn('[SEED] Resetting database before seeding...');
				await this.resetDatabase();
			} else {
				this.logger.log('[SEED] Skipping database reset.');
			}

			// Sort seeders by priority (lower first)
			this.seeders.sort((a, b) => a.priority - b.priority);

			for (const { seeder } of this.seeders) {
				try {
					await seeder.seed();
				} catch (error) {
					const err = error as Error;

					this.logger.error(`[SEED] Failed in ${seeder.constructor.name}`, { message: err.message, stack: err.stack });
				}
			}

			this.logger.log('[SEED] Database seeding completed successfully.');
		} catch (error) {
			const err = error as Error;

			this.logger.error('[SEED] Seeding process failed', { message: err.message, stack: err.stack });
		}
	}

	private async resetDatabase(): Promise<void> {
		this.logger.warn('[SEED] Resetting database...');
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();

		try {
			await queryRunner.query('PRAGMA foreign_keys = OFF;');

			// Truncate all tables
			const tables = await queryRunner.getTables();
			for (const table of tables) {
				this.logger.debug(`[SEED] Truncating table: ${table.name}`);
				await queryRunner.query(`DELETE FROM "${table.name}";`);
			}

			await queryRunner.query('PRAGMA foreign_keys = ON;');

			this.logger.warn('[SEED] Database reset complete.');
		} catch (error) {
			const err = error as Error;

			this.logger.error('[SEED] Failed to reset database', { message: err.message, stack: err.stack });
		} finally {
			await queryRunner.release();
		}
	}
}

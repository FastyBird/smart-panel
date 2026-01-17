import inquirer from 'inquirer';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { SeedTools, Seeder } from '../../seed/services/seed.service';
import { CreateSceneDto } from '../dto/create-scene.dto';
import { SCENES_MODULE_NAME } from '../scenes.constants';

import { ScenesService } from './scenes.service';

// Default seed file name
const DEFAULT_SCENES_FILE = 'scenes.json';

@Injectable()
export class ScenesSeederService implements Seeder {
	private readonly logger = createExtensionLogger(SCENES_MODULE_NAME, 'ScenesSeederService');

	constructor(
		private readonly scenesService: ScenesService,
		private readonly seedTools: SeedTools,
	) {}

	async seed(): Promise<void> {
		const { seed } = await inquirer.prompt<{ seed: boolean }>([
			{
				type: 'confirm',
				name: 'seed',
				message: 'Would you like to seed the database with demo data for the Scenes module?',
				default: true,
			},
		]);

		if (!seed) {
			this.logger.log('[SEED] Skipping Scenes module.');

			return;
		}

		this.logger.log('[SEED] Seeding scenes module...');

		let seededScenes = 0;

		const scenes = this.seedTools.loadJsonData(DEFAULT_SCENES_FILE);

		if (!scenes.length) {
			this.logger.warn('[SEED] No scenes found in scenes.json');
			return;
		}

		for (const scene of scenes) {
			try {
				// Check if scene with this ID already exists
				if (scene.id) {
					const existingScene = await this.scenesService.findOne(scene.id as string);

					if (existingScene) {
						this.logger.debug(`[SEED] Scene with id=${scene.id} already exists, skipping`);
						continue;
					}
				}

				// Create the scene with actions
				const createDto: CreateSceneDto = {
					id: scene.id as string | undefined,
					name: scene.name as string,
					description: (scene.description as string | null) ?? null,
					category: scene.category as CreateSceneDto['category'] | undefined,
					primary_space_id: (scene.primary_space_id as string | null) ?? null,
					order: (scene.order as number) ?? 0,
					enabled: (scene.enabled as boolean) ?? true,
					triggerable: (scene.triggerable as boolean) ?? true,
					actions: scene.actions as CreateSceneDto['actions'],
				};

				await this.scenesService.create(createDto);

				seededScenes++;

				this.logger.debug(`[SEED] Created scene: ${scene.name}`);
			} catch (error) {
				const err = error as Error;

				this.logger.error(`[SEED] Failed to create scene: ${JSON.stringify(scene)}`, {
					message: err.message,
					stack: err.stack,
				});
			}
		}

		this.logger.log(`[SEED] Successfully seeded ${seededScenes} scenes.`);
	}
}

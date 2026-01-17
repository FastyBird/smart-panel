import inquirer from 'inquirer';
import { validate as uuidValidate } from 'uuid';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { SeedTools, Seeder } from '../../seed/services/seed.service';
import { SetClimateRoleDto } from '../dto/climate-role.dto';
import { CreateSpaceDto } from '../dto/create-space.dto';
import { SetLightingRoleDto } from '../dto/lighting-role.dto';
import { SPACES_MODULE_NAME } from '../spaces.constants';

import { SpaceClimateRoleService } from './space-climate-role.service';
import { SpaceLightingRoleService } from './space-lighting-role.service';
import { SpacesService } from './spaces.service';

// Default seed file names
const DEFAULT_SPACES_FILE = 'spaces.json';
const DEFAULT_LIGHTING_ROLES_FILE = 'spaces_lighting_roles.json';
const DEFAULT_CLIMATE_ROLES_FILE = 'spaces_climate_roles.json';

@Injectable()
export class SpacesSeederService implements Seeder {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpacesSeederService');

	constructor(
		private readonly spacesService: SpacesService,
		private readonly lightingRoleService: SpaceLightingRoleService,
		private readonly climateRoleService: SpaceClimateRoleService,
		private readonly seedTools: SeedTools,
	) {}

	async seed(): Promise<void> {
		const { seed } = await inquirer.prompt<{ seed: boolean }>([
			{
				type: 'confirm',
				name: 'seed',
				message: 'Would you like to seed the database with demo data for the Spaces module?',
				default: true,
			},
		]);

		if (!seed) {
			this.logger.log('[SEED] Skipping Spaces module.');

			return;
		}

		this.logger.log('[SEED] Seeding spaces module...');

		let seededSpaces = 0;
		let seededLightingRoles = 0;
		let seededClimateRoles = 0;

		const spaces = this.seedTools.loadJsonData(DEFAULT_SPACES_FILE);
		const lightingRoles = this.seedTools.loadJsonData(DEFAULT_LIGHTING_ROLES_FILE);
		const climateRoles = this.seedTools.loadJsonData(DEFAULT_CLIMATE_ROLES_FILE);

		// Seed spaces
		if (spaces.length) {
			for (const space of spaces) {
				try {
					await this.createSpace(space);
					seededSpaces++;
				} catch (error) {
					const err = error as Error;

					this.logger.error(`[SEED] Failed to create space: ${JSON.stringify(space)} error=${err.message}`, err.stack);
				}
			}
		} else {
			this.logger.warn('[SEED] No spaces found in spaces.json');
		}

		// Seed lighting roles
		if (lightingRoles.length) {
			for (const role of lightingRoles) {
				try {
					await this.createLightingRole(role);
					seededLightingRoles++;
				} catch (error) {
					const err = error as Error;

					this.logger.error(
						`[SEED] Failed to create lighting role: ${JSON.stringify(role)} error=${err.message}`,
						err.stack,
					);
				}
			}
		} else {
			this.logger.debug('[SEED] No lighting roles found in spaces_lighting_roles.json');
		}

		// Seed climate roles
		if (climateRoles.length) {
			for (const role of climateRoles) {
				try {
					await this.createClimateRole(role);
					seededClimateRoles++;
				} catch (error) {
					const err = error as Error;

					this.logger.error(
						`[SEED] Failed to create climate role: ${JSON.stringify(role)} error=${err.message}`,
						err.stack,
					);
				}
			}
		} else {
			this.logger.debug('[SEED] No climate roles found in spaces_climate_roles.json');
		}

		this.logger.log(
			`[SEED] Successfully seeded ${seededSpaces} spaces, ${seededLightingRoles} lighting roles, ${seededClimateRoles} climate roles.`,
		);
	}

	private async createSpace(space: Record<string, any>): Promise<void> {
		const dtoInstance = toInstance(CreateSpaceDto, space);

		await this.spacesService.create(dtoInstance);

		this.logger.debug(`[SEED] Created space: ${space.name}`);
	}

	private async createLightingRole(role: Record<string, any>): Promise<void> {
		const spaceId = role['space_id'] as string | undefined;

		if (typeof spaceId !== 'string' || !uuidValidate(spaceId)) {
			this.logger.error(`[SEED] Lighting role space_id=${spaceId} is not a valid UUIDv4`);

			return;
		}

		// Verify space exists
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.error(`[SEED] Space with id=${spaceId} not found for lighting role`);

			return;
		}

		const dto: SetLightingRoleDto = {
			deviceId: role['device_id'] as string,
			channelId: role['channel_id'] as string,
			role: role['role'] as SetLightingRoleDto['role'],
			priority: (role['priority'] as number) ?? 0,
		};

		await this.lightingRoleService.setRole(spaceId, dto);

		this.logger.debug(`[SEED] Created lighting role for device=${dto.deviceId} channel=${dto.channelId}`);
	}

	private async createClimateRole(role: Record<string, any>): Promise<void> {
		const spaceId = role['space_id'] as string | undefined;

		if (typeof spaceId !== 'string' || !uuidValidate(spaceId)) {
			this.logger.error(`[SEED] Climate role space_id=${spaceId} is not a valid UUIDv4`);

			return;
		}

		// Verify space exists
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.error(`[SEED] Space with id=${spaceId} not found for climate role`);

			return;
		}

		const dto: SetClimateRoleDto = {
			deviceId: role['device_id'] as string,
			channelId: (role['channel_id'] as string | null) ?? undefined,
			role: role['role'] as SetClimateRoleDto['role'],
			priority: (role['priority'] as number) ?? 0,
		};

		await this.climateRoleService.setRole(spaceId, dto);

		this.logger.debug(`[SEED] Created climate role for device=${dto.deviceId}`);
	}
}

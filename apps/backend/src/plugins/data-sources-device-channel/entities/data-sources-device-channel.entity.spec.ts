/**
 * ⚠️ Note:
 * Some OpenAPI types are explicitly extended with additional properties like `page`, `card`, and `tile`
 * (e.g., `& { page: string; card: string; tile: string }`) in order to match the structure of the TypeORM entities.
 *
 * This is required because our entity models use table inheritance and shared base properties, so the
 * relations (even if optional or unused in the given type) are present and validated.
 *
 * These extra props do not exist in the OpenAPI spec itself, but are necessary for validation and
 * compatibility with class-transformer + class-validator during test synchronization.
 *
 * Please keep this in mind when updating entity fields or OpenAPI schemas.
 */
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { components } from '../../../openapi';

import { DeviceChannelDataSourceEntity } from './data-sources-device-channel.entity';

type DeviceChannelDataSource = components['schemas']['DataSourcesDeviceChannelPluginDeviceChannelDataSource'];

const caseRegex = new RegExp('_([a-z0-9])', 'g');

describe('Plugin entity and OpenAPI Model Synchronization', () => {
	const validateEntityAgainstModel = <T extends object, U extends object>(entity: T, model: U) => {
		// Convert model keys from snake_case to camelCase
		const modelKeys = Object.keys(model).map((attribute) => attribute.replaceAll(caseRegex, (g) => g[1].toUpperCase()));

		// Check that all keys in the model (converted to camelCase) exist in the entity
		modelKeys.forEach((key) => {
			expect(entity).toHaveProperty(key);
		});

		// Convert entity keys to snake_case and compare against the model keys
		const entityKeys = Object.keys(entity).map((key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`));

		const originalModelKeys = Object.keys(model);
		entityKeys.forEach((key) => {
			expect(originalModelKeys).toContain(key);
		});
	};

	test('DeviceChannelDataSourceEntity matches DashboardDeviceChannelDataSource', () => {
		const openApiModel: DeviceChannelDataSource & { parent_type: string; parent_id: string } = {
			id: uuid().toString(),
			type: 'device-channel',
			parent: {
				type: 'tile',
				id: uuid().toString(),
			},
			device: uuid().toString(),
			channel: uuid().toString(),
			property: uuid().toString(),
			icon: 'icon',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			parent_type: 'page',
			parent_id: uuid().toString(),
		};

		const entityInstance = plainToInstance(DeviceChannelDataSourceEntity, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		expect(errors).toHaveLength(0);
	});
});

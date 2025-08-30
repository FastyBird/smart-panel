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
import { validateSync } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { toInstance } from '../../../common/utils/transform.utils';
import { components } from '../../../openapi';
import { TILES_DEVICE_PREVIEW_TYPE } from '../tiles-device-preview.constants';

import { DevicePreviewTileEntity } from './tiles-device-preview.entity';

type DevicePreviewTile = components['schemas']['TilesDevicePreviewPluginDevicePreviewTile'];

const caseRegex = new RegExp('_([a-z0-9])', 'g');

describe('Device preview tiles plugin entity and OpenAPI Model Synchronization', () => {
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

	test('DevicePreviewTileEntity matches DashboardDevicePreviewTile', () => {
		const openApiModel: DevicePreviewTile & { parent_type: string; parent_id: string } = {
			id: uuid().toString(),
			type: TILES_DEVICE_PREVIEW_TYPE,
			parent: {
				type: 'page',
				id: uuid().toString(),
			},
			device: uuid().toString(),
			row: 1,
			col: 0,
			row_span: 2,
			col_span: 2,
			hidden: false,
			icon: 'icon',
			data_source: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			parent_type: 'page',
			parent_id: uuid().toString(),
		};

		const entityInstance = toInstance(DevicePreviewTileEntity, openApiModel);

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		expect(errors).toHaveLength(0);
	});
});

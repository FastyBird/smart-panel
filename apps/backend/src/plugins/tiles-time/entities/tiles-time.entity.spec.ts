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

import { TimeTileEntity } from './tiles-time.entity';

type TimeTile = components['schemas']['TilesTimePluginTimeTile'];

const caseRegex = new RegExp('_([a-z0-9])', 'g');

describe('Time tiles plugin entity and OpenAPI Model Synchronization', () => {
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

	test('TimeTileEntity matches DashboardTimeTile', () => {
		const openApiModel: TimeTile & { parent_type: string; parent_id: string } = {
			id: uuid().toString(),
			type: 'clock',
			parent: {
				type: 'page',
				id: uuid().toString(),
			},
			row: 1,
			col: 0,
			row_span: 2,
			col_span: 2,
			hidden: false,
			data_source: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			parent_type: 'page',
			parent_id: uuid().toString(),
		};

		const entityInstance = plainToInstance(TimeTileEntity, openApiModel, {
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

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
import { Expose } from 'class-transformer';
import { validateSync } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { components } from '../../../openapi';

import { DataSourceEntity, PageEntity, TileEntity } from './dashboard.entity';

type Page = components['schemas']['DashboardModulePage'];
type Tile = components['schemas']['DashboardModuleTile'];
type DataSource = components['schemas']['DashboardModuleDataSource'];

const caseRegex = new RegExp('_([a-z0-9])', 'g');

class PageBaseEntity extends PageEntity {
	@Expose()
	get type(): string {
		return 'mock';
	}
}
class TileBaseEntity extends TileEntity {
	@Expose()
	get type(): string {
		return 'mock';
	}
}
class DataSourceBaseEntity extends DataSourceEntity {
	@Expose()
	get type(): string {
		return 'mock';
	}
}

describe('Dashboard module entity and OpenAPI component synchronization', () => {
	const validateEntityAgainstModel = <T extends object, U extends object>(entity: T, component: U) => {
		// Convert component keys from snake_case to camelCase
		const componentKeys = Object.keys(component).map((attribute) =>
			attribute.replaceAll(caseRegex, (g) => g[1].toUpperCase()),
		);

		// Check that all keys in the component (converted to camelCase) exist in the entity
		componentKeys.forEach((key) => {
			expect(entity).toHaveProperty(key);
		});

		// Convert entity keys to snake_case and compare against the component keys
		const entityKeys = Object.keys(entity).map((key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`));

		const originalModelKeys = Object.keys(component);
		entityKeys.forEach((key) => {
			expect(originalModelKeys).toContain(key);
		});
	};

	test('PageEntity matches DashboardPage', () => {
		const openApiModel: Page = {
			id: uuid().toString(),
			type: 'page',
			title: 'Cards Dashboard',
			icon: 'cards-icon',
			order: 1,
			data_source: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = plainToInstance(PageBaseEntity, openApiModel, {
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

	test('TileEntity matches DashboardTile', () => {
		const openApiModel: Tile & { parent_type: string; parent_id: string } = {
			id: uuid().toString(),
			type: 'tile',
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

		const entityInstance = plainToInstance(TileBaseEntity, openApiModel, {
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

	test('DataSourceEntity matches DashboardDataSource', () => {
		const openApiModel: DataSource & { parent_type: string; parent_id: string } = {
			id: uuid().toString(),
			type: 'data-source',
			parent: {
				type: 'tile',
				id: uuid().toString(),
			},
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			parent_type: 'page',
			parent_id: uuid().toString(),
		};

		const entityInstance = plainToInstance(DataSourceBaseEntity, openApiModel, {
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

import { plainToInstance } from 'class-transformer';
import { Expose } from 'class-transformer';
import { validateSync } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { components } from '../../../openapi';

import {
	CardEntity,
	CardsPageEntity,
	DataSourceEntity,
	DayWeatherTileEntity,
	DeviceChannelDataSourceEntity,
	DevicePageEntity,
	DeviceTileEntity,
	ForecastWeatherTileEntity,
	PageEntity,
	TileEntity,
	TilesPageEntity,
	TimeTileEntity,
} from './dashboard.entity';

type Page = components['schemas']['DashboardPageBase'];
type CardsPage = components['schemas']['DashboardCardsPage'];
type TilesPage = components['schemas']['DashboardTilesPage'];
type DevicePage = components['schemas']['DashboardDevicePage'];
type Tile = components['schemas']['DashboardTileBase'];
type DeviceTile = components['schemas']['DashboardDeviceTile'];
type TimeTile = components['schemas']['DashboardTimeTile'];
type DayWeatherTile = components['schemas']['DashboardDayWeatherTile'];
type ForecastWeatherTile = components['schemas']['DashboardForecastWeatherTile'];
type DataSource = components['schemas']['DashboardDataSourceBase'];
type DeviceChannelDataSource = components['schemas']['DashboardDeviceChannelDataSource'];
type Card = components['schemas']['DashboardCard'];

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

describe('Dashboard module entity and OpenAPI Model Synchronization', () => {
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

	test('PageEntity matches DashboardPage', () => {
		const openApiModel: Page = {
			id: uuid().toString(),
			title: 'Cards Dashboard',
			icon: 'cards-icon',
			order: 1,
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

	test('CardsPageEntity matches DashboardCardsPage', () => {
		const openApiModel: CardsPage = {
			id: uuid().toString(),
			type: 'cards',
			title: 'Cards Dashboard',
			icon: 'cards-icon',
			order: 1,
			cards: [],
			data_source: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = plainToInstance(CardsPageEntity, openApiModel, {
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

	test('TilesPageEntity matches DashboardTilesPage', () => {
		const openApiModel: TilesPage = {
			id: uuid().toString(),
			type: 'tiles',
			title: 'Cards Dashboard',
			icon: 'cards-icon',
			order: 1,
			tiles: [],
			data_source: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = plainToInstance(TilesPageEntity, openApiModel, {
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

	test('DevicePageEntity matches DashboardDevicePage', () => {
		const openApiModel: DevicePage = {
			id: uuid().toString(),
			type: 'device',
			title: 'Device Dashboard',
			icon: 'device-icon',
			order: 1,
			device: uuid().toString(),
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = plainToInstance(DevicePageEntity, openApiModel, {
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
		const openApiModel: Tile = {
			id: uuid().toString(),
			page: uuid().toString(),
			card: uuid().toString(),
			row: 1,
			col: 0,
			row_span: 2,
			col_span: 2,
			data_source: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
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

	test('DeviceTileEntity matches DashboardDeviceTile', () => {
		const openApiModel: DeviceTile = {
			id: uuid().toString(),
			type: 'device',
			page: uuid().toString(),
			card: uuid().toString(),
			device: uuid().toString(),
			row: 1,
			col: 0,
			row_span: 2,
			col_span: 2,
			icon: 'icon',
			data_source: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = plainToInstance(DeviceTileEntity, openApiModel, {
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

	test('TimeTileEntity matches DashboardTimeTile', () => {
		const openApiModel: TimeTile = {
			id: uuid().toString(),
			type: 'clock',
			page: uuid().toString(),
			card: uuid().toString(),
			row: 1,
			col: 0,
			row_span: 2,
			col_span: 2,
			data_source: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
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

	test('DayWeatherTileEntity matches DashboardDayWeatherTile', () => {
		const openApiModel: DayWeatherTile = {
			id: uuid().toString(),
			type: 'weather-day',
			page: uuid().toString(),
			card: uuid().toString(),
			row: 1,
			col: 0,
			row_span: 2,
			col_span: 2,
			data_source: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = plainToInstance(DayWeatherTileEntity, openApiModel, {
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

	test('ForecastWeatherTileEntity matches DashboardForecastWeatherTile', () => {
		const openApiModel: ForecastWeatherTile = {
			id: uuid().toString(),
			type: 'weather-forecast',
			page: uuid().toString(),
			card: uuid().toString(),
			row: 1,
			col: 0,
			row_span: 2,
			col_span: 2,
			data_source: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = plainToInstance(ForecastWeatherTileEntity, openApiModel, {
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
		const openApiModel: DataSource = {
			id: uuid().toString(),
			page: uuid().toString(),
			tile: uuid().toString(),
			card: uuid().toString(),
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
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

	test('DeviceChannelDataSourceEntity matches DashboardDeviceChannelDataSource', () => {
		const openApiModel: DeviceChannelDataSource = {
			id: uuid().toString(),
			type: 'device-channel',
			page: uuid().toString(),
			tile: uuid().toString(),
			card: uuid().toString(),
			device: uuid().toString(),
			channel: uuid().toString(),
			property: uuid().toString(),
			icon: 'icon',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
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

	test('CardEntity matches DashboardCard', () => {
		const openApiModel: Card = {
			id: uuid().toString(),
			title: 'Card title',
			icon: 'Card icon',
			order: 0,
			page: uuid().toString(),
			tiles: [],
			data_source: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = plainToInstance(CardEntity, openApiModel, {
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

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { v4 as uuid } from 'uuid';

import type { components } from '../../../openapi';
import { ChannelCategory, DataTypeType, DeviceCategory, PermissionType, PropertyCategory } from '../devices.constants';

import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from './devices.entity';

type Device = components['schemas']['DevicesModuleDevice'];
type DeviceControl = components['schemas']['DevicesModuleDeviceControl'];
type Channel = components['schemas']['DevicesModuleChannel'];
type ChannelControl = components['schemas']['DevicesModuleChannelControl'];
type ChannelProperty = components['schemas']['DevicesModuleChannelProperty'];

const caseRegex = new RegExp('_([a-z0-9])', 'g');

describe('Devices module entity and OpenAPI component synchronization', () => {
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

	test('DeviceEntity matches DevicesDevice', () => {
		const openApiModel: Device = {
			id: uuid().toString(),
			type: 'device',
			category: DeviceCategory.GENERIC,
			name: 'Thermostat',
			description: 'Living room thermostat',
			controls: [],
			channels: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = plainToInstance(DeviceEntity, openApiModel, {
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

	test('DeviceControlEntity matches DevicesDeviceControl', () => {
		const openApiModel: DeviceControl = {
			id: uuid().toString(),
			name: 'reboot',
			device: uuid().toString(),
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = plainToInstance(DeviceControlEntity, openApiModel, {
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

	test('ChannelEntity matches DevicesChannel', () => {
		const openApiModel: Channel = {
			id: uuid().toString(),
			type: 'channel',
			category: ChannelCategory.GENERIC,
			name: 'Temperature Sensor',
			description: 'Living room temperature sensor',
			device: uuid().toString(),
			controls: [],
			properties: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = plainToInstance(ChannelEntity, openApiModel, {
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

	test('ChannelControlEntity matches DevicesChannelControl', () => {
		const openApiModel: ChannelControl = {
			id: uuid().toString(),
			name: 'reset',
			channel: uuid().toString(),
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = plainToInstance(ChannelControlEntity, openApiModel, {
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

	test('ChannelPropertyEntity matches DevicesChannelProperty', () => {
		const openApiModel: ChannelProperty = {
			id: uuid().toString(),
			type: 'property',
			category: PropertyCategory.GENERIC,
			name: 'Thermostat Mode',
			permissions: [PermissionType.READ_ONLY],
			data_type: DataTypeType.STRING,
			unit: '°C',
			format: ['heat', 'auto'],
			invalid: -999,
			step: 0.5,
			value: '22.1',
			channel: uuid().toString(),
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = plainToInstance(ChannelPropertyEntity, openApiModel, {
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

import { validateSync } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../devices.constants';

import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from './devices.entity';

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
		const openApiModel = {
			id: uuid().toString(),
			type: 'device',
			category: DeviceCategory.GENERIC,
			identifier: null,
			name: 'Thermostat',
			description: 'Living room thermostat',
			enabled: true,
			status: {
				online: false,
				status: ConnectionState.UNKNOWN,
			},
			controls: [],
			channels: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = toInstance(DeviceEntity, openApiModel);

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('DeviceControlEntity matches DevicesDeviceControl', () => {
		const openApiModel = {
			id: uuid().toString(),
			name: 'reboot',
			device: uuid().toString(),
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = toInstance(DeviceControlEntity, openApiModel);

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('ChannelEntity matches DevicesChannel', () => {
		const openApiModel = {
			id: uuid().toString(),
			type: 'channel',
			category: ChannelCategory.GENERIC,
			identifier: null,
			name: 'Temperature Sensor',
			description: 'Living room temperature sensor',
			device: uuid().toString(),
			controls: [],
			properties: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = toInstance(ChannelEntity, openApiModel);

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('ChannelControlEntity matches DevicesChannelControl', () => {
		const openApiModel = {
			id: uuid().toString(),
			name: 'reset',
			channel: uuid().toString(),
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const entityInstance = toInstance(ChannelControlEntity, openApiModel);

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('ChannelPropertyEntity matches DevicesChannelProperty', () => {
		const openApiModel = {
			id: uuid().toString(),
			type: 'property',
			category: PropertyCategory.GENERIC,
			identifier: null,
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

		const entityInstance = toInstance(ChannelPropertyEntity, openApiModel);

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});
});

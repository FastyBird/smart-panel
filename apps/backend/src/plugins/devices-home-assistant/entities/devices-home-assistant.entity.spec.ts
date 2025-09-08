import { validateSync } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import type { components } from '../../../openapi';

import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from './devices-home-assistant.entity';

type HomeAssistantPluginHomeAssistantDevice = components['schemas']['DevicesHomeAssistantPluginHomeAssistantDevice'];
type HomeAssistantPluginHomeAssistantChannel = components['schemas']['DevicesHomeAssistantPluginHomeAssistantChannel'];
type HomeAssistantPluginHomeAssistantChannelProperty =
	components['schemas']['DevicesHomeAssistantPluginHomeAssistantChannelProperty'];

const caseRegex = new RegExp('_([a-z0-9])', 'g');

describe('Devices Home Assistant plugin entity and OpenAPI Model Synchronization', () => {
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

	test('HomeAssistantDeviceEntity matches HomeAssistantDevicesDevice', () => {
		const openApiModel: HomeAssistantPluginHomeAssistantDevice = {
			id: uuid().toString(),
			type: 'device',
			category: DeviceCategory.GENERIC,
			identifier: null,
			name: 'Thermostat',
			description: 'Living room thermostat',
			enabled: true,
			controls: [],
			channels: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			ha_device_id: 'light.hall_cabinet_lights_lights',
		};

		const entityInstance = toInstance(HomeAssistantDeviceEntity, openApiModel);

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('ChannelEntity matches DevicesChannel', () => {
		const openApiModel: HomeAssistantPluginHomeAssistantChannel = {
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

		const entityInstance = toInstance(HomeAssistantChannelEntity, openApiModel);

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('ChannelPropertyEntity matches DevicesChannelProperty', () => {
		const openApiModel: HomeAssistantPluginHomeAssistantChannelProperty = {
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
			ha_entity_id: 'light.hall_cabinet_lights_lights',
			ha_attribute: 'brightness',
		};

		const entityInstance = toInstance(HomeAssistantChannelPropertyEntity, openApiModel);

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});
});

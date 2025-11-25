import { validateSync } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { toInstance } from '../../../common/utils/transform.utils';
import { ConnectionState, DeviceCategory } from '../../../modules/devices/devices.constants';
import { DEVICES_THIRD_PARTY_TYPE } from '../devices-third-party.constants';

import { ThirdPartyDeviceEntity } from './devices-third-party.entity';

const caseRegex = new RegExp('_([a-z0-9])', 'g');

describe('Devices Third-Party plugin entity and OpenAPI Model Synchronization', () => {
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

	test('ThirdPartyDeviceEntity matches ThirdPartyDevicesDevice', () => {
		const openApiModel = {
			id: uuid().toString(),
			type: DEVICES_THIRD_PARTY_TYPE,
			category: DeviceCategory.GENERIC,
			identifier: null,
			name: 'Thermostat',
			description: 'Living room thermostat',
			enabled: true,
			status: {
				online: true,
				status: ConnectionState.CONNECTED,
			},
			controls: [],
			channels: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			service_address: 'http://localhost:8080',
		};

		const entityInstance = toInstance(ThirdPartyDeviceEntity, openApiModel);

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});
});

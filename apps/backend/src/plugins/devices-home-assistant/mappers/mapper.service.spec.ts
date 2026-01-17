/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Test, TestingModule } from '@nestjs/testing';

import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DEVICES_HOME_ASSISTANT_TYPE, HomeAssistantDomain } from '../devices-home-assistant.constants';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';
import { BUILTIN_TRANSFORMERS, TransformerRegistry } from '../mappings/transformers/transformer.registry';
import { VirtualPropertyService } from '../services/virtual-property.service';

import { MapperService } from './mapper.service';
import { UniversalEntityMapperService } from './universal.entity.mapper.service';

describe('MapperService', () => {
	let service: MapperService;
	let channelsService: jest.Mocked<ChannelsService>;
	let channelsPropertiesService: jest.Mocked<ChannelsPropertiesService>;
	let universalEntityMapperService: jest.Mocked<UniversalEntityMapperService>;
	let transformerRegistry: TransformerRegistry;

	const mockDevice: HomeAssistantDeviceEntity = {
		id: 'device-1',
		type: DEVICES_HOME_ASSISTANT_TYPE,
		haDeviceId: 'ha-device-1',
	} as HomeAssistantDeviceEntity;

	const mockChannel = {
		id: 'channel-1',
		type: DEVICES_HOME_ASSISTANT_TYPE,
		category: ChannelCategory.LIGHT,
		device: mockDevice,
	} as unknown as HomeAssistantChannelEntity;

	beforeEach(async () => {
		// Create a real TransformerRegistry with built-in transformers
		transformerRegistry = new TransformerRegistry();
		transformerRegistry.registerAll(BUILTIN_TRANSFORMERS);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MapperService,
				{
					provide: ChannelsService,
					useValue: {
						findAll: jest.fn(),
					},
				},
				{
					provide: ChannelsPropertiesService,
					useValue: {
						findAll: jest.fn(),
					},
				},
				{
					provide: UniversalEntityMapperService,
					useValue: {
						mapFromHA: jest.fn().mockResolvedValue(new Map()),
						mapToHA: jest.fn().mockResolvedValue(null),
					},
				},
				{
					provide: VirtualPropertyService,
					useValue: {
						resolveVirtualPropertyValue: jest.fn(),
					},
				},
				{
					provide: TransformerRegistry,
					useValue: transformerRegistry,
				},
			],
		}).compile();

		service = module.get(MapperService);
		channelsService = module.get(ChannelsService);
		channelsPropertiesService = module.get(ChannelsPropertiesService);
		universalEntityMapperService = module.get(UniversalEntityMapperService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('mapFromHA - Transformer Application', () => {
		it('should apply brightness_to_percent transformer when reading brightness from HA', async () => {
			// Arrange: HA sends brightness as 0-255
			const brightnessProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-brightness',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.BRIGHTNESS,
				dataType: DataTypeType.UCHAR,
				permissions: [PermissionType.READ_ONLY],
				haEntityId: 'light.test',
				haAttribute: 'brightness',
				haTransformer: 'brightness_to_percent', // Transformer configured
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([brightnessProperty]);

			// Configure universalEntityMapperService to return the brightness value
			universalEntityMapperService.mapFromHA.mockResolvedValue(
				new Map([['prop-brightness', 255]]), // Return the raw HA value
			);

			const states = [
				{
					entity_id: 'light.test',
					state: 'on',
					attributes: {
						brightness: 255, // Full brightness in HA (0-255)
					},
				},
			] as unknown as HomeAssistantStateDto[];

			// Act
			const result = await service.mapFromHA(mockDevice, states);

			// Assert: Should be transformed to 100%
			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].property.id).toBe('prop-brightness');
			expect(result[0][0].value).toBe(100); // Transformed from 255 to 100%
		});

		it('should apply brightness_to_percent transformer for mid-range values', async () => {
			const brightnessProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-brightness',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.BRIGHTNESS,
				dataType: DataTypeType.UCHAR,
				permissions: [PermissionType.READ_ONLY],
				haEntityId: 'light.test',
				haAttribute: 'brightness',
				haTransformer: 'brightness_to_percent',
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([brightnessProperty]);
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map([['prop-brightness', 127]]));

			const states = [
				{
					entity_id: 'light.test',
					state: 'on',
					attributes: {
						brightness: 127, // ~50% brightness in HA
					},
				},
			] as unknown as HomeAssistantStateDto[];

			const result = await service.mapFromHA(mockDevice, states);

			expect(result[0][0].value).toBe(50); // 127/255 * 100 ≈ 50
		});

		it('should apply state_on_off transformer when reading state', async () => {
			const onProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-on',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
				haEntityId: 'light.test',
				haAttribute: 'fb.main_state',
				haTransformer: 'state_on_off',
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([onProperty]);
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map([['prop-on', 'on']]));

			const states = [
				{
					entity_id: 'light.test',
					state: 'on',
					attributes: {},
				},
			] as unknown as HomeAssistantStateDto[];

			const result = await service.mapFromHA(mockDevice, states);

			expect(result[0][0].value).toBe(true); // 'on' transformed to true
		});

		it('should apply state_on_off transformer for off state', async () => {
			const onProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-on',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
				haEntityId: 'light.test',
				haAttribute: 'fb.main_state',
				haTransformer: 'state_on_off',
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([onProperty]);
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map([['prop-on', 'off']]));

			const states = [
				{
					entity_id: 'light.test',
					state: 'off',
					attributes: {},
				},
			] as unknown as HomeAssistantStateDto[];

			const result = await service.mapFromHA(mockDevice, states);

			expect(result[0][0].value).toBe(false); // 'off' transformed to false
		});

		it('should apply mireds_to_kelvin transformer for color temperature', async () => {
			const colorTempProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-color-temp',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.COLOR_TEMPERATURE,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				haEntityId: 'light.test',
				haAttribute: 'color_temp',
				haTransformer: 'mireds_to_kelvin',
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([colorTempProperty]);
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map([['prop-color-temp', 250]]));

			const states = [
				{
					entity_id: 'light.test',
					state: 'on',
					attributes: {
						color_temp: 250, // 250 mireds
					},
				},
			] as unknown as HomeAssistantStateDto[];

			const result = await service.mapFromHA(mockDevice, states);

			expect(result[0][0].value).toBe(4000); // 1000000 / 250 = 4000K
		});

		it('should NOT apply transformer when haTransformer is null', async () => {
			const brightnessProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-brightness',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.BRIGHTNESS,
				dataType: DataTypeType.UCHAR,
				permissions: [PermissionType.READ_ONLY],
				haEntityId: 'light.test',
				haAttribute: 'brightness',
				haTransformer: null, // No transformer
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([brightnessProperty]);
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map([['prop-brightness', 255]]));

			const states = [
				{
					entity_id: 'light.test',
					state: 'on',
					attributes: {
						brightness: 255,
					},
				},
			] as unknown as HomeAssistantStateDto[];

			const result = await service.mapFromHA(mockDevice, states);

			// Value should remain as-is without transformation
			expect(result[0][0].value).toBe(255);
		});

		it('should use passthrough for unknown transformer names', async () => {
			const property: HomeAssistantChannelPropertyEntity = {
				id: 'prop-test',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.BRIGHTNESS,
				dataType: DataTypeType.UCHAR,
				permissions: [PermissionType.READ_ONLY],
				haEntityId: 'light.test',
				haAttribute: 'brightness',
				haTransformer: 'unknown_transformer', // Doesn't exist
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([property]);
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map([['prop-test', 200]]));

			const states = [
				{
					entity_id: 'light.test',
					state: 'on',
					attributes: {
						brightness: 200,
					},
				},
			] as unknown as HomeAssistantStateDto[];

			const result = await service.mapFromHA(mockDevice, states);

			// Passthrough returns value as-is
			expect(result[0][0].value).toBe(200);
		});

		it('should handle null values without applying transformer', async () => {
			const brightnessProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-brightness',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.BRIGHTNESS,
				dataType: DataTypeType.UCHAR,
				permissions: [PermissionType.READ_ONLY],
				haEntityId: 'light.test',
				haAttribute: 'brightness',
				haTransformer: 'brightness_to_percent',
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([brightnessProperty]);
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map([['prop-brightness', null]]));

			const states = [
				{
					entity_id: 'light.test',
					state: 'off',
					attributes: {
						brightness: null, // Light is off, brightness is null
					},
				},
			] as unknown as HomeAssistantStateDto[];

			const result = await service.mapFromHA(mockDevice, states);

			expect(result[0][0].value).toBe(null);
		});

		it('should apply lock_state transformer', async () => {
			const lockChannel = {
				id: 'channel-lock',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: ChannelCategory.LOCK,
				device: mockDevice,
			} as unknown as HomeAssistantChannelEntity;

			const lockProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-locked',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.LOCKED,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
				haEntityId: 'lock.front_door',
				haAttribute: 'fb.main_state',
				haTransformer: 'lock_state',
				channel: lockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([lockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([lockProperty]);
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map([['prop-locked', 'locked']]));

			const states = [
				{
					entity_id: 'lock.front_door',
					state: 'locked',
					attributes: {},
				},
			] as unknown as HomeAssistantStateDto[];

			const result = await service.mapFromHA(mockDevice, states);

			expect(result[0][0].value).toBe(true); // 'locked' transformed to true
		});

		it('should apply hvac_mode transformer', async () => {
			const thermostatChannel = {
				id: 'channel-thermostat',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: ChannelCategory.THERMOSTAT,
				device: mockDevice,
			} as unknown as HomeAssistantChannelEntity;

			const modeProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-mode',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.MODE,
				dataType: DataTypeType.ENUM,
				permissions: [PermissionType.READ_ONLY],
				haEntityId: 'climate.living_room',
				haAttribute: 'fb.main_state',
				haTransformer: 'hvac_mode',
				channel: thermostatChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([thermostatChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([modeProperty]);
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map([['prop-mode', 'heat']]));

			const states = [
				{
					entity_id: 'climate.living_room',
					state: 'heat',
					attributes: {},
				},
			] as unknown as HomeAssistantStateDto[];

			const result = await service.mapFromHA(mockDevice, states);

			expect(result[0][0].value).toBe('heating'); // 'heat' transformed to 'heating'
		});
	});

	describe('mapToHA - Transformer Application', () => {
		it('should apply brightness_to_percent transformer write() when writing brightness', async () => {
			// The same transformer is used for both read and write:
			// - read() converts HA brightness (0-255) to percentage (0-100)
			// - write() converts percentage (0-100) back to HA brightness (0-255)
			const brightnessProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-brightness',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.BRIGHTNESS,
				dataType: DataTypeType.UCHAR,
				permissions: [PermissionType.READ_WRITE],
				haEntityId: 'light.test',
				haAttribute: 'brightness',
				haTransformer: 'brightness_to_percent', // Same transformer, write() inverts read()
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([brightnessProperty]);

			// Register a light mapper
			const mockLightMapper = {
				domain: HomeAssistantDomain.LIGHT,
				mapFromHA: jest.fn(),
				mapToHA: jest.fn().mockResolvedValue({
					state: 'on',
					service: 'turn_on',
					attributes: new Map([['brightness', 255]]),
				}),
			};
			service.registerMapper(mockLightMapper);

			const values = new Map<string, string | number | boolean>();
			values.set('prop-brightness', 100); // Smart Panel sends 100%

			await service.mapToHA(mockDevice, values);

			// The mapper should receive transformed value
			expect(mockLightMapper.mapToHA).toHaveBeenCalled();
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
			const callArgs = (mockLightMapper.mapToHA as any).mock.calls[0][1] as Map<string, string | number | boolean>;
			expect(callArgs.get('prop-brightness')).toBe(255); // 100% transformed to 255
		});

		it('should apply state_on_off transformer in reverse when writing', async () => {
			const onProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-on',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
				haEntityId: 'light.test',
				haAttribute: 'fb.main_state',
				haTransformer: 'state_on_off',
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([onProperty]);

			const mockLightMapper = {
				domain: HomeAssistantDomain.LIGHT,
				mapFromHA: jest.fn(),
				mapToHA: jest.fn().mockResolvedValue({
					state: 'on',
					service: 'turn_on',
					attributes: new Map(),
				}),
			};
			service.registerMapper(mockLightMapper);

			const values = new Map<string, string | number | boolean>();
			values.set('prop-on', true); // Smart Panel sends boolean true

			await service.mapToHA(mockDevice, values);

			// The mapper should receive 'on' string
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
			const callArgs = (mockLightMapper.mapToHA as any).mock.calls[0][1] as Map<string, string | number | boolean>;
			expect(callArgs.get('prop-on')).toBe('on'); // true transformed to 'on'
		});

		it('should NOT apply transformer when haTransformer is null for write', async () => {
			const brightnessProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-brightness',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.BRIGHTNESS,
				dataType: DataTypeType.UCHAR,
				permissions: [PermissionType.READ_WRITE],
				haEntityId: 'light.test',
				haAttribute: 'brightness',
				haTransformer: null, // No transformer
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([brightnessProperty]);

			const mockLightMapper = {
				domain: HomeAssistantDomain.LIGHT,
				mapFromHA: jest.fn(),
				mapToHA: jest.fn().mockResolvedValue({
					state: 'on',
					service: 'turn_on',
					attributes: new Map([['brightness', 100]]),
				}),
			};
			service.registerMapper(mockLightMapper);

			const values = new Map<string, string | number | boolean>();
			values.set('prop-brightness', 100);

			await service.mapToHA(mockDevice, values);

			// Value should remain as-is
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
			const callArgs = (mockLightMapper.mapToHA as any).mock.calls[0][1] as Map<string, string | number | boolean>;
			expect(callArgs.get('prop-brightness')).toBe(100);
		});
	});

	describe('Fallback Boolean Conversion (backward compatibility)', () => {
		// These tests verify that existing devices without haTransformer configured
		// still get proper boolean conversion based on dataType: BOOL

		it('should convert "on" to true for BOOL property without transformer (mapFromHA)', async () => {
			const onProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-on',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL, // Property has BOOL dataType
				permissions: [PermissionType.READ_ONLY],
				haEntityId: 'light.test',
				haAttribute: 'fb.main_state',
				haTransformer: null, // No transformer configured (existing device)
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([onProperty]);
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map([['prop-on', 'on']]));

			const states = [
				{
					entity_id: 'light.test',
					state: 'on',
					attributes: {},
				},
			] as unknown as HomeAssistantStateDto[];

			const result = await service.mapFromHA(mockDevice, states);

			expect(result[0][0].value).toBe(true); // Fallback converts 'on' to true
		});

		it('should convert "off" to false for BOOL property without transformer (mapFromHA)', async () => {
			const onProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-on',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
				haEntityId: 'light.test',
				haAttribute: 'fb.main_state',
				haTransformer: null,
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([onProperty]);
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map([['prop-on', 'off']]));

			const states = [
				{
					entity_id: 'light.test',
					state: 'off',
					attributes: {},
				},
			] as unknown as HomeAssistantStateDto[];

			const result = await service.mapFromHA(mockDevice, states);

			expect(result[0][0].value).toBe(false); // Fallback converts 'off' to false
		});

		it('should convert "true"/"false" strings for BOOL property without transformer', async () => {
			const boolProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-bool',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.ACTIVE,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
				haEntityId: 'sensor.test',
				haAttribute: 'is_active',
				haTransformer: null,
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([boolProperty]);
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map([['prop-bool', 'true']]));

			const states = [
				{
					entity_id: 'sensor.test',
					state: 'on',
					attributes: { is_active: 'true' },
				},
			] as unknown as HomeAssistantStateDto[];

			const result = await service.mapFromHA(mockDevice, states);

			expect(result[0][0].value).toBe(true);
		});

		it('should NOT apply fallback conversion for non-BOOL properties without transformer', async () => {
			// For non-BOOL properties, values should pass through unchanged
			const brightnessProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-brightness',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.BRIGHTNESS,
				dataType: DataTypeType.UCHAR, // Not BOOL
				permissions: [PermissionType.READ_ONLY],
				haEntityId: 'light.test',
				haAttribute: 'brightness',
				haTransformer: null,
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([brightnessProperty]);
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map([['prop-brightness', 255]]));

			const states = [
				{
					entity_id: 'light.test',
					state: 'on',
					attributes: { brightness: 255 },
				},
			] as unknown as HomeAssistantStateDto[];

			const result = await service.mapFromHA(mockDevice, states);

			expect(result[0][0].value).toBe(255); // Unchanged, no conversion applied
		});

		it('should convert boolean true to "on" for BOOL property without transformer (mapToHA)', async () => {
			const onProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-on',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
				haEntityId: 'light.test',
				haAttribute: 'fb.main_state',
				haTransformer: null, // No transformer configured (existing device)
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([onProperty]);

			const mockLightMapper = {
				domain: HomeAssistantDomain.LIGHT,
				mapFromHA: jest.fn(),
				mapToHA: jest.fn().mockResolvedValue({
					state: 'on',
					service: 'turn_on',
					attributes: new Map(),
				}),
			};
			service.registerMapper(mockLightMapper);

			const values = new Map<string, string | number | boolean>();
			values.set('prop-on', true); // Smart Panel sends boolean true

			await service.mapToHA(mockDevice, values);

			// The mapper should receive 'on' string (fallback conversion)
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
			const callArgs = (mockLightMapper.mapToHA as any).mock.calls[0][1] as Map<string, string | number | boolean>;
			expect(callArgs.get('prop-on')).toBe('on');
		});

		it('should convert boolean false to "off" for BOOL property without transformer (mapToHA)', async () => {
			const onProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-on',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
				haEntityId: 'light.test',
				haAttribute: 'fb.main_state',
				haTransformer: null,
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([onProperty]);

			const mockLightMapper = {
				domain: HomeAssistantDomain.LIGHT,
				mapFromHA: jest.fn(),
				mapToHA: jest.fn().mockResolvedValue({
					state: 'off',
					service: 'turn_off',
					attributes: new Map(),
				}),
			};
			service.registerMapper(mockLightMapper);

			const values = new Map<string, string | number | boolean>();
			values.set('prop-on', false);

			await service.mapToHA(mockDevice, values);

			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
			const callArgs = (mockLightMapper.mapToHA as any).mock.calls[0][1] as Map<string, string | number | boolean>;
			expect(callArgs.get('prop-on')).toBe('off');
		});

		it('should handle already boolean values in mapFromHA (pass through)', async () => {
			const onProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-on',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
				haEntityId: 'light.test',
				haAttribute: 'fb.main_state',
				haTransformer: null,
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([onProperty]);
			// Some sources might already return boolean
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map([['prop-on', true]]));

			const states = [
				{
					entity_id: 'light.test',
					state: 'on',
					attributes: {},
				},
			] as unknown as HomeAssistantStateDto[];

			const result = await service.mapFromHA(mockDevice, states);

			expect(result[0][0].value).toBe(true); // Boolean passes through
		});

		it('should handle numeric 1/0 for BOOL property without transformer', async () => {
			const boolProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-bool',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.ACTIVE,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
				haEntityId: 'sensor.test',
				haAttribute: 'is_active',
				haTransformer: null,
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([boolProperty]);
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map([['prop-bool', 1]]));

			const states = [
				{
					entity_id: 'sensor.test',
					state: 'on',
					attributes: { is_active: 1 },
				},
			] as unknown as HomeAssistantStateDto[];

			const result = await service.mapFromHA(mockDevice, states);

			expect(result[0][0].value).toBe(true); // 1 converted to true
		});
	});

	describe('Bidirectional Transformer Verification', () => {
		it('should correctly round-trip brightness values', async () => {
			// Simulate reading from HA and writing back

			// Read: HA sends 255, should become 100
			const readProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-brightness',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.BRIGHTNESS,
				dataType: DataTypeType.UCHAR,
				permissions: [PermissionType.READ_WRITE],
				haEntityId: 'light.test',
				haAttribute: 'brightness',
				haTransformer: 'brightness_to_percent',
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([readProperty]);
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map([['prop-brightness', 255]]));

			const states = [
				{
					entity_id: 'light.test',
					state: 'on',
					attributes: { brightness: 255 },
				},
			] as unknown as HomeAssistantStateDto[];

			const readResult = await service.mapFromHA(mockDevice, states);
			expect(readResult[0][0].value).toBe(100); // Read: 255 -> 100

			// Write: Send 100 back, should become 255 with the same transformer
			// The transformer's write() method applies the inverse operation
			const writeProperty = {
				...readProperty,
				// Same transformer - its write() method inverts the read() operation
				haTransformer: 'brightness_to_percent',
			} as HomeAssistantChannelPropertyEntity;

			channelsPropertiesService.findAll.mockResolvedValue([writeProperty]);
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map());

			const mockLightMapper = {
				domain: HomeAssistantDomain.LIGHT,
				mapFromHA: jest.fn(),
				mapToHA: jest.fn().mockResolvedValue({
					state: 'on',
					service: 'turn_on',
					attributes: new Map(),
				}),
			};
			service.registerMapper(mockLightMapper);

			const values = new Map<string, string | number | boolean>();
			values.set('prop-brightness', 100);

			await service.mapToHA(mockDevice, values);

			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
			const callArgs = (mockLightMapper.mapToHA as any).mock.calls[0][1] as Map<string, string | number | boolean>;
			expect(callArgs.get('prop-brightness')).toBe(255); // Write: 100 -> 255
		});

		it('should correctly round-trip color temperature values', async () => {
			const colorTempProperty: HomeAssistantChannelPropertyEntity = {
				id: 'prop-color-temp',
				type: DEVICES_HOME_ASSISTANT_TYPE,
				category: PropertyCategory.COLOR_TEMPERATURE,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				haEntityId: 'light.test',
				haAttribute: 'color_temp',
				haTransformer: 'mireds_to_kelvin',
				channel: mockChannel,
			} as HomeAssistantChannelPropertyEntity;

			channelsService.findAll.mockResolvedValue([mockChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([colorTempProperty]);
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map([['prop-color-temp', 250]]));

			// Read: 250 mireds -> 4000K
			const states = [
				{
					entity_id: 'light.test',
					state: 'on',
					attributes: { color_temp: 250 },
				},
			] as unknown as HomeAssistantStateDto[];

			const readResult = await service.mapFromHA(mockDevice, states);
			expect(readResult[0][0].value).toBe(4000); // 1000000/250 = 4000K

			// Write: 4000K -> 250 mireds (same transformer, write() applies same formula)
			// Note: mireds_to_kelvin and kelvin_to_mireds use the same formula (1000000/value)
			// so either works, but we use the same transformer for consistency
			const writeProperty = {
				...colorTempProperty,
				haTransformer: 'mireds_to_kelvin',
			} as HomeAssistantChannelPropertyEntity;

			channelsPropertiesService.findAll.mockResolvedValue([writeProperty]);
			universalEntityMapperService.mapFromHA.mockResolvedValue(new Map());

			const mockLightMapper = {
				domain: HomeAssistantDomain.LIGHT,
				mapFromHA: jest.fn(),
				mapToHA: jest.fn().mockResolvedValue({
					state: 'on',
					service: 'turn_on',
					attributes: new Map(),
				}),
			};
			service.registerMapper(mockLightMapper);

			const values = new Map<string, string | number | boolean>();
			values.set('prop-color-temp', 4000);

			await service.mapToHA(mockDevice, values);

			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
			const callArgs = (mockLightMapper.mapToHA as any).mock.calls[0][1] as Map<string, string | number | boolean>;
			expect(callArgs.get('prop-color-temp')).toBe(250); // 1000000/4000 = 250 mireds
		});
	});
});

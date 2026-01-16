// Import mocked modules after mocking
import { existsSync, readFileSync } from 'fs';
import { readFile, readdir } from 'fs/promises';

import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { HomeAssistantDomain } from '../devices-home-assistant.constants';

import { MappingLoaderService } from './mapping-loader.service';
import { EntityRole } from './mapping.types';
import { TransformerRegistry } from './transformers';

// Mock fs module (sync operations - used only for schema loading in constructor)
jest.mock('fs', () => ({
	existsSync: jest.fn(),
	readFileSync: jest.fn(),
}));

// Mock fs/promises module (async operations - used for YAML file loading)
jest.mock('fs/promises', () => ({
	readdir: jest.fn(),
	readFile: jest.fn(),
}));

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockReaddir = readdir as jest.MockedFunction<typeof readdir>;
const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

describe('MappingLoaderService', () => {
	let service: MappingLoaderService;
	let transformerRegistry: jest.Mocked<TransformerRegistry>;

	// Sample valid mapping schema
	const mockMappingSchema = {
		$schema: 'http://json-schema.org/draft-07/schema#',
		type: 'object',
		required: ['mappings'],
		properties: {
			mappings: { type: 'array' },
			transformers: { type: 'object' },
			domain_roles: { type: 'object' },
		},
	};

	// Sample valid virtual properties schema
	const mockVirtualPropsSchema = {
		$schema: 'http://json-schema.org/draft-07/schema#',
		type: 'object',
		properties: {
			virtual_properties: { type: 'object' },
			derivations: { type: 'object' },
		},
	};

	beforeEach(async () => {
		// Reset all mocks
		jest.clearAllMocks();

		// Setup default mock implementations
		mockExistsSync.mockReturnValue(true);
		// Sync readFileSync is only used for schema loading in constructor
		mockReadFileSync.mockImplementation((path: string | Buffer | URL | number) => {
			const pathStr = path.toString();
			if (pathStr.includes('mapping-schema.json')) {
				return JSON.stringify(mockMappingSchema);
			}
			if (pathStr.includes('virtual-properties-schema.json')) {
				return JSON.stringify(mockVirtualPropsSchema);
			}
			return '';
		});
		// Async readdir for directory discovery
		mockReaddir.mockResolvedValue([]);
		// Async readFile for file loading
		mockReadFile.mockResolvedValue('');

		const transformerRegistryMock = {
			registerAll: jest.fn(),
			clear: jest.fn(),
			get: jest.fn(),
			getOrCreate: jest.fn().mockReturnValue({
				canRead: () => true,
				canWrite: () => true,
				read: (v: unknown) => v,
				write: (v: unknown) => v,
			}),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [MappingLoaderService, { provide: TransformerRegistry, useValue: transformerRegistryMock }],
		}).compile();

		service = module.get(MappingLoaderService);
		transformerRegistry = module.get(TransformerRegistry);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('getMappings', () => {
		it('should return empty array when no mappings loaded', () => {
			const mappings = service.getMappings();
			expect(mappings).toEqual([]);
		});
	});

	describe('findMatchingMapping', () => {
		beforeEach(async () => {
			// Load mock mappings by simulating loadMappingFile
			mockReaddir.mockResolvedValue([
				{ name: 'test.yaml', isFile: () => true, isDirectory: () => false },
			] as unknown as Awaited<ReturnType<typeof readdir>>);
			mockReadFile.mockResolvedValue(`
mappings:
  - name: light_default
    domain: light
    device_class: null
    priority: 50
    device_category: lighting
    channel:
      category: light
    property_bindings:
      - ha_attribute: fb.main_state
        property_category: on
  - name: light_dimmer
    domain: light
    device_class: dimmer
    priority: 60
    device_category: lighting
    channel:
      category: light
    property_bindings:
      - ha_attribute: fb.main_state
        property_category: on
  - name: light_with_entity_pattern
    domain: light
    entity_id_contains: kitchen
    priority: 70
    device_category: lighting
    channel:
      category: light
    property_bindings:
      - ha_attribute: fb.main_state
        property_category: on
`);

			await service.loadAllMappings();
		});

		it('should find mapping by domain and device class', () => {
			const mapping = service.findMatchingMapping(HomeAssistantDomain.LIGHT, 'dimmer');
			expect(mapping).toBeDefined();
			expect(mapping?.name).toBe('light_dimmer');
		});

		it('should return fallback mapping when no specific device class matches', () => {
			const mapping = service.findMatchingMapping(HomeAssistantDomain.LIGHT, 'unknown_class');
			expect(mapping).toBeDefined();
			expect(mapping?.name).toBe('light_default');
		});

		it('should return undefined when domain does not match any mapping', () => {
			const mapping = service.findMatchingMapping(HomeAssistantDomain.CAMERA, null);
			expect(mapping).toBeUndefined();
		});

		it('should match mapping by entity_id_contains pattern', () => {
			const mapping = service.findMatchingMapping(HomeAssistantDomain.LIGHT, null, 'light.kitchen_main');
			expect(mapping).toBeDefined();
			expect(mapping?.name).toBe('light_with_entity_pattern');
		});

		it('should not match entity_id_contains mapping when pattern not in entity_id', () => {
			const mapping = service.findMatchingMapping(HomeAssistantDomain.LIGHT, null, 'light.bedroom_main');
			expect(mapping).toBeDefined();
			expect(mapping?.name).toBe('light_default'); // Falls back to default
		});

		it('should skip entityIdContains mappings in fallback when no entityId provided', () => {
			const mapping = service.findMatchingMapping(HomeAssistantDomain.LIGHT, null);
			expect(mapping).toBeDefined();
			expect(mapping?.name).toBe('light_default');
		});
	});

	describe('loadMappingFile', () => {
		it('should load and parse a valid mapping file', async () => {
			mockReadFile.mockResolvedValue(`
mappings:
  - name: test_mapping
    domain: switch
    device_class: outlet
    priority: 50
    device_category: generic
    channel:
      category: switch
    property_bindings:
      - ha_attribute: fb.main_state
        property_category: on
`);

			const result = await service.loadMappingFile({
				path: '/test/mapping.yaml',
				source: 'builtin',
				priority: 0,
			});

			expect(result.success).toBe(true);
			expect(result.resolvedMappings).toHaveLength(1);
			expect(result.resolvedMappings?.[0].name).toBe('test_mapping');
			expect(result.resolvedMappings?.[0].domain).toBe(HomeAssistantDomain.SWITCH);
		});

		it('should return error for invalid YAML syntax', async () => {
			mockReadFile.mockResolvedValue('invalid: yaml: content: [');

			const result = await service.loadMappingFile({
				path: '/test/invalid.yaml',
				source: 'builtin',
				priority: 0,
			});

			expect(result.success).toBe(false);
			expect(result.errors).toBeDefined();
		});

		it('should register transformers from mapping file', async () => {
			mockReadFile.mockResolvedValue(`
mappings:
  - name: test_mapping
    domain: light
    device_class: null
    priority: 50
    device_category: lighting
    channel:
      category: light
    property_bindings:
      - ha_attribute: fb.main_state
        property_category: on
transformers:
  custom_transformer:
    type: scale
    input_range: [0, 100]
    output_range: [0, 255]
`);

			await service.loadMappingFile({
				path: '/test/mapping.yaml',
				source: 'builtin',
				priority: 0,
			});

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(transformerRegistry.registerAll).toHaveBeenCalledWith({
				custom_transformer: {
					type: 'scale',
					input_range: [0, 100],
					output_range: [0, 255],
				},
			});
		});

		it('should resolve property bindings correctly', async () => {
			mockReadFile.mockResolvedValue(`
mappings:
  - name: test_mapping
    domain: light
    device_class: null
    priority: 50
    device_category: lighting
    channel:
      category: light
    property_bindings:
      - ha_attribute: brightness
        property_category: brightness
        transformer: brightness_to_percent
        array_index: 0
`);

			const result = await service.loadMappingFile({
				path: '/test/mapping.yaml',
				source: 'builtin',
				priority: 0,
			});

			expect(result.success).toBe(true);
			const binding = result.resolvedMappings?.[0].propertyBindings[0];
			expect(binding?.haAttribute).toBe('brightness');
			expect(binding?.propertyCategory).toBe(PropertyCategory.BRIGHTNESS);
			expect(binding?.transformerName).toBe('brightness_to_percent');
			expect(binding?.arrayIndex).toBe(0);
		});
	});

	describe('getDomainRole', () => {
		beforeEach(async () => {
			mockReaddir.mockResolvedValue([
				{ name: 'test.yaml', isFile: () => true, isDirectory: () => false },
			] as unknown as Awaited<ReturnType<typeof readdir>>);
			mockReadFile.mockResolvedValue(`
mappings: []
domain_roles:
  primary:
    - light
    - switch
  secondary:
    - sensor
  standalone:
    - button
`);

			await service.loadAllMappings();
		});

		it('should return PRIMARY for primary domains', () => {
			expect(service.getDomainRole(HomeAssistantDomain.LIGHT)).toBe(EntityRole.PRIMARY);
			expect(service.getDomainRole(HomeAssistantDomain.SWITCH)).toBe(EntityRole.PRIMARY);
		});

		it('should return SECONDARY for secondary domains', () => {
			expect(service.getDomainRole(HomeAssistantDomain.SENSOR)).toBe(EntityRole.SECONDARY);
		});

		it('should return STANDALONE for standalone domains', () => {
			expect(service.getDomainRole(HomeAssistantDomain.BUTTON)).toBe(EntityRole.STANDALONE);
		});

		it('should return SECONDARY as default for unknown domains', () => {
			expect(service.getDomainRole(HomeAssistantDomain.CAMERA)).toBe(EntityRole.SECONDARY);
		});
	});

	describe('isPrimaryDomain and isStandaloneDomain', () => {
		beforeEach(async () => {
			mockReaddir.mockResolvedValue([
				{ name: 'test.yaml', isFile: () => true, isDirectory: () => false },
			] as unknown as Awaited<ReturnType<typeof readdir>>);
			mockReadFile.mockResolvedValue(`
mappings: []
domain_roles:
  primary:
    - light
  standalone:
    - button
`);

			await service.loadAllMappings();
		});

		it('should correctly identify primary domains', () => {
			expect(service.isPrimaryDomain(HomeAssistantDomain.LIGHT)).toBe(true);
			expect(service.isPrimaryDomain(HomeAssistantDomain.SENSOR)).toBe(false);
		});

		it('should correctly identify standalone domains', () => {
			expect(service.isStandaloneDomain(HomeAssistantDomain.BUTTON)).toBe(true);
			expect(service.isStandaloneDomain(HomeAssistantDomain.LIGHT)).toBe(false);
		});
	});

	describe('getVirtualProperties', () => {
		beforeEach(async () => {
			// Disable user mappings path to avoid duplicates
			mockExistsSync.mockImplementation((path: string) => {
				return !path.includes('var/data');
			});
			mockReaddir.mockResolvedValue([
				{ name: 'virtual-properties.yaml', isFile: () => true, isDirectory: () => false },
			] as unknown as Awaited<ReturnType<typeof readdir>>);
			mockReadFile.mockResolvedValue(`
derivations:
  thermostat_state:
    rule:
      type: threshold
      property_source: current_temperature
      property_compare: target_temperature
virtual_properties:
  thermostat:
    - property_category: state
      virtual_type: derived
      data_type: string
      permissions:
        - read_only
      derivation: thermostat_state
    - property_category: preset
      virtual_type: static
      data_type: string
      permissions:
        - read_only
      static_value: manual
`);

			await service.loadAllMappings();
		});

		it('should load and return virtual properties for a channel category', () => {
			const props = service.getVirtualProperties(ChannelCategory.THERMOSTAT);
			expect(props).toHaveLength(2);
			expect(props[0].propertyCategory).toBe(PropertyCategory.STATE);
			expect(props[0].virtualType).toBe('derived');
		});

		it('should return empty array for channel category without virtual properties', () => {
			const props = service.getVirtualProperties(ChannelCategory.LIGHT);
			expect(props).toEqual([]);
		});
	});

	describe('loadAllMappings', () => {
		it('should clear and reload all mappings', async () => {
			// Disable user mappings path to avoid duplicates
			mockExistsSync.mockImplementation((path: string) => {
				return !path.includes('var/data');
			});
			mockReaddir.mockResolvedValue([
				{ name: 'test.yaml', isFile: () => true, isDirectory: () => false },
			] as unknown as Awaited<ReturnType<typeof readdir>>);
			mockReadFile.mockResolvedValue(`
mappings:
  - name: test_mapping
    domain: light
    device_class: null
    priority: 50
    device_category: lighting
    channel:
      category: light
    property_bindings:
      - ha_attribute: fb.main_state
        property_category: on
`);

			await service.loadAllMappings();

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(transformerRegistry.clear).toHaveBeenCalled();
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(transformerRegistry.registerAll).toHaveBeenCalled();
			expect(service.getMappings()).toHaveLength(1);
		});

		it('should handle missing user mappings directory gracefully', async () => {
			mockExistsSync.mockImplementation((path: string) => {
				return !path.includes('var/data');
			});
			mockReaddir.mockResolvedValue([]);

			await expect(service.loadAllMappings()).resolves.not.toThrow();
		});

		it('should sort mappings by priority (higher first)', async () => {
			// Disable user mappings path to avoid duplicates
			mockExistsSync.mockImplementation((path: string) => {
				return !path.includes('var/data');
			});
			mockReaddir.mockResolvedValue([
				{ name: 'test.yaml', isFile: () => true, isDirectory: () => false },
			] as unknown as Awaited<ReturnType<typeof readdir>>);
			mockReadFile.mockResolvedValue(`
mappings:
  - name: low_priority
    domain: light
    device_class: null
    priority: 10
    device_category: lighting
    channel:
      category: light
    property_bindings:
      - ha_attribute: fb.main_state
        property_category: on
  - name: high_priority
    domain: light
    device_class: dimmer
    priority: 90
    device_category: lighting
    channel:
      category: light
    property_bindings:
      - ha_attribute: fb.main_state
        property_category: on
`);

			await service.loadAllMappings();

			const mappings = service.getMappings();
			expect(mappings[0].name).toBe('high_priority');
			expect(mappings[1].name).toBe('low_priority');
		});
	});

	describe('reload', () => {
		it('should reload all mappings when called', async () => {
			const loadAllMappingsSpy = jest.spyOn(service, 'loadAllMappings');

			await service.reload();

			expect(loadAllMappingsSpy).toHaveBeenCalled();
		});
	});

	describe('getDerivation and hasDerivation', () => {
		beforeEach(async () => {
			// Disable user mappings path to avoid duplicates
			mockExistsSync.mockImplementation((path: string) => {
				return !path.includes('var/data');
			});
			mockReaddir.mockResolvedValue([
				{ name: 'virtual-properties.yaml', isFile: () => true, isDirectory: () => false },
			] as unknown as Awaited<ReturnType<typeof readdir>>);
			mockReadFile.mockResolvedValue(`
derivations:
  thermostat_state:
    rule:
      type: threshold
      property_source: current_temperature
      property_compare: target_temperature
virtual_properties: {}
`);

			await service.loadAllMappings();
		});

		it('should return true for registered derivations', () => {
			expect(service.hasDerivation('thermostat_state')).toBe(true);
		});

		it('should return false for non-existent derivations', () => {
			expect(service.hasDerivation('unknown_derivation')).toBe(false);
		});

		it('should return derivation rule when it exists', () => {
			const derivation = service.getDerivation('thermostat_state');
			expect(derivation).toBeDefined();
			expect(derivation?.type).toBe('threshold');
		});

		it('should return undefined for non-existent derivation', () => {
			const derivation = service.getDerivation('unknown_derivation');
			expect(derivation).toBeUndefined();
		});
	});

	describe('path getters', () => {
		it('should return user mappings path', () => {
			const path = service.getUserMappingsPath();
			expect(path).toContain('home-assistant/mappings');
		});

		it('should return builtin mappings path', () => {
			const path = service.getBuiltinMappingsPath();
			expect(path).toContain('definitions');
		});
	});

	describe('device class array matching', () => {
		beforeEach(async () => {
			// Disable user mappings path to avoid duplicates
			mockExistsSync.mockImplementation((path: string) => {
				return !path.includes('var/data');
			});
			mockReaddir.mockResolvedValue([
				{ name: 'test.yaml', isFile: () => true, isDirectory: () => false },
			] as unknown as Awaited<ReturnType<typeof readdir>>);
			mockReadFile.mockResolvedValue(`
mappings:
  - name: temperature_sensor
    domain: sensor
    device_class:
      - temperature
      - humidity
    priority: 60
    device_category: sensor
    channel:
      category: temperature
    property_bindings:
      - ha_attribute: fb.main_state
        property_category: measured
  - name: sensor_default
    domain: sensor
    device_class: null
    priority: 50
    device_category: sensor
    channel:
      category: generic
    property_bindings:
      - ha_attribute: fb.main_state
        property_category: measured
`);

			await service.loadAllMappings();
		});

		it('should match mapping when device class is in array', () => {
			const mapping = service.findMatchingMapping(HomeAssistantDomain.SENSOR, 'temperature');
			expect(mapping).toBeDefined();
			expect(mapping?.name).toBe('temperature_sensor');
		});

		it('should match mapping for second item in device class array', () => {
			const mapping = service.findMatchingMapping(HomeAssistantDomain.SENSOR, 'humidity');
			expect(mapping).toBeDefined();
			expect(mapping?.name).toBe('temperature_sensor');
		});

		it('should fall back to default when device class not in array', () => {
			const mapping = service.findMatchingMapping(HomeAssistantDomain.SENSOR, 'pressure');
			expect(mapping).toBeDefined();
			expect(mapping?.name).toBe('sensor_default');
		});
	});
});

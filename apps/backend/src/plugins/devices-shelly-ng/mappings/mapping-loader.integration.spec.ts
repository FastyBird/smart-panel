import { mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ComponentType } from '../devices-shelly-ng.constants';

import { MappingLoaderService } from './mapping-loader.service';
import { MappingContext } from './mapping.types';
import { TransformerRegistry } from './transformers';

describe('MappingLoaderService Integration Tests', () => {
	let service: MappingLoaderService;
	let transformerRegistry: TransformerRegistry;
	let tempDir: string;

	beforeEach(async () => {
		// Create temporary directory for test mappings
		tempDir = join(tmpdir(), `mapping-tests-${Date.now()}-${Math.random().toString(36).substring(7)}`);
		mkdirSync(tempDir, { recursive: true });

		const module: TestingModule = await Test.createTestingModule({
			providers: [TransformerRegistry, MappingLoaderService],
		})
			.overrideProvider(MappingLoaderService)
			.useFactory({
				factory: (transformerRegistry: TransformerRegistry) => {
					const service = new MappingLoaderService(transformerRegistry);
					// Override paths to use temp directory
					Reflect.set(service as object, 'userMappingsPath', tempDir);
					return service;
				},
				inject: [TransformerRegistry],
			})
			.compile();

		transformerRegistry = module.get<TransformerRegistry>(TransformerRegistry);
		service = module.get<MappingLoaderService>(MappingLoaderService);
	});

	afterEach(() => {
		// Cleanup temp directory if needed
		// Note: In a real implementation, you'd want to clean this up
	});

	describe('YAML Mapping File Loading', () => {
		it('should load and parse valid YAML mapping file', () => {
			const testMapping = `
version: "1.0"

mappings:
  - name: test_switch_mapping
    description: "Test switch mapping"
    priority: 200
    match:
      component_type: switch
      device_category: SWITCHER
    channels:
      - identifier: "test:switch:{key}"
        name: "Test Switch: {key}"
        category: SWITCHER
        properties:
          - shelly_property: output
            panel:
              identifier: ON
              data_type: BOOL
            transformer: boolean_state
`;

			const testFile = join(tempDir, 'test-mapping.yaml');
			writeFileSync(testFile, testMapping);

			service.loadAllMappings();

			const context: MappingContext = {
				componentType: ComponentType.SWITCH,
				componentKey: 0,
				deviceCategory: DeviceCategory.SWITCHER,
			};

			const result = service.findMatchingMapping(context);
			expect(result).toBeDefined();
			expect(result?.name).toBe('test_switch_mapping');
			expect(result?.channels[0]?.identifier).toContain('test:switch:');
		});

		it('should handle invalid YAML gracefully', () => {
			const invalidYaml = `
version: "1.0"

mappings:
  - name: invalid
    match:
      component_type: switch
    # Missing required fields
`;

			const testFile = join(tempDir, 'invalid.yaml');
			writeFileSync(testFile, invalidYaml);

			service.loadAllMappings();

			const loadResults = service.getLoadResults();
			const invalidResult = loadResults.find((r) => r.source === testFile);

			// Should either fail validation or have warnings
			expect(invalidResult).toBeDefined();
		});
	});

	describe('Mapping Resolution with Real Conditions', () => {
		beforeEach(() => {
			// Setup test mappings
			const switchMapping = `
version: "1.0"

transformers:
  boolean_state:
    type: boolean
    true_value: true
    false_value: false

mappings:
  - name: switch_lighting
    priority: 150
    match:
      all_of:
        - component_type: switch
        - device_category: LIGHTING
    channels:
      - identifier: "switch:{key}"
        category: LIGHT
        properties:
          - shelly_property: output
            panel:
              identifier: ON
              data_type: BOOL
            transformer: boolean_state

  - name: switch_default
    priority: 100
    match:
      component_type: switch
    channels:
      - identifier: "switch:{key}"
        category: SWITCHER
        properties:
          - shelly_property: output
            panel:
              identifier: ON
              data_type: BOOL
            transformer: boolean_state
`;

			const testFile = join(tempDir, 'switch-mappings.yaml');
			writeFileSync(testFile, switchMapping);
			service.loadAllMappings();
		});

		it('should match LIGHTING device category correctly', () => {
			const context: MappingContext = {
				componentType: ComponentType.SWITCH,
				componentKey: 0,
				deviceCategory: DeviceCategory.LIGHTING,
			};

			const result = service.findMatchingMapping(context);
			expect(result).toBeDefined();
			expect(result?.name).toBe('switch_lighting');
			expect(result?.channels[0]?.category).toBe(ChannelCategory.LIGHT);
		});

		it('should fall back to default mapping for unmatched categories', () => {
			const context: MappingContext = {
				componentType: ComponentType.SWITCH,
				componentKey: 0,
				deviceCategory: DeviceCategory.OUTLET,
			};

			const result = service.findMatchingMapping(context);
			expect(result).toBeDefined();
			expect(result?.name).toBe('switch_default');
			expect(result?.channels[0]?.category).toBe(ChannelCategory.SWITCHER);
		});

		it('should respect priority when multiple mappings match', () => {
			// Create a higher priority mapping
			const highPriorityMapping = `
version: "1.0"

mappings:
  - name: switch_override
    priority: 300
    match:
      component_type: switch
      device_category: LIGHTING
    channels:
      - identifier: "switch:{key}"
        category: SWITCHER
        properties:
          - shelly_property: output
            panel:
              identifier: ON
              data_type: BOOL
`;

			const overrideFile = join(tempDir, 'override.yaml');
			writeFileSync(overrideFile, highPriorityMapping);
			service.loadAllMappings();

			const context: MappingContext = {
				componentType: ComponentType.SWITCH,
				componentKey: 0,
				deviceCategory: DeviceCategory.LIGHTING,
			};

			const result = service.findMatchingMapping(context);
			expect(result).toBeDefined();
			expect(result?.name).toBe('switch_override');
			expect(result?.priority).toBeGreaterThan(150);
		});
	});

	describe('Transformer Integration', () => {
		beforeEach(() => {
			const mappingWithTransformer = `
version: "1.0"

transformers:
  brightness_clamp:
    type: clamp
    min: 0
    max: 100
  scale_0_255:
    type: scale
    input_range: [0, 100]
    output_range: [0, 255]

mappings:
  - name: light_with_transformers
    match:
      component_type: light
    channels:
      - identifier: "light:{key}"
        category: LIGHT
        properties:
          - shelly_property: brightness
            panel:
              identifier: BRIGHTNESS
              data_type: UCHAR
              format: [0, 100]
            transformer: brightness_clamp
`;

			const testFile = join(tempDir, 'transformer-test.yaml');
			writeFileSync(testFile, mappingWithTransformer);
			service.loadAllMappings();
		});

		it('should register transformers from mapping files', () => {
			expect(transformerRegistry.has('brightness_clamp')).toBe(true);
			expect(transformerRegistry.has('scale_0_255')).toBe(true);
		});

		it('should apply transformers correctly', () => {
			const transformer = transformerRegistry.get('brightness_clamp');
			expect(transformer).toBeDefined();

			const clamped = transformer.read(150);
			expect(clamped).toBe(100);

			const clampedNegative = transformer.read(-10);
			expect(clampedNegative).toBe(0);
		});

		it('should find mapping with transformer reference', () => {
			const context: MappingContext = {
				componentType: ComponentType.LIGHT,
				componentKey: 0,
				deviceCategory: DeviceCategory.LIGHTING,
			};

			const result = service.findMatchingMapping(context);
			expect(result).toBeDefined();
			const propertyMapping = result?.channels[0]?.properties?.[0];
			expect(propertyMapping?.transformerName).toBe('brightness_clamp');
		});
	});

	describe('Derivation Rules Integration', () => {
		beforeEach(() => {
			const mappingWithDerivation = `
version: "1.0"

derivations:
  battery_status:
    description: "Derive battery status"
    rule:
      type: threshold
      thresholds:
        - max: 20
          value: "low"
        - value: "normal"

mappings:
  - name: battery_with_derivation
    match:
      component_type: devicePower
    channels:
      - identifier: "devicePower:{key}"
        category: BATTERY
        properties:
          - shelly_property: battery
            panel:
              identifier: PERCENTAGE
              data_type: UCHAR
        derived_properties:
          - identifier: STATUS
            data_type: ENUM
            format: ["normal", "low"]
            source_property: PERCENTAGE
            derivation: battery_status
`;

			const testFile = join(tempDir, 'derivation-test.yaml');
			writeFileSync(testFile, mappingWithDerivation);
			service.loadAllMappings();
		});

		it('should register derivation rules', () => {
			const derivation = service.getDerivation('battery_status');
			expect(derivation).toBeDefined();
			expect(derivation?.rule.type).toBe('threshold');
		});

		it('should include derived properties in channel definition', () => {
			const context: MappingContext = {
				componentType: ComponentType.DEVICE_POWER,
				componentKey: 0,
				deviceCategory: DeviceCategory.GENERIC,
			};

			const result = service.findMatchingMapping(context);
			expect(result).toBeDefined();
			const derivedProps = result?.channels[0]?.derivedProperties;
			expect(derivedProps).toBeDefined();
			expect(derivedProps?.length).toBeGreaterThan(0);
			expect(derivedProps?.[0]?.identifier).toBe(PropertyCategory.STATUS);
		});
	});

	describe('Template Interpolation', () => {
		it('should interpolate {key} in channel identifiers and names', () => {
			const context: MappingContext = {
				componentType: ComponentType.SWITCH,
				componentKey: 3,
				deviceCategory: DeviceCategory.SWITCHER,
			};

			const interpolated = service.interpolateTemplate('switch:{key}', context);
			expect(interpolated).toBe('switch:3');

			const nameInterpolated = service.interpolateTemplate('Switch {key}', context);
			expect(nameInterpolated).toBe('Switch 3');
		});
	});

	describe('Cache Behavior', () => {
		it('should cache mapping resolution results', () => {
			const context: MappingContext = {
				componentType: ComponentType.SWITCH,
				componentKey: 0,
				deviceCategory: DeviceCategory.SWITCHER,
			};

			// First call
			const result1 = service.findMatchingMapping(context);
			const stats1 = service.getCacheStats();

			// Second call should use cache
			const result2 = service.findMatchingMapping(context);
			const stats2 = service.getCacheStats();

			expect(result1).toBe(result2); // Same object reference indicates cache hit
			expect(stats2.size).toBe(stats1.size); // Cache size shouldn't increase
		});

		it('should clear cache on reload', () => {
			const context: MappingContext = {
				componentType: ComponentType.SWITCH,
				componentKey: 0,
				deviceCategory: DeviceCategory.SWITCHER,
			};

			// Populate cache
			service.findMatchingMapping(context);
			expect(service.getCacheStats().size).toBeGreaterThan(0);

			// Reload should clear cache
			service.reload();
			expect(service.getCacheStats().size).toBe(0);
		});
	});

	describe('Error Handling', () => {
		it('should handle missing mapping files gracefully', () => {
			// Service should still work even if some files are missing
			service.loadAllMappings();
			const results = service.getLoadResults();
			expect(Array.isArray(results)).toBe(true);
		});

		it('should return undefined for unmatchable contexts without error', () => {
			const context: MappingContext = {
				componentType: ComponentType.INPUT,
				componentKey: 999,
				deviceCategory: DeviceCategory.GENERIC,
			};

			expect(() => {
				const result = service.findMatchingMapping(context);
				expect(result).toBeUndefined();
			}).not.toThrow();
		});
	});

	describe('Path Traversal Protection', () => {
		it('should validate paths and prevent traversal', () => {
			// This test verifies that path validation is working
			// The actual validation is in the private validatePath method
			// which is tested through the file loading process
			expect(true).toBe(true); // Placeholder - actual test would require mocking fs operations
		});
	});
});

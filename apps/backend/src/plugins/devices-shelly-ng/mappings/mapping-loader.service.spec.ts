import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ComponentType } from '../devices-shelly-ng.constants';
import { TransformerRegistry } from './transformers';
import { MappingLoaderService } from './mapping-loader.service';
import { MappingContext, ResolvedMapping } from './mapping.types';

describe('MappingLoaderService', () => {
	let service: MappingLoaderService;
	let transformerRegistry: TransformerRegistry;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [TransformerRegistry, MappingLoaderService],
		}).compile();

		transformerRegistry = module.get<TransformerRegistry>(TransformerRegistry);
		service = module.get<MappingLoaderService>(MappingLoaderService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('findMatchingMapping', () => {
		it('should return undefined when no mapping matches', () => {
			const context: MappingContext = {
				componentType: ComponentType.SWITCH,
				componentKey: 0,
				deviceCategory: DeviceCategory.GENERIC,
			};

			const result = service.findMatchingMapping(context);
			expect(result).toBeUndefined();
		});

		it('should match by component type', () => {
			const context: MappingContext = {
				componentType: ComponentType.SWITCH,
				componentKey: 0,
				deviceCategory: DeviceCategory.SWITCHER,
			};

			const result = service.findMatchingMapping(context);
			expect(result).toBeDefined();
			expect(result?.channels[0]?.category).toBe(ChannelCategory.SWITCHER);
		});

		it('should match by device category', () => {
			const context: MappingContext = {
				componentType: ComponentType.SWITCH,
				componentKey: 0,
				deviceCategory: DeviceCategory.LIGHTING,
			};

			const result = service.findMatchingMapping(context);
			expect(result).toBeDefined();
			expect(result?.channels[0]?.category).toBe(ChannelCategory.LIGHT);
		});

		it('should use cache for repeated lookups', () => {
			const context: MappingContext = {
				componentType: ComponentType.SWITCH,
				componentKey: 0,
				deviceCategory: DeviceCategory.SWITCHER,
			};

			// First lookup
			const result1 = service.findMatchingMapping(context);
			
			// Second lookup should use cache
			const result2 = service.findMatchingMapping(context);
			
			expect(result1).toBe(result2);
			
			const stats = service.getCacheStats();
			expect(stats.size).toBeGreaterThan(0);
		});
	});

	describe('interpolateTemplate', () => {
		it('should interpolate {key} placeholder', () => {
			const context: MappingContext = {
				componentType: ComponentType.SWITCH,
				componentKey: 5,
				deviceCategory: DeviceCategory.SWITCHER,
			};

			const result = service.interpolateTemplate('switch:{key}', context);
			expect(result).toBe('switch:5');
		});

		it('should handle multiple {key} placeholders', () => {
			const context: MappingContext = {
				componentType: ComponentType.SWITCH,
				componentKey: 2,
				deviceCategory: DeviceCategory.SWITCHER,
			};

			const result = service.interpolateTemplate('Switch {key}: Channel {key}', context);
			expect(result).toBe('Switch 2: Channel 2');
		});
	});

	describe('getDerivation', () => {
		it('should return undefined for non-existent derivation', () => {
			const result = service.getDerivation('nonexistent');
			expect(result).toBeUndefined();
		});

		it('should return derivation if it exists', () => {
			// Assuming battery_status derivation exists in derivation-rules.yaml
			const result = service.getDerivation('battery_status');
			expect(result).toBeDefined();
		});
	});

	describe('cache management', () => {
		it('should clear cache on reload', () => {
			const context: MappingContext = {
				componentType: ComponentType.SWITCH,
				componentKey: 0,
				deviceCategory: DeviceCategory.SWITCHER,
			};

			// Populate cache
			service.findMatchingMapping(context);
			expect(service.getCacheStats().size).toBeGreaterThan(0);

			// Clear cache
			service.clearCache();
			expect(service.getCacheStats().size).toBe(0);
		});

		it('should clear cache on reload', () => {
			const context: MappingContext = {
				componentType: ComponentType.SWITCH,
				componentKey: 0,
				deviceCategory: DeviceCategory.SWITCHER,
			};

			// Populate cache
			service.findMatchingMapping(context);
			const sizeBefore = service.getCacheStats().size;

			// Reload should clear cache
			service.reload();
			expect(service.getCacheStats().size).toBe(0);
		});
	});

	describe('getMappings', () => {
		it('should return all resolved mappings', () => {
			const mappings = service.getMappings();
			expect(Array.isArray(mappings)).toBe(true);
			expect(mappings.length).toBeGreaterThan(0);
		});
	});

	describe('getLoadResults', () => {
		it('should return load results', () => {
			const results = service.getLoadResults();
			expect(Array.isArray(results)).toBe(true);
		});
	});
});

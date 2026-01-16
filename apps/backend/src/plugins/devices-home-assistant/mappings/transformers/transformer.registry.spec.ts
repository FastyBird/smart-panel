import { BUILTIN_TRANSFORMERS, TransformerRegistry } from './transformer.registry';
import { ITransformer } from './transformer.types';
import { PassthroughTransformer } from './transformers';

/**
 * A test transformer that always throws errors
 */
class ThrowingTransformer implements ITransformer {
	read(): unknown {
		throw new Error('Read error');
	}
	write(): unknown {
		throw new Error('Write error');
	}
	canRead(): boolean {
		return true;
	}
	canWrite(): boolean {
		return true;
	}
}

describe('TransformerRegistry', () => {
	let registry: TransformerRegistry;

	beforeEach(() => {
		registry = new TransformerRegistry();
	});

	afterEach(() => {
		registry.clear();
	});

	describe('register', () => {
		it('should register a transformer definition', () => {
			registry.register('test_scale', {
				type: 'scale',
				input_range: [0, 100],
				output_range: [0, 255],
			});

			expect(registry.has('test_scale')).toBe(true);
		});

		it('should create transformer instance when registering', () => {
			registry.register('test_boolean', {
				type: 'boolean',
				true_value: 'on',
				false_value: 'off',
			});

			const transformer = registry.get('test_boolean');
			expect(transformer).toBeDefined();
			expect(transformer.canRead()).toBe(true);
			expect(transformer.canWrite()).toBe(true);
		});
	});

	describe('registerAll', () => {
		it('should register multiple transformers at once', () => {
			registry.registerAll({
				trans1: { type: 'formula', read: 'value * 2', write: 'value / 2' },
				trans2: { type: 'boolean', true_value: true, false_value: false },
			});

			expect(registry.has('trans1')).toBe(true);
			expect(registry.has('trans2')).toBe(true);
			expect(registry.size).toBe(2);
		});
	});

	describe('get', () => {
		it('should return registered transformer', () => {
			registry.register('my_transformer', {
				type: 'scale',
				input_range: [0, 255],
				output_range: [0, 100],
			});

			const transformer = registry.get('my_transformer');
			expect(transformer.read(255)).toBe(100);
		});

		it('should return PassthroughTransformer for unknown names', () => {
			const transformer = registry.get('unknown');
			expect(transformer).toBeInstanceOf(PassthroughTransformer);
			expect(transformer.read(42)).toBe(42);
		});
	});

	describe('has', () => {
		it('should return true for registered transformers', () => {
			registry.register('exists', { type: 'formula', read: 'value', write: 'value' });
			expect(registry.has('exists')).toBe(true);
		});

		it('should return false for non-existent transformers', () => {
			expect(registry.has('does_not_exist')).toBe(false);
		});
	});

	describe('getDefinition', () => {
		it('should return the definition for a registered transformer', () => {
			const definition = {
				type: 'scale' as const,
				input_range: [0, 100] as [number, number],
				output_range: [0, 255] as [number, number],
			};
			registry.register('scale_test', definition);

			const retrieved = registry.getDefinition('scale_test');
			expect(retrieved).toEqual(definition);
		});

		it('should return undefined for non-existent transformers', () => {
			expect(registry.getDefinition('unknown')).toBeUndefined();
		});
	});

	describe('getOrCreate', () => {
		it('should return registered transformer by name', () => {
			registry.register('named', {
				type: 'scale',
				input_range: [0, 255],
				output_range: [0, 100],
			});

			const transformer = registry.getOrCreate('named');
			expect(transformer.read(255)).toBe(100);
		});

		it('should return PassthroughTransformer for unknown name without inline', () => {
			const transformer = registry.getOrCreate('unknown_name');
			expect(transformer).toBeInstanceOf(PassthroughTransformer);
		});

		it('should create inline transformer when provided', () => {
			const transformer = registry.getOrCreate(undefined, {
				type: 'scale',
				input_range: [0, 100],
				output_range: [0, 255],
			});

			expect(transformer.read(100)).toBe(255);
		});

		it('should prefer named transformer over inline', () => {
			registry.register('named', {
				type: 'scale',
				input_range: [0, 255],
				output_range: [0, 100],
			});

			// Named should take precedence
			const transformer = registry.getOrCreate('named', {
				type: 'scale',
				input_range: [0, 100],
				output_range: [0, 255], // Different config
			});

			// Should use named (255 -> 100), not inline (100 -> 255)
			expect(transformer.read(255)).toBe(100);
		});

		it('should return PassthroughTransformer when no name and no inline', () => {
			const transformer = registry.getOrCreate();
			expect(transformer).toBeInstanceOf(PassthroughTransformer);
		});
	});

	describe('clear', () => {
		it('should remove all registered transformers', () => {
			registry.registerAll(BUILTIN_TRANSFORMERS);
			expect(registry.size).toBeGreaterThan(0);

			registry.clear();

			expect(registry.size).toBe(0);
			expect(registry.has('brightness_to_percent')).toBe(false);
		});
	});

	describe('getNames', () => {
		it('should return all registered transformer names', () => {
			registry.register('trans_a', { type: 'formula', read: 'value', write: 'value' });
			registry.register('trans_b', { type: 'formula', read: 'value', write: 'value' });

			const names = registry.getNames();
			expect(names).toContain('trans_a');
			expect(names).toContain('trans_b');
			expect(names).toHaveLength(2);
		});
	});

	describe('size', () => {
		it('should return the count of registered transformers', () => {
			expect(registry.size).toBe(0);

			registry.register('one', { type: 'formula', read: 'value', write: 'value' });
			expect(registry.size).toBe(1);

			registry.register('two', { type: 'formula', read: 'value', write: 'value' });
			expect(registry.size).toBe(2);
		});
	});

	describe('BUILTIN_TRANSFORMERS', () => {
		beforeEach(() => {
			registry.registerAll(BUILTIN_TRANSFORMERS);
		});

		it('should include brightness_to_percent transformer', () => {
			expect(registry.has('brightness_to_percent')).toBe(true);
			const transformer = registry.get('brightness_to_percent');
			expect(transformer.read(255)).toBe(100);
			expect(transformer.read(127)).toBe(50);
			expect(transformer.read(0)).toBe(0);
		});

		it('should include percent_to_brightness transformer', () => {
			expect(registry.has('percent_to_brightness')).toBe(true);
			const transformer = registry.get('percent_to_brightness');
			expect(transformer.read(100)).toBe(255);
			expect(transformer.read(50)).toBe(128); // 50% of 255 = 127.5, rounded to 128
			expect(transformer.read(0)).toBe(0);
		});

		it('should include mireds_to_kelvin transformer', () => {
			expect(registry.has('mireds_to_kelvin')).toBe(true);
			const transformer = registry.get('mireds_to_kelvin');
			expect(transformer.read(250)).toBe(4000); // 1000000 / 250 = 4000K
			expect(transformer.read(500)).toBe(2000); // 1000000 / 500 = 2000K
		});

		it('should include kelvin_to_mireds transformer', () => {
			expect(registry.has('kelvin_to_mireds')).toBe(true);
			const transformer = registry.get('kelvin_to_mireds');
			expect(transformer.read(4000)).toBe(250);
			expect(transformer.read(2000)).toBe(500);
		});

		it('should include state_on_off transformer', () => {
			expect(registry.has('state_on_off')).toBe(true);
			const transformer = registry.get('state_on_off');
			expect(transformer.read('on')).toBe(true);
			expect(transformer.read('off')).toBe(false);
			expect(transformer.write(true)).toBe('on');
			expect(transformer.write(false)).toBe('off');
		});

		it('should include lock_state transformer', () => {
			expect(registry.has('lock_state')).toBe(true);
			const transformer = registry.get('lock_state');
			expect(transformer.read('locked')).toBe(true);
			expect(transformer.read('unlocked')).toBe(false);
			expect(transformer.write(true)).toBe('locked');
			expect(transformer.write(false)).toBe('unlocked');
		});

		it('should include hvac_mode transformer', () => {
			expect(registry.has('hvac_mode')).toBe(true);
			const transformer = registry.get('hvac_mode');
			expect(transformer.read('heat')).toBe('heating');
			expect(transformer.read('cool')).toBe('cooling');
			expect(transformer.read('off')).toBe('off');
			expect(transformer.write('heating')).toBe('heat');
			expect(transformer.write('cooling')).toBe('cool');
		});

		it('should include cover_state transformer', () => {
			expect(registry.has('cover_state')).toBe(true);
			const transformer = registry.get('cover_state');
			expect(transformer.read('open')).toBe('opened');
			expect(transformer.read('closed')).toBe('closed');
			expect(transformer.write('opened')).toBe('open');
		});

		it('should include passthrough transformer', () => {
			expect(registry.has('passthrough')).toBe(true);
			const transformer = registry.get('passthrough');
			expect(transformer.read(42)).toBe(42);
			expect(transformer.read('test')).toBe('test');
			// Note: The built-in passthrough uses formula type which coerces booleans to numbers
			expect(transformer.write(100)).toBe(100);
		});

		it('should have bidirectional transformers for brightness', () => {
			const toPercent = registry.get('brightness_to_percent');
			const toBrightness = registry.get('percent_to_brightness');

			// Round-trip: 200 -> 78 -> 199 (rounding causes slight difference)
			const percent = toPercent.read(200) as number;
			expect(percent).toBe(78);
			const brightness = toBrightness.read(percent) as number;
			expect(brightness).toBe(199); // Close to 200
		});
	});

	describe('caching', () => {
		it('should return same PassthroughTransformer instance for unknown names', () => {
			const transformer1 = registry.get('unknown1');
			const transformer2 = registry.get('unknown2');
			expect(transformer1).toBe(transformer2);
		});

		it('should return same PassthroughTransformer instance from getOrCreate', () => {
			const transformer1 = registry.getOrCreate();
			const transformer2 = registry.getOrCreate();
			expect(transformer1).toBe(transformer2);
		});

		it('should cache inline transformers', () => {
			const inlineConfig = {
				input_range: [0, 100] as [number, number],
				output_range: [0, 255] as [number, number],
			};

			const transformer1 = registry.getOrCreate(undefined, inlineConfig);
			const transformer2 = registry.getOrCreate(undefined, inlineConfig);

			expect(transformer1).toBe(transformer2);
		});

		it('should return different transformers for different inline configs', () => {
			const config1 = { input_range: [0, 100] as [number, number], output_range: [0, 255] as [number, number] };
			const config2 = { input_range: [0, 50] as [number, number], output_range: [0, 255] as [number, number] };

			const transformer1 = registry.getOrCreate(undefined, config1);
			const transformer2 = registry.getOrCreate(undefined, config2);

			expect(transformer1).not.toBe(transformer2);
		});

		it('should provide inline cache statistics', () => {
			const stats = registry.getInlineCacheStats();
			expect(stats).toHaveProperty('size');
			expect(stats).toHaveProperty('maxSize');
			expect(stats.maxSize).toBe(100);
		});

		it('should clear inline cache when clear() is called', () => {
			// Add some inline transformers
			registry.getOrCreate(undefined, {
				input_range: [0, 100] as [number, number],
				output_range: [0, 255] as [number, number],
			});

			let stats = registry.getInlineCacheStats();
			expect(stats.size).toBe(1);

			registry.clear();

			stats = registry.getInlineCacheStats();
			expect(stats.size).toBe(0);
		});
	});

	describe('metrics and monitoring', () => {
		beforeEach(() => {
			registry.registerAll(BUILTIN_TRANSFORMERS);
		});

		it('should return initial metrics with zero values', () => {
			const metrics = registry.getMetrics();
			expect(metrics.totalReadOperations).toBe(0);
			expect(metrics.totalWriteOperations).toBe(0);
			expect(metrics.readErrors).toBe(0);
			expect(metrics.writeErrors).toBe(0);
			expect(metrics.errorsByTransformer.size).toBe(0);
		});

		it('should track read operations via monitored transformer', () => {
			const transformer = registry.getMonitored('brightness_to_percent');

			transformer.read(128);
			transformer.read(255);

			const metrics = registry.getMetrics();
			expect(metrics.totalReadOperations).toBe(2);
		});

		it('should track write operations via monitored transformer', () => {
			const transformer = registry.getMonitored('state_on_off');

			transformer.write(true);
			transformer.write(false);
			transformer.write(true);

			const metrics = registry.getMetrics();
			expect(metrics.totalWriteOperations).toBe(3);
		});

		it('should track read errors and return original value', () => {
			// Mock the get method to return a throwing transformer
			const throwingTransformer = new ThrowingTransformer();
			jest.spyOn(registry, 'get').mockReturnValueOnce(throwingTransformer);

			const transformer = registry.getMonitored('error_transformer');
			const result = transformer.read(42);

			const metrics = registry.getMetrics();
			expect(metrics.readErrors).toBe(1);
			expect(metrics.errorsByTransformer.get('error_transformer')).toBe(1);
			expect(result).toBe(42); // Original value returned on error
		});

		it('should track write errors and return original value', () => {
			// Mock the get method to return a throwing transformer
			const throwingTransformer = new ThrowingTransformer();
			jest.spyOn(registry, 'get').mockReturnValueOnce(throwingTransformer);

			const transformer = registry.getMonitored('write_error_transformer');
			const result = transformer.write(100);

			const metrics = registry.getMetrics();
			expect(metrics.writeErrors).toBe(1);
			expect(metrics.errorsByTransformer.get('write_error_transformer')).toBe(1);
			expect(result).toBe(100); // Original value returned on error
		});

		it('should accumulate errors by transformer name', () => {
			// Mock the get method to return a throwing transformer
			const throwingTransformer = new ThrowingTransformer();
			jest.spyOn(registry, 'get').mockReturnValue(throwingTransformer);

			const transformer = registry.getMonitored('failing_transformer');

			transformer.read(1);
			transformer.read(2);
			transformer.write(3);

			const metrics = registry.getMetrics();
			expect(metrics.errorsByTransformer.get('failing_transformer')).toBe(3);

			// Restore mock
			jest.restoreAllMocks();
		});

		it('should reset metrics when resetMetrics() is called', () => {
			const transformer = registry.getMonitored('brightness_to_percent');
			transformer.read(128);
			transformer.read(255);

			registry.resetMetrics();

			const metrics = registry.getMetrics();
			expect(metrics.totalReadOperations).toBe(0);
			expect(metrics.totalWriteOperations).toBe(0);
		});

		it('should reset metrics when clear() is called', () => {
			const transformer = registry.getMonitored('brightness_to_percent');
			transformer.read(128);

			registry.clear();

			const metrics = registry.getMetrics();
			expect(metrics.totalReadOperations).toBe(0);
		});

		it('should cache monitored transformer instances', () => {
			const transformer1 = registry.getMonitored('brightness_to_percent');
			const transformer2 = registry.getMonitored('brightness_to_percent');

			expect(transformer1).toBe(transformer2);
		});

		it('should return different monitored instances for different transformers', () => {
			const transformer1 = registry.getMonitored('brightness_to_percent');
			const transformer2 = registry.getMonitored('state_on_off');

			expect(transformer1).not.toBe(transformer2);
		});

		it('should work with getOrCreateMonitored for named transformers', () => {
			const transformer = registry.getOrCreateMonitored('brightness_to_percent');

			transformer.read(255);

			const metrics = registry.getMetrics();
			expect(metrics.totalReadOperations).toBe(1);
		});

		it('should work with getOrCreateMonitored for inline transformers', () => {
			const transformer = registry.getOrCreateMonitored(undefined, {
				type: 'scale',
				input_range: [0, 100],
				output_range: [0, 255],
			});

			transformer.read(50);
			transformer.write(128);

			const metrics = registry.getMetrics();
			expect(metrics.totalReadOperations).toBe(1);
			expect(metrics.totalWriteOperations).toBe(1);
		});

		it('should work with getOrCreateMonitored for passthrough', () => {
			const transformer = registry.getOrCreateMonitored();

			transformer.read(42);

			const metrics = registry.getMetrics();
			expect(metrics.totalReadOperations).toBe(1);
		});

		it('should preserve canRead and canWrite from wrapped transformer', () => {
			const transformer = registry.getMonitored('brightness_to_percent');

			expect(transformer.canRead()).toBe(true);
			expect(transformer.canWrite()).toBe(true);
		});

		it('should return a copy of errorsByTransformer map', () => {
			// Mock the get method to return a throwing transformer
			const throwingTransformer = new ThrowingTransformer();
			jest.spyOn(registry, 'get').mockReturnValueOnce(throwingTransformer);

			const transformer = registry.getMonitored('failing');
			transformer.read(1);

			const metrics = registry.getMetrics();
			metrics.errorsByTransformer.set('failing', 999); // Modify the copy

			const freshMetrics = registry.getMetrics();
			expect(freshMetrics.errorsByTransformer.get('failing')).toBe(1); // Original unchanged
		});
	});
});

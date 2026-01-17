import {
	BooleanTransformer,
	ClampTransformer,
	FormulaTransformer,
	MapTransformer,
	PassthroughTransformer,
	RoundTransformer,
	ScaleTransformer,
	createInlineTransformer,
	createTransformer,
} from './transformers';

describe('Transformers', () => {
	describe('ScaleTransformer', () => {
		it('should scale values linearly on read', () => {
			const transformer = new ScaleTransformer({
				type: 'scale',
				input_range: [0, 255],
				output_range: [0, 100],
			});

			expect(transformer.read(0)).toBe(0);
			expect(transformer.read(255)).toBe(100);
			expect(transformer.read(127)).toBe(50);
		});

		it('should scale values inversely on write', () => {
			const transformer = new ScaleTransformer({
				type: 'scale',
				input_range: [0, 255],
				output_range: [0, 100],
			});

			expect(transformer.write(0)).toBe(0);
			expect(transformer.write(100)).toBe(255);
			expect(transformer.write(50)).toBe(128); // 50% of 255 = 127.5, rounds to 128
		});

		it('should clamp values to input range on read', () => {
			const transformer = new ScaleTransformer({
				type: 'scale',
				input_range: [0, 100],
				output_range: [0, 255],
			});

			expect(transformer.read(150)).toBe(255); // Clamped to 100, then scaled
			expect(transformer.read(-50)).toBe(0); // Clamped to 0
		});

		it('should handle string values', () => {
			const transformer = new ScaleTransformer({
				type: 'scale',
				input_range: [0, 100],
				output_range: [0, 255],
			});

			expect(transformer.read('50')).toBe(128); // 50% of 255 = 127.5, rounds to 128
		});

		it('should handle direction read_only', () => {
			const transformer = new ScaleTransformer({
				type: 'scale',
				input_range: [0, 255],
				output_range: [0, 100],
				direction: 'read_only',
			});

			expect(transformer.canRead()).toBe(true);
			expect(transformer.canWrite()).toBe(false);
		});

		it('should handle direction write_only', () => {
			const transformer = new ScaleTransformer({
				type: 'scale',
				input_range: [0, 255],
				output_range: [0, 100],
				direction: 'write_only',
			});

			expect(transformer.canRead()).toBe(false);
			expect(transformer.canWrite()).toBe(true);
		});
	});

	describe('MapTransformer', () => {
		it('should map values on read using read map', () => {
			const transformer = new MapTransformer({
				type: 'map',
				read: {
					on: 'enabled',
					off: 'disabled',
				},
			});

			expect(transformer.read('on')).toBe('enabled');
			expect(transformer.read('off')).toBe('disabled');
		});

		it('should map values on write using write map', () => {
			const transformer = new MapTransformer({
				type: 'map',
				write: {
					enabled: 'on',
					disabled: 'off',
				},
			});

			expect(transformer.write('enabled')).toBe('on');
			expect(transformer.write('disabled')).toBe('off');
		});

		it('should use bidirectional map for both read and write', () => {
			const transformer = new MapTransformer({
				type: 'map',
				bidirectional: {
					heat: 'heating',
					cool: 'cooling',
					off: 'off',
				},
			});

			// Read: HA -> Panel
			expect(transformer.read('heat')).toBe('heating');
			expect(transformer.read('cool')).toBe('cooling');

			// Write: Panel -> HA
			expect(transformer.write('heating')).toBe('heat');
			expect(transformer.write('cooling')).toBe('cool');
		});

		it('should return original value for unmapped keys', () => {
			const transformer = new MapTransformer({
				type: 'map',
				read: {
					known: 'mapped',
				},
			});

			expect(transformer.read('unknown')).toBe('unknown');
		});

		it('should handle numeric keys', () => {
			const transformer = new MapTransformer({
				type: 'map',
				read: {
					'1': 'one',
					'2': 'two',
				},
			});

			expect(transformer.read(1)).toBe('one');
			expect(transformer.read('2')).toBe('two');
		});
	});

	describe('FormulaTransformer', () => {
		it('should apply read formula', () => {
			const transformer = new FormulaTransformer({
				type: 'formula',
				read: 'value * 2',
			});

			expect(transformer.read(10)).toBe(20);
			expect(transformer.read(5)).toBe(10);
		});

		it('should apply write formula', () => {
			const transformer = new FormulaTransformer({
				type: 'formula',
				write: 'value / 2',
			});

			expect(transformer.write(20)).toBe(10);
			expect(transformer.write(10)).toBe(5);
		});

		it('should support Math functions', () => {
			const transformer = new FormulaTransformer({
				type: 'formula',
				read: 'Math.round(1000000 / value)',
			});

			expect(transformer.read(250)).toBe(4000); // mireds to kelvin
		});

		it('should return value unchanged if no formula matches direction', () => {
			const transformer = new FormulaTransformer({
				type: 'formula',
				read: 'value * 2',
				// No write formula
			});

			expect(transformer.write(10)).toBe(10); // Unchanged
		});

		it('should handle non-numeric values gracefully', () => {
			const transformer = new FormulaTransformer({
				type: 'formula',
				read: 'value * 2',
			});

			expect(transformer.read('not a number')).toBe('not a number');
		});

		it('should reject unsafe formulas with process', () => {
			expect(() => {
				new FormulaTransformer({
					type: 'formula',
					read: 'process.exit(1)',
				});
			}).toThrow(/Unsafe formula/);
		});

		it('should reject unsafe formulas with require', () => {
			expect(() => {
				new FormulaTransformer({
					type: 'formula',
					read: "require('fs')",
				});
			}).toThrow(/Unsafe formula/);
		});

		it('should reject unsafe formulas with Function constructor', () => {
			expect(() => {
				new FormulaTransformer({
					type: 'formula',
					read: 'new Function("return 1")()',
				});
			}).toThrow(/Unsafe formula/);
		});

		it('should allow Math.round', () => {
			const transformer = new FormulaTransformer({
				type: 'formula',
				read: 'Math.round(value)',
			});

			expect(transformer.read(3.7)).toBe(4);
		});

		it('should allow Math.floor', () => {
			const transformer = new FormulaTransformer({
				type: 'formula',
				read: 'Math.floor(value)',
			});

			expect(transformer.read(3.9)).toBe(3);
		});

		it('should allow Math.ceil', () => {
			const transformer = new FormulaTransformer({
				type: 'formula',
				read: 'Math.ceil(value)',
			});

			expect(transformer.read(3.1)).toBe(4);
		});
	});

	describe('BooleanTransformer', () => {
		it('should convert true_value to true on read', () => {
			const transformer = new BooleanTransformer({
				type: 'boolean',
				true_value: 'on',
				false_value: 'off',
			});

			expect(transformer.read('on')).toBe(true);
		});

		it('should convert false_value to false on read', () => {
			const transformer = new BooleanTransformer({
				type: 'boolean',
				true_value: 'on',
				false_value: 'off',
			});

			expect(transformer.read('off')).toBe(false);
		});

		it('should convert true to true_value on write', () => {
			const transformer = new BooleanTransformer({
				type: 'boolean',
				true_value: 'on',
				false_value: 'off',
			});

			expect(transformer.write(true)).toBe('on');
		});

		it('should convert false to false_value on write', () => {
			const transformer = new BooleanTransformer({
				type: 'boolean',
				true_value: 'on',
				false_value: 'off',
			});

			expect(transformer.write(false)).toBe('off');
		});

		it('should invert values when invert is true', () => {
			const transformer = new BooleanTransformer({
				type: 'boolean',
				true_value: 'on',
				false_value: 'off',
				invert: true,
			});

			expect(transformer.read('on')).toBe(false); // Inverted
			expect(transformer.read('off')).toBe(true); // Inverted
			expect(transformer.write(true)).toBe('off'); // Inverted
			expect(transformer.write(false)).toBe('on'); // Inverted
		});

		it('should coerce string values', () => {
			const transformer = new BooleanTransformer({
				type: 'boolean',
				true_value: 'yes',
				false_value: 'no',
			});

			expect(transformer.read('true')).toBe(true);
			expect(transformer.read('1')).toBe(true);
			expect(transformer.read('false')).toBe(false);
			expect(transformer.read('0')).toBe(false);
		});

		it('should coerce numeric values', () => {
			const transformer = new BooleanTransformer({
				type: 'boolean',
				true_value: 1,
				false_value: 0,
			});

			expect(transformer.read(1)).toBe(true);
			expect(transformer.read(0)).toBe(false);
			expect(transformer.read(5)).toBe(true); // Non-zero is truthy
		});

		it('should handle locked/unlocked for locks', () => {
			const transformer = new BooleanTransformer({
				type: 'boolean',
				true_value: 'locked',
				false_value: 'unlocked',
			});

			expect(transformer.read('locked')).toBe(true);
			expect(transformer.read('unlocked')).toBe(false);
			expect(transformer.write(true)).toBe('locked');
			expect(transformer.write(false)).toBe('unlocked');
		});
	});

	describe('ClampTransformer', () => {
		it('should clamp values to range on read', () => {
			const transformer = new ClampTransformer({
				type: 'clamp',
				min: 0,
				max: 100,
			});

			expect(transformer.read(50)).toBe(50);
			expect(transformer.read(-10)).toBe(0);
			expect(transformer.read(150)).toBe(100);
		});

		it('should clamp values to range on write', () => {
			const transformer = new ClampTransformer({
				type: 'clamp',
				min: 10,
				max: 90,
			});

			expect(transformer.write(50)).toBe(50);
			expect(transformer.write(5)).toBe(10);
			expect(transformer.write(95)).toBe(90);
		});

		it('should handle string values', () => {
			const transformer = new ClampTransformer({
				type: 'clamp',
				min: 0,
				max: 100,
			});

			expect(transformer.read('50')).toBe(50);
			expect(transformer.read('200')).toBe(100);
		});
	});

	describe('RoundTransformer', () => {
		it('should round to integers by default', () => {
			const transformer = new RoundTransformer({
				type: 'round',
			});

			expect(transformer.read(3.7)).toBe(4);
			expect(transformer.read(3.2)).toBe(3);
		});

		it('should round to specified precision', () => {
			const transformer = new RoundTransformer({
				type: 'round',
				precision: 2,
			});

			expect(transformer.read(3.14159)).toBe(3.14);
			expect(transformer.read(2.567)).toBe(2.57);
		});

		it('should round on write as well', () => {
			const transformer = new RoundTransformer({
				type: 'round',
				precision: 1,
			});

			expect(transformer.write(3.14)).toBe(3.1);
		});
	});

	describe('PassthroughTransformer', () => {
		it('should return values unchanged on read', () => {
			const transformer = new PassthroughTransformer();

			expect(transformer.read(42)).toBe(42);
			expect(transformer.read('hello')).toBe('hello');
			expect(transformer.read(true)).toBe(true);
			expect(transformer.read(null)).toBe(null);
		});

		it('should return values unchanged on write', () => {
			const transformer = new PassthroughTransformer();

			expect(transformer.write(42)).toBe(42);
			expect(transformer.write('hello')).toBe('hello');
		});

		it('should support direction configuration', () => {
			const readOnly = new PassthroughTransformer('read_only');
			expect(readOnly.canRead()).toBe(true);
			expect(readOnly.canWrite()).toBe(false);

			const writeOnly = new PassthroughTransformer('write_only');
			expect(writeOnly.canRead()).toBe(false);
			expect(writeOnly.canWrite()).toBe(true);
		});
	});

	describe('createTransformer', () => {
		it('should create ScaleTransformer for scale type', () => {
			const transformer = createTransformer({
				type: 'scale',
				input_range: [0, 100],
				output_range: [0, 255],
			});

			expect(transformer).toBeInstanceOf(ScaleTransformer);
			expect(transformer.read(100)).toBe(255);
		});

		it('should create MapTransformer for map type', () => {
			const transformer = createTransformer({
				type: 'map',
				read: { a: 'A' },
			});

			expect(transformer).toBeInstanceOf(MapTransformer);
			expect(transformer.read('a')).toBe('A');
		});

		it('should create FormulaTransformer for formula type', () => {
			const transformer = createTransformer({
				type: 'formula',
				read: 'value + 1',
			});

			expect(transformer).toBeInstanceOf(FormulaTransformer);
			expect(transformer.read(5)).toBe(6);
		});

		it('should create BooleanTransformer for boolean type', () => {
			const transformer = createTransformer({
				type: 'boolean',
				true_value: 'yes',
				false_value: 'no',
			});

			expect(transformer).toBeInstanceOf(BooleanTransformer);
			expect(transformer.read('yes')).toBe(true);
		});

		it('should create ClampTransformer for clamp type', () => {
			const transformer = createTransformer({
				type: 'clamp',
				min: 0,
				max: 100,
			});

			expect(transformer).toBeInstanceOf(ClampTransformer);
			expect(transformer.read(150)).toBe(100);
		});

		it('should create RoundTransformer for round type', () => {
			const transformer = createTransformer({
				type: 'round',
				precision: 2,
			});

			expect(transformer).toBeInstanceOf(RoundTransformer);
			expect(transformer.read(3.14159)).toBe(3.14);
		});

		it('should create PassthroughTransformer for unknown type', () => {
			const transformer = createTransformer({
				type: 'unknown' as 'scale',
				input_range: [0, 100],
				output_range: [0, 100],
			});

			expect(transformer).toBeInstanceOf(PassthroughTransformer);
		});
	});

	describe('createInlineTransformer', () => {
		it('should create scale transformer from inline config', () => {
			const transformer = createInlineTransformer({
				input_range: [0, 255],
				output_range: [0, 100],
			});

			expect(transformer.read(255)).toBe(100);
		});

		it('should create boolean transformer from inline config', () => {
			const transformer = createInlineTransformer({
				true_value: 'on',
				false_value: 'off',
			});

			expect(transformer.read('on')).toBe(true);
		});

		it('should create map transformer from inline values', () => {
			const transformer = createInlineTransformer({
				values: {
					heat: 'heating',
					cool: 'cooling',
				},
			});

			expect(transformer.read('heat')).toBe('heating');
		});

		it('should create formula transformer from inline read/write strings', () => {
			const transformer = createInlineTransformer({
				read: 'value * 2',
				write: 'value / 2',
			});

			expect(transformer.read(5)).toBe(10);
			expect(transformer.write(10)).toBe(5);
		});

		it('should return passthrough when no config matches', () => {
			const transformer = createInlineTransformer({});

			expect(transformer).toBeInstanceOf(PassthroughTransformer);
		});

		it('should handle explicit type in inline config', () => {
			const transformer = createInlineTransformer({
				type: 'boolean',
				true_value: 'yes',
				false_value: 'no',
			});

			expect(transformer.read('yes')).toBe(true);
		});
	});
});

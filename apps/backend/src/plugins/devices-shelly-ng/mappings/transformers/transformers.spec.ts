import {
	BooleanTransformerDefinition,
	ClampTransformerDefinition,
	FormulaTransformerDefinition,
	MapTransformerDefinition,
	RoundTransformerDefinition,
	ScaleTransformerDefinition,
} from './transformer.types';
import {
	BooleanTransformer,
	ClampTransformer,
	FormulaTransformer,
	MapTransformer,
	RoundTransformer,
	ScaleTransformer,
	createTransformer,
} from './transformers';

describe('ScaleTransformer', () => {
	test('linear interpolation from 0-100 to 0-255', () => {
		const transformer = new ScaleTransformer({
			type: 'scale',
			input_range: [0, 100],
			output_range: [0, 255],
		});

		expect(transformer.read(0)).toBe(0);
		expect(transformer.read(50)).toBe(128);
		expect(transformer.read(100)).toBe(255);
		expect(transformer.write(0)).toBe(0);
		expect(transformer.write(128)).toBe(50);
		expect(transformer.write(255)).toBe(100);
	});

	test('handles degenerate input range', () => {
		const transformer = new ScaleTransformer({
			type: 'scale',
			input_range: [50, 50],
			output_range: [0, 100],
		});

		expect(transformer.read(50)).toBe(0);
		expect(transformer.read(100)).toBe(0);
	});

	test('handles degenerate output range', () => {
		const transformer = new ScaleTransformer({
			type: 'scale',
			input_range: [0, 100],
			output_range: [50, 50],
		});

		expect(transformer.write(50)).toBe(0);
	});

	test('handles NaN and Infinity', () => {
		const transformer = new ScaleTransformer({
			type: 'scale',
			input_range: [0, 100],
			output_range: [0, 255],
		});

		expect(transformer.read(NaN)).toBeNaN();
		expect(transformer.read(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
		expect(transformer.write(NaN)).toBeNaN();
	});
});

describe('MapTransformer', () => {
	test('bidirectional mapping', () => {
		const transformer = new MapTransformer({
			type: 'map',
			bidirectional: {
				on: true,
				off: false,
			},
		});

		expect(transformer.read('on')).toBe(true);
		expect(transformer.read('off')).toBe(false);
		expect(transformer.write(true)).toBe('on');
		expect(transformer.write(false)).toBe('off');
	});

	test('separate read and write maps', () => {
		const transformer = new MapTransformer({
			type: 'map',
			read: {
				opening: 'opening',
				closing: 'closing',
			},
			write: {
				open: 'open',
				close: 'close',
			},
		});

		expect(transformer.read('opening')).toBe('opening');
		expect(transformer.read('closing')).toBe('closing');
		expect(transformer.write('open')).toBe('open');
		expect(transformer.write('close')).toBe('close');
	});

	test('returns original value if not in map', () => {
		const transformer = new MapTransformer({
			type: 'map',
			read: { a: 'b' },
		});

		expect(transformer.read('unknown')).toBe('unknown');
	});

	test('write_formula applies formula when value not in map', () => {
		const transformer = new MapTransformer({
			type: 'map',
			write: { 0: 'off', 1: 'on' },
			write_formula: 'value * 2',
		});

		expect(transformer.write(0)).toBe('off');
		expect(transformer.write(1)).toBe('on');
		expect(transformer.write(5)).toBe(10); // Uses formula
		expect(transformer.write(10)).toBe(20); // Uses formula
	});

	test('write_formula rejects dangerous patterns', () => {
		const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

		const transformer = new MapTransformer({
			type: 'map',
			write_formula: 'eval("malicious code")',
		});

		// Formula should not be compiled due to dangerous pattern
		expect(transformer.write(5)).toBe(5); // Returns original value
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('Map transformer: Write formula rejected due to dangerous patterns'),
		);

		consoleSpy.mockRestore();
	});

	test('write_formula rejects require() calls', () => {
		const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

		const transformer = new MapTransformer({
			type: 'map',
			write_formula: 'require("child_process").exec("rm -rf /")',
		});

		expect(transformer.write(5)).toBe(5);
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('Map transformer: Write formula rejected due to dangerous patterns'),
		);

		consoleSpy.mockRestore();
	});
});

describe('BooleanTransformer', () => {
	test('converts true/false values', () => {
		const transformer = new BooleanTransformer({
			type: 'boolean',
			true_value: 1,
			false_value: 0,
		});

		expect(transformer.read(1)).toBe(true);
		expect(transformer.read(0)).toBe(false);
		expect(transformer.write(true)).toBe(1);
		expect(transformer.write(false)).toBe(0);
	});

	test('handles inversion', () => {
		const transformer = new BooleanTransformer({
			type: 'boolean',
			true_value: 0,
			false_value: 1,
			invert: true,
		});

		expect(transformer.read(0)).toBe(false); // 0 means true, but inverted
		expect(transformer.read(1)).toBe(true); // 1 means false, but inverted
	});
});

describe('ClampTransformer', () => {
	test('clamps values to range', () => {
		const transformer = new ClampTransformer({
			type: 'clamp',
			min: 0,
			max: 100,
		});

		expect(transformer.read(50)).toBe(50);
		expect(transformer.read(-10)).toBe(0);
		expect(transformer.read(150)).toBe(100);
	});

	test('handles NaN and Infinity', () => {
		const transformer = new ClampTransformer({
			type: 'clamp',
			min: 0,
			max: 100,
		});

		expect(transformer.read(NaN)).toBeNaN();
		expect(transformer.read(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
	});
});

describe('RoundTransformer', () => {
	test('rounds to integer', () => {
		const transformer = new RoundTransformer({
			type: 'round',
			precision: 0,
		});

		expect(transformer.read(3.7)).toBe(4);
		expect(transformer.read(3.2)).toBe(3);
	});

	test('rounds to decimal places', () => {
		const transformer = new RoundTransformer({
			type: 'round',
			precision: 2,
		});

		expect(transformer.read(3.14159)).toBe(3.14);
		expect(transformer.read(3.145)).toBe(3.15);
	});
});

describe('FormulaTransformer', () => {
	test('applies JavaScript formula', () => {
		const transformer = new FormulaTransformer({
			type: 'formula',
			read: 'value * 2',
			write: 'value / 2',
		});

		expect(transformer.read(5)).toBe(10);
		expect(transformer.write(10)).toBe(5);
	});

	test('returns original value on error', () => {
		const transformer = new FormulaTransformer({
			type: 'formula',
			read: 'invalid syntax !!!',
		});

		expect(transformer.read(5)).toBe(5);
	});
});

describe('createTransformer', () => {
	test('creates scale transformer', () => {
		const def: ScaleTransformerDefinition = {
			type: 'scale',
			input_range: [0, 100],
			output_range: [0, 255],
		};
		const transformer = createTransformer(def);
		expect(transformer).toBeInstanceOf(ScaleTransformer);
	});

	test('creates map transformer', () => {
		const def: MapTransformerDefinition = {
			type: 'map',
			bidirectional: { a: 'b' },
		};
		const transformer = createTransformer(def);
		expect(transformer).toBeInstanceOf(MapTransformer);
	});

	test('creates boolean transformer', () => {
		const def: BooleanTransformerDefinition = {
			type: 'boolean',
			true_value: 1,
			false_value: 0,
		};
		const transformer = createTransformer(def);
		expect(transformer).toBeInstanceOf(BooleanTransformer);
	});

	test('creates clamp transformer', () => {
		const def: ClampTransformerDefinition = {
			type: 'clamp',
			min: 0,
			max: 100,
		};
		const transformer = createTransformer(def);
		expect(transformer).toBeInstanceOf(ClampTransformer);
	});

	test('creates round transformer', () => {
		const def: RoundTransformerDefinition = {
			type: 'round',
			precision: 2,
		};
		const transformer = createTransformer(def);
		expect(transformer).toBeInstanceOf(RoundTransformer);
	});

	test('creates formula transformer', () => {
		const def: FormulaTransformerDefinition = {
			type: 'formula',
			read: 'value * 2',
		};
		const transformer = createTransformer(def);
		expect(transformer).toBeInstanceOf(FormulaTransformer);
	});
});

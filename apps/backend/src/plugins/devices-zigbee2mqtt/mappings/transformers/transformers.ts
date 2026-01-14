/**
 * Transformer Implementations
 *
 * Concrete implementations of all transformer types for converting
 * values between Zigbee2MQTT and Smart Panel formats.
 */
import {
	AnyTransformerDefinition,
	BooleanTransformerDefinition,
	ClampTransformerDefinition,
	FormulaTransformerDefinition,
	ITransformer,
	InlineTransform,
	MapTransformerDefinition,
	RoundTransformerDefinition,
	ScaleTransformerDefinition,
	TransformContext,
	TransformDirection,
} from './transformer.types';

/**
 * Base transformer class with common functionality
 */
abstract class BaseTransformer implements ITransformer {
	protected direction: TransformDirection;

	constructor(direction: TransformDirection = 'bidirectional') {
		this.direction = direction;
	}

	abstract read(value: unknown, context?: TransformContext): unknown;
	abstract write(value: unknown, context?: TransformContext): unknown;

	canRead(): boolean {
		return this.direction === 'bidirectional' || this.direction === 'read_only';
	}

	canWrite(): boolean {
		return this.direction === 'bidirectional' || this.direction === 'write_only';
	}

	/**
	 * Safely convert value to number
	 */
	protected toNumber(value: unknown, fallback: number = 0): number {
		if (typeof value === 'number') {
			return value;
		}
		if (typeof value === 'string') {
			const parsed = parseFloat(value);
			return isNaN(parsed) ? fallback : parsed;
		}
		if (typeof value === 'boolean') {
			return value ? 1 : 0;
		}
		return fallback;
	}

	/**
	 * Safely convert value to string for map lookups
	 */
	protected toStringKey(value: unknown): string {
		if (value === null || value === undefined) {
			return '';
		}
		if (typeof value === 'string') {
			return value;
		}
		if (typeof value === 'number' || typeof value === 'boolean') {
			return String(value);
		}
		if (typeof value === 'object') {
			return JSON.stringify(value);
		}
		// For symbols and other types, use JSON.stringify as fallback
		return JSON.stringify(value);
	}
}

/**
 * Scale Transformer
 *
 * Linear scaling between input and output ranges.
 * Automatically invertible for write operations.
 *
 * Example: brightness 0-254 (Z2M) <-> 0-100 (Panel)
 */
export class ScaleTransformer extends BaseTransformer {
	private inputMin: number;
	private inputMax: number;
	private outputMin: number;
	private outputMax: number;

	constructor(definition: ScaleTransformerDefinition) {
		super(definition.direction);
		this.inputMin = definition.input_range[0];
		this.inputMax = definition.input_range[1];
		this.outputMin = definition.output_range[0];
		this.outputMax = definition.output_range[1];
	}

	read(value: unknown, _context?: TransformContext): number {
		const numValue = this.toNumber(value, this.inputMin);
		return this.scale(numValue, this.inputMin, this.inputMax, this.outputMin, this.outputMax);
	}

	write(value: unknown, _context?: TransformContext): number {
		const numValue = this.toNumber(value, this.outputMin);
		// Inverse scaling for write
		return this.scale(numValue, this.outputMin, this.outputMax, this.inputMin, this.inputMax);
	}

	private scale(value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number {
		// Handle edge case where input range is zero
		if (fromMax === fromMin) {
			return toMin;
		}

		// Clamp input to range
		const clampedValue = Math.max(fromMin, Math.min(fromMax, value));

		// Linear interpolation
		const ratio = (clampedValue - fromMin) / (fromMax - fromMin);
		const result = toMin + ratio * (toMax - toMin);

		return Math.round(result);
	}
}

/**
 * Map Transformer
 *
 * Value mapping using lookup tables.
 * Supports separate read/write maps or bidirectional mapping.
 *
 * Example: cover state OPEN/CLOSE/STOP <-> opened/closed/stopped
 */
export class MapTransformer extends BaseTransformer {
	private readMap: Map<string, unknown>;
	private writeMap: Map<string, unknown>;

	constructor(definition: MapTransformerDefinition) {
		super(definition.direction);

		this.readMap = new Map();
		this.writeMap = new Map();

		// Build read map
		if (definition.read) {
			for (const [key, val] of Object.entries(definition.read)) {
				this.readMap.set(key, val);
			}
		}

		// Build write map
		if (definition.write) {
			for (const [key, val] of Object.entries(definition.write)) {
				this.writeMap.set(String(key), val);
			}
		}

		// Handle bidirectional mapping - creates both read and inverse write maps
		if (definition.bidirectional) {
			for (const [key, val] of Object.entries(definition.bidirectional)) {
				this.readMap.set(key, val);
				// Inverse mapping for write
				this.writeMap.set(this.toStringKey(val), key);
			}
		}
	}

	read(value: unknown, _context?: TransformContext): unknown {
		const key = this.toStringKey(value);
		return this.readMap.has(key) ? this.readMap.get(key) : value;
	}

	write(value: unknown, _context?: TransformContext): unknown {
		const key = this.toStringKey(value);
		return this.writeMap.has(key) ? this.writeMap.get(key) : value;
	}
}

/**
 * Formula Transformer
 *
 * Custom JavaScript expressions for complex transformations.
 * Uses 'value' variable in expressions.
 *
 * Example: color temperature mired <-> Kelvin (1000000 / value)
 */
export class FormulaTransformer extends BaseTransformer {
	private readFormula: ((value: unknown, context?: TransformContext) => unknown) | null;
	private writeFormula: ((value: unknown, context?: TransformContext) => unknown) | null;

	constructor(definition: FormulaTransformerDefinition) {
		super(definition.direction);

		this.readFormula = definition.read ? this.compileFormula(definition.read) : null;
		this.writeFormula = definition.write ? this.compileFormula(definition.write) : null;
	}

	read(value: unknown, context?: TransformContext): unknown {
		if (!this.readFormula) {
			return value;
		}
		try {
			return this.readFormula(value, context);
		} catch {
			return value;
		}
	}

	write(value: unknown, context?: TransformContext): unknown {
		if (!this.writeFormula) {
			return value;
		}
		try {
			return this.writeFormula(value, context);
		} catch {
			return value;
		}
	}

	private compileFormula(formula: string): (value: unknown, context?: TransformContext) => unknown {
		// Create a safe evaluation function
		// eslint-disable-next-line @typescript-eslint/no-implied-eval
		const fn = new Function(
			'value',
			'context',
			'Math',
			`
			"use strict";
			try {
				return ${formula};
			} catch (e) {
				return value;
			}
		`,
		);

		return (value: unknown, context?: TransformContext): unknown => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
			return fn(value, context, Math) as unknown;
		};
	}
}

/**
 * Boolean Transformer
 *
 * Converts between Z2M on/off values and boolean.
 * Automatically invertible.
 *
 * Example: state "ON"/"OFF" <-> true/false
 */
export class BooleanTransformer extends BaseTransformer {
	private trueValue: unknown;
	private falseValue: unknown;
	private invert: boolean;

	constructor(definition: BooleanTransformerDefinition) {
		super(definition.direction);
		this.trueValue = definition.true_value;
		this.falseValue = definition.false_value;
		this.invert = definition.invert ?? false;
	}

	read(value: unknown, _context?: TransformContext): boolean {
		let result: boolean;

		if (value === this.trueValue) {
			result = true;
		} else if (value === this.falseValue) {
			result = false;
		} else {
			// Try to coerce to boolean
			result = this.coerceBoolean(value);
		}

		return this.invert ? !result : result;
	}

	write(value: unknown, _context?: TransformContext): unknown {
		let boolValue = this.coerceBoolean(value);

		if (this.invert) {
			boolValue = !boolValue;
		}

		return boolValue ? this.trueValue : this.falseValue;
	}

	private coerceBoolean(value: unknown): boolean {
		if (typeof value === 'boolean') {
			return value;
		}
		if (typeof value === 'number') {
			return value !== 0;
		}
		if (typeof value === 'string') {
			const lower = value.toLowerCase();
			return lower === 'true' || lower === '1' || lower === 'on' || lower === 'yes';
		}
		return Boolean(value);
	}
}

/**
 * Clamp Transformer
 *
 * Clamps values to a min/max range.
 * Same operation for read and write.
 */
export class ClampTransformer extends BaseTransformer {
	private min: number;
	private max: number;

	constructor(definition: ClampTransformerDefinition) {
		super(definition.direction);
		this.min = definition.min;
		this.max = definition.max;
	}

	read(value: unknown, _context?: TransformContext): number {
		return this.clamp(this.toNumber(value));
	}

	write(value: unknown, _context?: TransformContext): number {
		return this.clamp(this.toNumber(value));
	}

	private clamp(value: number): number {
		return Math.max(this.min, Math.min(this.max, value));
	}
}

/**
 * Round Transformer
 *
 * Rounds numeric values to specified precision.
 * Same operation for read and write.
 */
export class RoundTransformer extends BaseTransformer {
	private precision: number;
	private multiplier: number;

	constructor(definition: RoundTransformerDefinition) {
		super(definition.direction);
		this.precision = definition.precision ?? 0;
		this.multiplier = Math.pow(10, this.precision);
	}

	read(value: unknown, _context?: TransformContext): number {
		return this.round(this.toNumber(value));
	}

	write(value: unknown, _context?: TransformContext): number {
		return this.round(this.toNumber(value));
	}

	private round(value: number): number {
		return Math.round(value * this.multiplier) / this.multiplier;
	}
}

/**
 * Passthrough Transformer
 *
 * Returns values unchanged. Used as default when no transformer is specified.
 */
export class PassthroughTransformer extends BaseTransformer {
	constructor(direction: TransformDirection = 'bidirectional') {
		super(direction);
	}

	read(value: unknown, _context?: TransformContext): unknown {
		return value;
	}

	write(value: unknown, _context?: TransformContext): unknown {
		return value;
	}
}

/**
 * Composite Transformer
 *
 * Chains multiple transformers together.
 * Transformers are applied in order for read, reverse order for write.
 */
export class CompositeTransformer extends BaseTransformer {
	private transformers: ITransformer[];

	constructor(transformers: ITransformer[], direction: TransformDirection = 'bidirectional') {
		super(direction);
		this.transformers = transformers;
	}

	read(value: unknown, context?: TransformContext): unknown {
		let result = value;
		for (const transformer of this.transformers) {
			if (transformer.canRead()) {
				result = transformer.read(result, context);
			}
		}
		return result;
	}

	write(value: unknown, context?: TransformContext): unknown {
		let result = value;
		// Apply in reverse order for write
		for (let i = this.transformers.length - 1; i >= 0; i--) {
			const transformer = this.transformers[i];
			if (transformer.canWrite()) {
				result = transformer.write(result, context);
			}
		}
		return result;
	}
}

/**
 * Factory function to create a transformer from definition
 */
export function createTransformer(definition: AnyTransformerDefinition): ITransformer {
	switch (definition.type) {
		case 'scale':
			return new ScaleTransformer(definition);
		case 'map':
			return new MapTransformer(definition);
		case 'formula':
			return new FormulaTransformer(definition);
		case 'boolean':
			return new BooleanTransformer(definition);
		case 'clamp':
			return new ClampTransformer(definition);
		case 'round':
			return new RoundTransformer(definition);
		default:
			return new PassthroughTransformer();
	}
}

/**
 * Create a transformer from inline transform definition
 */
export function createInlineTransformer(transform: InlineTransform): ITransformer {
	// Handle explicit type
	if (transform.type) {
		switch (transform.type) {
			case 'scale':
				return new ScaleTransformer({
					type: 'scale',
					input_range: transform.input_range ?? [0, 100],
					output_range: transform.output_range ?? [0, 100],
				});
			case 'boolean':
				return new BooleanTransformer({
					type: 'boolean',
					true_value: transform.true_value ?? true,
					false_value: transform.false_value ?? false,
					invert: transform.invert,
				});
			case 'map':
				return new MapTransformer({
					type: 'map',
					read: typeof transform.read === 'object' ? (transform.read as Record<string, unknown>) : undefined,
					write: typeof transform.write === 'object' ? (transform.write as Record<string, unknown>) : undefined,
					bidirectional: transform.values,
				});
			case 'formula':
				return new FormulaTransformer({
					type: 'formula',
					read: typeof transform.read === 'string' ? transform.read : undefined,
					write: typeof transform.write === 'string' ? transform.write : undefined,
				});
		}
	}

	// Infer type from properties
	if (transform.input_range && transform.output_range) {
		return new ScaleTransformer({
			type: 'scale',
			input_range: transform.input_range,
			output_range: transform.output_range,
		});
	}

	if (transform.true_value !== undefined || transform.false_value !== undefined) {
		return new BooleanTransformer({
			type: 'boolean',
			true_value: transform.true_value ?? true,
			false_value: transform.false_value ?? false,
			invert: transform.invert,
		});
	}

	if (transform.values || (typeof transform.read === 'object' && transform.read !== null)) {
		return new MapTransformer({
			type: 'map',
			read: typeof transform.read === 'object' ? (transform.read as Record<string, unknown>) : undefined,
			write: typeof transform.write === 'object' ? (transform.write as Record<string, unknown>) : undefined,
			bidirectional: transform.values,
		});
	}

	if (typeof transform.read === 'string' || typeof transform.write === 'string') {
		return new FormulaTransformer({
			type: 'formula',
			read: typeof transform.read === 'string' ? transform.read : undefined,
			write: typeof transform.write === 'string' ? transform.write : undefined,
		});
	}

	return new PassthroughTransformer();
}

/**
 * Transformer Implementations for Shelly NG
 *
 * Concrete implementations of value transformers.
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
 * Base class for transformers
 */
abstract class BaseTransformer implements ITransformer {
	protected readonly direction: TransformDirection;

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
}

/**
 * Scale transformer - linear interpolation between ranges
 */
export class ScaleTransformer extends BaseTransformer {
	private readonly inputMin: number;
	private readonly inputMax: number;
	private readonly outputMin: number;
	private readonly outputMax: number;
	private readonly inputRangeValid: boolean;
	private readonly outputRangeValid: boolean;

	constructor(def: ScaleTransformerDefinition) {
		super(def.direction);
		[this.inputMin, this.inputMax] = def.input_range;
		[this.outputMin, this.outputMax] = def.output_range;

		// Validate ranges to prevent division by zero
		this.inputRangeValid = this.inputMax !== this.inputMin;
		this.outputRangeValid = this.outputMax !== this.outputMin;

		// Note: Warnings are logged during construction, but we don't have access to logger here
		// In a production environment, these degenerate ranges should be caught during validation
	}

	read(value: unknown): unknown {
		if (typeof value !== 'number') {
			return value;
		}

		// Handle NaN and Infinity
		if (!Number.isFinite(value)) {
			return value; // Pass through NaN/Infinity as-is
		}

		// Handle degenerate input range - return outputMin (or outputMax, they're equal)
		if (!this.inputRangeValid) {
			return this.outputMin;
		}

		// Linear interpolation: Shelly -> Panel
		const ratio = (value - this.inputMin) / (this.inputMax - this.inputMin);
		return Math.round(this.outputMin + ratio * (this.outputMax - this.outputMin));
	}

	write(value: unknown): unknown {
		if (typeof value !== 'number') {
			return value;
		}

		// Handle NaN and Infinity
		if (!Number.isFinite(value)) {
			return value; // Pass through NaN/Infinity as-is
		}

		// Handle degenerate output range - return inputMin (or inputMax, they're equal)
		if (!this.outputRangeValid) {
			return this.inputMin;
		}

		// Inverse interpolation: Panel -> Shelly
		const ratio = (value - this.outputMin) / (this.outputMax - this.outputMin);
		return Math.round(this.inputMin + ratio * (this.inputMax - this.inputMin));
	}
}

/**
 * Map transformer - value lookup tables
 */
export class MapTransformer extends BaseTransformer {
	private readonly readMap: Map<string, unknown>;
	private readonly writeMap: Map<string, unknown>;
	private readonly writeFormula?: string;

	constructor(def: MapTransformerDefinition) {
		super(def.direction);
		this.readMap = new Map();
		this.writeMap = new Map();
		this.writeFormula = def.write_formula;

		// Build read map
		if (def.read) {
			for (const [key, value] of Object.entries(def.read)) {
				this.readMap.set(String(key), value);
			}
		}

		// Build write map
		if (def.write) {
			for (const [key, value] of Object.entries(def.write)) {
				this.writeMap.set(String(key), value);
			}
		}

		// Bidirectional creates both maps
		if (def.bidirectional) {
			for (const [key, value] of Object.entries(def.bidirectional)) {
				this.readMap.set(String(key), value);
				// Convert value to string safely - primitives use String(), objects use JSON.stringify
				const valueKey =
					typeof value === 'object' && value !== null
						? JSON.stringify(value)
						: String(value as string | number | boolean);
				this.writeMap.set(valueKey, key);
			}
		}
	}

	read(value: unknown): unknown {
		const key =
			typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value as string | number | boolean);
		return this.readMap.has(key) ? this.readMap.get(key) : value;
	}

	write(value: unknown): unknown {
		const key =
			typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value as string | number | boolean);

		if (this.writeMap.has(key)) {
			return this.writeMap.get(key);
		}

		// Try formula if available
		if (this.writeFormula && typeof value === 'number') {
			try {
				// eslint-disable-next-line @typescript-eslint/no-implied-eval
				const fn = new Function('value', `return ${this.writeFormula}`) as (v: number) => unknown;
				return fn(value);
			} catch {
				return value;
			}
		}

		return value;
	}
}

/**
 * Formula transformer - JavaScript expressions
 *
 * SECURITY NOTE: Currently uses `new Function()` which allows arbitrary code execution.
 * For production use, consider replacing with a sandboxed expression evaluator like 'expr-eval'.
 * This implementation includes basic validation to prevent obvious security issues.
 */
export class FormulaTransformer extends BaseTransformer {
	private readonly readFn?: (value: unknown) => unknown;
	private readonly writeFn?: (value: unknown) => unknown;
	private readonly readFormula?: string;
	private readonly writeFormula?: string;

	constructor(def: FormulaTransformerDefinition) {
		super(def.direction);

		// Validate formulas for dangerous patterns
		const dangerousPatterns = [
			/eval\s*\(/i,
			/Function\s*\(/i,
			/require\s*\(/i,
			/import\s+/i,
			/process\./i,
			/global\./i,
			/window\./i,
			/document\./i,
			/__proto__/i,
			/constructor\./i,
		];

		const validateFormula = (formula: string): boolean => {
			for (const pattern of dangerousPatterns) {
				if (pattern.test(formula)) {
					console.warn(`Formula transformer: Dangerous pattern detected in formula: ${formula}`);
					return false;
				}
			}
			return true;
		};

		if (def.read) {
			this.readFormula = def.read;
			if (validateFormula(def.read)) {
				try {
					// eslint-disable-next-line @typescript-eslint/no-implied-eval
					this.readFn = new Function('value', `return ${def.read}`) as (value: unknown) => unknown;
				} catch {
					// Invalid formula - will return value as-is
					console.warn(`Formula transformer: Failed to compile read formula: ${def.read}`);
				}
			}
		}

		if (def.write) {
			this.writeFormula = def.write;
			if (validateFormula(def.write)) {
				try {
					// eslint-disable-next-line @typescript-eslint/no-implied-eval
					this.writeFn = new Function('value', `return ${def.write}`) as (value: unknown) => unknown;
				} catch {
					// Invalid formula - will return value as-is
					console.warn(`Formula transformer: Failed to compile write formula: ${def.write}`);
				}
			}
		}
	}

	read(value: unknown): unknown {
		if (this.readFn) {
			try {
				// Execute formula in a controlled context
				return this.readFn(value);
			} catch (error) {
				console.warn(`Formula transformer read error: ${error instanceof Error ? error.message : String(error)}`);
				return value;
			}
		}
		if (this.readFormula) {
			console.warn(
				`Formula transformer: Read formula not compiled, returning original value. Formula: ${this.readFormula}`,
			);
		}
		return value;
	}

	write(value: unknown): unknown {
		if (this.writeFn) {
			try {
				// Execute formula in a controlled context
				return this.writeFn(value);
			} catch (error) {
				console.warn(`Formula transformer write error: ${error instanceof Error ? error.message : String(error)}`);
				return value;
			}
		}
		if (this.writeFormula) {
			console.warn(
				`Formula transformer: Write formula not compiled, returning original value. Formula: ${this.writeFormula}`,
			);
		}
		return value;
	}
}

/**
 * Boolean transformer - converts between different boolean representations
 */
export class BooleanTransformer extends BaseTransformer {
	private readonly trueValue: unknown;
	private readonly falseValue: unknown;
	private readonly invert: boolean;

	constructor(def: BooleanTransformerDefinition) {
		super(def.direction);
		this.trueValue = def.true_value;
		this.falseValue = def.false_value;
		this.invert = def.invert ?? false;
	}

	read(value: unknown): unknown {
		let result: boolean;

		if (value === this.trueValue) {
			result = true;
		} else if (value === this.falseValue) {
			result = false;
		} else {
			// Try to coerce to boolean
			result = Boolean(value);
		}

		return this.invert ? !result : result;
	}

	write(value: unknown): unknown {
		let boolValue = Boolean(value);

		if (this.invert) {
			boolValue = !boolValue;
		}

		return boolValue ? this.trueValue : this.falseValue;
	}
}

/**
 * Clamp transformer - constrains values to a range
 */
export class ClampTransformer extends BaseTransformer {
	private readonly min: number;
	private readonly max: number;

	constructor(def: ClampTransformerDefinition) {
		super(def.direction);
		this.min = def.min;
		this.max = def.max;
	}

	read(value: unknown): unknown {
		if (typeof value !== 'number') {
			return value;
		}
		// Handle NaN and Infinity
		if (!Number.isFinite(value)) {
			return value;
		}
		return Math.max(this.min, Math.min(this.max, value));
	}

	write(value: unknown): unknown {
		if (typeof value !== 'number') {
			return value;
		}
		// Handle NaN and Infinity
		if (!Number.isFinite(value)) {
			return value;
		}
		return Math.max(this.min, Math.min(this.max, value));
	}
}

/**
 * Round transformer - rounds numeric values
 */
export class RoundTransformer extends BaseTransformer {
	private readonly precision: number;

	constructor(def: RoundTransformerDefinition) {
		super(def.direction);
		this.precision = def.precision ?? 0;
	}

	read(value: unknown): unknown {
		if (typeof value !== 'number') {
			return value;
		}
		// Handle NaN and Infinity
		if (!Number.isFinite(value)) {
			return value;
		}
		const factor = Math.pow(10, this.precision);
		return Math.round(value * factor) / factor;
	}

	write(value: unknown): unknown {
		if (typeof value !== 'number') {
			return value;
		}
		// Handle NaN and Infinity
		if (!Number.isFinite(value)) {
			return value;
		}
		const factor = Math.pow(10, this.precision);
		return Math.round(value * factor) / factor;
	}
}

/**
 * Identity transformer - passes values through unchanged
 */
export class IdentityTransformer extends BaseTransformer {
	constructor() {
		super('bidirectional');
	}

	read(value: unknown): unknown {
		return value;
	}

	write(value: unknown): unknown {
		return value;
	}
}

/**
 * Create a transformer from a definition
 */
export function createTransformer(def: AnyTransformerDefinition): ITransformer {
	switch (def.type) {
		case 'scale':
			return new ScaleTransformer(def);
		case 'map':
			return new MapTransformer(def);
		case 'formula':
			return new FormulaTransformer(def);
		case 'boolean':
			return new BooleanTransformer(def);
		case 'clamp':
			return new ClampTransformer(def);
		case 'round':
			return new RoundTransformer(def);
		default:
			return new IdentityTransformer();
	}
}

/**
 * Create a transformer from an inline transform definition
 */
export function createInlineTransformer(transform: InlineTransform): ITransformer {
	// Determine type from properties
	if (transform.type === 'scale' || (transform.input_range && transform.output_range)) {
		return new ScaleTransformer({
			type: 'scale',
			input_range: transform.input_range ?? [0, 100],
			output_range: transform.output_range ?? [0, 100],
		});
	}

	if (transform.type === 'boolean' || transform.true_value !== undefined) {
		return new BooleanTransformer({
			type: 'boolean',
			true_value: transform.true_value ?? true,
			false_value: transform.false_value ?? false,
			invert: transform.invert,
		});
	}

	if (transform.type === 'map' || transform.values) {
		return new MapTransformer({
			type: 'map',
			bidirectional: transform.values,
		});
	}

	if (transform.type === 'formula' || typeof transform.read === 'string' || typeof transform.write === 'string') {
		return new FormulaTransformer({
			type: 'formula',
			read: typeof transform.read === 'string' ? transform.read : undefined,
			write: typeof transform.write === 'string' ? transform.write : undefined,
		});
	}

	return new IdentityTransformer();
}

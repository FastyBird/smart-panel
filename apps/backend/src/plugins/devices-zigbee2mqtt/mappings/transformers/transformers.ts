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
 * Can optionally use a formula for write when no map entry is found.
 *
 * Example: cover state OPEN/CLOSE/STOP <-> opened/closed/stopped
 */
export class MapTransformer extends BaseTransformer {
	private readMap: Map<string, unknown>;
	private writeMap: Map<string, unknown>;
	private writeFormulaFn: ((value: number) => unknown) | null = null;

	// Allowed Math functions for write_formula (same as FormulaTransformer)
	private static readonly ALLOWED_MATH_FUNCTIONS = [
		'abs',
		'ceil',
		'floor',
		'round',
		'trunc',
		'max',
		'min',
		'pow',
		'sqrt',
		'log',
		'log10',
		'log2',
		'exp',
		'sign',
	];

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

		// Compile write formula if provided (used as fallback when no map entry found)
		if (definition.write_formula) {
			this.writeFormulaFn = this.compileWriteFormula(definition.write_formula);
		}
	}

	read(value: unknown, _context?: TransformContext): unknown {
		const key = this.toStringKey(value);
		return this.readMap.has(key) ? this.readMap.get(key) : value;
	}

	write(value: unknown, _context?: TransformContext): unknown {
		const key = this.toStringKey(value);
		// First try the write map
		if (this.writeMap.has(key)) {
			return this.writeMap.get(key);
		}
		// If no map entry and we have a formula, use it
		if (this.writeFormulaFn) {
			const numValue = this.toNumber(value, NaN);
			if (!isNaN(numValue)) {
				try {
					return this.writeFormulaFn(numValue);
				} catch {
					return value;
				}
			}
		}
		// Fallback to original value
		return value;
	}

	/**
	 * Compile a write formula into a function
	 * Uses same security restrictions as FormulaTransformer
	 */
	private compileWriteFormula(formula: string): ((value: number) => unknown) | null {
		try {
			// Basic validation - reject obviously dangerous patterns
			const forbidden = [
				/\bprocess\b/i,
				/\brequire\b/i,
				/\bglobal\b/i,
				/\beval\b/i,
				/\bFunction\b/,
				/\bthis\b/,
				/\bnew\b/,
			];
			for (const pattern of forbidden) {
				if (pattern.test(formula)) {
					return null;
				}
			}

			// Create sandboxed Math object
			const safeMath: Record<string, (...args: number[]) => number> = {};
			for (const fn of MapTransformer.ALLOWED_MATH_FUNCTIONS) {
				safeMath[fn] = Math[fn as keyof Math] as (...args: number[]) => number;
			}

			// Compile the formula
			// eslint-disable-next-line @typescript-eslint/no-implied-eval
			const fn = new Function(
				'value',
				'Math',
				`
				"use strict";
				return ${formula};
			`,
			);

			return (value: number): unknown => {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call
				return fn(value, safeMath);
			};
		} catch {
			return null;
		}
	}
}

/**
 * Formula Transformer
 *
 * Safe mathematical expressions for value transformations.
 * Uses 'value' variable in expressions.
 *
 * SECURITY: Only allows mathematical operations to prevent arbitrary code execution.
 * Allowed: arithmetic (+, -, *, /, %), Math functions, numeric literals, 'value' variable
 * Forbidden: function calls, property access (except Math.*), assignments, keywords
 *
 * Example: color temperature mired <-> Kelvin (1000000 / value)
 */
export class FormulaTransformer extends BaseTransformer {
	private readFormula: ((value: number) => number) | null;
	private writeFormula: ((value: number) => number) | null;

	// Allowed Math functions (safe mathematical operations only)
	private static readonly ALLOWED_MATH_FUNCTIONS = [
		'abs',
		'ceil',
		'floor',
		'round',
		'trunc',
		'max',
		'min',
		'pow',
		'sqrt',
		'log',
		'log10',
		'log2',
		'exp',
		'sign',
	];

	// Forbidden patterns that could enable code execution
	private static readonly FORBIDDEN_PATTERNS = [
		/\bprocess\b/i,
		/\brequire\b/i,
		/\bglobal\b/i,
		/\beval\b/i,
		/\bFunction\b/,
		/\bthis\b/,
		/\bnew\b/,
		/\bimport\b/i,
		/\bexport\b/i,
		/\bclass\b/,
		/\bfunction\b/,
		/\breturn\b/, // We add return ourselves
		/\bvar\b/,
		/\blet\b/,
		/\bconst\b/,
		/\bif\b/,
		/\belse\b/,
		/\bfor\b/,
		/\bwhile\b/,
		/\bdo\b/,
		/\bswitch\b/,
		/\btry\b/,
		/\bcatch\b/,
		/\bthrow\b/,
		/\bawait\b/,
		/\basync\b/,
		/\byield\b/,
		/\bdelete\b/,
		/\btypeof\b/,
		/\binstanceof\b/,
		/\bin\b/,
		/\bvoid\b/,
		/\bdebugger\b/,
		/\bconstructor\b/i,
		/\bprototype\b/i,
		/\b__proto__\b/,
		/\b__defineGetter__\b/,
		/\b__defineSetter__\b/,
		/\[\s*['"`]/, // Property access with string literals: obj["prop"]
		/['"`]\s*\]/, // Property access with string literals: obj["prop"]
		/`/, // Template literals
		/;/, // Multiple statements
		/=>/, // Arrow functions
		/=(?!=)/, // Assignment (but not == or ===)
		/\+\+/, // Increment
		/--/, // Decrement
	];

	constructor(definition: FormulaTransformerDefinition) {
		super(definition.direction);

		this.readFormula = definition.read ? this.compileFormula(definition.read) : null;
		this.writeFormula = definition.write ? this.compileFormula(definition.write) : null;
	}

	read(value: unknown, _context?: TransformContext): unknown {
		if (!this.readFormula) {
			return value;
		}
		try {
			// Use NaN as fallback so isNaN check properly detects non-numeric values
			const numValue = this.toNumber(value, NaN);
			if (isNaN(numValue)) {
				return value;
			}
			return this.readFormula(numValue);
		} catch {
			return value;
		}
	}

	write(value: unknown, _context?: TransformContext): unknown {
		if (!this.writeFormula) {
			return value;
		}
		try {
			// Use NaN as fallback so isNaN check properly detects non-numeric values
			const numValue = this.toNumber(value, NaN);
			if (isNaN(numValue)) {
				return value;
			}
			return this.writeFormula(numValue);
		} catch {
			return value;
		}
	}

	/**
	 * Validate that a formula is safe (only contains mathematical operations)
	 */
	private validateFormula(formula: string): void {
		// Check for forbidden patterns
		for (const pattern of FormulaTransformer.FORBIDDEN_PATTERNS) {
			if (pattern.test(formula)) {
				throw new Error(`Unsafe formula: contains forbidden pattern ${pattern.source}`);
			}
		}

		// Check for property access - only Math.* is allowed
		// Allow: Math.round, Math.floor, etc.
		// Forbid: anything.else, value.something, obj.method()
		// Use [a-zA-Z_] for first char to avoid matching decimal numbers like 2.54
		const propertyAccessPattern = /([a-zA-Z_]\w*)\s*\.\s*(\w+)/g;
		let match: RegExpExecArray | null;
		while ((match = propertyAccessPattern.exec(formula)) !== null) {
			const obj = match[1];
			const prop = match[2];
			if (obj !== 'Math') {
				throw new Error(`Unsafe formula: property access on '${obj}' is not allowed`);
			}
			if (!FormulaTransformer.ALLOWED_MATH_FUNCTIONS.includes(prop)) {
				throw new Error(`Unsafe formula: Math.${prop} is not an allowed function`);
			}
		}

		// Check for standalone function calls (not Math.*)
		// First, remove all valid Math.function() calls, then check for remaining function calls
		let formulaWithoutMath = formula;
		for (const fn of FormulaTransformer.ALLOWED_MATH_FUNCTIONS) {
			formulaWithoutMath = formulaWithoutMath.replace(new RegExp(`Math\\.${fn}\\s*`, 'g'), '');
		}

		// Now check for any remaining function calls
		const functionCallPattern = /\b([a-zA-Z_]\w*)\s*\(/g;
		while ((match = functionCallPattern.exec(formulaWithoutMath)) !== null) {
			const funcName = match[1];
			throw new Error(`Unsafe formula: function call '${funcName}()' is not allowed`);
		}

		// Verify the formula only contains allowed characters and tokens
		// After removing Math function calls and 'value', should only have numbers and operators
		let simplified = formula;

		// Remove allowed Math.* calls (including parentheses)
		for (const fn of FormulaTransformer.ALLOWED_MATH_FUNCTIONS) {
			simplified = simplified.replace(new RegExp(`Math\\.${fn}`, 'g'), '');
		}

		// Remove 'value' variable
		simplified = simplified.replace(/\bvalue\b/g, '');

		// Remove numbers (including decimals and scientific notation)
		simplified = simplified.replace(/\d+\.?\d*(?:[eE][+-]?\d+)?/g, '');

		// Remove allowed operators and whitespace
		simplified = simplified.replace(/[\s+\-*/%(),.<>=!&|?:]+/g, '');

		// If anything remains, it's not allowed
		if (simplified.length > 0) {
			throw new Error(`Unsafe formula: contains unexpected tokens '${simplified}'`);
		}
	}

	/**
	 * Compile a validated formula into a safe function
	 */
	private compileFormula(formula: string): (value: number) => number {
		// Validate the formula first
		this.validateFormula(formula);

		// Create a sandboxed Math object with only allowed functions
		const safeMath: Record<string, (...args: number[]) => number> = {};
		for (const fn of FormulaTransformer.ALLOWED_MATH_FUNCTIONS) {
			safeMath[fn] = Math[fn as keyof Math] as (...args: number[]) => number;
		}

		// Compile the formula with restricted scope
		// eslint-disable-next-line @typescript-eslint/no-implied-eval
		const fn = new Function(
			'value',
			'Math',
			`
			"use strict";
			return ${formula};
		`,
		);

		return (value: number): number => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const result = fn(value, safeMath) as unknown;
			return typeof result === 'number' ? result : NaN;
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

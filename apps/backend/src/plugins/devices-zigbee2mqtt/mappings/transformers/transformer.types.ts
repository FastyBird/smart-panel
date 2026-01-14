/**
 * Transformer Types and Interfaces
 *
 * Defines the transformer system for converting values between
 * Zigbee2MQTT and Smart Panel formats bidirectionally.
 */

/**
 * Supported transformer types
 */
export type TransformerType = 'scale' | 'map' | 'formula' | 'boolean' | 'clamp' | 'round';

/**
 * Direction of transformation
 */
export type TransformDirection = 'bidirectional' | 'read_only' | 'write_only';

/**
 * Base transformer definition from config
 */
export interface TransformerDefinition {
	type: TransformerType;
	direction?: TransformDirection;
}

/**
 * Scale transformer - linear scaling between ranges
 * Automatically invertible
 */
export interface ScaleTransformerDefinition extends TransformerDefinition {
	type: 'scale';
	input_range: [number, number]; // Z2M range [min, max]
	output_range: [number, number]; // Panel range [min, max]
}

/**
 * Map transformer - value mapping with lookup tables
 */
export interface MapTransformerDefinition extends TransformerDefinition {
	type: 'map';
	read?: Record<string, unknown>; // Z2M value -> Panel value
	write?: Record<string, unknown>; // Panel value -> Z2M value
	bidirectional?: Record<string, unknown>; // Auto-creates inverse for write
}

/**
 * Formula transformer - custom JavaScript expressions
 */
export interface FormulaTransformerDefinition extends TransformerDefinition {
	type: 'formula';
	read?: string; // Expression for read (Z2M -> Panel)
	write?: string; // Expression for write (Panel -> Z2M)
}

/**
 * Boolean transformer - ON/OFF, true/false conversions
 * Automatically invertible
 */
export interface BooleanTransformerDefinition extends TransformerDefinition {
	type: 'boolean';
	true_value: unknown; // Z2M value representing true
	false_value: unknown; // Z2M value representing false
	invert?: boolean; // Invert the boolean logic
}

/**
 * Clamp transformer - clamp values to min/max range
 */
export interface ClampTransformerDefinition extends TransformerDefinition {
	type: 'clamp';
	min: number;
	max: number;
}

/**
 * Round transformer - round numeric values
 */
export interface RoundTransformerDefinition extends TransformerDefinition {
	type: 'round';
	precision?: number; // Decimal places (default: 0)
}

/**
 * Union type for all transformer definitions
 */
export type AnyTransformerDefinition =
	| ScaleTransformerDefinition
	| MapTransformerDefinition
	| FormulaTransformerDefinition
	| BooleanTransformerDefinition
	| ClampTransformerDefinition
	| RoundTransformerDefinition;

/**
 * Inline transform in property mapping
 */
export interface InlineTransform {
	type?: TransformerType;
	read?: unknown;
	write?: unknown;
	input_range?: [number, number];
	output_range?: [number, number];
	true_value?: unknown;
	false_value?: unknown;
	invert?: boolean;
	values?: Record<string, unknown>; // Bidirectional map
}

/**
 * Context passed to transformers for additional information
 */
export interface TransformContext {
	/** Z2M expose information (has min/max/unit from device) */
	expose?: {
		value_min?: number;
		value_max?: number;
		unit?: string;
		values?: string[];
	};
	/** Property identifier */
	propertyIdentifier?: string;
	/** Channel identifier */
	channelIdentifier?: string;
	/** Device friendly name */
	deviceName?: string;
}

/**
 * Transformer interface - all transformers must implement this
 */
export interface ITransformer {
	/**
	 * Transform value from Z2M format to Smart Panel format
	 * @param value - Value from Zigbee2MQTT
	 * @param context - Optional transformation context
	 * @returns Transformed value for Smart Panel
	 */
	read(value: unknown, context?: TransformContext): unknown;

	/**
	 * Transform value from Smart Panel format to Z2M format
	 * @param value - Value from Smart Panel
	 * @param context - Optional transformation context
	 * @returns Transformed value for Zigbee2MQTT
	 */
	write(value: unknown, context?: TransformContext): unknown;

	/**
	 * Whether this transformer supports read operations
	 */
	canRead(): boolean;

	/**
	 * Whether this transformer supports write operations
	 */
	canWrite(): boolean;
}

/**
 * Result of transformer creation
 */
export interface TransformerCreateResult {
	success: boolean;
	transformer?: ITransformer;
	error?: string;
}

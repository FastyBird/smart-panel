/**
 * Transformer Registry for Shelly NG
 *
 * Manages named transformer instances and provides lookup functionality.
 */
import { Injectable } from '@nestjs/common';

import { AnyTransformerDefinition, ITransformer } from './transformer.types';
import { IdentityTransformer, createTransformer } from './transformers';

/**
 * Registry for managing named transformers
 */
@Injectable()
export class TransformerRegistry {
	private readonly transformers: Map<string, ITransformer> = new Map();
	private readonly identityTransformer = new IdentityTransformer();

	/**
	 * Register a transformer by name
	 */
	register(name: string, definition: AnyTransformerDefinition): void {
		const transformer = createTransformer(definition);
		this.transformers.set(name, transformer);
	}

	/**
	 * Register multiple transformers
	 */
	registerAll(definitions: Record<string, AnyTransformerDefinition>): void {
		for (const [name, definition] of Object.entries(definitions)) {
			this.register(name, definition);
		}
	}

	/**
	 * Get a transformer by name
	 * Returns identity transformer if not found
	 */
	get(name: string): ITransformer {
		return this.transformers.get(name) ?? this.identityTransformer;
	}

	/**
	 * Check if a transformer exists
	 */
	has(name: string): boolean {
		return this.transformers.has(name);
	}

	/**
	 * Get number of registered transformers
	 */
	get size(): number {
		return this.transformers.size;
	}

	/**
	 * Clear all registered transformers
	 */
	clear(): void {
		this.transformers.clear();
	}
}

/**
 * Built-in transformers for Shelly NG devices
 */
export const BUILTIN_TRANSFORMERS: Record<string, AnyTransformerDefinition> = {
	// Boolean state transformer (Shelly uses true/false natively)
	boolean_state: {
		type: 'boolean',
		true_value: true,
		false_value: false,
	},

	// Percentage (0-100) - passthrough
	percentage: {
		type: 'clamp',
		min: 0,
		max: 100,
	},

	// Color temperature (Kelvin range for Shelly CCT)
	color_temp_kelvin: {
		type: 'clamp',
		min: 2700,
		max: 6500,
	},

	// RGB color value (0-255)
	rgb_color: {
		type: 'clamp',
		min: 0,
		max: 255,
	},

	// Cover position (Shelly: 0=closed, 100=open)
	cover_position: {
		type: 'clamp',
		min: 0,
		max: 100,
	},

	// Round to integer
	round_int: {
		type: 'round',
		precision: 0,
	},

	// Round to 1 decimal
	round_1dp: {
		type: 'round',
		precision: 1,
	},

	// Round to 2 decimals
	round_2dp: {
		type: 'round',
		precision: 2,
	},

	// Cover state to status
	cover_state: {
		type: 'map',
		bidirectional: {
			open: 'opening',
			close: 'closing',
			stop: 'stopped',
			stopped: 'stopped',
			opening: 'opening',
			closing: 'closing',
		},
	},
};

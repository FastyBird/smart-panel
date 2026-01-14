/**
 * Transformer Registry
 *
 * Central registry for named transformers.
 * Transformers can be registered from YAML config and looked up by name.
 */
import { Injectable } from '@nestjs/common';

import { AnyTransformerDefinition, ITransformer, InlineTransform } from './transformer.types';
import { PassthroughTransformer, createInlineTransformer, createTransformer } from './transformers';

/**
 * Registry for managing named transformers
 */
@Injectable()
export class TransformerRegistry {
	private transformers = new Map<string, ITransformer>();
	private definitions = new Map<string, AnyTransformerDefinition>();

	/**
	 * Register a transformer definition by name
	 */
	register(name: string, definition: AnyTransformerDefinition): void {
		this.definitions.set(name, definition);
		this.transformers.set(name, createTransformer(definition));
	}

	/**
	 * Register multiple transformer definitions
	 */
	registerAll(transformers: Record<string, AnyTransformerDefinition>): void {
		for (const [name, definition] of Object.entries(transformers)) {
			this.register(name, definition);
		}
	}

	/**
	 * Get a transformer by name
	 * Returns PassthroughTransformer if not found
	 */
	get(name: string): ITransformer {
		return this.transformers.get(name) ?? new PassthroughTransformer();
	}

	/**
	 * Check if a transformer exists
	 */
	has(name: string): boolean {
		return this.transformers.has(name);
	}

	/**
	 * Get transformer definition by name
	 */
	getDefinition(name: string): AnyTransformerDefinition | undefined {
		return this.definitions.get(name);
	}

	/**
	 * Get or create a transformer
	 * If name is provided, looks up in registry
	 * If inline transform is provided, creates new transformer
	 * Returns passthrough if neither is provided
	 */
	getOrCreate(name?: string, inline?: InlineTransform): ITransformer {
		if (name && this.has(name)) {
			return this.get(name);
		}

		if (inline) {
			return createInlineTransformer(inline);
		}

		return new PassthroughTransformer();
	}

	/**
	 * Clear all registered transformers
	 */
	clear(): void {
		this.transformers.clear();
		this.definitions.clear();
	}

	/**
	 * Get all registered transformer names
	 */
	getNames(): string[] {
		return Array.from(this.transformers.keys());
	}

	/**
	 * Get count of registered transformers
	 */
	get size(): number {
		return this.transformers.size;
	}
}

/**
 * Built-in transformer definitions for common conversions
 * These are automatically registered when the registry is initialized
 */
export const BUILTIN_TRANSFORMERS: Record<string, AnyTransformerDefinition> = {
	// Brightness: Z2M 0-254 <-> Panel 0-100%
	brightness_normalize: {
		type: 'scale',
		input_range: [0, 254],
		output_range: [0, 100],
	},

	// Brightness with 255 max (some devices)
	brightness_normalize_255: {
		type: 'scale',
		input_range: [0, 255],
		output_range: [0, 100],
	},

	// Color temperature: mired <-> Kelvin
	color_temp_mired_to_kelvin: {
		type: 'formula',
		read: 'Math.round(1000000 / value)',
		write: 'Math.round(1000000 / value)',
	},

	// Link quality: Z2M 0-255 <-> Panel 0-100%
	link_quality_normalize: {
		type: 'scale',
		input_range: [0, 255],
		output_range: [0, 100],
		direction: 'read_only',
	},

	// State ON/OFF <-> boolean
	state_on_off: {
		type: 'boolean',
		true_value: 'ON',
		false_value: 'OFF',
	},

	// State OPEN/CLOSE <-> boolean (for locks)
	state_open_close: {
		type: 'boolean',
		true_value: 'OPEN',
		false_value: 'CLOSE',
	},

	// Cover state normalization
	cover_state: {
		type: 'map',
		read: {
			OPEN: 'opened',
			CLOSE: 'closed',
			STOP: 'stopped',
		},
		write: {
			open: 'OPEN',
			close: 'CLOSE',
			stop: 'STOP',
			opened: 'OPEN',
			closed: 'CLOSE',
			stopped: 'STOP',
		},
	},

	// Lock state: LOCKED/UNLOCKED <-> boolean
	lock_state: {
		type: 'boolean',
		true_value: 'LOCKED',
		false_value: 'UNLOCKED',
	},

	// Contact sensor: invert logic (Z2M true=closed, Panel true=open/detected)
	contact_invert: {
		type: 'boolean',
		true_value: true,
		false_value: false,
		invert: true,
	},

	// Fan speed: low/medium/high/auto
	fan_mode: {
		type: 'map',
		bidirectional: {
			low: 'low',
			medium: 'medium',
			high: 'high',
			auto: 'auto',
			off: 'off',
		},
	},

	// HVAC mode normalization
	hvac_mode: {
		type: 'map',
		bidirectional: {
			off: 'off',
			heat: 'heating',
			cool: 'cooling',
			auto: 'auto',
			fan_only: 'fan_only',
			dry: 'dry',
		},
	},

	// HVAC running state
	hvac_running_state: {
		type: 'map',
		read: {
			idle: 'idle',
			heat: 'heating',
			cool: 'cooling',
			fan_only: 'fan_only',
		},
		direction: 'read_only',
	},

	// Passthrough (no transformation)
	passthrough: {
		type: 'formula',
		read: 'value',
		write: 'value',
	},
};

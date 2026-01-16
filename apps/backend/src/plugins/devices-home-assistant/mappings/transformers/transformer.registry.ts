/**
 * Transformer Registry
 *
 * Central registry for named transformers.
 * Transformers can be registered from YAML config and looked up by name.
 */
import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../../common/logger';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../../devices-home-assistant.constants';

import { AnyTransformerDefinition, ITransformer, InlineTransform } from './transformer.types';
import { PassthroughTransformer, createInlineTransformer, createTransformer } from './transformers';

/**
 * Registry for managing named transformers
 */
@Injectable()
export class TransformerRegistry {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'TransformerRegistry',
	);

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
		if (name) {
			if (this.has(name)) {
				return this.get(name);
			}
			this.logger.warn(
				`Transformer '${name}' not found in registry. Using passthrough (no transformation). ` +
					`Available transformers: ${this.getNames().join(', ')}`,
			);
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
 * Built-in transformer definitions for Home Assistant
 */
export const BUILTIN_TRANSFORMERS: Record<string, AnyTransformerDefinition> = {
	// Brightness: HA uses 0-255, Panel uses 0-100%
	brightness_to_percent: {
		type: 'scale',
		input_range: [0, 255],
		output_range: [0, 100],
	},

	// Inverse brightness transform
	percent_to_brightness: {
		type: 'scale',
		input_range: [0, 100],
		output_range: [0, 255],
	},

	// Color temperature: mireds to Kelvin
	mireds_to_kelvin: {
		type: 'formula',
		read: 'Math.round(1000000 / value)',
		write: 'Math.round(1000000 / value)',
	},

	// Kelvin to mireds
	kelvin_to_mireds: {
		type: 'formula',
		read: 'Math.round(1000000 / value)',
		write: 'Math.round(1000000 / value)',
	},

	// State on/off to boolean
	state_on_off: {
		type: 'boolean',
		true_value: 'on',
		false_value: 'off',
	},

	// Invert boolean
	invert_boolean: {
		type: 'boolean',
		true_value: true,
		false_value: false,
		invert: true,
	},

	// Cover state normalization
	cover_state: {
		type: 'map',
		read: {
			open: 'opened',
			closed: 'closed',
			opening: 'opening',
			closing: 'closing',
		},
		write: {
			opened: 'open',
			closed: 'closed',
			opening: 'opening',
			closing: 'closing',
		},
	},

	// Lock state: locked/unlocked to boolean
	lock_state: {
		type: 'boolean',
		true_value: 'locked',
		false_value: 'unlocked',
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

	// HVAC action normalization
	hvac_action: {
		type: 'map',
		read: {
			idle: 'idle',
			heating: 'heating',
			cooling: 'cooling',
			off: 'idle',
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

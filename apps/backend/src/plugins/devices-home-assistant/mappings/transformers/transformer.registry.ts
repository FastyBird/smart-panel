/**
 * Transformer Registry
 *
 * Central registry for named transformers.
 * Transformers can be registered from YAML config and looked up by name.
 */
import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../../common/logger';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../../devices-home-assistant.constants';

import { AnyTransformerDefinition, ITransformer, InlineTransform, TransformContext } from './transformer.types';
import { PassthroughTransformer, createInlineTransformer, createTransformer } from './transformers';

// Maximum number of inline transformers to cache
const INLINE_CACHE_MAX_SIZE = 100;

/**
 * Metrics for transformer operations
 */
export interface TransformerMetrics {
	totalReadOperations: number;
	totalWriteOperations: number;
	readErrors: number;
	writeErrors: number;
	errorsByTransformer: Map<string, number>;
}

/**
 * Wrapper transformer that tracks metrics and handles errors
 */
class MonitoredTransformer implements ITransformer {
	constructor(
		private readonly wrapped: ITransformer,
		private readonly name: string,
		private readonly onReadError: (name: string, error: Error, value: unknown) => void,
		private readonly onWriteError: (name: string, error: Error, value: unknown) => void,
		private readonly onRead: () => void,
		private readonly onWrite: () => void,
	) {}

	read(value: unknown, context?: TransformContext): unknown {
		this.onRead();
		try {
			return this.wrapped.read(value, context);
		} catch (error) {
			this.onReadError(this.name, error as Error, value);
			return value; // Return original value on error
		}
	}

	write(value: unknown, context?: TransformContext): unknown {
		this.onWrite();
		try {
			return this.wrapped.write(value, context);
		} catch (error) {
			this.onWriteError(this.name, error as Error, value);
			return value; // Return original value on error
		}
	}

	canRead(): boolean {
		return this.wrapped.canRead();
	}

	canWrite(): boolean {
		return this.wrapped.canWrite();
	}
}

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

	// Singleton passthrough transformer to avoid repeated instantiation
	private readonly passthroughTransformer = new PassthroughTransformer();

	// LRU cache for inline transformers
	private inlineCache = new Map<string, ITransformer>();
	private inlineCacheOrder: string[] = [];

	// Cache for monitored transformer wrappers
	private monitoredCache = new Map<string, ITransformer>();

	// Metrics tracking
	private metrics: TransformerMetrics = {
		totalReadOperations: 0,
		totalWriteOperations: 0,
		readErrors: 0,
		writeErrors: 0,
		errorsByTransformer: new Map(),
	};

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
	 * Returns cached PassthroughTransformer if not found
	 */
	get(name: string): ITransformer {
		return this.transformers.get(name) ?? this.passthroughTransformer;
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
	 * If inline transform is provided, creates or retrieves cached transformer
	 * Returns cached passthrough if neither is provided
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
			return this.getOrCreateInline(inline);
		}

		return this.passthroughTransformer;
	}

	/**
	 * Get or create an inline transformer with LRU caching
	 */
	private getOrCreateInline(inline: InlineTransform): ITransformer {
		const cacheKey = this.computeInlineCacheKey(inline);

		// Check cache hit
		const cached = this.inlineCache.get(cacheKey);
		if (cached) {
			// Move to end of order (most recently used)
			const index = this.inlineCacheOrder.indexOf(cacheKey);
			if (index > -1) {
				this.inlineCacheOrder.splice(index, 1);
				this.inlineCacheOrder.push(cacheKey);
			}
			return cached;
		}

		// Create new transformer
		const transformer = createInlineTransformer(inline);

		// Add to cache with LRU eviction
		if (this.inlineCacheOrder.length >= INLINE_CACHE_MAX_SIZE) {
			const evictKey = this.inlineCacheOrder.shift();
			if (evictKey) {
				this.inlineCache.delete(evictKey);
			}
		}

		this.inlineCache.set(cacheKey, transformer);
		this.inlineCacheOrder.push(cacheKey);

		return transformer;
	}

	/**
	 * Compute a cache key for inline transformer config
	 */
	private computeInlineCacheKey(inline: InlineTransform): string {
		// Use JSON.stringify with sorted keys for consistent hashing
		return JSON.stringify(inline, Object.keys(inline).sort());
	}

	/**
	 * Clear all registered transformers and caches
	 */
	clear(): void {
		this.transformers.clear();
		this.definitions.clear();
		this.inlineCache.clear();
		this.inlineCacheOrder = [];
		this.monitoredCache.clear();
		this.resetMetrics();
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

	/**
	 * Get inline cache statistics for monitoring
	 */
	getInlineCacheStats(): { size: number; maxSize: number } {
		return {
			size: this.inlineCache.size,
			maxSize: INLINE_CACHE_MAX_SIZE,
		};
	}

	/**
	 * Get a monitored version of a transformer that tracks metrics
	 * Use this when you want to track operations and errors
	 */
	getMonitored(name: string): ITransformer {
		// Check if we already have a monitored wrapper cached
		const cached = this.monitoredCache.get(name);
		if (cached) {
			return cached;
		}

		const transformer = this.get(name);
		const monitored = new MonitoredTransformer(
			transformer,
			name,
			this.handleReadError.bind(this),
			this.handleWriteError.bind(this),
			this.handleRead.bind(this),
			this.handleWrite.bind(this),
		);

		this.monitoredCache.set(name, monitored);
		return monitored;
	}

	/**
	 * Get a monitored version using getOrCreate logic
	 */
	getOrCreateMonitored(name?: string, inline?: InlineTransform): ITransformer {
		const transformerName = name ?? (inline ? `inline:${this.computeInlineCacheKey(inline)}` : 'passthrough');

		// Check if we already have a monitored wrapper cached
		const cached = this.monitoredCache.get(transformerName);
		if (cached) {
			return cached;
		}

		const transformer = this.getOrCreate(name, inline);
		const monitored = new MonitoredTransformer(
			transformer,
			transformerName,
			this.handleReadError.bind(this),
			this.handleWriteError.bind(this),
			this.handleRead.bind(this),
			this.handleWrite.bind(this),
		);

		this.monitoredCache.set(transformerName, monitored);
		return monitored;
	}

	/**
	 * Get current metrics
	 */
	getMetrics(): TransformerMetrics {
		return {
			...this.metrics,
			// Return a copy of the map to prevent external modification
			errorsByTransformer: new Map(this.metrics.errorsByTransformer),
		};
	}

	/**
	 * Reset all metrics
	 */
	resetMetrics(): void {
		this.metrics = {
			totalReadOperations: 0,
			totalWriteOperations: 0,
			readErrors: 0,
			writeErrors: 0,
			errorsByTransformer: new Map(),
		};
	}

	/**
	 * Handle read operation tracking
	 */
	private handleRead(): void {
		this.metrics.totalReadOperations++;
	}

	/**
	 * Handle write operation tracking
	 */
	private handleWrite(): void {
		this.metrics.totalWriteOperations++;
	}

	/**
	 * Handle read error
	 */
	private handleReadError(name: string, error: Error, value: unknown): void {
		this.metrics.readErrors++;
		this.incrementTransformerErrors(name);
		this.logger.error(`Transformer '${name}' read error for value ${JSON.stringify(value)}: ${error.message}`);
	}

	/**
	 * Handle write error
	 */
	private handleWriteError(name: string, error: Error, value: unknown): void {
		this.metrics.writeErrors++;
		this.incrementTransformerErrors(name);
		this.logger.error(`Transformer '${name}' write error for value ${JSON.stringify(value)}: ${error.message}`);
	}

	/**
	 * Increment error count for a specific transformer
	 */
	private incrementTransformerErrors(name: string): void {
		const current = this.metrics.errorsByTransformer.get(name) ?? 0;
		this.metrics.errorsByTransformer.set(name, current + 1);
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

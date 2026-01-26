import { Injectable } from '@nestjs/common';

import { ChannelPropertyEntity } from '../../devices/entities/devices.entity';

/**
 * Base result interface for intent execution.
 */
export interface IntentExecutionResult {
	success: boolean;
	affectedDevices: number;
	failedDevices: number;
	skippedOfflineDevices?: number;
	offlineDeviceIds?: string[];
}

/**
 * Base service providing shared utilities for domain-specific intent services.
 * Contains common property extraction and value conversion methods.
 */
@Injectable()
export class SpaceIntentBaseService {
	/**
	 * Get min/max values from a property's format.
	 * Returns default range if format is not available or invalid.
	 */
	protected getPropertyMinMax(
		property: ChannelPropertyEntity | null | undefined,
		defaultMin: number = 0,
		defaultMax: number = 100,
	): { min: number; max: number } {
		if (!property?.format) {
			return { min: defaultMin, max: defaultMax };
		}

		// Format is typically "min:max" or array [min, max] or a range string
		const format = property.format;

		if (Array.isArray(format) && format.length >= 2) {
			const min = typeof format[0] === 'number' ? format[0] : parseFloat(String(format[0]));
			const max = typeof format[1] === 'number' ? format[1] : parseFloat(String(format[1]));

			if (!isNaN(min) && !isNaN(max)) {
				return { min, max };
			}
		}

		if (typeof format === 'string' && 'split' in String.prototype) {
			// Try to parse as "min:max" or "min|max"
			const parts = (format as string).split(/[:|]/);

			if (parts.length >= 2) {
				const min = parseFloat(parts[0]);
				const max = parseFloat(parts[1]);

				if (!isNaN(min) && !isNaN(max)) {
					return { min, max };
				}
			}
		}

		return { min: defaultMin, max: defaultMax };
	}

	/**
	 * Get boolean value from a property.
	 */
	protected getPropertyBooleanValue(property: ChannelPropertyEntity | null | undefined): boolean {
		if (!property) {
			return false;
		}

		const value = property.value;

		if (typeof value === 'boolean') {
			return value;
		}

		if (value === 'true' || value === 1 || value === '1' || value === 'on') {
			return true;
		}

		return false;
	}

	/**
	 * Get numeric value from a property.
	 */
	protected getPropertyNumericValue(property: ChannelPropertyEntity | null | undefined): number | null {
		if (!property) {
			return null;
		}

		const value = property.value;

		if (typeof value === 'number') {
			return value;
		}

		if (typeof value === 'string') {
			const parsed = parseFloat(value);

			return isNaN(parsed) ? null : parsed;
		}

		return null;
	}

	/**
	 * Clamp a value to the given range.
	 */
	protected clampValue(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}
}

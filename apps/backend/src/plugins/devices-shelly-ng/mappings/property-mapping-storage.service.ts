/**
 * Property Mapping Storage Service
 *
 * Stores and retrieves property mapping information for transformers
 * to be used when writing values back to devices.
 */
import { Injectable } from '@nestjs/common';

import { ResolvedProperty } from './mapping.types';

/**
 * Storage for property mappings keyed by property ID
 */
@Injectable()
export class PropertyMappingStorageService {
	private readonly propertyMappings: Map<string, ResolvedProperty> = new Map();

	/**
	 * Store a property mapping for a property
	 */
	store(propertyId: string, mapping: ResolvedProperty): void {
		this.propertyMappings.set(propertyId, mapping);
	}

	/**
	 * Get a property mapping by property ID
	 */
	get(propertyId: string): ResolvedProperty | undefined {
		return this.propertyMappings.get(propertyId);
	}

	/**
	 * Remove a property mapping
	 */
	remove(propertyId: string): void {
		this.propertyMappings.delete(propertyId);
	}

	/**
	 * Clear all mappings (useful for testing or reload)
	 */
	clear(): void {
		this.propertyMappings.clear();
	}

	/**
	 * Get all property IDs for a given channel
	 */
	getPropertyIdsForChannel(channelId: string, propertyMappings: Map<string, string>): string[] {
		const propertyIds: string[] = [];
		for (const [propId, chanId] of propertyMappings.entries()) {
			if (chanId === channelId) {
				propertyIds.push(propId);
			}
		}
		return propertyIds;
	}
}

/**
 * Virtual Property Types
 *
 * Context and result types for virtual property resolution.
 * The actual virtual property definitions are loaded from YAML configuration
 * by MappingLoaderService.
 */
import { DataTypeType, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { HomeAssistantDomain } from '../devices-home-assistant.constants';
import { VirtualPropertyType } from '../mappings';
import { HomeAssistantStateModel } from '../models/home-assistant.model';

/**
 * Context for resolving virtual property values
 */
export interface VirtualPropertyContext {
	/**
	 * HA entity ID associated with this channel
	 */
	entityId: string;

	/**
	 * HA domain
	 */
	domain: HomeAssistantDomain;

	/**
	 * HA device class
	 */
	deviceClass?: string | null;

	/**
	 * Current state from HA
	 */
	state?: HomeAssistantStateModel;

	/**
	 * All states from the device (for multi-entity derivations)
	 */
	allStates?: HomeAssistantStateModel[];
}

/**
 * Result of resolving a virtual property value
 */
export interface ResolvedVirtualPropertyValue {
	/**
	 * Property category
	 */
	category: PropertyCategory;

	/**
	 * Resolved value
	 */
	value: string | number | boolean | null;

	/**
	 * Whether this is a virtual property
	 */
	isVirtual: true;

	/**
	 * Virtual property type
	 */
	virtualType: VirtualPropertyType;

	/**
	 * Data type
	 */
	dataType: DataTypeType;

	/**
	 * Permissions
	 */
	permissions: PermissionType[];

	/**
	 * Format
	 */
	format?: (string | number)[];

	/**
	 * Unit
	 */
	unit?: string;
}

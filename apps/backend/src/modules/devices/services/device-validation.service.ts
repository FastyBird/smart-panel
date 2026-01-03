import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import {
	ChannelCategory,
	DEVICES_MODULE_NAME,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import {
	type PropertyMetadata,
	getAllProperties,
	getAllowedChannels,
	getChannelConstraints,
	getDeviceConstraints,
	getRequiredProperties,
	isChannelAllowed,
} from '../utils/schema.utils';

import { DevicesService } from './devices.service';

/**
 * Severity level for validation issues
 */
export enum ValidationIssueSeverity {
	ERROR = 'error',
	WARNING = 'warning',
}

/**
 * Type of validation issue
 */
export enum ValidationIssueType {
	MISSING_CHANNEL = 'missing_channel',
	MISSING_PROPERTY = 'missing_property',
	INVALID_DATA_TYPE = 'invalid_data_type',
	INVALID_PERMISSIONS = 'invalid_permissions',
	INVALID_FORMAT = 'invalid_format',
	UNKNOWN_CHANNEL = 'unknown_channel',
	DUPLICATE_CHANNEL = 'duplicate_channel',
	CONSTRAINT_ONE_OF_VIOLATION = 'constraint_one_of_violation',
	CONSTRAINT_ONE_OR_MORE_OF_VIOLATION = 'constraint_one_or_more_of_violation',
	CONSTRAINT_MUTUALLY_EXCLUSIVE_VIOLATION = 'constraint_mutually_exclusive_violation',
}

/**
 * A single validation issue
 */
export interface ValidationIssue {
	type: ValidationIssueType;
	severity: ValidationIssueSeverity;
	channelCategory?: ChannelCategory;
	channelId?: string;
	propertyCategory?: PropertyCategory;
	propertyId?: string;
	message: string;
	expected?: string;
	actual?: string;
}

/**
 * Validation result for a single device
 */
export interface DeviceValidationResult {
	deviceId: string;
	deviceIdentifier: string | null;
	deviceName: string;
	deviceCategory: DeviceCategory;
	pluginType: string;
	isValid: boolean;
	issues: ValidationIssue[];
}

/**
 * Summary of validation results
 */
export interface ValidationSummary {
	totalDevices: number;
	validDevices: number;
	invalidDevices: number;
	totalIssues: number;
	errorCount: number;
	warningCount: number;
}

/**
 * Full validation response
 */
export interface ValidationResponse {
	summary: ValidationSummary;
	devices: DeviceValidationResult[];
}

/**
 * Input for pre-save property validation (plain object, not entity)
 */
export interface PropertyDataInput {
	category: PropertyCategory;
	dataType?: DataTypeType;
	permissions?: PermissionType[];
}

/**
 * Input for pre-save channel validation (plain object, not entity)
 */
export interface ChannelDataInput {
	category: ChannelCategory;
	properties?: PropertyDataInput[];
}

/**
 * Input for pre-save device validation (plain object, not entity)
 */
export interface DeviceDataInput {
	category: DeviceCategory;
	channels?: ChannelDataInput[];
}

/**
 * Result of pre-save validation (without device-specific info)
 */
export interface PreSaveValidationResult {
	isValid: boolean;
	issues: ValidationIssue[];
}

@Injectable()
export class DeviceValidationService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DeviceValidationService');

	constructor(private readonly devicesService: DevicesService) {}

	/**
	 * Validate all devices against their specifications
	 */
	async validateAllDevices(): Promise<ValidationResponse> {
		const devices = await this.devicesService.findAll();
		const results: DeviceValidationResult[] = [];

		for (const device of devices) {
			results.push(this.validateDevice(device));
		}

		const summary = this.calculateSummary(results);

		return { summary, devices: results };
	}

	/**
	 * Validate devices of a specific plugin type
	 */
	async validatePluginDevices(pluginType: string): Promise<ValidationResponse> {
		const devices = await this.devicesService.findAll(pluginType);
		const results: DeviceValidationResult[] = [];

		for (const device of devices) {
			results.push(this.validateDevice(device));
		}

		const summary = this.calculateSummary(results);

		return { summary, devices: results };
	}

	/**
	 * Validate a single device by ID
	 */
	async validateDeviceById(deviceId: string): Promise<DeviceValidationResult | null> {
		const device = await this.devicesService.findOne(deviceId);

		if (!device) {
			return null;
		}

		return this.validateDevice(device);
	}

	/**
	 * Validate a single device entity against its specification
	 */
	validateDevice(device: DeviceEntity): DeviceValidationResult {
		const issues: ValidationIssue[] = [];

		// Validate channels
		this.validateChannels(device, issues);

		// Validate properties for each channel
		for (const channel of device.channels || []) {
			this.validateChannelProperties(channel, issues);
		}

		return {
			deviceId: device.id,
			deviceIdentifier: device.identifier,
			deviceName: device.name,
			deviceCategory: device.category,
			pluginType: device.type,
			isValid: issues.filter((i) => i.severity === ValidationIssueSeverity.ERROR).length === 0,
			issues,
		};
	}

	/**
	 * Validate device structure before saving (for plugins to use pre-save).
	 * This validates the device data structure without requiring a persisted entity.
	 *
	 * @param deviceData - Plain object describing the intended device structure
	 * @returns Validation result with issues found
	 *
	 * @example
	 * ```typescript
	 * const result = deviceValidationService.validateDeviceStructure({
	 *   category: DeviceCategory.LIGHTING,
	 *   channels: [
	 *     {
	 *       category: ChannelCategory.LIGHT,
	 *       properties: [
	 *         { category: PropertyCategory.ON, dataType: DataTypeType.BOOL, permissions: [PermissionType.READ_WRITE] }
	 *       ]
	 *     }
	 *   ]
	 * });
	 *
	 * if (!result.isValid) {
	 *   console.log('Device structure is invalid:', result.issues);
	 * }
	 * ```
	 */
	validateDeviceStructure(deviceData: DeviceDataInput): PreSaveValidationResult {
		const issues: ValidationIssue[] = [];

		// Validate channels
		this.validateChannelStructure(deviceData, issues);

		// Validate properties for each channel
		for (const channel of deviceData.channels || []) {
			this.validateChannelPropertyStructure(channel, issues);
		}

		return {
			isValid: issues.filter((i) => i.severity === ValidationIssueSeverity.ERROR).length === 0,
			issues,
		};
	}

	/**
	 * Validate that a specific channel category is allowed for a device category.
	 * Useful for plugins to check before creating a channel.
	 */
	isChannelAllowedForDevice(deviceCategory: DeviceCategory, channelCategory: ChannelCategory): boolean {
		return isChannelAllowed(deviceCategory, channelCategory);
	}

	/**
	 * Get all required channel categories for a device category.
	 * Useful for plugins to know what channels must be created.
	 */
	getRequiredChannelsForDevice(deviceCategory: DeviceCategory): ChannelCategory[] {
		const allowedChannels = getAllowedChannels(deviceCategory);
		return allowedChannels.filter((ch) => ch.required).map((ch) => ch.category);
	}

	/**
	 * Get all required property categories for a channel category.
	 * Useful for plugins to know what properties must be created.
	 */
	getRequiredPropertiesForChannel(channelCategory: ChannelCategory): PropertyCategory[] {
		return getRequiredProperties(channelCategory);
	}

	/**
	 * Validate that all required channels exist and no unknown channels are present
	 */
	private validateChannels(device: DeviceEntity, issues: ValidationIssue[]): void {
		const deviceCategory = device.category;
		const channels = device.channels || [];

		// Get all channel specs for this device category
		const allowedChannelSpecs = getAllowedChannels(deviceCategory);

		// Build a map of channel category to spec info (count required, multiple allowed)
		// This handles the case where multiple spec entries have the same category
		const channelSpecInfo = new Map<
			ChannelCategory,
			{ requiredCount: number; totalSlots: number; multipleAllowed: boolean }
		>();

		for (const spec of allowedChannelSpecs) {
			const category = spec.category;
			const existing = channelSpecInfo.get(category) || { requiredCount: 0, totalSlots: 0, multipleAllowed: false };

			existing.totalSlots++;
			if (spec.required) {
				existing.requiredCount++;
			}
			// If any spec allows multiple, consider it allowed
			if (spec.multiple) {
				existing.multipleAllowed = true;
			}

			channelSpecInfo.set(category, existing);
		}

		// Track existing channel categories and their instances
		const existingChannelCategories = new Map<ChannelCategory, ChannelEntity[]>();

		for (const channel of channels) {
			const existing = existingChannelCategories.get(channel.category) || [];
			existing.push(channel);
			existingChannelCategories.set(channel.category, existing);
		}

		// Check for missing required channels
		// A category is satisfied if we have at least requiredCount instances
		for (const [category, specInfo] of channelSpecInfo) {
			if (specInfo.requiredCount > 0) {
				const existingCount = existingChannelCategories.get(category)?.length || 0;

				if (existingCount < specInfo.requiredCount) {
					issues.push({
						type: ValidationIssueType.MISSING_CHANNEL,
						severity: ValidationIssueSeverity.ERROR,
						channelCategory: category,
						message:
							specInfo.requiredCount === 1
								? `Missing required channel: ${category}`
								: `Missing required channels: ${category} (found ${existingCount}, need at least ${specInfo.requiredCount})`,
						expected: specInfo.requiredCount.toString(),
						actual: existingCount.toString(),
					});
				}
			}
		}

		// Check for unknown channels and duplicates
		for (const [channelCategory, channelInstances] of existingChannelCategories) {
			const specInfo = channelSpecInfo.get(channelCategory);

			// Check if channel is allowed for this device category
			if (!isChannelAllowed(deviceCategory, channelCategory)) {
				for (const channel of channelInstances) {
					issues.push({
						type: ValidationIssueType.UNKNOWN_CHANNEL,
						severity: ValidationIssueSeverity.WARNING,
						channelCategory,
						channelId: channel.id,
						message: `Channel category '${channelCategory}' is not defined in specification for device category '${deviceCategory}'`,
					});
				}
			} else if (specInfo) {
				// Check for duplicate channels when multiple is not allowed
				// Only warn if we have more instances than defined slots AND multiple is not allowed
				const maxAllowed = specInfo.multipleAllowed ? Infinity : specInfo.totalSlots;

				if (channelInstances.length > maxAllowed) {
					issues.push({
						type: ValidationIssueType.DUPLICATE_CHANNEL,
						severity: ValidationIssueSeverity.WARNING,
						channelCategory,
						message: `Too many instances of channel '${channelCategory}' found`,
						expected: maxAllowed.toString(),
						actual: channelInstances.length.toString(),
					});
				}
			}
		}

		// Validate device-level channel constraints (oneOf, oneOrMoreOf, mutuallyExclusiveGroups)
		this.validateDeviceChannelConstraints(device, existingChannelCategories, issues);
	}

	/**
	 * Validate device-level channel constraints
	 */
	private validateDeviceChannelConstraints(
		device: DeviceEntity,
		existingChannelCategories: Map<ChannelCategory, ChannelEntity[]>,
		issues: ValidationIssue[],
	): void {
		const constraints = getDeviceConstraints(device.category);

		if (!constraints) {
			return;
		}

		const existingCategories = new Set(existingChannelCategories.keys());

		// Check oneOrMoreOf constraints - at least one channel from each group must be present
		if (constraints.oneOrMoreOf) {
			for (const group of constraints.oneOrMoreOf) {
				const hasAny = group.some((channelCat) => existingCategories.has(channelCat));

				if (!hasAny) {
					issues.push({
						type: ValidationIssueType.CONSTRAINT_ONE_OR_MORE_OF_VIOLATION,
						severity: ValidationIssueSeverity.ERROR,
						message: `At least one channel of [${group.join(', ')}] must be present for device category: ${device.category}`,
						expected: `at least 1 of: ${group.join(', ')}`,
						actual: 'none present',
					});
				}
			}
		}

		// Check oneOf constraints - at most one channel from each group can be present (mutually exclusive)
		if (constraints.oneOf) {
			for (const group of constraints.oneOf) {
				const presentCount = group.filter((channelCat) => existingCategories.has(channelCat)).length;

				if (presentCount > 1) {
					const presentChannels = group.filter((channelCat) => existingCategories.has(channelCat));
					issues.push({
						type: ValidationIssueType.CONSTRAINT_ONE_OF_VIOLATION,
						severity: ValidationIssueSeverity.ERROR,
						message: `Only one channel of [${group.join(', ')}] can be present for device category: ${device.category}, found: [${presentChannels.join(', ')}]`,
						expected: `at most 1 of: ${group.join(', ')}`,
						actual: `${presentCount} present`,
					});
				}
			}
		}

		// Check mutuallyExclusiveGroups constraints (e.g., outlet vs switcher)
		// Each entry can contain 2+ groups that are all mutually exclusive with each other
		if (constraints.mutuallyExclusiveGroups) {
			for (const groups of constraints.mutuallyExclusiveGroups) {
				if (groups.length < 2) continue;

				// Check all pairs of groups for mutual exclusivity
				for (let i = 0; i < groups.length; i++) {
					for (let j = i + 1; j < groups.length; j++) {
						const groupA = groups[i];
						const groupB = groups[j];
						const hasGroupA = groupA.some((channelCat) => existingCategories.has(channelCat));
						const hasGroupB = groupB.some((channelCat) => existingCategories.has(channelCat));

						if (hasGroupA && hasGroupB) {
							issues.push({
								type: ValidationIssueType.CONSTRAINT_MUTUALLY_EXCLUSIVE_VIOLATION,
								severity: ValidationIssueSeverity.ERROR,
								message: `Channels [${groupA.join(', ')}] and [${groupB.join(', ')}] cannot be used together for device category: ${device.category}`,
								expected: 'only one group',
								actual: 'both groups present',
							});
						}
					}
				}
			}
		}
	}

	/**
	 * Validate that all required properties exist for a channel
	 */
	private validateChannelProperties(channel: ChannelEntity, issues: ValidationIssue[]): void {
		const channelCategory = channel.category;
		const properties = channel.properties || [];

		// Get required properties for this channel category
		const requiredProperties = getRequiredProperties(channelCategory);

		// Get all property specs for validation
		const allPropertySpecs = getAllProperties(channelCategory);
		const propertySpecMap = new Map(allPropertySpecs.map((p) => [p.category, p]));

		// Track existing property categories
		const existingPropertyCategories = new Set<PropertyCategory>();

		for (const property of properties) {
			existingPropertyCategories.add(property.category);

			// Validate property against spec if spec exists
			const propertySpec = propertySpecMap.get(property.category);

			if (propertySpec) {
				this.validatePropertyAgainstSpec(channel, property, propertySpec, issues);
			}
		}

		// Check for missing required properties
		for (const requiredProperty of requiredProperties) {
			if (!existingPropertyCategories.has(requiredProperty)) {
				issues.push({
					type: ValidationIssueType.MISSING_PROPERTY,
					severity: ValidationIssueSeverity.ERROR,
					channelCategory,
					channelId: channel.id,
					propertyCategory: requiredProperty,
					message: `Missing required property: ${requiredProperty} in channel: ${channelCategory}`,
				});
			}
		}

		// Validate property constraints (oneOf, oneOrMoreOf, mutuallyExclusiveGroups)
		this.validatePropertyConstraints(channel, existingPropertyCategories, issues);
	}

	/**
	 * Validate property constraints for a channel
	 */
	private validatePropertyConstraints(
		channel: ChannelEntity,
		existingProperties: Set<PropertyCategory>,
		issues: ValidationIssue[],
	): void {
		const constraints = getChannelConstraints(channel.category);

		if (!constraints) {
			return;
		}

		// Check oneOrMoreOf constraints - at least one property from each group must be present
		if (constraints.oneOrMoreOf) {
			for (const group of constraints.oneOrMoreOf) {
				const hasAny = group.some((prop) => existingProperties.has(prop));

				if (!hasAny) {
					issues.push({
						type: ValidationIssueType.CONSTRAINT_ONE_OR_MORE_OF_VIOLATION,
						severity: ValidationIssueSeverity.ERROR,
						channelCategory: channel.category,
						channelId: channel.id,
						message: `At least one of [${group.join(', ')}] must be present in channel: ${channel.category}`,
						expected: `at least 1 of: ${group.join(', ')}`,
						actual: 'none present',
					});
				}
			}
		}

		// Check oneOf constraints - at most one property from each group can be present (mutually exclusive)
		if (constraints.oneOf) {
			for (const group of constraints.oneOf) {
				const presentCount = group.filter((prop) => existingProperties.has(prop)).length;

				if (presentCount > 1) {
					const presentProps = group.filter((prop) => existingProperties.has(prop));
					issues.push({
						type: ValidationIssueType.CONSTRAINT_ONE_OF_VIOLATION,
						severity: ValidationIssueSeverity.ERROR,
						channelCategory: channel.category,
						channelId: channel.id,
						message: `Only one of [${group.join(', ')}] can be present in channel: ${channel.category}, found: [${presentProps.join(', ')}]`,
						expected: `at most 1 of: ${group.join(', ')}`,
						actual: `${presentCount} present`,
					});
				}
			}
		}

		// Check mutuallyExclusiveGroups constraints (e.g., RGB vs HSV)
		// Each entry can contain 2+ groups that are all mutually exclusive with each other
		if (constraints.mutuallyExclusiveGroups) {
			for (const groups of constraints.mutuallyExclusiveGroups) {
				if (groups.length < 2) continue;

				// Check all pairs of groups for mutual exclusivity
				for (let i = 0; i < groups.length; i++) {
					for (let j = i + 1; j < groups.length; j++) {
						const groupA = groups[i];
						const groupB = groups[j];
						const hasGroupA = groupA.some((prop) => existingProperties.has(prop));
						const hasGroupB = groupB.some((prop) => existingProperties.has(prop));

						if (hasGroupA && hasGroupB) {
							issues.push({
								type: ValidationIssueType.CONSTRAINT_MUTUALLY_EXCLUSIVE_VIOLATION,
								severity: ValidationIssueSeverity.ERROR,
								channelCategory: channel.category,
								channelId: channel.id,
								message: `Properties [${groupA.join(', ')}] and [${groupB.join(', ')}] cannot be used together in channel: ${channel.category}`,
								expected: 'only one group',
								actual: 'both groups present',
							});
						}
					}
				}
			}
		}
	}

	/**
	 * Check if a property's permissions satisfy a required permission.
	 * READ_WRITE satisfies both READ_ONLY and WRITE_ONLY requirements.
	 */
	private permissionSatisfied(requiredPermission: PermissionType, propertyPermissions: Set<PermissionType>): boolean {
		// Direct match
		if (propertyPermissions.has(requiredPermission)) {
			return true;
		}

		// READ_WRITE satisfies READ_ONLY requirement
		if (requiredPermission === PermissionType.READ_ONLY && propertyPermissions.has(PermissionType.READ_WRITE)) {
			return true;
		}

		// READ_WRITE satisfies WRITE_ONLY requirement
		if (requiredPermission === PermissionType.WRITE_ONLY && propertyPermissions.has(PermissionType.READ_WRITE)) {
			return true;
		}

		return false;
	}

	/**
	 * Validate a property against its specification
	 */
	private validatePropertyAgainstSpec(
		channel: ChannelEntity,
		property: ChannelPropertyEntity,
		spec: PropertyMetadata,
		issues: ValidationIssue[],
	): void {
		// Validate data type
		if (spec.data_type && property.dataType !== spec.data_type) {
			issues.push({
				type: ValidationIssueType.INVALID_DATA_TYPE,
				severity: ValidationIssueSeverity.WARNING,
				channelCategory: channel.category,
				channelId: channel.id,
				propertyCategory: property.category,
				propertyId: property.id,
				message: `Property '${property.category}' has incorrect data type`,
				expected: spec.data_type,
				actual: property.dataType,
			});
		}

		// Validate permissions (check if all required permissions are satisfied)
		// READ_WRITE satisfies both READ_ONLY and WRITE_ONLY requirements
		if (spec.permissions && spec.permissions.length > 0) {
			const propertyPermissions = new Set(property.permissions);
			const unsatisfiedPermissions = spec.permissions.filter(
				(requiredPerm) => !this.permissionSatisfied(requiredPerm, propertyPermissions),
			);

			if (unsatisfiedPermissions.length > 0) {
				issues.push({
					type: ValidationIssueType.INVALID_PERMISSIONS,
					severity: ValidationIssueSeverity.WARNING,
					channelCategory: channel.category,
					channelId: channel.id,
					propertyCategory: property.category,
					propertyId: property.id,
					message: `Property '${property.category}' is missing permissions`,
					expected: spec.permissions.join(', '),
					actual: (property.permissions ?? []).join(', '),
				});
			}
		}
	}

	/**
	 * Calculate summary statistics from validation results
	 */
	private calculateSummary(results: DeviceValidationResult[]): ValidationSummary {
		let errorCount = 0;
		let warningCount = 0;

		for (const result of results) {
			for (const issue of result.issues) {
				if (issue.severity === ValidationIssueSeverity.ERROR) {
					errorCount++;
				} else {
					warningCount++;
				}
			}
		}

		return {
			totalDevices: results.length,
			validDevices: results.filter((r) => r.isValid).length,
			invalidDevices: results.filter((r) => !r.isValid).length,
			totalIssues: errorCount + warningCount,
			errorCount,
			warningCount,
		};
	}

	/**
	 * Validate channel structure for pre-save validation (plain objects)
	 */
	private validateChannelStructure(deviceData: DeviceDataInput, issues: ValidationIssue[]): void {
		const deviceCategory = deviceData.category;
		const channels = deviceData.channels || [];

		// Get all channel specs for this device category
		const allowedChannelSpecs = getAllowedChannels(deviceCategory);

		// Build a map of channel category to spec info
		const channelSpecInfo = new Map<
			ChannelCategory,
			{ requiredCount: number; totalSlots: number; multipleAllowed: boolean }
		>();

		for (const spec of allowedChannelSpecs) {
			const category = spec.category;
			const existing = channelSpecInfo.get(category) || { requiredCount: 0, totalSlots: 0, multipleAllowed: false };

			existing.totalSlots++;
			if (spec.required) {
				existing.requiredCount++;
			}
			if (spec.multiple) {
				existing.multipleAllowed = true;
			}

			channelSpecInfo.set(category, existing);
		}

		// Track channel instances by category
		const existingChannelCategories = new Map<ChannelCategory, ChannelDataInput[]>();

		for (const channel of channels) {
			const existing = existingChannelCategories.get(channel.category) || [];
			existing.push(channel);
			existingChannelCategories.set(channel.category, existing);
		}

		// Check for missing required channels
		for (const [category, specInfo] of channelSpecInfo) {
			if (specInfo.requiredCount > 0) {
				const existingCount = existingChannelCategories.get(category)?.length || 0;

				if (existingCount < specInfo.requiredCount) {
					issues.push({
						type: ValidationIssueType.MISSING_CHANNEL,
						severity: ValidationIssueSeverity.ERROR,
						channelCategory: category,
						message:
							specInfo.requiredCount === 1
								? `Missing required channel: ${category}`
								: `Missing required channels: ${category} (found ${existingCount}, need at least ${specInfo.requiredCount})`,
						expected: specInfo.requiredCount.toString(),
						actual: existingCount.toString(),
					});
				}
			}
		}

		// Check for unknown channels and duplicates
		for (const [channelCategory, channelInstances] of existingChannelCategories) {
			const specInfo = channelSpecInfo.get(channelCategory);

			if (!isChannelAllowed(deviceCategory, channelCategory)) {
				issues.push({
					type: ValidationIssueType.UNKNOWN_CHANNEL,
					severity: ValidationIssueSeverity.WARNING,
					channelCategory,
					message: `Channel category '${channelCategory}' is not defined in specification for device category '${deviceCategory}'`,
				});
			} else if (specInfo) {
				const maxAllowed = specInfo.multipleAllowed ? Infinity : specInfo.totalSlots;

				if (channelInstances.length > maxAllowed) {
					issues.push({
						type: ValidationIssueType.DUPLICATE_CHANNEL,
						severity: ValidationIssueSeverity.WARNING,
						channelCategory,
						message: `Too many instances of channel '${channelCategory}' found`,
						expected: maxAllowed.toString(),
						actual: channelInstances.length.toString(),
					});
				}
			}
		}

		// Validate device-level channel constraints (oneOf, oneOrMoreOf, mutuallyExclusiveGroups)
		this.validateDeviceChannelConstraintsStructure(deviceCategory, existingChannelCategories, issues);
	}

	/**
	 * Validate device-level channel constraints for pre-save validation (plain objects)
	 */
	private validateDeviceChannelConstraintsStructure(
		deviceCategory: DeviceCategory,
		existingChannelCategories: Map<ChannelCategory, ChannelDataInput[]>,
		issues: ValidationIssue[],
	): void {
		const constraints = getDeviceConstraints(deviceCategory);

		if (!constraints) {
			return;
		}

		const existingCategories = new Set(existingChannelCategories.keys());

		// Check oneOrMoreOf constraints - at least one channel from each group must be present
		if (constraints.oneOrMoreOf) {
			for (const group of constraints.oneOrMoreOf) {
				const hasAny = group.some((channelCat) => existingCategories.has(channelCat));

				if (!hasAny) {
					issues.push({
						type: ValidationIssueType.CONSTRAINT_ONE_OR_MORE_OF_VIOLATION,
						severity: ValidationIssueSeverity.ERROR,
						message: `At least one channel of [${group.join(', ')}] must be present for device category: ${deviceCategory}`,
						expected: `at least 1 of: ${group.join(', ')}`,
						actual: 'none present',
					});
				}
			}
		}

		// Check oneOf constraints - at most one channel from each group can be present (mutually exclusive)
		if (constraints.oneOf) {
			for (const group of constraints.oneOf) {
				const presentCount = group.filter((channelCat) => existingCategories.has(channelCat)).length;

				if (presentCount > 1) {
					const presentChannels = group.filter((channelCat) => existingCategories.has(channelCat));
					issues.push({
						type: ValidationIssueType.CONSTRAINT_ONE_OF_VIOLATION,
						severity: ValidationIssueSeverity.ERROR,
						message: `Only one channel of [${group.join(', ')}] can be present for device category: ${deviceCategory}, found: [${presentChannels.join(', ')}]`,
						expected: `at most 1 of: ${group.join(', ')}`,
						actual: `${presentCount} present`,
					});
				}
			}
		}

		// Check mutuallyExclusiveGroups constraints (e.g., outlet vs switcher)
		// Each entry can contain 2+ groups that are all mutually exclusive with each other
		if (constraints.mutuallyExclusiveGroups) {
			for (const groups of constraints.mutuallyExclusiveGroups) {
				if (groups.length < 2) continue;

				// Check all pairs of groups for mutual exclusivity
				for (let i = 0; i < groups.length; i++) {
					for (let j = i + 1; j < groups.length; j++) {
						const groupA = groups[i];
						const groupB = groups[j];
						const hasGroupA = groupA.some((channelCat) => existingCategories.has(channelCat));
						const hasGroupB = groupB.some((channelCat) => existingCategories.has(channelCat));

						if (hasGroupA && hasGroupB) {
							issues.push({
								type: ValidationIssueType.CONSTRAINT_MUTUALLY_EXCLUSIVE_VIOLATION,
								severity: ValidationIssueSeverity.ERROR,
								message: `Channels [${groupA.join(', ')}] and [${groupB.join(', ')}] cannot be used together for device category: ${deviceCategory}`,
								expected: 'only one group',
								actual: 'both groups present',
							});
						}
					}
				}
			}
		}
	}

	/**
	 * Validate channel property structure for pre-save validation (plain objects)
	 */
	private validateChannelPropertyStructure(channel: ChannelDataInput, issues: ValidationIssue[]): void {
		const channelCategory = channel.category;
		const properties = channel.properties || [];

		// Get required properties for this channel category
		const requiredProperties = getRequiredProperties(channelCategory);

		// Get all property specs for validation
		const allPropertySpecs = getAllProperties(channelCategory);
		const propertySpecMap = new Map(allPropertySpecs.map((p) => [p.category, p]));

		// Track existing property categories
		const existingPropertyCategories = new Set<PropertyCategory>();

		for (const property of properties) {
			existingPropertyCategories.add(property.category);

			// Validate property against spec if spec exists
			const propertySpec = propertySpecMap.get(property.category);

			if (propertySpec) {
				this.validatePropertyDataAgainstSpec(channelCategory, property, propertySpec, issues);
			}
		}

		// Check for missing required properties
		for (const requiredProperty of requiredProperties) {
			if (!existingPropertyCategories.has(requiredProperty)) {
				issues.push({
					type: ValidationIssueType.MISSING_PROPERTY,
					severity: ValidationIssueSeverity.ERROR,
					channelCategory,
					propertyCategory: requiredProperty,
					message: `Missing required property: ${requiredProperty} in channel: ${channelCategory}`,
				});
			}
		}

		// Validate property constraints (oneOf, oneOrMoreOf, mutuallyExclusiveGroups)
		this.validatePropertyConstraintsStructure(channelCategory, existingPropertyCategories, issues);
	}

	/**
	 * Validate property constraints for pre-save validation (plain objects)
	 */
	private validatePropertyConstraintsStructure(
		channelCategory: ChannelCategory,
		existingProperties: Set<PropertyCategory>,
		issues: ValidationIssue[],
	): void {
		const constraints = getChannelConstraints(channelCategory);

		if (!constraints) {
			return;
		}

		// Check oneOrMoreOf constraints - at least one property from each group must be present
		if (constraints.oneOrMoreOf) {
			for (const group of constraints.oneOrMoreOf) {
				const hasAny = group.some((prop) => existingProperties.has(prop));

				if (!hasAny) {
					issues.push({
						type: ValidationIssueType.CONSTRAINT_ONE_OR_MORE_OF_VIOLATION,
						severity: ValidationIssueSeverity.ERROR,
						channelCategory,
						message: `At least one of [${group.join(', ')}] must be present in channel: ${channelCategory}`,
						expected: `at least 1 of: ${group.join(', ')}`,
						actual: 'none present',
					});
				}
			}
		}

		// Check oneOf constraints - exactly one (or zero) property from each group can be present
		if (constraints.oneOf) {
			for (const group of constraints.oneOf) {
				const presentCount = group.filter((prop) => existingProperties.has(prop)).length;

				if (presentCount > 1) {
					const presentProps = group.filter((prop) => existingProperties.has(prop));
					issues.push({
						type: ValidationIssueType.CONSTRAINT_ONE_OF_VIOLATION,
						severity: ValidationIssueSeverity.ERROR,
						channelCategory,
						message: `Only one of [${group.join(', ')}] can be present in channel: ${channelCategory}, found: [${presentProps.join(', ')}]`,
						expected: `at most 1 of: ${group.join(', ')}`,
						actual: `${presentCount} present`,
					});
				}
			}
		}

		// Check mutuallyExclusiveGroups constraints (e.g., RGB vs HSV)
		// Each entry can contain 2+ groups that are all mutually exclusive with each other
		if (constraints.mutuallyExclusiveGroups) {
			for (const groups of constraints.mutuallyExclusiveGroups) {
				if (groups.length < 2) continue;

				// Check all pairs of groups for mutual exclusivity
				for (let i = 0; i < groups.length; i++) {
					for (let j = i + 1; j < groups.length; j++) {
						const groupA = groups[i];
						const groupB = groups[j];
						const hasGroupA = groupA.some((prop) => existingProperties.has(prop));
						const hasGroupB = groupB.some((prop) => existingProperties.has(prop));

						if (hasGroupA && hasGroupB) {
							issues.push({
								type: ValidationIssueType.CONSTRAINT_MUTUALLY_EXCLUSIVE_VIOLATION,
								severity: ValidationIssueSeverity.ERROR,
								channelCategory,
								message: `Properties [${groupA.join(', ')}] and [${groupB.join(', ')}] cannot be used together in channel: ${channelCategory}`,
								expected: 'only one group',
								actual: 'both groups present',
							});
						}
					}
				}
			}
		}
	}

	/**
	 * Validate property data against spec for pre-save validation (plain objects)
	 */
	private validatePropertyDataAgainstSpec(
		channelCategory: ChannelCategory,
		property: PropertyDataInput,
		spec: PropertyMetadata,
		issues: ValidationIssue[],
	): void {
		// Validate data type if provided
		if (spec.data_type && property.dataType && property.dataType !== spec.data_type) {
			issues.push({
				type: ValidationIssueType.INVALID_DATA_TYPE,
				severity: ValidationIssueSeverity.WARNING,
				channelCategory,
				propertyCategory: property.category,
				message: `Property '${property.category}' has incorrect data type`,
				expected: spec.data_type,
				actual: property.dataType,
			});
		}

		// Validate permissions if provided
		if (spec.permissions && spec.permissions.length > 0 && property.permissions) {
			const propertyPermissions = new Set(property.permissions);
			const unsatisfiedPermissions = spec.permissions.filter(
				(requiredPerm) => !this.permissionSatisfied(requiredPerm, propertyPermissions),
			);

			if (unsatisfiedPermissions.length > 0) {
				issues.push({
					type: ValidationIssueType.INVALID_PERMISSIONS,
					severity: ValidationIssueSeverity.WARNING,
					channelCategory,
					propertyCategory: property.category,
					message: `Property '${property.category}' is missing permissions`,
					expected: spec.permissions.join(', '),
					actual: property.permissions.join(', '),
				});
			}
		}
	}
}

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DEVICES_MODULE_NAME, DeviceCategory, PropertyCategory } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import {
	type PropertyMetadata,
	getAllProperties,
	getRequiredChannels,
	getRequiredProperties,
	isChannelAllowed,
	isChannelMultiple,
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

@Injectable()
export class DeviceValidationService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DeviceValidationService');

	constructor(private readonly devicesService: DevicesService) {}

	/**
	 * Validate all devices against their specifications
	 */
	async validateAllDevices(): Promise<ValidationResponse> {
		this.logger.debug('Validating all devices');

		const devices = await this.devicesService.findAll();
		const results: DeviceValidationResult[] = [];

		for (const device of devices) {
			results.push(this.validateDevice(device));
		}

		const summary = this.calculateSummary(results);

		this.logger.debug(`Validation complete: ${summary.validDevices}/${summary.totalDevices} devices valid`);

		return { summary, devices: results };
	}

	/**
	 * Validate devices of a specific plugin type
	 */
	async validatePluginDevices(pluginType: string): Promise<ValidationResponse> {
		this.logger.debug(`Validating devices for plugin: ${pluginType}`);

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
		this.logger.debug(`Validating device: ${deviceId}`);

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
	 * Validate that all required channels exist and no unknown channels are present
	 */
	private validateChannels(device: DeviceEntity, issues: ValidationIssue[]): void {
		const deviceCategory = device.category;
		const channels = device.channels || [];

		// Get required channels for this device category
		const requiredChannels = getRequiredChannels(deviceCategory);

		// Track existing channel categories for duplicate detection
		const existingChannelCategories = new Map<ChannelCategory, ChannelEntity[]>();

		for (const channel of channels) {
			const existing = existingChannelCategories.get(channel.category) || [];
			existing.push(channel);
			existingChannelCategories.set(channel.category, existing);
		}

		// Check for missing required channels
		for (const requiredChannel of requiredChannels) {
			if (!existingChannelCategories.has(requiredChannel)) {
				issues.push({
					type: ValidationIssueType.MISSING_CHANNEL,
					severity: ValidationIssueSeverity.ERROR,
					channelCategory: requiredChannel,
					message: `Missing required channel: ${requiredChannel}`,
				});
			}
		}

		// Check for unknown channels and duplicates
		for (const [channelCategory, channelInstances] of existingChannelCategories) {
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
			}

			// Check for duplicate channels when multiple is not allowed
			if (channelInstances.length > 1 && !isChannelMultiple(deviceCategory, channelCategory)) {
				issues.push({
					type: ValidationIssueType.DUPLICATE_CHANNEL,
					severity: ValidationIssueSeverity.WARNING,
					channelCategory,
					message: `Multiple instances of channel '${channelCategory}' found but only one is allowed`,
					expected: '1',
					actual: channelInstances.length.toString(),
				});
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

		// Validate permissions (check if all required permissions are present)
		if (spec.permissions && spec.permissions.length > 0) {
			const propertyPermissions = new Set(property.permissions);
			const missingPermissions = spec.permissions.filter((p) => !propertyPermissions.has(p));

			if (missingPermissions.length > 0) {
				issues.push({
					type: ValidationIssueType.INVALID_PERMISSIONS,
					severity: ValidationIssueSeverity.WARNING,
					channelCategory: channel.category,
					channelId: channel.id,
					propertyCategory: property.category,
					propertyId: property.id,
					message: `Property '${property.category}' is missing permissions`,
					expected: spec.permissions.join(', '),
					actual: property.permissions.join(', '),
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
}

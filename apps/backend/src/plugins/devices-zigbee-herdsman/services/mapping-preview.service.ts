/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ChannelCategory, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	COMMON_PROPERTY_MAPPINGS,
	DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
	DEVICES_ZIGBEE_HERDSMAN_TYPE,
	ZH_SPECIFIC_TYPES,
	extractExposeInfo,
	formatSnakeCaseToTitle,
	mapZhAccessToPermissions,
	mapZhCategoryToDeviceCategory,
	mapZhExposeToChannelCategory,
	mapZhTypeToDataType,
} from '../devices-zigbee-herdsman.constants';
import {
	DevicesZigbeeHerdsmanNotFoundException,
	DevicesZigbeeHerdsmanValidationException,
	ZigbeeHerdsmanCoordinatorOfflineException,
} from '../devices-zigbee-herdsman.exceptions';
import { ZhMappingPreviewRequestDto } from '../dto/mapping-preview.dto';
import { ZigbeeHerdsmanDeviceEntity } from '../entities/devices-zigbee-herdsman.entity';
import { ZhExpose } from '../interfaces/zigbee-herdsman.interface';
import {
	ZhDeviceInfoModel,
	ZhExposeMappingPreviewModel,
	ZhMappingPreviewModel,
	ZhMappingWarningModel,
	ZhPropertyMappingPreviewModel,
	ZhSuggestedChannelModel,
	ZhSuggestedDeviceModel,
} from '../models/zigbee-herdsman-response.model';

import { ZigbeeHerdsmanService } from './zigbee-herdsman.service';

@Injectable()
export class ZhMappingPreviewService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
		'MappingPreviewService',
	);

	constructor(
		private readonly zigbeeHerdsmanService: ZigbeeHerdsmanService,
		private readonly devicesService: DevicesService,
	) {}

	async generatePreview(ieeeAddress: string, request?: ZhMappingPreviewRequestDto): Promise<ZhMappingPreviewModel> {
		if (!this.zigbeeHerdsmanService.isCoordinatorOnline()) {
			throw new ZigbeeHerdsmanCoordinatorOfflineException();
		}

		const discovered = this.zigbeeHerdsmanService.getDiscoveredDevice(ieeeAddress);
		if (!discovered) {
			throw new DevicesZigbeeHerdsmanNotFoundException(`Device with IEEE address ${ieeeAddress} not found`);
		}

		if (!discovered.definition) {
			throw new DevicesZigbeeHerdsmanValidationException(
				`Device ${ieeeAddress} has no definition — interview may be incomplete`,
			);
		}

		// Build device info
		const zhDevice: ZhDeviceInfoModel = {
			ieeeAddress: discovered.ieeeAddress,
			friendlyName: discovered.friendlyName,
			manufacturer: discovered.definition.vendor ?? null,
			model: discovered.definition.model ?? null,
			description: discovered.definition.description ?? null,
		};

		// Determine device category
		const exposes = discovered.definition.exposes;
		const { exposeTypes, propertyNames } = extractExposeInfo(exposes);
		const deviceCategory = request?.deviceCategory ?? mapZhCategoryToDeviceCategory(exposeTypes, propertyNames);

		const suggestedDevice: ZhSuggestedDeviceModel = {
			category: deviceCategory,
			name: discovered.definition.description || discovered.friendlyName,
			confidence: request?.deviceCategory ? 'high' : 'medium',
		};

		// Map exposes
		const warnings: ZhMappingWarningModel[] = [];
		const exposeMappings: ZhExposeMappingPreviewModel[] = [];
		const skipSet = new Set(request?.exposeOverrides?.filter((o) => o.skip).map((o) => o.exposeName) ?? []);
		const categoryOverrides = new Map(
			request?.exposeOverrides
				?.filter((o): o is typeof o & { channelCategory: ChannelCategory } => !!o.channelCategory)
				.map((o) => [o.exposeName, o.channelCategory] as [string, ChannelCategory]) ?? [],
		);

		// Check if already adopted
		const adoptedDevices = await this.devicesService.findAll<ZigbeeHerdsmanDeviceEntity>(DEVICES_ZIGBEE_HERDSMAN_TYPE);
		const alreadyAdopted = adoptedDevices.find((d) => d.ieeeAddress === ieeeAddress);
		if (alreadyAdopted) {
			warnings.push({
				type: 'device_already_adopted',
				message: `Device is already adopted as "${alreadyAdopted.name}"`,
				suggestion: 'Re-adopting will replace the existing device',
			});
		}

		// Check availability
		if (!discovered.available) {
			warnings.push({
				type: 'device_not_available',
				message: 'Device is currently offline',
				suggestion: 'The device may not respond to commands until it comes back online',
			});
		}

		// Check interview status
		if (discovered.interviewStatus !== 'completed') {
			warnings.push({
				type: 'interview_incomplete',
				message: `Device interview is ${discovered.interviewStatus}`,
				suggestion: 'Wait for interview to complete for full capability mapping',
			});
		}

		for (const expose of exposes) {
			const exposeName = expose.property ?? expose.name ?? expose.type;

			if (skipSet.has(exposeName)) {
				exposeMappings.push({
					exposeName,
					exposeType: expose.type,
					status: 'skipped',
					suggestedChannel: null,
					suggestedProperties: [],
					missingRequiredProperties: [],
				});
				continue;
			}

			const mapping = this.mapExpose(expose, categoryOverrides.get(exposeName));

			if (mapping) {
				exposeMappings.push(mapping);
			} else {
				warnings.push({
					type: 'unsupported_expose',
					exposeName,
					message: `Expose "${exposeName}" (type: ${expose.type}) is not supported`,
				});
				exposeMappings.push({
					exposeName,
					exposeType: expose.type,
					status: 'unmapped',
					suggestedChannel: null,
					suggestedProperties: [],
					missingRequiredProperties: [],
				});
			}
		}

		const readyToAdopt =
			exposeMappings.some((m) => m.status === 'mapped') &&
			!exposeMappings.some((m) => m.missingRequiredProperties.length > 0);

		return {
			zhDevice,
			suggestedDevice,
			exposes: exposeMappings,
			warnings,
			readyToAdopt,
		};
	}

	private mapExpose(expose: ZhExpose, channelCategoryOverride?: any): ZhExposeMappingPreviewModel | null {
		const exposeName = expose.property ?? expose.name ?? expose.type;
		const isSpecific = (ZH_SPECIFIC_TYPES as readonly string[]).includes(expose.type);

		if (isSpecific && 'features' in expose && expose.features) {
			// Composite expose (light, switch, climate, etc.)
			const channelCategory = channelCategoryOverride ?? mapZhExposeToChannelCategory(expose.type);
			const properties: ZhPropertyMappingPreviewModel[] = [];

			for (const feature of expose.features) {
				const prop = this.mapFeatureToProperty(feature);
				if (prop) {
					properties.push(prop);
				}
			}

			const suggestedChannel: ZhSuggestedChannelModel = {
				category: channelCategory,
				name: formatSnakeCaseToTitle(expose.type),
				confidence: 'high',
			};

			return {
				exposeName,
				exposeType: expose.type,
				status: properties.length > 0 ? 'mapped' : 'unmapped',
				suggestedChannel,
				suggestedProperties: properties,
				missingRequiredProperties: [],
			};
		}

		// Generic expose (binary, numeric, enum, text)
		const exposeProperty = expose.property ?? '';
		const commonMapping = COMMON_PROPERTY_MAPPINGS[exposeProperty];
		if (commonMapping && exposeProperty) {
			const channelCategory = channelCategoryOverride ?? commonMapping.channelCategory;
			const property: ZhPropertyMappingPreviewModel = {
				category: commonMapping.category,
				name: commonMapping.name,
				zigbeeProperty: exposeProperty,
				dataType: commonMapping.dataType,
				permissions: expose.access
					? mapZhAccessToPermissions(expose.access)
					: (commonMapping.permissions ?? [PermissionType.READ_ONLY]),
				format: this.extractFormat(expose),
				required: true,
				currentValue: null,
			};

			return {
				exposeName,
				exposeType: expose.type,
				status: 'mapped',
				suggestedChannel: {
					category: channelCategory as ChannelCategory,
					name: formatSnakeCaseToTitle(expose.property ?? expose.type),
					confidence: 'high',
				},
				suggestedProperties: [property],
				missingRequiredProperties: [],
			};
		}

		// Unknown generic expose (access may be 0 which is falsy but still a valid expose)
		if (expose.property && expose.access !== undefined) {
			const dataType = mapZhTypeToDataType(
				expose.type,
				'value_min' in expose ? (expose as any).value_min : undefined,
				'value_max' in expose ? (expose as any).value_max : undefined,
				undefined,
				'value_step' in expose ? (expose as any).value_step : undefined,
			);

			return {
				exposeName,
				exposeType: expose.type,
				status: 'partial',
				suggestedChannel: channelCategoryOverride
					? {
							category: channelCategoryOverride,
							name: formatSnakeCaseToTitle(expose.property),
							confidence: 'medium',
						}
					: null,
				suggestedProperties: [
					{
						category: PropertyCategory.GENERIC,
						name: formatSnakeCaseToTitle(expose.property),
						zigbeeProperty: expose.property,
						dataType,
						permissions: mapZhAccessToPermissions(expose.access),
						format: this.extractFormat(expose),
						required: false,
						currentValue: null,
					},
				],
				missingRequiredProperties: [],
			};
		}

		return null;
	}

	private mapFeatureToProperty(feature: ZhExpose): ZhPropertyMappingPreviewModel | null {
		if (!feature.property) {
			return null;
		}

		const commonMapping = COMMON_PROPERTY_MAPPINGS[feature.property];
		if (commonMapping) {
			return {
				category: commonMapping.category,
				name: commonMapping.name,
				zigbeeProperty: feature.property,
				dataType: commonMapping.dataType,
				permissions: feature.access
					? mapZhAccessToPermissions(feature.access)
					: (commonMapping.permissions ?? [PermissionType.READ_ONLY]),
				format: this.extractFormat(feature),
				required: true,
				currentValue: null,
			};
		}

		// Fallback for unknown features
		const dataType = mapZhTypeToDataType(
			feature.type,
			'value_min' in feature ? (feature as any).value_min : undefined,
			'value_max' in feature ? (feature as any).value_max : undefined,
			undefined,
			'value_step' in feature ? (feature as any).value_step : undefined,
		);

		return {
			category: PropertyCategory.GENERIC,
			name: formatSnakeCaseToTitle(feature.property),
			zigbeeProperty: feature.property,
			dataType,
			permissions: feature.access ? mapZhAccessToPermissions(feature.access) : [],
			format: this.extractFormat(feature),
			required: false,
			currentValue: null,
		};
	}

	private extractFormat(expose: ZhExpose): (string | number)[] | null {
		if ('values' in expose && expose.values) {
			return expose.values;
		}
		if ('value_min' in expose && 'value_max' in expose) {
			const numExpose = expose as any;
			if (numExpose.value_min !== undefined && numExpose.value_max !== undefined) {
				return [numExpose.value_min, numExpose.value_max];
			}
		}
		return null;
	}
}

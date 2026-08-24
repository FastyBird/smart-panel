import { HomeyDevice } from '../models/homey-device.model';
import { HomeyDeviceSupportReason, HomeyDeviceSupportState } from '../models/inventory.model';

import { HomeyMappingLoaderService } from './mapping-loader.service';
import { HomeyMappingConflict, HomeyMappingResolution, ResolvedHomeyPropertyBinding } from './mapping.types';

export interface HomeyDeviceSupport {
	readonly state: HomeyDeviceSupportState;
	readonly reasons: readonly HomeyDeviceSupportReason[];
}

export function resolveHomeyDeviceSupport(
	mappingLoader: HomeyMappingLoaderService,
	device: HomeyDevice,
): HomeyDeviceSupport {
	const deviceResolution = mappingLoader.resolveDeviceMappings(device);
	const channelResolution = mappingLoader.resolveChannelMappings(device);
	const propertyResolution = mappingLoader.resolvePropertyMappings(device);
	const reasons: HomeyDeviceSupportReason[] = [];

	if (hasBlockingConflict(deviceResolution.conflicts)) {
		reasons.push(HomeyDeviceSupportReason.DEVICE_MAPPING_CONFLICT);
	} else if (deviceResolution.mappings.length === 0) {
		return {
			state: HomeyDeviceSupportState.UNSUPPORTED,
			reasons: [HomeyDeviceSupportReason.NO_DEVICE_MAPPING],
		};
	}

	if (hasBlockingConflict(channelResolution.conflicts)) {
		reasons.push(HomeyDeviceSupportReason.CHANNEL_MAPPING_CONFLICT);
	} else if (channelResolution.mappings.length === 0) {
		reasons.push(HomeyDeviceSupportReason.NO_CHANNEL_MAPPING);
	}

	if (hasBlockingConflict(propertyResolution.conflicts)) {
		reasons.push(HomeyDeviceSupportReason.PROPERTY_MAPPING_CONFLICT);
	} else if (propertyResolution.mappings.length === 0) {
		reasons.push(HomeyDeviceSupportReason.NO_PROPERTY_MAPPING);
	} else if (!hasCompatiblePropertyMapping(channelResolution, propertyResolution)) {
		reasons.push(HomeyDeviceSupportReason.NO_COMPATIBLE_PROPERTY_MAPPING);
	}

	return {
		state:
			reasons.length === 0
				? HomeyDeviceSupportState.SUPPORTED
				: reasons.some((reason) => reason.endsWith('_conflict'))
					? HomeyDeviceSupportState.CONFLICTED
					: HomeyDeviceSupportState.UNSUPPORTED,
		reasons,
	};
}

function hasCompatiblePropertyMapping(
	channelResolution: ReturnType<HomeyMappingLoaderService['resolveChannelMappings']>,
	propertyResolution: HomeyMappingResolution<ResolvedHomeyPropertyBinding>,
): boolean {
	const channelIdentifiers = new Set(channelResolution.mappings.map((mapping) => mapping.channel.identifier));

	return propertyResolution.mappings.some((binding) => channelIdentifiers.has(binding.mapping.property.channel));
}

function hasBlockingConflict(conflicts: readonly HomeyMappingConflict[]): boolean {
	return conflicts.some((conflict) => conflict.policy === 'error');
}

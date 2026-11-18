import {
	channelChannelsPropertiesSpecificationMappers,
	deviceChannelsSpecificationMappers,
	deviceChannelsSpecificationOrder,
	getChannelPropertySpecification,
} from '../../../modules/devices/devices.mapping';
import { DevicesModuleChannelCategory, type DevicesModuleDeviceCategory } from '../../../openapi.constants';
import type { IVirtualMappingSlot, IVirtualMappingSlotGroup } from '../components/wizard/virtual-wizard-mapping-step.types';

/** Projection slots shared by category guidance, mapping and the final summary. */
export function projectionSlotGroups(category: DevicesModuleDeviceCategory | null): IVirtualMappingSlotGroup[] {
	if (category === null) {
		return [];
	}

	const channelSpec = deviceChannelsSpecificationMappers[category];

	if (!channelSpec) {
		return [];
	}

	const ordered = deviceChannelsSpecificationOrder[category] ?? [...channelSpec.required, ...channelSpec.optional];

	// `device_information` is declared required by essentially every device category, so a plain
	// expansion of the spec *would* offer it. The backend synthesizes those properties as owned by the
	// virtual device itself (they describe the virtual device, not a borrowed source), so there is
	// nothing legitimate to map them to and offering them would only invite a mapping that cannot be
	// created.
	const channels = ordered.filter((channel: DevicesModuleChannelCategory): boolean => channel !== DevicesModuleChannelCategory.device_information);

	// Required first, at both levels: required channels ahead of optional ones here, and required
	// properties ahead of optional ones inside each channel (which is the order the property mappers
	// already produce). Grouping by channel rather than flattening required slots to the very top
	// keeps a channel's properties together, which is how the user thinks about a source channel.
	return [
		...channels.filter((channel: DevicesModuleChannelCategory): boolean => channelSpec.required.includes(channel)),
		...channels.filter((channel: DevicesModuleChannelCategory): boolean => !channelSpec.required.includes(channel)),
	].map((specChannel: DevicesModuleChannelCategory): IVirtualMappingSlotGroup => {
		const channelRequired = channelSpec.required.includes(specChannel);

		const propertySpec = channelChannelsPropertiesSpecificationMappers[specChannel] ?? { required: [], optional: [] };

		return {
			specChannel,
			required: channelRequired,
			slots: [...propertySpec.required, ...propertySpec.optional].map((specProperty): IVirtualMappingSlot => {
				const metadata = getChannelPropertySpecification(specChannel, specProperty);

				const propertyRequired = propertySpec.required.includes(specProperty);

				return {
					key: `${specChannel}.${specProperty}`,
					specChannel,
					specProperty,
					// `required` is the conjunction because the two levels are independent: a required
					// property of an optional channel (illuminance.illuminance under lighting) does not
					// have to be filled at all, since the channel it belongs to need not exist.
					required: channelRequired && propertyRequired,
					channelRequired,
					propertyRequired,
					permissions: metadata?.permissions ?? [],
					dataType: metadata?.data_type ?? null,
					unit: metadata?.unit ?? null,
				};
			}),
		};
	});
}

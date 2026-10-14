import type { IChannel, IChannelProperty, IDevice } from '../../../modules/devices';
import { DevicesModuleChannelPropertyPermissions } from '../../../openapi.constants';

/** UI filtering is a convenience; server draft validation owns the persisted intersection. */
export const lightGroupChannelCandidates = (devices: readonly IDevice[], channels: readonly IChannel[], properties: readonly IChannelProperty[]) =>
	channels.filter((channel) => {
		const device = devices.find((candidate) => candidate.id === channel.device);
		return (
			device?.type !== 'virtual' &&
			device?.category === 'lighting' &&
			channel.category === 'light' &&
			properties.some(
				(property) =>
					property.channel === channel.id &&
					property.category === 'on' &&
					property.dataType === 'bool' &&
					property.permissions.includes(DevicesModuleChannelPropertyPermissions.rw)
			)
		);
	});

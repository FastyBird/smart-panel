import type { IChannel, IChannelProperty, IDevice } from '../../../modules/devices';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

/** Recovery follows physical cover channels, independent of the device's display category. */
export const shellyCoverRecoveryTargets = (
	device: IDevice,
	channels: IChannel[],
	propertiesForChannel: (channelId: IChannel['id']) => IChannelProperty[]
) => {
	if (device.type !== DEVICES_SHELLY_NG_TYPE) return [];
	return channels.flatMap((channel) => {
		if (channel.device !== device.id || channel.category !== 'window_covering' || !/^cover:\d+$/.test(channel.identifier ?? '')) return [];
		const command = propertiesForChannel(channel.id).find((property) => property.category === 'command');
		return command ? [{ deviceId: device.id, channelId: channel.id, propertyId: command.id }] : [];
	});
};

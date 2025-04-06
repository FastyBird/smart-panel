import type { IChannelsFilter } from '../../composables/composables';
import type { IChannel } from '../../store/channels.store.types';

export interface IChannelsTableColumnDeviceProps {
	channel: IChannel;
	filters: IChannelsFilter;
}

import type { IChannelsFilter } from '../../composables';
import type { IChannel } from '../../store';

export interface IChannelsTableColumnDeviceProps {
	channel: IChannel;
	filters: IChannelsFilter;
}

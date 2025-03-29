import type { IChannelsPropertiesFilter } from '../../composables';
import type { IChannelProperty } from '../../store';

export interface IChannelsPropertiesTableColumnChannelProps {
	property: IChannelProperty;
	filters: IChannelsPropertiesFilter;
}

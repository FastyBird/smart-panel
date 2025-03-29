import type { IChannelsPropertiesFilter } from '../../composables';
import type { IChannelProperty } from '../../store';

export interface IChannelsPropertiesTableColumnDataTypeProps {
	property: IChannelProperty;
	filters: IChannelsPropertiesFilter;
}

import type { IChannelsPropertiesFilter } from '../../composables/composables';
import type { IChannelProperty } from '../../store/channels.properties.store.types';

export interface IChannelsPropertiesTableColumnDataTypeProps {
	property: IChannelProperty;
	filters: IChannelsPropertiesFilter;
}

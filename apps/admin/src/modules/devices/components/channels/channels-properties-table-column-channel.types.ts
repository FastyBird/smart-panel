import type { IChannelsPropertiesFilter } from '../../composables/types';
import type { IChannelProperty } from '../../store/channels.properties.store.types';

export interface IChannelsPropertiesTableColumnChannelProps {
	property: IChannelProperty;
	filters: IChannelsPropertiesFilter;
	withFilters?: boolean;
}

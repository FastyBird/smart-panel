import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';

export interface IViewChannelProps {
	id: IChannel['id'];
	propertyId?: IChannelProperty['id'];
}

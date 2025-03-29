import type { IChannel, IChannelProperty } from '../store';

export interface IViewChannelProps {
	id: IChannel['id'];
	propertyId?: IChannelProperty['id'];
}

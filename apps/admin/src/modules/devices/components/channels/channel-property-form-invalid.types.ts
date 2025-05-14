import { type DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory } from '../../../../openapi';
import type { IChannelProperty } from '../../store/channels.properties.store.types';

export interface IChannelPropertyFormInvalidProps {
	modelValue: IChannelProperty['invalid'];
	channelCategory: DevicesModuleChannelCategory;
	propertyCategory: DevicesModuleChannelPropertyCategory;
	disabled?: boolean;
}

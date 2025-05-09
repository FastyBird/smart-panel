import { type DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory } from '../../../../openapi';
import type { IChannelProperty } from '../../store/channels.properties.store.types';

export interface IChannelPropertyFormFormatProps {
	modelValue: IChannelProperty['format'];
	channelCategory: DevicesModuleChannelCategory;
	propertyCategory: DevicesModuleChannelPropertyCategory;
	disabled?: boolean;
}

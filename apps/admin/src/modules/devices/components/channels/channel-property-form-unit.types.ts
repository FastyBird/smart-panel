import { type DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory } from '../../../../openapi.constants';
import type { IChannelProperty } from '../../store/channels.properties.store.types';

export interface IChannelPropertyFormUnitProps {
	modelValue: IChannelProperty['unit'];
	channelCategory: DevicesModuleChannelCategory;
	propertyCategory: DevicesModuleChannelPropertyCategory;
	disabled?: boolean;
}

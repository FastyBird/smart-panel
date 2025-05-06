import { type DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory } from '../../../../openapi';
import type { IChannelProperty } from '../../store/channels.properties.store.types';

export interface IChannelPropertyFormStepProps {
	modelValue: IChannelProperty['step'];
	channelCategory: DevicesModuleChannelCategory;
	propertyCategory: DevicesModuleChannelPropertyCategory;
	disabled?: boolean;
}

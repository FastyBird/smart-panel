import { type DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory } from '../../../../openapi';

export interface IChannelPropertyFormMinMaxProps {
	minValue: number | undefined;
	maxValue: number | undefined;
	channelCategory: DevicesModuleChannelCategory;
	propertyCategory: DevicesModuleChannelPropertyCategory;
	disabled?: boolean;
}

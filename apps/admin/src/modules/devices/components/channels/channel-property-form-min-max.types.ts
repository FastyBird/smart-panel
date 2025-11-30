import { type DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory } from '../../../../openapi.constants';

export interface IChannelPropertyFormMinMaxProps {
	minValue: number | undefined;
	maxValue: number | undefined;
	channelCategory: DevicesModuleChannelCategory;
	propertyCategory: DevicesModuleChannelPropertyCategory;
	disabled?: boolean;
}

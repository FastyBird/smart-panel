import {
	type DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
} from '../../../../openapi.constants';
import type { IChannelProperty } from '../../store/channels.properties.store.types';

export interface IChannelPropertyFormDataTypeProps {
	modelValue: IChannelProperty['dataType'];
	dataTypesOptions: { value: DevicesModuleChannelPropertyDataType; label: string }[];
	channelCategory: DevicesModuleChannelCategory;
	propertyCategory: DevicesModuleChannelPropertyCategory;
	disabled?: boolean;
}

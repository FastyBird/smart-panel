import { type DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory, DevicesModuleChannelPropertyData_type } from '../../../../openapi.constants';
import type { IChannelProperty } from '../../store/channels.properties.store.types';

export interface IChannelPropertyFormDataTypeProps {
	modelValue: IChannelProperty['dataType'];
	dataTypesOptions: { value: DevicesModuleChannelPropertyData_type; label: string }[];
	channelCategory: DevicesModuleChannelCategory;
	propertyCategory: DevicesModuleChannelPropertyCategory;
	disabled?: boolean;
}

import type { DevicesModuleChannelPropertyDataType, DevicesModuleDeviceCategory } from '../../../../openapi.constants';
import type { IChannelProperty } from '../../store/channels.properties.store.types';
import type { IChannel } from '../../store/channels.store.types';
import type { IDevice } from '../../store/devices.store.types';

export type IDevicePropertyPickerAccess = 'readable' | 'writable';

export type IDevicePropertyPickerField = 'device' | 'channel' | 'property';

export interface IDevicePropertyPickerTexts {
	deviceTitle: string;
	devicePlaceholder: string;
	deviceGroupRecommended: string;
	deviceGroupOther: string;
	channelTitle: string;
	channelPlaceholder: string;
	channelEmpty: string;
	propertyTitle: string;
	propertyPlaceholder: string;
	propertyEmpty: string;
}

export interface IDevicePropertyPickerProps {
	// Selection, bound with v-model:device-id, v-model:channel-id and v-model:property-id
	deviceId: IDevice['id'] | null | undefined;
	channelId: IChannel['id'] | null | undefined;
	propertyId: IChannelProperty['id'] | null | undefined;
	// Only offer properties with this permission: readable (ro, rw) or writable (rw, wo)
	access?: IDevicePropertyPickerAccess;
	// Only offer properties of these data types
	dataTypes?: DevicesModuleChannelPropertyDataType[];
	// Extra predicate a property has to pass, applied together with the access and data type filters
	propertyFilter?: (property: IChannelProperty) => boolean;
	// Device categories offered first; the other devices are offered only when showAllDevices is set
	recommendedCategories?: DevicesModuleDeviceCategory[] | null;
	showAllDevices?: boolean;
	// Names of the form model fields, used as the form item props and the select names
	deviceProp?: string;
	channelProp?: string;
	propertyProp?: string;
	// Overrides of the default labels and placeholders
	texts?: Partial<IDevicePropertyPickerTexts>;
}

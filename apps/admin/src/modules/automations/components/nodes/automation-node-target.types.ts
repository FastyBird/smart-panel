import type { IDevicePropertyPickerAccess } from '../../../devices/components/devices/device-property-picker.types';
import type { IChannelProperty } from '../../../devices/store/channels.properties.store.types';

export interface IAutomationNodeTargetProps {
	deviceId: string | null;
	channelId: string | null;
	propertyId: string | null;
	// readable for what a card watches or compares, writable for what it sets
	access?: IDevicePropertyPickerAccess;
	propertyFilter?: (property: IChannelProperty) => boolean;
	// Put before the configuration keys in the names of the fields (`writes.0.`)
	prefix?: string;
	// What was found wrong with the device, the channel or the property
	errors?: string[];
}

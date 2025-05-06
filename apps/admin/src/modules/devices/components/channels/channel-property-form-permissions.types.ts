import {
	type DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyPermissions,
} from '../../../../openapi';
import type { IChannelProperty } from '../../store/channels.properties.store.types';

export interface IChannelPropertyFormPermissionsProps {
	modelValue: IChannelProperty['permissions'];
	permissionsOptions: { value: DevicesModuleChannelPropertyPermissions; label: string }[];
	channelCategory: DevicesModuleChannelCategory;
	propertyCategory: DevicesModuleChannelPropertyCategory;
	disabled?: boolean;
}

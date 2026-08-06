import type {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
	DevicesModuleDeviceCategory,
} from '../../../../openapi.constants';

import type { IVirtualSlotMapping } from './virtual-wizard.types';

/**
 * One property the chosen device category's specification either requires or allows, expanded from
 * the cross product of that category's channels and each channel's properties.
 *
 * `key` is `<specChannel>.<specProperty>` and is the identity every other structure here is keyed
 * by. A bare property category is not enough: `active` and `fault` appear on most channels, so two
 * different slots of the same category coexist in almost every category's expansion.
 *
 * `channelRequired` and `propertyRequired` are independent — the specification declares `required`
 * at both levels and a required property of an *optional* channel does not have to be filled at all
 * (`illuminance.illuminance` under `lighting` is one). `required` is the conjunction, and is the only
 * one the progress indicator counts.
 */
export interface IVirtualMappingSlot {
	key: string;
	specChannel: DevicesModuleChannelCategory;
	specProperty: DevicesModuleChannelPropertyCategory;
	required: boolean;
	channelRequired: boolean;
	propertyRequired: boolean;
	permissions: DevicesModuleChannelPropertyPermissions[];
	dataType: DevicesModuleChannelPropertyDataType | null;
	unit: string | null;
}

/** Every slot belonging to one spec channel, which is the unit the "take this whole channel" shortcut works on. */
export interface IVirtualMappingSlotGroup {
	specChannel: DevicesModuleChannelCategory;
	required: boolean;
	slots: IVirtualMappingSlot[];
}

/**
 * Live completion of the *required* slots only. Derived from the current selections rather than
 * counted as slots are filled, so clearing a mapping cannot leave the indicator ahead of reality.
 */
export interface IVirtualMappingProgress {
	requiredTotal: number;
	requiredFilled: number;
	remaining: IVirtualMappingSlot[];
}

export interface IVirtualWizardMappingStepProps {
	category: DevicesModuleDeviceCategory | null;
	modelValue: IVirtualSlotMapping[];
}

import type { DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory, DevicesModuleDeviceCategory } from '../../../../openapi.constants';

import type { IVirtualSlotMapping } from './virtual-wizard.types';

export interface IVirtualWizardReviewStepProps {
	category: DevicesModuleDeviceCategory | null;
	mappings: IVirtualSlotMapping[];
	name: string;
	roomId: string | null;
	zoneIds: string[];
}

/**
 * One filled mapping, resolved to display strings. Built only for slots whose `sourceProperty` is
 * not null — a slot the user left unmapped never had a property created for it, so it has nothing to
 * summarise here either. `key` is `<specChannel>.<specProperty>`, matching the mapping step's slot
 * key, for stable `v-for` identity.
 */
export interface IVirtualReviewRow {
	key: string;
	specChannel: DevicesModuleChannelCategory;
	specProperty: DevicesModuleChannelPropertyCategory;
	sourceDevice: string;
	sourceChannel: string;
	sourceProperty: string;
}

/** What the review step hands back once the device exists, regardless of how the optional hide went. */
export interface IVirtualWizardReviewCreatedPayload {
	id: string;
	name: string;
}

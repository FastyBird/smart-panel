import type { DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory, DevicesModuleDeviceCategory } from '../../../../openapi.constants';

/**
 * One spec slot's chosen source, keyed by the channel/property category pair the target device
 * category's spec requires. `sourceProperty` is the id of the real device's channel property this
 * virtual device projects its value from; `null` while the slot is still unfilled.
 *
 * Field names and shape are fixed by the admin implementation plan (Task 9 —
 * docs/superpowers/plans/2026-08-02-virtual-devices-admin.md), which is where the mapping step
 * that builds these lives. `IVirtualWizardState` needs the type now to compile, so it is defined
 * here rather than left a forward reference — the mapping step should import it from here rather
 * than redeclare it.
 */
export interface IVirtualSlotMapping {
	specChannel: DevicesModuleChannelCategory;
	specProperty: DevicesModuleChannelPropertyCategory;
	sourceProperty: string | null;
}

/**
 * The construction wizard's state, carried across all four steps (category, mapping, details,
 * review) and read/written by each. Owned by the wizard shell (`view-virtual-device-wizard.vue`)
 * and passed down to whichever step is active.
 */
export interface IVirtualWizardState {
	category: DevicesModuleDeviceCategory | null;
	mappings: IVirtualSlotMapping[];
	name: string;
	roomId: string | null;
	zoneIds: string[];
}

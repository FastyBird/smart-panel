import type { IDevice } from '../../../modules/devices';
import type { DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory } from '../../../openapi.constants';

export interface IVirtualDeviceSourcesProps {
	device: IDevice;
}

/**
 * One orphaned property this device's detail page offers to fix. A property is orphaned when it
 * still carries `valueOrigin: 'source'` (it is supposed to project another property's value) but its
 * `sourceProperty` link is null — the FK is `ON DELETE SET NULL`, so this is exactly what a deleted
 * source property leaves behind. A `'local'` property with a null source never had one to begin with
 * and is not a warning.
 *
 * `action` is a literal rather than a boolean so the shape reads the same way at the call site as the
 * backend's own compatibility reports do, and leaves room for a future second action without another
 * prop threading through every consumer.
 */
export interface IVirtualSourceWarning {
	action: 'remap';
	propertyId: string;
	specChannel: DevicesModuleChannelCategory;
	specProperty: DevicesModuleChannelPropertyCategory;
}

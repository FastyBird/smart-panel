export interface IVirtualDeviceRemapDialogProps {
	/**
	 * The orphaned property to remap. Everything else this dialog needs — its channel, the virtual
	 * device that owns it, and the spec channel/property pair the compatibility check requires — is
	 * derived live from the stores rather than threaded through as separate props, so the dialog keeps
	 * working off current data even if something changes while it is open (see `.vue` for what happens
	 * when the property or its device is deleted mid-dialog).
	 */
	propertyId: string;
}

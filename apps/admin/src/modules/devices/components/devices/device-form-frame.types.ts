import type { DevicesModuleDeviceCategory } from '../../../../openapi.constants';

/** The fields of a device form the host frame edits; a plugin's form model has them along with its own */
export interface IDeviceFormFrameModel {
	id?: string;
	identifier?: string | null;
	name?: string | null;
	category?: DevicesModuleDeviceCategory | null;
	enabled?: boolean;
	description?: string | null;
	roomId?: string | null;
}

export interface IDeviceFormFrameProps {
	model: IDeviceFormFrameModel;
	categoriesOptions: { value: DevicesModuleDeviceCategory; label: string }[];
	/** Adding picks the category; editing shows it fixed and adds the room */
	mode: 'add' | 'edit';
	/** Shows the device id under Identifiers */
	showId?: boolean;
	/** The identifier under Identifiers: editable while adding a device that is given one, fixed on an existing device */
	identifier?: 'editable' | 'readonly' | 'hidden';
}

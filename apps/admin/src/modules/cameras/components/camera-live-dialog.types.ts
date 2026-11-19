import type { ICamera } from '../store';

export interface ICameraLiveDialogProps {
	cameras: ICamera[];
	/** The id of the open camera, or `null` while the dialog is closed. */
	modelValue: string | null;
}

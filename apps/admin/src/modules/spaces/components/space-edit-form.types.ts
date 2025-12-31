import type { ISpace } from '../store';

export interface ISpaceEditFormProps {
	space: ISpace;
	hideActions?: boolean;
}

export const spaceEditFormEmits = {
	saved: (space: ISpace): boolean => typeof space === 'object',
	cancel: (): boolean => true,
	'update:remote-form-changed': (formChanged: boolean): boolean => typeof formChanged === 'boolean',
	'manage-devices': (): boolean => true,
	'manage-displays': (): boolean => true,
};

import type { ISpace } from '../store';

export interface ISpaceAddFormProps {
	hideActions?: boolean;
}

export const spaceAddFormEmits = {
	saved: (space: ISpace): boolean => typeof space === 'object',
	cancel: (): boolean => true,
	'update:remote-form-changed': (formChanged: boolean): boolean => typeof formChanged === 'boolean',
};

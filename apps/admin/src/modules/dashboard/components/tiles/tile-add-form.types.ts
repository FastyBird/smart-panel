import type { FormResultType } from '../../dashboard.constants';
import type { ITile } from '../../store/tiles.store.types';

export interface ITileAddFormProps {
	id: ITile['id'];
	parent: string;
	parentId: string;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
	onlyDraft?: boolean;
	withPosition?: boolean;
	withSize?: boolean;
}

export const tileAddFormEmits = {
	'update:remote-form-submit': (remoteFormSubmit: boolean): boolean => typeof remoteFormSubmit === 'boolean',
	'update:remote-form-result': (remoteFormResult: FormResultType): boolean => typeof remoteFormResult === 'string',
	'update:remote-form-reset': (remoteFormReset: boolean): boolean => typeof remoteFormReset === 'boolean',
	'update:remote-form-changed': (formChanged: boolean): boolean => typeof formChanged === 'boolean',
};

import type { FormResultType } from '../../scenes.constants';
import type { ISceneActionAddForm } from '../../schemas/scenes.types';
import type { ISceneAction } from '../../store/scenes.actions.store.types';

export interface ISceneActionAddFormProps {
	id: ISceneAction['id'];
	sceneId: string;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

export const sceneActionAddFormEmits = {
	'update:remote-form-submit': (remoteFormSubmit: boolean): boolean => typeof remoteFormSubmit === 'boolean',
	'update:remote-form-result': (remoteFormResult: FormResultType): boolean => typeof remoteFormResult === 'string',
	'update:remote-form-reset': (remoteFormReset: boolean): boolean => typeof remoteFormReset === 'boolean',
	'update:remote-form-changed': (formChanged: boolean): boolean => typeof formChanged === 'boolean',
	submit: (data: ISceneActionAddForm & { type: string }): boolean => typeof data === 'object',
};

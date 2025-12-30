import type { FormResultType } from '../../scenes.constants';
import type { IScene } from '../../store/scenes.store.types';

export interface ISceneEditFormProps {
	scene: IScene;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

export const sceneEditFormEmits = {
	'update:remote-form-submit': (remoteFormSubmit: boolean): boolean => typeof remoteFormSubmit === 'boolean',
	'update:remote-form-result': (remoteFormResult: FormResultType): boolean => typeof remoteFormResult === 'string',
	'update:remote-form-reset': (remoteFormReset: boolean): boolean => typeof remoteFormReset === 'boolean',
	'update:remote-form-changed': (formChanged: boolean): boolean => typeof formChanged === 'boolean',
};

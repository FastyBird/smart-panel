/*
eslint-disable @typescript-eslint/no-empty-object-type
*/
import type { ComponentOptionsMixin, DefineComponent } from 'vue';

import type { ISceneAddFormProps, sceneAddFormEmits } from './components/scenes/scene-add-form.types';
import type { ISceneEditFormProps, sceneEditFormEmits } from './components/scenes/scene-edit-form.types';
import type { SceneAddFormSchema, SceneEditFormSchema } from './schemas/scenes.schemas';
import type { SceneCreateReqSchema, SceneSchema, SceneUpdateReqSchema } from './store/scenes.store.schemas';

export type IScenePluginsComponents = {
	sceneAddForm?: DefineComponent<ISceneAddFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof sceneAddFormEmits>;
	sceneEditForm?: DefineComponent<ISceneEditFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof sceneEditFormEmits>;
};

export type IScenePluginsSchemas = {
	sceneSchema?: typeof SceneSchema;
	sceneAddFormSchema?: typeof SceneAddFormSchema;
	sceneEditFormSchema?: typeof SceneEditFormSchema;
	sceneCreateReqSchema?: typeof SceneCreateReqSchema;
	sceneUpdateReqSchema?: typeof SceneUpdateReqSchema;
};

/*
eslint-disable @typescript-eslint/no-empty-object-type
*/
import type { ComponentOptionsMixin, DefineComponent } from 'vue';

import type { ISceneActionAddFormProps, sceneActionAddFormEmits } from './components/actions/scene-action-add-form.types';
import type { ISceneActionCardProps } from './components/actions/scene-action-card.types';
import type { ISceneActionEditFormProps, sceneActionEditFormEmits } from './components/actions/scene-action-edit-form.types';
import type { ISceneAddFormProps, sceneAddFormEmits } from './components/scenes/scene-add-form.types';
import type { ISceneEditFormProps, sceneEditFormEmits } from './components/scenes/scene-edit-form.types';
import type { SceneActionAddFormSchema, SceneActionEditFormSchema, SceneAddFormSchema, SceneEditFormSchema } from './schemas/scenes.schemas';
import type {
	SceneActionCreateReqSchema,
	SceneActionSchema,
	SceneActionUpdateReqSchema,
	SceneCreateReqSchema,
	SceneSchema,
	SceneUpdateReqSchema,
} from './store/scenes.store.schemas';

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

export type ISceneActionPluginsComponents = {
	sceneActionAddForm?: DefineComponent<
		ISceneActionAddFormProps,
		{},
		{},
		{},
		{},
		ComponentOptionsMixin,
		ComponentOptionsMixin,
		typeof sceneActionAddFormEmits
	>;
	sceneActionEditForm?: DefineComponent<
		ISceneActionEditFormProps,
		{},
		{},
		{},
		{},
		ComponentOptionsMixin,
		ComponentOptionsMixin,
		typeof sceneActionEditFormEmits
	>;
	sceneActionCard?: DefineComponent<ISceneActionCardProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin>;
};

export type ISceneActionPluginsSchemas = {
	sceneActionSchema?: typeof SceneActionSchema;
	sceneActionAddFormSchema?: typeof SceneActionAddFormSchema;
	sceneActionEditFormSchema?: typeof SceneActionEditFormSchema;
	sceneActionCreateReqSchema?: typeof SceneActionCreateReqSchema;
	sceneActionUpdateReqSchema?: typeof SceneActionUpdateReqSchema;
};

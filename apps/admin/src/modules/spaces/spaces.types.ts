/*
eslint-disable @typescript-eslint/no-empty-object-type
*/
import type { ComponentOptionsMixin, DefineComponent } from 'vue';

import { type ISpaceAddFormProps, spaceAddFormEmits } from './components/space-add-form.types';
import { type ISpaceDetailProps } from './components/space-detail.types';
import { type ISpaceEditFormProps, spaceEditFormEmits } from './components/space-edit-form.types';
import type { SpaceAddFormSchema, SpaceEditFormSchema } from './composables/schemas';
import { SpaceCreateSchema, SpaceEditSchema, SpaceSchema } from './store/spaces.store.schemas';

export type ISpacePluginsComponents = {
	spaceDetail?: DefineComponent<ISpaceDetailProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}>;
	spaceAddForm?: DefineComponent<ISpaceAddFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof spaceAddFormEmits>;
	spaceEditForm?: DefineComponent<ISpaceEditFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof spaceEditFormEmits>;
};

export type ISpacePluginsSchemas = {
	spaceSchema?: typeof SpaceSchema;
	spaceAddFormSchema?: typeof SpaceAddFormSchema;
	spaceEditFormSchema?: typeof SpaceEditFormSchema;
	spaceCreateReqSchema?: typeof SpaceCreateSchema;
	spaceUpdateReqSchema?: typeof SpaceEditSchema;
};

export type ISpacePluginRoutes = {};

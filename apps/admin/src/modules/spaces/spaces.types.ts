/*
eslint-disable @typescript-eslint/no-empty-object-type
*/
import type { Component, ComponentOptionsMixin, DefineComponent } from 'vue';

import { type ISpaceAddFormProps, spaceAddFormEmits } from './components/space-add-form.types';
import { type ISpaceDetailProps } from './components/space-detail.types';
import { type ISpaceEditFormProps, spaceEditFormEmits } from './components/space-edit-form.types';
import type { SpaceAddFormSchema, SpaceEditFormSchema } from './composables/schemas';
import type { SpaceCreateSchema, SpaceEditSchema, SpaceSchema } from './store/spaces.store.schemas';

export type ISpacePluginsComponents = {
	spaceDetail?: DefineComponent<ISpaceDetailProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}>;
	spaceAddForm?: DefineComponent<ISpaceAddFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof spaceAddFormEmits>;
	spaceEditForm?: DefineComponent<ISpaceEditFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof spaceEditFormEmits>;
	// Detail-view sections and add-dialogs contributed by plugins. Typed as
	// the broad `Component` because their prop shapes live in the plugin's
	// own tree — importing those shapes into core would invert the one-way
	// plugin→core dependency layering. The view dispatches them via
	// `<component :is>`, so the loose typing is acceptable at the seam.
	spaceDomainsSection?: Component;
	spaceScenesSection?: Component;
	spaceAddDeviceDialog?: Component;
	spaceAddSceneDialog?: Component;
	spaceAddDisplayDialog?: Component;
};

export type ISpacePluginsSchemas = {
	spaceSchema?: typeof SpaceSchema;
	spaceAddFormSchema?: typeof SpaceAddFormSchema;
	spaceEditFormSchema?: typeof SpaceEditFormSchema;
	spaceCreateReqSchema?: typeof SpaceCreateSchema;
	spaceUpdateReqSchema?: typeof SpaceEditSchema;
};

export type ISpacePluginRoutes = {};

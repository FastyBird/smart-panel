import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import i18n from '../../locales';
import {
	type ISpacePluginRoutes,
	type ISpacePluginsComponents,
	type ISpacePluginsSchemas,
	SPACES_MODULE_NAME,
	SpaceAddFormSchema,
	SpaceEditFormSchema,
} from '../../modules/spaces';
import { SpaceCreateSchema, SpaceEditSchema, SpaceSchema } from '../../modules/spaces/store/spaces.store.schemas';

import {
	SpaceAddDeviceDialog,
	SpaceAddDisplayDialog,
	SpaceAddForm,
	SpaceAddSceneDialog,
	SpaceDetail,
	SpaceDomainsSection,
	SpaceEditForm,
	SpaceScenesSection,
} from './components/components';
import { locales } from './locales';
import {
	SPACES_HOME_CONTROL_PLUGIN_NAME,
	SPACES_HOME_CONTROL_PLUGIN_SOURCE,
	SPACES_HOME_CONTROL_TYPES,
} from './spaces-home-control.constants';

export const spacesHomeControlPluginKey: PluginInjectionKey<IPlugin<ISpacePluginsComponents, ISpacePluginsSchemas, ISpacePluginRoutes>> =
	Symbol('FB-Plugin-SpacesHomeControl');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { spacesHomeControlPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(spacesHomeControlPluginKey, {
			type: SPACES_HOME_CONTROL_PLUGIN_NAME,
			source: SPACES_HOME_CONTROL_PLUGIN_SOURCE,
			name: 'Home Control Spaces',
			description:
				'Adds physical Room and Zone spaces with lighting, climate, covers, sensor and media controls. Provides the interactive home-control surface of the Smart Panel.',
			links: {
				documentation: 'https://smart-panel.fastybird.com',
				devDocumentation: 'https://smart-panel.fastybird.com',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			// Human-readable labels per space type — the `name` field surfaces
			// in `useSpacesPlugins.options` dropdown-style UI and shouldn't be a
			// raw enum value (`'room'`, `'zone'`). Translate at install time
			// from the plugin's own locale messages (added just above via
			// `setLocaleMessage`).
			elements: SPACES_HOME_CONTROL_TYPES.map((type) => ({
				type,
				name: i18n.global.t(`spacesHomeControlPlugin.typeLabels.${type}`),
				components: {
					spaceDetail: SpaceDetail,
					spaceAddForm: SpaceAddForm,
					spaceEditForm: SpaceEditForm,
					spaceDomainsSection: SpaceDomainsSection,
					spaceScenesSection: SpaceScenesSection,
					spaceAddDeviceDialog: SpaceAddDeviceDialog,
					spaceAddDisplayDialog: SpaceAddDisplayDialog,
					spaceAddSceneDialog: SpaceAddSceneDialog,
				},
				schemas: {
					spaceSchema: SpaceSchema,
					spaceAddFormSchema: SpaceAddFormSchema,
					spaceEditFormSchema: SpaceEditFormSchema,
					spaceCreateReqSchema: SpaceCreateSchema,
					spaceUpdateReqSchema: SpaceEditSchema,
				},
			})),
			modules: [SPACES_MODULE_NAME],
			isCore: true,
		});
	},
};

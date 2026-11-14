import type { App } from 'vue';
import type { RouteLocationResolvedGeneric, RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { AUTOMATIONS_MODULE_NAME } from '../../modules/automations/automations.constants';
import type { IAutomationNodePluginsComponents, IAutomationNodePluginsSchemas } from '../../modules/automations/automations.types';
import {
	type ISpace,
	type ISpacePluginRoutes,
	type ISpacePluginsComponents,
	type ISpacePluginsSchemas,
	SPACES_MODULE_NAME,
	SpaceAddFormSchema,
	SpaceEditFormSchema,
	RouteNames as SpacesRouteNames,
} from '../../modules/spaces';
import { SpaceCreateSchema, SpaceEditSchema, SpaceSchema } from '../../modules/spaces/store/spaces.store.schemas';

import { SPACE_AUTOMATION_NODE_ELEMENTS } from './automations/space-automations.elements';
import { SpaceAddForm, SpaceDetail, SpaceEditForm, SpacesWizard } from './components/components';
import { locales } from './locales';
import { PluginRoutes } from './router';
import {
	RouteNames,
	SPACES_HOME_CONTROL_PLUGIN_NAME,
	SPACES_HOME_CONTROL_PLUGIN_SOURCE,
	SPACES_HOME_CONTROL_TYPES,
} from './spaces-home-control.constants';

export const spacesHomeControlPluginKey: PluginInjectionKey<
	IPlugin<ISpacePluginsComponents & IAutomationNodePluginsComponents, ISpacePluginsSchemas & IAutomationNodePluginsSchemas, ISpacePluginRoutes>
> = Symbol('FB-Plugin-SpacesHomeControl');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			// The names of the plugin's automation cards go where the automations editor looks the names of
			// cards up (`automations.editor.nodeTypes.<type>`); everything else stays under the plugin
			const automations = (translations.automations ?? {}) as { nodeTypes?: Record<string, unknown> };
			const mergedMessages = defaultsDeep(currentMessages, {
				spacesHomeControlPlugin: translations,
				automations: { editor: { nodeTypes: automations.nodeTypes ?? {} } },
			});

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const spacePluginRoute = options.router.getRoutes().find((route) => route.name === SpacesRouteNames.SPACE_PLUGIN);

		if (spacePluginRoute) {
			PluginRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(SpacesRouteNames.SPACE_PLUGIN, route);
			});
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
			// Store the i18n KEY in `element.name`; the `useSpacesPlugins`
			// composable resolves it through `useI18n()` at render time so
			// runtime locale changes update the picker label without a
			// page reload. Plain strings (from legacy plugins) fall
			// through unchanged.
			elements: [
				...SPACES_HOME_CONTROL_TYPES.map((type) => ({
					type,
					name: `spacesHomeControlPlugin.typeLabels.${type}`,
					components: {
						spaceDetail: SpaceDetail,
						spaceAddForm: SpaceAddForm,
						spaceEditForm: SpaceEditForm,
						spaceWizard: SpacesWizard,
					},
					schemas: {
						spaceSchema: SpaceSchema,
						spaceAddFormSchema: SpaceAddFormSchema,
						spaceEditFormSchema: SpaceEditFormSchema,
						spaceCreateReqSchema: SpaceCreateSchema,
						spaceUpdateReqSchema: SpaceEditSchema,
					},
				})),
				// The space cards of the automations editor: occupancy, activity mode and lighting
				...SPACE_AUTOMATION_NODE_ELEMENTS,
			],
			...(spacePluginRoute
				? {
						routes: {
							configure: (id: ISpace['id']): string | RouteLocationResolvedGeneric => {
								return options.router.resolve({
									name: RouteNames.SPACE,
									params: {
										id,
									},
								});
							},
						},
					}
				: {}),
			modules: [SPACES_MODULE_NAME, AUTOMATIONS_MODULE_NAME],
			isCore: true,
		});
	},
};

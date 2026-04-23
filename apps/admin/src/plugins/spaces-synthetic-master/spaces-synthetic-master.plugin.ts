import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import i18n from '../../locales';
import { type ISpacePluginRoutes, type ISpacePluginsComponents, type ISpacePluginsSchemas, SPACES_MODULE_NAME } from '../../modules/spaces';
import { SpaceSchema } from '../../modules/spaces/store/spaces.store.schemas';

import { locales } from './locales';
import {
	SPACES_SYNTHETIC_MASTER_PLUGIN_NAME,
	SPACES_SYNTHETIC_MASTER_PLUGIN_SOURCE,
	SPACES_SYNTHETIC_MASTER_TYPES,
} from './spaces-synthetic-master.constants';

export const spacesSyntheticMasterPluginKey: PluginInjectionKey<
	IPlugin<ISpacePluginsComponents, ISpacePluginsSchemas, ISpacePluginRoutes>
> = Symbol('FB-Plugin-SpacesSyntheticMaster');

/**
 * Admin plugin for the synthetic Master space type.
 *
 * The master space is a singleton, seeded by the backend plugin; no admin UI
 * affordance creates it. This plugin contributes the base SpaceSchema so the
 * core spaces module recognizes the `master` discriminator when rendering
 * the singleton row in lists / edit views. Dedicated edit components can be
 * contributed in a later phase once the entity gains layout / weather-widget
 * config columns.
 */
export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { spacesSyntheticMasterPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(spacesSyntheticMasterPluginKey, {
			type: SPACES_SYNTHETIC_MASTER_PLUGIN_NAME,
			source: SPACES_SYNTHETIC_MASTER_PLUGIN_SOURCE,
			name: 'Master Space',
			description:
				'Contributes the singleton Master synthetic space — the whole-house overview surface that aggregates state across all rooms.',
			links: {
				documentation: 'https://smart-panel.fastybird.com',
				devDocumentation: 'https://smart-panel.fastybird.com',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: SPACES_SYNTHETIC_MASTER_TYPES.map((type) => ({
				type,
				// Translate the type label at install time from the plugin's
				// own locale messages instead of a hardcoded English constant
				// so non-English admin locales render the localized name.
				name: i18n.global.t(`spacesSyntheticMasterPlugin.typeLabels.${type}`),
				components: {},
				schemas: {
					spaceSchema: SpaceSchema,
				},
			})),
			modules: [SPACES_MODULE_NAME],
			isCore: true,
		});
	},
};

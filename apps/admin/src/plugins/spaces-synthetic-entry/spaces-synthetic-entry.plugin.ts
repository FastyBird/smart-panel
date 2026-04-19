import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { type ISpacePluginRoutes, type ISpacePluginsComponents, type ISpacePluginsSchemas, SPACES_MODULE_NAME } from '../../modules/spaces';
import { SpaceSchema } from '../../modules/spaces/store/spaces.store.schemas';

import { locales } from './locales';
import {
	SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME,
	SPACES_SYNTHETIC_ENTRY_PLUGIN_SOURCE,
	SPACES_SYNTHETIC_ENTRY_TYPES,
	SPACES_SYNTHETIC_ENTRY_TYPE_LABELS,
} from './spaces-synthetic-entry.constants';

export const spacesSyntheticEntryPluginKey: PluginInjectionKey<
	IPlugin<ISpacePluginsComponents, ISpacePluginsSchemas, ISpacePluginRoutes>
> = Symbol('FB-Plugin-SpacesSyntheticEntry');

/**
 * Admin plugin for the synthetic Entry space type.
 *
 * The entry space is a singleton, seeded by the backend plugin; no admin UI
 * affordance creates it. This plugin contributes the base SpaceSchema so the
 * core spaces module recognizes the `entry` discriminator when rendering the
 * singleton row in lists / edit views. Dedicated edit components can be
 * contributed in a later phase once the entity gains security-mode config
 * columns.
 */
export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { spacesSyntheticEntryPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(spacesSyntheticEntryPluginKey, {
			type: SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME,
			source: SPACES_SYNTHETIC_ENTRY_PLUGIN_SOURCE,
			name: 'Entry Space',
			description:
				'Contributes the singleton Entry synthetic space — the security / front-door surface that surfaces arming state and access control.',
			links: {
				documentation: 'https://smart-panel.fastybird.com',
				devDocumentation: 'https://smart-panel.fastybird.com',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: SPACES_SYNTHETIC_ENTRY_TYPES.map((type) => ({
				type,
				name: SPACES_SYNTHETIC_ENTRY_TYPE_LABELS[type],
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

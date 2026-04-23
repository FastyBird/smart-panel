import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import {
	type IPlugin,
	type PluginInjectionKey,
	injectLogger,
	injectPluginsManager,
	injectSockets,
	injectStoresManager,
} from '../../common';
import {
	type ISpacePluginRoutes,
	type ISpacePluginsComponents,
	type ISpacePluginsSchemas,
	SPACES_MODULE_NAME,
} from '../../modules/spaces';
import { SpaceSchema } from '../../modules/spaces/store/spaces.store.schemas';

import SignageInfoPanelSpaceAddForm from './components/signage-info-panel-space-add-form.vue';
import SignageInfoPanelSpaceEditForm from './components/signage-info-panel-space-edit-form.vue';
import { locales } from './locales';
import {
	EventType,
	SPACES_SIGNAGE_INFO_PANEL_EVENT_PREFIX,
	SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME,
	SPACES_SIGNAGE_INFO_PANEL_PLUGIN_SOURCE,
	SPACES_SIGNAGE_INFO_PANEL_TYPES,
	SPACES_SIGNAGE_INFO_PANEL_TYPE_LABELS,
} from './spaces-signage-info-panel.constants';
import { registerAnnouncementsStore } from './store/announcements.store';
import type { IAnnouncement } from './store/announcements.store.types';
import { announcementsStoreKey } from './store/keys';

export const spacesSignageInfoPanelPluginKey: PluginInjectionKey<
	IPlugin<ISpacePluginsComponents, ISpacePluginsSchemas, ISpacePluginRoutes>
> = Symbol('FB-Plugin-SpacesSignageInfoPanel');

/**
 * Admin plugin for the `spaces-signage-info-panel` backend plugin.
 *
 * Registers the `signage_info_panel` space type with the spaces module's
 * plugin dispatcher, contributes a custom `spaceEditForm` that exposes
 * the subtype toggles / weather-location picker / feed URL alongside a
 * nested announcements editor, and wires the announcements Pinia store
 * so socket events keep the editor in sync with the backend.
 */
export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);
		const logger = injectLogger(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, {
				spacesSignageInfoPanelPlugin: translations,
			});

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const announcementsStore = registerAnnouncementsStore(options.store);

		app.provide(announcementsStoreKey, announcementsStore);
		storesManager.addStore(announcementsStoreKey, announcementsStore);

		pluginsManager.addPlugin(spacesSignageInfoPanelPluginKey, {
			type: SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME,
			source: SPACES_SIGNAGE_INFO_PANEL_PLUGIN_SOURCE,
			name: 'Information Panel Signage',
			description:
				'Read-only, full-screen signage surface with clock, weather, announcements, and optional external feed.',
			links: {
				documentation: 'https://smart-panel.fastybird.com',
				devDocumentation: 'https://smart-panel.fastybird.com',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: SPACES_SIGNAGE_INFO_PANEL_TYPES.map((type) => ({
				type,
				name: SPACES_SIGNAGE_INFO_PANEL_TYPE_LABELS[type],
				components: {
					spaceAddForm: SignageInfoPanelSpaceAddForm,
					spaceEditForm: SignageInfoPanelSpaceEditForm,
				},
				schemas: {
					spaceSchema: SpaceSchema,
				},
			})),
			modules: [SPACES_MODULE_NAME],
			isCore: true,
		});

		sockets.on('event', (data: { event: string; payload: Record<string, unknown>; metadata: object }): void => {
			if (!data?.event?.startsWith(SPACES_SIGNAGE_INFO_PANEL_EVENT_PREFIX)) {
				return;
			}

			const payload = data.payload;
			if (payload === null || typeof payload !== 'object' || typeof payload.id !== 'string') {
				return;
			}

			switch (data.event) {
				case EventType.ANNOUNCEMENT_CREATED:
				case EventType.ANNOUNCEMENT_UPDATED: {
					// Resolve the parent space id from the event payload. An event
					// without a space id cannot be keyed into the per-space cache,
					// so we skip rather than insert a row with an empty key that
					// `listForSpace(id)` would never find.
					const rawSpaceId = payload.space_id ?? payload.spaceId;
					if (typeof rawSpaceId !== 'string' || rawSpaceId.length === 0) {
						logger.warn(
							'spaces-signage-info-panel event missing space id, dropping:',
							data.event,
						);
						return;
					}

					announcementsStore.onEvent({
						id: payload.id,
						spaceId: rawSpaceId,
						order: typeof payload.order === 'number' ? payload.order : 0,
						title: typeof payload.title === 'string' ? payload.title : '',
						body: typeof payload.body === 'string' ? payload.body : null,
						icon: typeof payload.icon === 'string' ? payload.icon : null,
						activeFrom: typeof payload.active_from === 'string' ? new Date(payload.active_from) : null,
						activeUntil: typeof payload.active_until === 'string' ? new Date(payload.active_until) : null,
						priority: typeof payload.priority === 'number' ? payload.priority : 0,
						createdAt: typeof payload.created_at === 'string' ? new Date(payload.created_at) : new Date(),
						updatedAt: typeof payload.updated_at === 'string' ? new Date(payload.updated_at) : null,
					} as IAnnouncement);
					break;
				}

				case EventType.ANNOUNCEMENT_DELETED:
					announcementsStore.unset(payload.id);
					break;

				default:
					logger.warn('Unhandled spaces-signage-info-panel event:', data.event);
			}
		});
	},
};

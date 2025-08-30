import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { DASHBOARD_MODULE_NAME, type ITilePluginsComponents, type ITilePluginsSchemas } from '../../modules/dashboard';

import { DevicePreviewTileAddForm, DevicePreviewTileEditForm } from './components/components';
import enUS from './locales/en-US.json';
import { DevicePreviewTileAddFormSchema, DevicePreviewTileEditFormSchema } from './schemas/tiles.schemas';
import { DevicePreviewTileCreateReqSchema, DevicePreviewTileSchema, DevicePreviewTileUpdateReqSchema } from './store/tiles.store.schemas';
import { TILES_DEVICE_PREVIEW_PLUGIN_NAME, TILES_DEVICE_PREVIEW_TYPE } from './tiles-device-preview.constants';

export const tilesDevicePreviewPluginKey: PluginInjectionKey<IPlugin<ITilePluginsComponents, ITilePluginsSchemas>> =
	Symbol('FB-Plugin-TilesDevicePreview');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { tilesDevicePreviewPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(tilesDevicePreviewPluginKey, {
			type: TILES_DEVICE_PREVIEW_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.tiles-device-preview',
			name: 'Device Preview Tile',
			description:
				'A compact tile for previewing the state of a device, including icons and key attributes. Ideal for at-a-glance control or status display.',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: TILES_DEVICE_PREVIEW_TYPE,
					components: {
						tileAddForm: DevicePreviewTileAddForm,
						tileEditForm: DevicePreviewTileEditForm,
					},
					schemas: {
						tileSchema: DevicePreviewTileSchema,
						tileAddFormSchema: DevicePreviewTileAddFormSchema,
						tileEditFormSchema: DevicePreviewTileEditFormSchema,
						tileCreateReqSchema: DevicePreviewTileCreateReqSchema,
						tileUpdateReqSchema: DevicePreviewTileUpdateReqSchema,
					},
				},
			],
			modules: [DASHBOARD_MODULE_NAME],
			isCore: true,
		});
	},
};

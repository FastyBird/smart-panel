import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import {
	DEVICES_MODULE_NAME,
	RouteNames as DevicesRouteNames,
	type IChannelPluginsComponents,
	type IChannelPluginsSchemas,
	type IChannelPropertyPluginsComponents,
	type IChannelPropertyPluginsSchemas,
	type IDevicePluginRoutes,
	type IDevicePluginsComponents,
	type IDevicePluginsSchemas,
} from '../../modules/devices';

import { VirtualDeviceAddForm, VirtualDeviceEditForm } from './components/components';
import { DEVICES_VIRTUAL_PLUGIN_NAME, DEVICES_VIRTUAL_TYPE, RouteNames } from './devices-virtual.constants';
import { locales } from './locales';
import { PluginRoutes } from './router';
import { VirtualDeviceAddFormSchema, VirtualDeviceEditFormSchema } from './schemas/devices.schemas';
import {
	VirtualChannelPropertyCreateReqSchema,
	VirtualChannelPropertySchema,
	VirtualChannelPropertyUpdateReqSchema,
} from './store/channels.properties.store.schemas';
import { VirtualChannelSchema } from './store/channels.store.schemas';
import { VirtualDeviceCreateReqSchema, VirtualDeviceSchema, VirtualDeviceUpdateReqSchema } from './store/devices.store.schemas';

export const devicesVirtualPluginKey: PluginInjectionKey<
	IPlugin<
		IDevicePluginsComponents & IChannelPluginsComponents & IChannelPropertyPluginsComponents,
		IDevicePluginsSchemas & IChannelPluginsSchemas & IChannelPropertyPluginsSchemas,
		IDevicePluginRoutes
	>
> = Symbol('FB-Plugin-DevicesVirtual');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { devicesVirtualPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		// Guarded on the devices list route existing (rather than added unconditionally like the
		// core module's own children) so a router that has not finished registering the devices
		// module yet cannot end up with an orphaned child route.
		const devicesRoute = options.router.getRoutes().find((route) => route.name === DevicesRouteNames.DEVICES);

		if (devicesRoute) {
			PluginRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(DevicesRouteNames.DEVICES, route);
			});
		}

		pluginsManager.addPlugin(devicesVirtualPluginKey, {
			type: DEVICES_VIRTUAL_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.devices-virtual',
			name: 'Virtual Devices',
			description: 'Build devices by splitting or combining the channels and properties of other devices',
			links: {
				documentation: 'https://smart-panel.fastybird.com',
				devDocumentation: 'https://smart-panel.fastybird.com',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: DEVICES_VIRTUAL_TYPE,
					components: {
						deviceAddForm: VirtualDeviceAddForm,
						deviceEditForm: VirtualDeviceEditForm,
					},
					schemas: {
						deviceSchema: VirtualDeviceSchema,
						deviceAddFormSchema: VirtualDeviceAddFormSchema,
						deviceEditFormSchema: VirtualDeviceEditFormSchema,
						deviceCreateReqSchema: VirtualDeviceCreateReqSchema,
						deviceUpdateReqSchema: VirtualDeviceUpdateReqSchema,
						channelSchema: VirtualChannelSchema,
						channelPropertySchema: VirtualChannelPropertySchema,
						// Without these two, `channels.properties.store.ts`'s `edit()`/`save()` actions fall
						// back to the base module's `ChannelPropertyUpdateReqSchema`/`ChannelPropertyCreateReqSchema`
						// — plain objects with no `source_property` field and no `.catchall()` — which
						// silently strips it from the outgoing request. A remap (or any other write to a
						// virtual property's `source_property`/`value_origin`) would then return 200 and
						// change nothing.
						channelPropertyCreateReqSchema: VirtualChannelPropertyCreateReqSchema,
						channelPropertyUpdateReqSchema: VirtualChannelPropertyUpdateReqSchema,
					},
				},
			],
			...(devicesRoute
				? {
						routes: {
							wizard: {
								label: 'devicesVirtualPlugin.wizard.title',
								icon: 'mdi:call-split',
								to: { name: RouteNames.WIZARD },
								testId: 'virtual-device-wizard',
							},
						},
					}
				: {}),
			modules: [DEVICES_MODULE_NAME],
			isCore: true,
		});
	},
};

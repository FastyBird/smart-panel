import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager, injectStoresManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';
import {
	DEVICES_MODULE_NAME,
	type IChannelPluginsComponents,
	type IChannelPluginsSchemas,
	type IChannelPropertyPluginsComponents,
	type IChannelPropertyPluginsSchemas,
	type IDevicePluginsComponents,
	type IDevicePluginsSchemas,
} from '../../modules/devices';
import DeviceWizard from '../../modules/devices/components/wizard/device-wizard.vue';
import { channelsPropertiesStoreKey, channelsStoreKey } from '../../modules/devices/store/keys';
import type { VirtualDeviceExtensionComponents } from '../devices-virtual/composables/use-virtual-device-extensions';

import { ShellyNgConfigForm, ShellyNgDeviceAddForm, ShellyNgDeviceEditForm } from './components/components';
import ShellyCoverRecoverySection from './components/shelly-cover-recovery-section.vue';
import { shellyCoverRecoveryTargets } from './components/shelly-cover-recovery-targets';
import ShellyCoverRecovery from './components/shelly-cover-recovery.vue';
import ThermostatMemberInstallation from './components/thermostat-member-installation.vue';
import { useDevicesWizard } from './composables/composables';
import { DEVICES_SHELLY_NG_PLUGIN_NAME, DEVICES_SHELLY_NG_TYPE } from './devices-shelly-ng.constants';
import { locales } from './locales';
import { ShellyNgConfigEditFormSchema } from './schemas/config.schemas';
import { ShellyNgDeviceAddFormSchema, ShellyNgDeviceEditFormSchema } from './schemas/devices.schemas';
import {
	ShellyNgChannelPropertyCreateReqSchema,
	ShellyNgChannelPropertySchema,
	ShellyNgChannelPropertyUpdateReqSchema,
} from './store/channels.properties.store.schemas';
import { ShellyNgChannelCreateReqSchema, ShellyNgChannelSchema, ShellyNgChannelUpdateReqSchema } from './store/channels.store.schemas';
import { ShellyNgConfigSchema, ShellyNgConfigUpdateReqSchema } from './store/config.store.schemas';
import { ShellyNgDeviceCreateReqSchema, ShellyNgDeviceSchema, ShellyNgDeviceUpdateReqSchema } from './store/devices.store.schemas';
import { shellyMeasurementAlias } from './utils/measurement-alias';

export const devicesShellyNgPluginKey: PluginInjectionKey<
	IPlugin<
		IDevicePluginsComponents & IChannelPluginsComponents & IChannelPropertyPluginsComponents & IPluginsComponents & VirtualDeviceExtensionComponents,
		IDevicePluginsSchemas & IChannelPluginsSchemas & IChannelPropertyPluginsSchemas & IPluginsSchemas
	>
> = Symbol('FB-Plugin-DevicesShellyNg');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { devicesShellyNgPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(devicesShellyNgPluginKey, {
			type: DEVICES_SHELLY_NG_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.devices-shelly-ng',
			name: 'Shelly Next Generation',
			description: 'Connect and control your Shelly Next Generation devices directly from the FastyBird Smart Panel',
			links: {
				documentation: 'https://smart-panel.fastybird.com',
				devDocumentation: 'https://smart-panel.fastybird.com',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: ShellyNgConfigForm,
					},
					schemas: {
						pluginConfigSchema: ShellyNgConfigSchema,
						pluginConfigEditFormSchema: ShellyNgConfigEditFormSchema,
						pluginConfigUpdateReqSchema: ShellyNgConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
				{
					type: DEVICES_SHELLY_NG_TYPE,
					components: {
						virtualCoverRecovery: ShellyCoverRecovery,
						virtualMeasurementAlias: shellyMeasurementAlias,
						virtualThermostatInstallations: { 'shelly-ng.guarded-switch': ThermostatMemberInstallation },
						deviceAddForm: ShellyNgDeviceAddForm,
						deviceEditForm: ShellyNgDeviceEditForm,
						deviceDetailTabs: [
							{
								id: 'shelly',
								label: 'devicesShellyNgPlugin.detailTab',
								icon: 'mdi:tools',
								component: ShellyCoverRecoverySection,
								visible: (device) => {
									const stores = injectStoresManager(app);
									return (
										shellyCoverRecoveryTargets(device, stores.getStore(channelsStoreKey).findForDevice(device.id), (id) =>
											stores.getStore(channelsPropertiesStoreKey).findForChannel(id)
										).length > 0
									);
								},
							},
						],
						deviceWizard: {
							selection: {
								kind: 'integration',
								icon: 'mdi:lightning-bolt-outline',
								order: 20,
								description: 'devicesShellyNgPlugin.wizard.selection.description',
							},
							component: DeviceWizard,
							props: { adapterFactory: useDevicesWizard },
							capabilities: { discovery: true, batch: true },
						},
					},
					schemas: {
						deviceSchema: ShellyNgDeviceSchema,
						deviceAddFormSchema: ShellyNgDeviceAddFormSchema,
						deviceEditFormSchema: ShellyNgDeviceEditFormSchema,
						deviceCreateReqSchema: ShellyNgDeviceCreateReqSchema,
						deviceUpdateReqSchema: ShellyNgDeviceUpdateReqSchema,
						channelSchema: ShellyNgChannelSchema,
						channelCreateReqSchema: ShellyNgChannelCreateReqSchema,
						channelUpdateReqSchema: ShellyNgChannelUpdateReqSchema,
						channelPropertySchema: ShellyNgChannelPropertySchema,
						channelPropertyCreateReqSchema: ShellyNgChannelPropertyCreateReqSchema,
						channelPropertyUpdateReqSchema: ShellyNgChannelPropertyUpdateReqSchema,
					},
					modules: [DEVICES_MODULE_NAME],
				},
			],
			modules: [DEVICES_MODULE_NAME, CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};

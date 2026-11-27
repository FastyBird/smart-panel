import type { IPlugin } from '../../../common';

export type ConfigPluginFamilyId = 'devices' | 'buddy' | 'notifications' | 'storage' | 'remoteAccess' | 'weather' | 'other';

export type ConfigPluginFamily = {
	id: ConfigPluginFamilyId;
	icon: string;
	/** Plugin type prefixes (or whole types) that belong to the family */
	types: string[];
};

/** The order the Configuration page shows the plugin families in; a plugin no family claims falls into "other" */
export const CONFIG_PLUGIN_FAMILIES: ConfigPluginFamily[] = [
	{ id: 'devices', icon: 'mdi:lan-connect', types: ['devices-', 'simulator-plugin'] },
	{ id: 'buddy', icon: 'mdi:robot-outline', types: ['buddy-'] },
	{ id: 'notifications', icon: 'mdi:bell-outline', types: ['notifications-'] },
	{ id: 'storage', icon: 'mdi:database-outline', types: ['influx-', 'logger-', 'memory-storage-plugin'] },
	{ id: 'remoteAccess', icon: 'mdi:web', types: ['remote-access-'] },
	{ id: 'weather', icon: 'mdi:weather-partly-cloudy', types: ['weather-'] },
	{ id: 'other', icon: 'mdi:toy-brick', types: [] },
];

export const CONFIG_MODULE_ICON = 'mdi:package-variant';

export const configPluginFamily = (type: IPlugin['type']): ConfigPluginFamily =>
	CONFIG_PLUGIN_FAMILIES.find((family) => family.types.some((prefix) => (prefix.endsWith('-') ? type.startsWith(prefix) : type === prefix))) ??
	CONFIG_PLUGIN_FAMILIES[CONFIG_PLUGIN_FAMILIES.length - 1];

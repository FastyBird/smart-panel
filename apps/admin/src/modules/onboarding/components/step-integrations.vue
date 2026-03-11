<template>
	<div class="py-4 px-4 max-w-lg mx-auto">
		<el-alert
			type="info"
			:title="t('onboardingModule.integrations.description')"
			:closable="false"
			show-icon
			class="mb-4!"
		/>

		<el-scrollbar max-height="40vh">
			<div
				v-loading="isFetching"
				class="flex flex-col gap-3"
			>
				<div
					v-for="integration in devicePlugins"
					:key="integration.type"
					class="rounded-lg border transition-all duration-300"
					:class="integration.enabled ? 'border-primary bg-primary/5' : 'border-gray-200'"
				>
					<div class="flex items-center gap-4 p-3">
						<el-icon
							:size="32"
							class="shrink-0"
							:class="integration.enabled ? 'text-primary' : 'text-gray-400'"
						>
							<icon :icon="getPluginIcon(integration.type)" />
						</el-icon>
						<div class="flex-1 min-w-0">
							<div class="font-medium">{{ integration.name }}</div>
							<div
								v-if="integration.description"
								class="text-xs text-gray-500 truncate"
							>
								{{ integration.description }}
							</div>
						</div>
						<el-switch
							:model-value="integration.enabled"
							:disabled="!integration.canToggleEnabled || isToggling(integration.type)"
							:loading="isToggling(integration.type)"
							@update:model-value="(val: string | number | boolean) => onToggle(integration.type, !!val)"
						/>
					</div>

					<!-- Expanded section when enabled -->
					<div
						v-if="integration.enabled"
						class="border-t border-primary/20 px-3 py-2 flex items-center justify-between gap-2"
					>
						<div class="flex items-center gap-2 text-xs min-w-0">
							<template v-if="isDiscovering(integration.type)">
								<el-icon
									:size="14"
									class="text-primary is-loading"
								>
									<icon icon="mdi:loading" />
								</el-icon>
								<span class="text-gray-500">
									{{ t('onboardingModule.integrations.searching') }}
								</span>
							</template>
							<template v-else-if="getDeviceCount(integration.type) > 0">
								<el-icon
									:size="14"
									class="text-green-500"
								>
									<icon icon="mdi:check-circle" />
								</el-icon>
								<span class="text-green-600">
									{{ t('onboardingModule.integrations.devicesFound', { count: getDeviceCount(integration.type) }) }}
								</span>
							</template>
							<template v-else-if="discoveryFinished(integration.type)">
								<el-icon
									:size="14"
									class="text-gray-400"
								>
									<icon icon="mdi:information-outline" />
								</el-icon>
								<span class="text-gray-500">
									{{ hasConfigForm(integration.type) ? t('onboardingModule.integrations.noDevicesYet') : t('onboardingModule.integrations.noDevicesFound') }}
								</span>
							</template>
							<template v-else>
								<el-icon
									:size="14"
									class="text-blue-400"
								>
									<icon icon="mdi:power-plug-outline" />
								</el-icon>
								<span class="text-gray-500">
									{{ t('onboardingModule.integrations.enabled') }}
								</span>
							</template>
						</div>
						<el-button
							v-if="hasConfigForm(integration.type)"
							size="small"
							text
							type="primary"
							@click="openConfigDialog(integration.type, integration.name)"
						>
							<el-icon
								:size="14"
								class="mr-1"
							>
								<icon icon="mdi:cog-outline" />
							</el-icon>
							{{ t('onboardingModule.integrations.configure') }}
						</el-button>
					</div>

					<!-- Configuration required badge -->
					<div
						v-if="integration.enabled && requiresConfiguration(integration.type) && !isConfigured(integration.type)"
						class="border-t border-orange-200 bg-orange-50 px-3 py-2 flex items-center gap-2"
					>
						<el-icon
							:size="14"
							class="text-orange-500"
						>
							<icon icon="mdi:alert-circle-outline" />
						</el-icon>
						<span class="text-xs text-orange-600">
							{{ t('onboardingModule.integrations.configRequired') }}
						</span>
						<el-button
							size="small"
							text
							type="warning"
							@click="openConfigDialog(integration.type, integration.name)"
						>
							{{ t('onboardingModule.integrations.setupNow') }}
						</el-button>
					</div>
				</div>

				<div
					v-if="devicePlugins.length === 0 && !isFetching"
					class="text-center text-gray-400 py-4"
				>
					{{ t('onboardingModule.integrations.noPlugins') }}
				</div>
			</div>
		</el-scrollbar>

		<!-- Summary bar -->
		<div
			v-if="enabledCount > 0"
			class="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-3"
		>
			<el-icon
				:size="20"
				class="text-primary shrink-0"
			>
				<icon icon="mdi:check-decagram" />
			</el-icon>
			<span class="text-sm text-gray-600">
				{{ t('onboardingModule.integrations.summary', { count: enabledCount }) }}
			</span>
			<span
				v-if="totalDevicesFound > 0"
				class="text-sm text-green-600 ml-auto"
			>
				{{ t('onboardingModule.integrations.totalDevices', { count: totalDevicesFound }) }}
			</span>
		</div>

		<el-alert
			type="info"
			:title="t('onboardingModule.integrations.hint')"
			:closable="false"
			show-icon
			class="mt-4!"
		/>

		<integration-config-dialog
			v-model:visible="configDialogVisible"
			:plugin-type="configDialogPluginType"
			:plugin-name="configDialogPluginName"
			@saved="onConfigSaved"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElIcon, ElScrollbar, ElSwitch, vLoading } from 'element-plus';
import { Icon } from '@iconify/vue';

import { injectStoresManager } from '../../../common';
import { extensionsStoreKey } from '../../../modules/extensions/store/keys';
import { ExtensionKind } from '../../../modules/extensions/extensions.constants';
import { CONFIG_MODULE_PLUGIN_TYPE } from '../../../modules/config/config.constants';
import type { IPluginsComponents, IPluginsSchemas } from '../../../modules/config/config.types';
import { configPluginsStoreKey } from '../../../modules/config/store/keys';
import { devicesStoreKey } from '../../../modules/devices/store/keys';
import { usePlugins } from '../../../modules/config/composables/usePlugins';

import IntegrationConfigDialog from './integration-config-dialog.vue';

defineOptions({
	name: 'StepIntegrations',
});

const { t } = useI18n();
const storesManager = injectStoresManager();
const extensionsStore = storesManager.getStore(extensionsStoreKey);
const devicesStore = storesManager.getStore(devicesStoreKey);
const configPluginsStore = storesManager.getStore(configPluginsStoreKey);
const { getByName } = usePlugins();

const isFetching = ref(false);
const togglingPlugins = reactive<Set<string>>(new Set());
const discoveringPlugins = reactive<Set<string>>(new Set());
const discoveredPlugins = reactive<Set<string>>(new Set());
const configuredPlugins = reactive<Set<string>>(new Set());

// Tracks the latest discovery generation per plugin so stale completions are discarded.
// Incremented each time startDiscovery is called; the callback checks its generation
// against the current value and bails if a newer discovery has been launched or the
// plugin was disabled (generation reset to 0).
const discoveryGeneration = reactive<Record<string, number>>({});

// Config dialog state
const configDialogVisible = ref(false);
const configDialogPluginType = ref('');
const configDialogPluginName = ref('');

// Plugins that require configuration to work (need API keys, hostnames, etc.)
const pluginsRequiringConfig: Record<string, boolean> = {
	'devices-home-assistant-plugin': true,
	'devices-zigbee2mqtt-plugin': true,
};

const pluginIcons: Record<string, string> = {
	'devices-home-assistant-plugin': 'mdi:home-assistant',
	'devices-shelly-v1-plugin': 'mdi:chip',
	'devices-shelly-ng-plugin': 'mdi:chip',
	'devices-zigbee2mqtt-plugin': 'mdi:zigbee',
	'devices-wled-plugin': 'mdi:led-strip-variant',
	'devices-third-party-plugin': 'mdi:api',
	'devices-simulator-plugin': 'mdi:test-tube',
};

const getPluginIcon = (type: string): string => {
	return pluginIcons[type] ?? 'mdi:puzzle';
};

const devicePlugins = computed(() => {
	return Object.values(extensionsStore.data)
		.filter((ext) => ext.kind === ExtensionKind.PLUGIN && ext.type.startsWith('devices-'))
		.sort((a, b) => a.name.localeCompare(b.name));
});

const enabledCount = computed(() => devicePlugins.value.filter((p) => p.enabled).length);

/**
 * Live device counts per plugin type, computed directly from the store.
 * Updates automatically when devices are added/removed via WebSocket events.
 */
const deviceCountsByPlugin = computed(() => {
	const allDevices = devicesStore.findAll();
	const counts: Record<string, number> = {};

	for (const plugin of devicePlugins.value) {
		if (plugin.enabled) {
			const pluginPrefix = plugin.type.replace('-plugin', '');
			counts[plugin.type] = allDevices.filter((d) => d.type.startsWith(pluginPrefix)).length;
		}
	}

	return counts;
});

const totalDevicesFound = computed(() => Object.values(deviceCountsByPlugin.value).reduce((sum, count) => sum + count, 0));

const isToggling = (type: string): boolean => togglingPlugins.has(type);

const isDiscovering = (type: string): boolean => discoveringPlugins.has(type);

const discoveryFinished = (type: string): boolean => discoveredPlugins.has(type);

const getDeviceCount = (type: string): number => deviceCountsByPlugin.value[type] ?? 0;

const hasConfigForm = (type: string): boolean => {
	const plugin = getByName(type);
	if (!plugin) return false;

	const element = plugin.elements?.find(
		(el: { type: string; components?: IPluginsComponents; schemas?: IPluginsSchemas }) => el.type === CONFIG_MODULE_PLUGIN_TYPE
	);

	return !!element?.components?.pluginConfigEditForm;
};

const requiresConfiguration = (type: string): boolean => !!pluginsRequiringConfig[type];

const isConfigured = (type: string): boolean => configuredPlugins.has(type);

const openConfigDialog = (type: string, name: string): void => {
	configDialogPluginType.value = type;
	configDialogPluginName.value = name;
	configDialogVisible.value = true;
};

const onConfigSaved = (): void => {
	configuredPlugins.add(configDialogPluginType.value);

	// Re-trigger discovery after config is saved
	startDiscovery(configDialogPluginType.value);
};

// Polling interval for device discovery (ms)
const DISCOVERY_POLL_INTERVAL = 5_000;
const DISCOVERY_INITIAL_DELAY = 2_000;

// Single shared polling timer — one fetch serves all enabled plugins
let pollingTimer: ReturnType<typeof setInterval> | null = null;
let pollingGeneration = 0;

const startPolling = (): void => {
	if (pollingTimer) return;

	const gen = ++pollingGeneration;

	pollingTimer = setInterval(() => {
		if (pollingGeneration !== gen) {
			stopPolling();
			return;
		}

		devicesStore.fetch().catch(() => {
			// Polling failure is non-fatal
		});
	}, DISCOVERY_POLL_INTERVAL);
};

const stopPolling = (): void => {
	if (pollingTimer) {
		clearInterval(pollingTimer);
		pollingTimer = null;
	}
};

const hasActiveDiscoveries = (): boolean => {
	return devicePlugins.value.some((p) => p.enabled && discoveryGeneration[p.type] > 0);
};

const startDiscovery = async (type: string): Promise<void> => {
	const generation = (discoveryGeneration[type] ?? 0) + 1;
	discoveryGeneration[type] = generation;

	discoveringPlugins.add(type);
	discoveredPlugins.delete(type);

	try {
		// Wait a moment for the backend to start the plugin
		await new Promise((resolve) => setTimeout(resolve, DISCOVERY_INITIAL_DELAY));

		// Bail if a newer discovery was started or plugin was disabled
		if (discoveryGeneration[type] !== generation) return;

		// Initial fetch to seed the store
		await devicesStore.fetch();

		if (discoveryGeneration[type] !== generation) return;

		// Start shared polling if not already running
		startPolling();
	} catch {
		// Discovery may fail if plugin isn't fully started yet
	} finally {
		// Only update state if this is still the current discovery
		if (discoveryGeneration[type] === generation) {
			discoveringPlugins.delete(type);
			discoveredPlugins.add(type);
		}
	}
};

const removePluginDevices = async (type: string): Promise<void> => {
	const pluginPrefix = type.replace('-plugin', '');
	const pluginDevices = devicesStore.findAll().filter((d) => d.type.startsWith(pluginPrefix));

	for (const device of pluginDevices) {
		try {
			await devicesStore.remove({ id: device.id });
		} catch {
			// Best-effort removal — continue with remaining devices
		}
	}
};

const onToggle = async (type: string, enabled: boolean): Promise<void> => {
	togglingPlugins.add(type);

	try {
		await extensionsStore.update({
			type,
			data: { enabled },
		});

		if (enabled) {
			startDiscovery(type);

			// Check if plugin config exists
			checkPluginConfig(type);
		} else {
			// Clean up state when disabled. Reset generation so any in-flight
			// discovery from the previous enable cycle discards its results.
			discoveryGeneration[type] = 0;
			discoveringPlugins.delete(type);
			discoveredPlugins.delete(type);
			configuredPlugins.delete(type);

			// Stop shared polling if no plugins are actively discovering
			if (!hasActiveDiscoveries()) {
				stopPolling();
			}

			// Remove discovered devices belonging to this plugin
			await removePluginDevices(type);
		}
	} catch {
		// Store handles errors internally
	} finally {
		togglingPlugins.delete(type);
	}
};

const checkPluginConfig = async (type: string): Promise<void> => {
	try {
		const config = await configPluginsStore.get({ type });

		if (config) {
			// Check if meaningful config values are set (beyond just 'type' and 'enabled')
			const configEntries = Object.entries(config).filter(
				([key, val]) => key !== 'type' && key !== 'enabled' && val !== null && val !== ''
			);

			if (configEntries.length > 0) {
				configuredPlugins.add(type);
			}
		}
	} catch {
		// Config fetch may fail - that's ok
	}
};

// Initialize state for already-enabled plugins
const initializeEnabledPlugins = (): void => {
	for (const plugin of devicePlugins.value) {
		if (plugin.enabled) {
			startDiscovery(plugin.type);
			checkPluginConfig(plugin.type);
		}
	}
};

onBeforeMount(async () => {
	isFetching.value = true;

	try {
		await extensionsStore.fetch();
	} catch {
		// Silent fail - list will be empty
	} finally {
		isFetching.value = false;
	}

	initializeEnabledPlugins();
});

onBeforeUnmount(() => {
	stopPolling();

	// Reset all generations so any in-flight startDiscovery() calls
	// bail at the next generation check instead of starting polling
	for (const type of Object.keys(discoveryGeneration)) {
		discoveryGeneration[type] = 0;
	}

	// Bump polling generation so a stale startPolling() from an
	// in-flight startDiscovery() self-cancels on the next tick
	pollingGeneration++;
});
</script>

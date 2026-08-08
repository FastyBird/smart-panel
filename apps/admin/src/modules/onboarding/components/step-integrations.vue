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
									<span
										v-if="getDiscoveryRemaining(integration.type) > 0"
										class="text-gray-400 ml-1"
									>
										({{ getDiscoveryRemaining(integration.type) }}s)
									</span>
								</span>
								<el-button
									size="small"
									text
									type="info"
									class="ml-auto!"
									@click="stopDiscoveryForPlugin(integration.type)"
								>
									{{ t('onboardingModule.integrations.stopScan') }}
								</el-button>
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
import { DevicesModuleDevicesHiddenFilter } from '../../../openapi.constants';
import { CONFIG_MODULE_PLUGIN_TYPE } from '../../../modules/config/config.constants';
import type { IPluginsComponents, IPluginsSchemas } from '../../../modules/config/config.types';
import { configPluginsStoreKey } from '../../../modules/config/store/keys';
import { useDevicesPlugins } from '../../../modules/devices/composables/useDevicesPlugins';
import { DEVICES_MODULE_NAME } from '../../../modules/devices/devices.constants';
import { devicesStoreKey } from '../../../modules/devices/store/keys';
import { usePlugins } from '../../../modules/config/composables/usePlugins';
import { DEVICES_VIRTUAL_PLUGIN_NAME } from '../../../plugins/devices-virtual/devices-virtual.constants';

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
const { getByPluginType } = useDevicesPlugins();

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
	'simulator-plugin': 'mdi:test-tube',
};

const getPluginIcon = (type: string): string => {
	return pluginIcons[type] ?? 'mdi:puzzle';
};

const devicePlugins = computed(() => {
	return Object.values(extensionsStore.data)
		.filter((ext) => ext.kind === ExtensionKind.plugin && (ext.type.startsWith('devices-') || ext.type === 'simulator-plugin'))
		.sort((a, b) => a.name.localeCompare(b.name));
});

const enabledCount = computed(() => devicePlugins.value.filter((p) => p.enabled).length);

/**
 * Resolves the device type string(s) a plugin's own devices are stored under, by reading the
 * plugin registry — the same source devices.store.ts itself uses to resolve a device's schema.
 *
 * This cannot be derived by stripping '-plugin' off the plugin's own type string: for every
 * plugin except devices-virtual, the device type happens to equal that derived prefix (e.g.
 * 'devices-home-assistant-plugin' -> prefix 'devices-home-assistant' -> device type
 * 'devices-home-assistant'), which is why that shortcut used to work everywhere it was tried.
 * devices-virtual is the one plugin where the device type ('virtual') genuinely differs from the
 * plugin's prefix ('devices-virtual') — the plugin name and device type are deliberately distinct
 * (see devices-virtual.constants.ts), so no string transformation of the plugin type can recover
 * the device type. Reading it from the registry is correct for every plugin uniformly.
 */
const devicesTypesForPlugin = (pluginType: string): string[] => {
	const plugin = getByPluginType(pluginType);

	return (plugin?.elements ?? [])
		.filter((element) => element.modules === undefined || element.modules.includes(DEVICES_MODULE_NAME))
		.map((element) => element.type);
};

/**
 * Live device counts per plugin type, computed directly from the store.
 * Updates automatically when devices are added/removed via WebSocket events.
 */
const deviceCountsByPlugin = computed(() => {
	const allDevices = devicesStore.findAll();
	const counts: Record<string, number> = {};

	for (const plugin of devicePlugins.value) {
		if (plugin.enabled) {
			const deviceTypes = devicesTypesForPlugin(plugin.type);
			counts[plugin.type] = allDevices.filter((d) => deviceTypes.includes(d.type)).length;
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

// Discovery timing constants
const DISCOVERY_INITIAL_DELAY = 2_000;
const DISCOVERY_TIMEOUT = 30_000;
const DISCOVERY_COUNTDOWN_INTERVAL = 1_000;

// Per-plugin discovery countdown timers
const discoveryTimers = reactive<Record<string, ReturnType<typeof setInterval> | null>>({});
const discoveryRemaining = reactive<Record<string, number>>({});

const getDiscoveryRemaining = (type: string): number => discoveryRemaining[type] ?? 0;

const stopDiscoveryForPlugin = (type: string): void => {
	// Invalidate the generation so any in-flight startDiscovery() calls
	// (still awaiting the 2s delay or fetch) will bail at their generation checks
	// instead of creating a ghost timer.
	discoveryGeneration[type] = (discoveryGeneration[type] ?? 0) + 1;

	// Clear the countdown timer
	if (discoveryTimers[type]) {
		clearInterval(discoveryTimers[type]!);
		discoveryTimers[type] = null;
	}

	discoveryRemaining[type] = 0;
	discoveringPlugins.delete(type);
	discoveredPlugins.add(type);
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

		// Initial fetch to seed the store with any already-discovered devices.
		// After this, new devices arrive in real-time via WebSocket events
		// (handled by devices.module.ts → devicesStore.onEvent).
		await devicesStore.fetch();
	} catch {
		// Initial fetch may fail if plugin isn't fully started yet
	}

	// Bail if a newer discovery was started or plugin was disabled
	if (discoveryGeneration[type] !== generation) return;

	// Start countdown timer — discovery state lasts DISCOVERY_TIMEOUT ms,
	// during which WebSocket events update the device store in real-time.
	// Clear any existing timer first to avoid leaking interval IDs when a
	// stale in-flight startDiscovery() races with a new one.
	if (discoveryTimers[type]) {
		clearInterval(discoveryTimers[type]!);
		discoveryTimers[type] = null;
	}

	const totalSeconds = Math.round(DISCOVERY_TIMEOUT / 1_000);
	discoveryRemaining[type] = totalSeconds;

	discoveryTimers[type] = setInterval(() => {
		// Bail if generation changed (plugin was toggled or re-discovered)
		if (discoveryGeneration[type] !== generation) {
			if (discoveryTimers[type]) {
				clearInterval(discoveryTimers[type]!);
				discoveryTimers[type] = null;
			}

			return;
		}

		discoveryRemaining[type] = Math.max(0, (discoveryRemaining[type] ?? 0) - 1);

		if (discoveryRemaining[type] <= 0) {
			stopDiscoveryForPlugin(type);
		}
	}, DISCOVERY_COUNTDOWN_INTERVAL);
};

/**
 * Plugins whose devices a user built by hand rather than the plugin finding them.
 *
 * Disabling a plugin deletes the devices it owns, which is safe for everything that discovers its
 * own hardware: the rows are a cache of what is out on the network, and re-enabling repopulates
 * them. Virtual devices have no such source. Each one is a category, a set of channels, and a
 * mapping from every one of its properties to a property on some other device — all of it authored
 * in the wizard, none of it recoverable by any scan. Deleting them on a toggle is unrecoverable
 * data loss from a control that reads as reversible, so this flow leaves them alone; removing a
 * virtual device stays an explicit act on the devices list, where it is confirmed.
 */
const NON_DISCOVERABLE_PLUGINS: readonly string[] = [DEVICES_VIRTUAL_PLUGIN_NAME];

const removePluginDevices = async (type: string): Promise<void> => {
	if (NON_DISCOVERABLE_PLUGINS.includes(type)) {
		return;
	}

	// Asked for explicitly, because the shared cache is not a complete answer: the devices endpoint
	// returns visible devices unless told otherwise, so a store filled by onboarding's own
	// `devicesStore.fetch()` holds no hidden ones. A discovered device is hidden when a virtual device
	// has taken its place, and cleaning up only the visible half would leave those behind in the
	// database owned by a plugin that is no longer running — invisible in the UI and impossible to
	// remove from it.
	try {
		await devicesStore.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });
	} catch {
		// Best-effort: what the store already holds is still worth cleaning up.
	}

	const deviceTypes = devicesTypesForPlugin(type);
	const pluginDevices = devicesStore.findAll().filter((d) => deviceTypes.includes(d.type));

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

			// Clear the countdown timer for this plugin
			if (discoveryTimers[type]) {
				clearInterval(discoveryTimers[type]!);
				discoveryTimers[type] = null;
			}

			discoveryRemaining[type] = 0;

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
	// Clear all countdown timers
	for (const type of Object.keys(discoveryTimers)) {
		if (discoveryTimers[type]) {
			clearInterval(discoveryTimers[type]!);
			discoveryTimers[type] = null;
		}
	}

	// Reset all generations so any in-flight startDiscovery() calls
	// bail at the next generation check instead of completing
	for (const type of Object.keys(discoveryGeneration)) {
		discoveryGeneration[type] = 0;
	}
});
</script>

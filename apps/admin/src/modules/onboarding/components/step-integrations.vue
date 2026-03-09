<template>
	<div class="py-4 px-4 max-w-lg mx-auto">
		<p class="text-gray-500 mb-4">
			{{ t('onboardingModule.integrations.description') }}
		</p>

		<div
			v-loading="isFetching"
			class="flex flex-col gap-3"
		>
			<div
				v-for="integration in devicePlugins"
				:key="integration.type"
				class="flex items-center gap-4 p-3 rounded-lg border"
				:class="integration.enabled ? 'border-primary bg-primary/5' : 'border-gray-200'"
			>
				<el-icon
					:size="32"
					class="shrink-0"
					:class="integration.enabled ? 'text-primary' : 'text-gray-400'"
				>
					<icon :icon="getPluginIcon(integration.type)" />
				</el-icon>
				<div class="flex-1">
					<div class="font-medium">{{ integration.name }}</div>
					<div
						v-if="integration.description"
						class="text-xs text-gray-500"
					>
						{{ integration.description }}
					</div>
				</div>
				<el-switch
					:model-value="integration.enabled"
					:disabled="!integration.canToggleEnabled"
					@update:model-value="(val: boolean) => onToggle(integration.type, val)"
				/>
			</div>

			<div
				v-if="devicePlugins.length === 0 && !isFetching"
				class="text-center text-gray-400 py-4"
			>
				{{ t('onboardingModule.integrations.noPlugins') }}
			</div>
		</div>

		<el-alert
			type="info"
			:title="t('onboardingModule.integrations.hint')"
			:closable="false"
			show-icon
			class="mt-4!"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElIcon, ElSwitch, vLoading } from 'element-plus';
import { Icon } from '@iconify/vue';

import { injectStoresManager } from '../../../common';
import { extensionsStoreKey } from '../../../modules/extensions/store/keys';
import { ExtensionKind } from '../../../modules/extensions/extensions.constants';

defineOptions({
	name: 'StepIntegrations',
});

const { t } = useI18n();
const storesManager = injectStoresManager();
const extensionsStore = storesManager.getStore(extensionsStoreKey);

const isFetching = ref(false);

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

const onToggle = async (type: string, enabled: boolean): Promise<void> => {
	try {
		await extensionsStore.update({
			type,
			data: { enabled },
		});
	} catch {
		// Store handles errors internally
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
});
</script>

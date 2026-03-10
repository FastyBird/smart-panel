<template>
	<div class="flex flex-col items-center text-center py-8 px-4">
		<el-icon
			:size="80"
			class="mb-6 text-green-500"
		>
			<icon icon="mdi:check-circle-outline" />
		</el-icon>

		<h2 class="text-2xl font-bold mb-4">
			{{ t('onboardingModule.complete.title') }}
		</h2>

		<p class="text-base text-gray-500 mb-8 max-w-md">
			{{ t('onboardingModule.complete.description') }}
		</p>

		<div class="flex flex-col gap-3 max-w-sm w-full">
			<!-- Account -->
			<div class="flex items-center gap-3 p-3 rounded-lg bg-green-50">
				<el-icon
					:size="20"
					class="text-green-500 shrink-0"
				>
					<icon icon="mdi:check" />
				</el-icon>
				<span>{{ t('onboardingModule.complete.summary.accountCreated') }}</span>
			</div>

			<!-- Location -->
			<div
				v-if="locationConfigured"
				class="flex items-center gap-3 p-3 rounded-lg bg-green-50"
			>
				<el-icon
					:size="20"
					class="text-green-500 shrink-0"
				>
					<icon icon="mdi:check" />
				</el-icon>
				<span>{{ t('onboardingModule.complete.summary.locationConfigured') }}</span>
			</div>
			<div
				v-else
				class="flex items-center gap-3 p-3 rounded-lg bg-gray-50"
			>
				<el-icon
					:size="20"
					class="text-gray-400 shrink-0"
				>
					<icon icon="mdi:minus" />
				</el-icon>
				<span class="text-gray-400">{{ t('onboardingModule.complete.summary.locationSkipped') }}</span>
			</div>

			<!-- Spaces -->
			<div
				v-if="spacesCount > 0"
				class="flex items-center gap-3 p-3 rounded-lg bg-green-50"
			>
				<el-icon
					:size="20"
					class="text-green-500 shrink-0"
				>
					<icon icon="mdi:check" />
				</el-icon>
				<span>{{ t('onboardingModule.complete.summary.spacesCreated', { count: spacesCount }) }}</span>
			</div>
			<div
				v-else
				class="flex items-center gap-3 p-3 rounded-lg bg-gray-50"
			>
				<el-icon
					:size="20"
					class="text-gray-400 shrink-0"
				>
					<icon icon="mdi:minus" />
				</el-icon>
				<span class="text-gray-400">{{ t('onboardingModule.complete.summary.spacesSkipped') }}</span>
			</div>

			<!-- Devices assigned -->
			<div
				v-if="assignedDevicesCount > 0"
				class="flex items-center gap-3 p-3 rounded-lg bg-green-50"
			>
				<el-icon
					:size="20"
					class="text-green-500 shrink-0"
				>
					<icon icon="mdi:check" />
				</el-icon>
				<span>{{ t('onboardingModule.complete.summary.devicesAssigned', { count: assignedDevicesCount }) }}</span>
			</div>
			<div
				v-else-if="discoveredDevices.length > 0"
				class="flex items-center gap-3 p-3 rounded-lg bg-gray-50"
			>
				<el-icon
					:size="20"
					class="text-gray-400 shrink-0"
				>
					<icon icon="mdi:minus" />
				</el-icon>
				<span class="text-gray-400">{{ t('onboardingModule.complete.summary.devicesSkipped') }}</span>
			</div>

			<!-- Integrations -->
			<div
				v-if="integrationsCount > 0"
				class="flex items-center gap-3 p-3 rounded-lg bg-green-50"
			>
				<el-icon
					:size="20"
					class="text-green-500 shrink-0"
				>
					<icon icon="mdi:check" />
				</el-icon>
				<span>{{ t('onboardingModule.complete.summary.integrationsEnabled', { count: integrationsCount }) }}</span>
			</div>
			<div
				v-else
				class="flex items-center gap-3 p-3 rounded-lg bg-gray-50"
			>
				<el-icon
					:size="20"
					class="text-gray-400 shrink-0"
				>
					<icon icon="mdi:minus" />
				</el-icon>
				<span class="text-gray-400">{{ t('onboardingModule.complete.summary.integrationsSkipped') }}</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Icon } from '@iconify/vue';
import { ElIcon } from 'element-plus';
import { useI18n } from 'vue-i18n';

import { injectStoresManager } from '../../../common';
import { extensionsStoreKey } from '../../../modules/extensions/store/keys';
import { ExtensionKind } from '../../../modules/extensions/extensions.constants';
import { useAppOnboarding } from '../composables/composables';

defineOptions({
	name: 'StepComplete',
});

defineProps<{
	locationConfigured: boolean;
}>();

const { t } = useI18n();
const storesManager = injectStoresManager();
const extensionsStore = storesManager.getStore(extensionsStoreKey);
const { spacesToCreate, savedSpacesCount, discoveredDevices, deviceAssignments } = useAppOnboarding();

const spacesCount = computed(() => savedSpacesCount.value + spacesToCreate.length);

const assignedDevicesCount = computed(() => {
	return Object.values(deviceAssignments).filter((v) => v !== null).length;
});

const integrationsCount = computed(() => {
	return Object.values(extensionsStore.data)
		.filter((ext) => ext.kind === ExtensionKind.PLUGIN && ext.type.startsWith('devices-') && ext.enabled).length;
});
</script>

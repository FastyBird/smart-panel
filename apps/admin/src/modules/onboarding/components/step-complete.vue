<template>
	<div class="flex flex-col items-center gap-4 p-4 tp:p-5 text-center">
		<div
			class="flex items-center justify-center w-16 h-16 rounded-full bg-success-soft text-success"
			aria-hidden="true"
		>
			<icon
				icon="mdi:check-circle-outline"
				width="36"
				height="36"
			/>
		</div>

		<h2 class="m-0 text-section">
			{{ t('onboardingModule.complete.title') }}
		</h2>

		<el-alert
			type="info"
			:title="t('onboardingModule.complete.description')"
			:closable="false"
			show-icon
			class="max-w-md text-left"
		/>

		<!-- What was set up, and what was skipped and can be done later -->
		<ul
			class="flex flex-col gap-2 w-full max-w-sm m-0 p-0 list-none text-left"
			data-test-id="onboarding-summary"
		>
			<li
				v-for="row in summary"
				:key="row.id"
				:class="['flex items-center gap-3 p-3 rounded-lg', row.done ? 'bg-success-soft' : 'bg-fill-light']"
				:data-done="row.done ? 'true' : 'false'"
			>
				<icon
					:icon="row.done ? 'mdi:check' : 'mdi:minus'"
					:class="['shrink-0', row.done ? 'text-success' : 'text-muted']"
					width="20"
					height="20"
					aria-hidden="true"
				/>
				<span :class="row.done ? 'text-body' : 'text-help'">{{ row.label }}</span>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert } from 'element-plus';

import { Icon } from '@iconify/vue';

import { injectStoresManager } from '../../../common';
import { extensionsStoreKey } from '../../../modules/extensions/store/keys';
import { ExtensionKind } from '../../../modules/extensions/extensions.constants';
import { useAppOnboarding } from '../composables/composables';

defineOptions({
	name: 'StepComplete',
});

const props = defineProps<{
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
		.filter((ext) => ext.kind === ExtensionKind.plugin && ext.type.startsWith('devices-') && ext.enabled).length;
});

const summary = computed<{ id: string; done: boolean; label: string }[]>(() => {
	const rows = [
		{ id: 'account', done: true, label: t('onboardingModule.complete.summary.accountCreated') },
		{
			id: 'location',
			done: props.locationConfigured,
			label: props.locationConfigured
				? t('onboardingModule.complete.summary.locationConfigured')
				: t('onboardingModule.complete.summary.locationSkipped'),
		},
		{
			id: 'spaces',
			done: spacesCount.value > 0,
			label:
				spacesCount.value > 0
					? t('onboardingModule.complete.summary.spacesCreated', { count: spacesCount.value })
					: t('onboardingModule.complete.summary.spacesSkipped'),
		},
	];

	// Devices only when some were found
	if (assignedDevicesCount.value > 0 || discoveredDevices.length > 0) {
		rows.push({
			id: 'devices',
			done: assignedDevicesCount.value > 0,
			label:
				assignedDevicesCount.value > 0
					? t('onboardingModule.complete.summary.devicesAssigned', { count: assignedDevicesCount.value })
					: t('onboardingModule.complete.summary.devicesSkipped'),
		});
	}

	rows.push({
		id: 'integrations',
		done: integrationsCount.value > 0,
		label:
			integrationsCount.value > 0
				? t('onboardingModule.complete.summary.integrationsEnabled', { count: integrationsCount.value })
				: t('onboardingModule.complete.summary.integrationsSkipped'),
	});

	return rows;
});
</script>

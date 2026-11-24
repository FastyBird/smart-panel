<template>
	<!-- Template 3: the summary card above the tabs -->
	<el-card
		shadow="never"
		body-class="flex flex-wrap items-start gap-4 p-4!"
		data-test-id="display-summary"
	>
		<div
			class="flex items-center justify-center shrink-0 w-14 h-14 rounded-lg bg-fill-light text-regular"
			aria-hidden="true"
		>
			<icon
				icon="mdi:monitor"
				width="32"
				height="32"
			/>
		</div>

		<div class="flex flex-col gap-1 min-w-[200px]">
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-section">{{ props.display.name || props.display.macAddress }}</span>
				<status-tag
					:status="DISPLAY_STATUS_TAG[displayStatus(props.display)]"
					:label="t(`displaysModule.states.${displayStatus(props.display)}`)"
					data-test-id="display-summary-status"
				/>
			</div>
			<span class="text-mono text-secondary">{{ props.display.macAddress }}</span>
		</div>

		<kv-grid
			:items="items"
			:cols="3"
			class="flex-1 min-w-[280px]"
		/>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard } from 'element-plus';

import { Icon } from '@iconify/vue';

import { KvGrid, type KvGridItem, StatusTag } from '../../../common';
import type { IDisplay } from '../store/displays.store.types';

import { DISPLAY_STATUS_TAG, displayStatus, isLocalAddress } from './displays-status';

defineOptions({
	name: 'DisplaySummary',
});

const props = defineProps<{ display: IDisplay }>();

const { t } = useI18n();

const address = (ipAddress: string | null | undefined): { value: string | null; mono: boolean } => {
	if (!ipAddress) {
		return { value: null, mono: false };
	}

	return isLocalAddress(ipAddress) ? { value: t('displaysModule.table.columns.local'), mono: false } : { value: ipAddress, mono: true };
};

const items = computed<KvGridItem[]>((): KvGridItem[] => [
	{ label: t('displaysModule.detail.info.version'), value: props.display.version },
	{ label: t('displaysModule.detail.info.build'), value: props.display.build },
	{ label: t('displaysModule.detail.info.resolution'), value: `${props.display.screenWidth}×${props.display.screenHeight}` },
	{ label: t('displaysModule.detail.info.pixelRatio'), value: props.display.pixelRatio },
	{ label: t('displaysModule.detail.info.currentIpAddress'), ...address(props.display.currentIpAddress) },
	{ label: t('displaysModule.detail.info.registeredFromIp'), ...address(props.display.registeredFromIp) },
]);
</script>

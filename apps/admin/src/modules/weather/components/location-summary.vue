<template>
	<!-- Template 3: the summary card at the top of the location -->
	<el-card
		shadow="never"
		body-class="flex flex-wrap items-center gap-4 p-4!"
		data-test-id="location-summary"
	>
		<div
			class="flex items-center justify-center shrink-0 w-14 h-14 rounded-lg bg-fill-light text-regular"
			aria-hidden="true"
		>
			<icon
				icon="mdi:map-marker"
				width="32"
				height="32"
			/>
		</div>

		<div class="flex flex-col gap-1 min-w-0">
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-section">{{ props.location.name }}</span>
				<status-tag
					v-if="props.primary"
					status="ok"
					:label="t('weatherModule.table.columns.primary.values.yes')"
					data-test-id="location-summary-primary"
				/>
			</div>
			<span class="text-secondary">{{ props.providerName }}</span>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElCard } from 'element-plus';

import { Icon } from '@iconify/vue';

import { StatusTag } from '../../../common';
import type { IWeatherLocation } from '../store/locations.store.types';

defineOptions({
	name: 'LocationSummary',
});

const props = defineProps<{ location: IWeatherLocation; primary: boolean; providerName: string }>();

const { t } = useI18n();
</script>

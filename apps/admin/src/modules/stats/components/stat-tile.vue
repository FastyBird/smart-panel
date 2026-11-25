<template>
	<!-- Template 6: a stat tile, a big figure with its label; the tiles share one grid row height -->
	<el-card
		shadow="never"
		class="h-full"
		body-class="flex flex-col gap-1 p-4! h-full box-border"
		:data-test-id="`stat-tile-${props.icon}`"
	>
		<!-- The label wraps to a second line rather than cut a word off at the 150 px minimum; the measured-at icon sits on the line under the figure -->
		<div class="flex items-start gap-2 min-w-0">
			<icon
				:icon="props.icon"
				width="18"
				height="18"
				class="shrink-0 text-secondary mt-0.5"
				aria-hidden="true"
			/>
			<span class="text-label line-clamp-2 break-words min-w-0">{{ props.label }}</span>
		</div>

		<el-skeleton
			v-if="props.loading && props.value === ''"
			:rows="1"
			animated
		/>

		<span
			v-else
			class="text-title truncate"
			data-test-id="stat-tile-value"
		>
			{{ props.value }}
		</span>

		<div
			v-if="props.hint || props.lastUpdated"
			class="flex items-center gap-2 min-w-0"
		>
			<span
				v-if="props.hint"
				:title="props.hint"
				class="text-help truncate"
			>
				{{ props.hint }}
			</span>

			<el-tooltip
				v-if="props.lastUpdated"
				:content="t('statsModule.texts.updated', { time: formatRelative(props.lastUpdated) })"
				placement="top"
			>
				<icon
					:icon="props.stale ? 'mdi:alert-outline' : 'mdi:information-outline'"
					width="16"
					height="16"
					:class="['shrink-0 ml-auto', props.stale ? 'text-warning' : 'text-muted']"
					:aria-label="t('statsModule.texts.updated', { time: formatRelative(props.lastUpdated) })"
					role="img"
					data-test-id="stat-tile-updated"
				/>
			</el-tooltip>
		</div>

		<el-progress
			v-if="props.progress !== null && props.progress !== undefined"
			:percentage="Math.max(0, Math.min(100, props.progress))"
			:stroke-width="6"
			:show-text="false"
			:color="[
				{ color: 'var(--el-color-success)', percentage: 60 },
				{ color: 'var(--el-color-warning)', percentage: 85 },
				{ color: 'var(--el-color-danger)', percentage: 100 },
			]"
			class="mt-auto pt-2"
		/>
	</el-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElCard, ElProgress, ElSkeleton, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { formatRelative } from '../../../common';

import type { IStatTileProps } from './stat-tile.types';

defineOptions({
	name: 'StatTile',
});

const props = withDefaults(defineProps<IStatTileProps>(), {
	hint: undefined,
	lastUpdated: null,
	stale: false,
	progress: null,
	loading: false,
});

const { t } = useI18n();
</script>

<template>
	<el-card
		v-loading="loading"
		shadow="never"
		header-class="px-3! py-3! font-bold"
	>
		<template #header>
			<div class="flex items-center gap-2">
				<el-icon :size="18">
					<icon icon="mdi:chart-box" />
				</el-icon>
				{{ t('spacesModule.overview.stats.title') }}
			</div>
		</template>

		<el-row :gutter="16">
			<el-col :span="8">
				<el-statistic
					:title="t('spacesModule.overview.stats.total')"
					:value="totalCount"
				>
					<template #prefix>
						<el-icon
							:size="20"
							class="mr-1"
						>
							<icon icon="mdi:home-group" />
						</el-icon>
					</template>
				</el-statistic>
			</el-col>

			<el-col :span="8">
				<el-statistic
					:title="t('spacesModule.overview.stats.rooms')"
					:value="roomCount"
				>
					<template #prefix>
						<el-icon
							:size="20"
							class="mr-1"
						>
							<icon icon="mdi:home" />
						</el-icon>
					</template>
				</el-statistic>
			</el-col>

			<el-col :span="8">
				<el-statistic
					:title="t('spacesModule.overview.stats.zones')"
					:value="zoneCount"
				>
					<template #prefix>
						<el-icon
							:size="20"
							class="mr-1"
						>
							<icon icon="mdi:home-floor-1" />
						</el-icon>
					</template>
				</el-statistic>
			</el-col>
		</el-row>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard, ElCol, ElIcon, ElRow, ElStatistic, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { SpaceType } from '../spaces.constants';
import type { ISpace } from '../store/spaces.store.types';

import type { ISpacesOverviewStatsProps } from './spaces-overview-stats.types';

defineOptions({
	name: 'SpacesOverviewStats',
});

const props = withDefaults(defineProps<ISpacesOverviewStatsProps>(), {
	spaces: () => [],
	loading: false,
});

const { t } = useI18n();

const nonDraftSpaces = computed<ISpace[]>((): ISpace[] => {
	return props.spaces.filter((space) => !space.draft);
});

const totalCount = computed<number>((): number => {
	return nonDraftSpaces.value.length;
});

const roomCount = computed<number>((): number => {
	return nonDraftSpaces.value.filter((space) => space.type === SpaceType.ROOM).length;
});

const zoneCount = computed<number>((): number => {
	return nonDraftSpaces.value.filter((space) => space.type === SpaceType.ZONE).length;
});
</script>

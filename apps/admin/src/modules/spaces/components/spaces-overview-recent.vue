<template>
	<el-card
		v-loading="loading"
		shadow="never"
		header-class="px-3! py-3! font-bold"
	>
		<template #header>
			<div class="flex items-center gap-2">
				<el-icon :size="18">
					<icon icon="mdi:history" />
				</el-icon>
				{{ t('spacesModule.overview.recent.title') }}
			</div>
		</template>

		<el-table
			v-if="spaces.length > 0"
			:data="spaces"
			:show-header="false"
			size="small"
		>
			<el-table-column>
				<template #default="{ row }">
					<div class="flex items-center gap-2">
						<el-icon
							:size="20"
							class="color-[var(--el-color-primary)]"
						>
							<icon :icon="row.icon || getDefaultIcon(row)" />
						</el-icon>
						<div class="flex flex-col min-w-0">
							<span class="font-medium truncate">{{ row.name }}</span>
							<span class="text-xs color-[var(--el-text-color-secondary)]">
								{{ t(`spacesModule.misc.types.${row.type}`) }}
								<template v-if="row.category">
									&bull; {{ t(`spacesModule.fields.spaces.category.options.${row.category}`) }}
								</template>
							</span>
						</div>
					</div>
				</template>
			</el-table-column>

			<el-table-column
				width="120"
				align="right"
			>
				<template #default="{ row }">
					<span class="text-xs color-[var(--el-text-color-secondary)]">
						{{ formatRelativeTime(row.updatedAt ?? row.createdAt) }}
					</span>
				</template>
			</el-table-column>

			<el-table-column
				width="80"
				align="right"
			>
				<template #default="{ row }">
					<el-button
						link
						type="primary"
						size="small"
						@click="$emit('detail', row.id)"
					>
						{{ t('spacesModule.buttons.detail.title') }}
					</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-empty
			v-else
			:description="t('spacesModule.overview.recent.empty')"
			:image-size="60"
		/>
	</el-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard, ElEmpty, ElIcon, ElTable, ElTableColumn, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { formatRelative } from '../../../common';
import { SPACE_CATEGORY_TEMPLATES, SpaceType } from '../spaces.constants';
import type { ISpace } from '../store/spaces.store.types';

import type { ISpacesOverviewRecentProps } from './spaces-overview-recent.types';

defineOptions({
	name: 'SpacesOverviewRecent',
});

withDefaults(defineProps<ISpacesOverviewRecentProps>(), {
	spaces: () => [],
	loading: false,
});

defineEmits<{
	(e: 'detail', id: ISpace['id']): void;
}>();

const { t } = useI18n();

const getDefaultIcon = (space: ISpace): string => {
	if (space.category && SPACE_CATEGORY_TEMPLATES[space.category]) {
		return SPACE_CATEGORY_TEMPLATES[space.category].icon;
	}
	return space.type === SpaceType.ROOM ? 'mdi:home' : 'mdi:home-floor-1';
};

const formatRelativeTime = (date: Date): string => {
	return formatRelative(date);
};
</script>

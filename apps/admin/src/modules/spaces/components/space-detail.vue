<template>
	<el-card
		shadow="never"
		class="mt-2"
		body-class="p-0!"
	>
		<dl class="grid m-0">
			<dt
				class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('spacesModule.fields.spaces.name.title') }}
			</dt>
			<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
				<el-text>
					{{ space.name }}
				</el-text>
			</dd>
			<dt
				class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('spacesModule.fields.spaces.type.title') }}
			</dt>
			<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
				<spaces-table-column-plugin :space="space" />
			</dd>
			<dt
				v-if="space.description"
				class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('spacesModule.fields.spaces.description.title') }}
			</dt>
			<dd
				v-if="space.description"
				class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]"
			>
				<el-text>
					{{ space.description }}
				</el-text>
			</dd>
			<dt
				v-if="space.icon"
				class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('spacesModule.fields.spaces.icon.title') }}
			</dt>
			<dd
				v-if="space.icon"
				class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center gap-2 min-w-[8rem]"
			>
				<el-icon>
					<icon :icon="space.icon" />
				</el-icon>
				<el-text>
					{{ space.icon }}
				</el-text>
			</dd>

			<slot />
		</dl>
	</el-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElCard, ElIcon, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { ISpaceDetailProps } from './space-detail.types';
import SpacesTableColumnPlugin from './spaces-table-column-plugin.vue';

defineOptions({
	name: 'SpaceDetail',
});

defineProps<ISpaceDetailProps>();

const { t } = useI18n();
</script>

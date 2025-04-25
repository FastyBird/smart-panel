<template>
	<div class="b-2 b-solid rounded-2 p-2 grow-1">
		<div class="flex flex-row">
			<el-button
				size="small"
				class="px-1!"
				@click="emit('detail', props.tile.id)"
			>
				<template #icon>
					<icon icon="mdi:file-search-outline" />
				</template>
			</el-button>
			<el-button
				size="small"
				type="primary"
				class="px-1! ml-2!"
				@click="emit('edit', props.tile.id)"
			>
				<template #icon>
					<icon icon="mdi:pencil" />
				</template>
			</el-button>
			<el-button
				size="small"
				type="warning"
				class="px-1! ml-2!"
				@click="emit('remove', props.tile.id)"
			>
				<template #icon>
					<icon icon="mdi:trash-can-outline" />
				</template>
			</el-button>
		</div>
		{{ props.tile.type }}
	</div>
</template>

<script setup lang="ts">
import { ElButton } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { ITile } from '../../../modules/dashboard';

import type { ITilesPreviewProps } from './tile-preview.types';

defineOptions({
	name: 'TilePreview',
});

const props = defineProps<ITilesPreviewProps>();

const emit = defineEmits<{
	(e: 'detail', id: ITile['id']): void;
	(e: 'edit', id: ITile['id']): void;
	(e: 'remove', id: ITile['id']): void;
}>();
</script>

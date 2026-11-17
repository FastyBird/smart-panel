<template>
	<el-button
		size="small"
		type="warning"
		plain
		:disabled="disabled"
		:aria-label="label"
		:title="label"
		@click="emit('click', $event)"
	>
		<template #icon>
			<icon icon="mdi:trash" />
		</template>
	</el-button>
</template>

<script setup lang="ts">
import { ElButton } from 'element-plus';

import { Icon } from '@iconify/vue';

defineProps<{ label: string; disabled?: boolean }>();
const emit = defineEmits<{ click: [event: MouseEvent] }>();
</script>

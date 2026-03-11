<template>
	<div class="flex flex-col items-center justify-center w-full h-full">
		<el-result>
			<template #icon>
				<icon-with-child :size="80">
					<template #primary>
						<icon :icon="icon" />
					</template>
					<template #secondary>
						<icon icon="mdi:help" />
					</template>
				</icon-with-child>
			</template>

			<template #title>
				{{ message }}
			</template>

			<template #extra>
				<el-button
					type="primary"
					@click="$emit('back')"
				>
					{{ buttonLabel }}
				</el-button>
			</template>
		</el-result>
	</div>
</template>

<script setup lang="ts">
import { ElButton, ElResult } from 'element-plus';

import { Icon } from '@iconify/vue';

import IconWithChild from './icon-with-child.vue';

defineOptions({
	name: 'EntityNotFound',
});

defineProps<{
	icon: string;
	message: string;
	buttonLabel: string;
}>();

defineEmits<{
	(e: 'back'): void;
}>();
</script>

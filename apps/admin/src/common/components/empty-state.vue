<template>
	<el-result>
		<template #icon>
			<icon-with-child :size="80">
				<template #primary><icon :icon="icon" /></template>
				<template #secondary><icon icon="mdi:information" /></template>
			</icon-with-child>
		</template>
		<template #title>{{ description }}</template>
		<template
			v-if="$slots.default"
			#extra
		>
			<slot />
		</template>
	</el-result>
</template>
<script setup lang="ts">
import { ElResult } from 'element-plus';

import { Icon } from '@iconify/vue';

import IconWithChild from './icon-with-child.vue';

withDefaults(defineProps<{ description: string; icon?: string }>(), { icon: 'mdi:inbox-outline' });
</script>

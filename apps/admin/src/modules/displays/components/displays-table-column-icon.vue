<template>
	<span
		class="inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-fill-light text-regular"
		aria-hidden="true"
	>
		<icon
			icon="mdi:monitor"
			width="20"
			height="20"
		/>
	</span>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';

import type { IDisplaysTableColumnIconProps } from './displays-table-column-icon.types';

defineOptions({
	name: 'DisplaysTableColumnIcon',
});

defineProps<IDisplaysTableColumnIconProps>();
</script>

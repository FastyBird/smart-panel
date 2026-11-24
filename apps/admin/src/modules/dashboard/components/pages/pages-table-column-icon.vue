<template>
	<span
		class="inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-fill-light text-regular"
		aria-hidden="true"
	>
		<icon
			:icon="iconName"
			width="20"
			height="20"
		/>
	</span>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';

import { usePageIcon } from '../../composables/composables';

import type { IPagesTableColumnIconProps } from './pages-table-column-icon.types';

defineOptions({
	name: 'PagesTableColumnIcon',
});

const props = defineProps<IPagesTableColumnIconProps>();

const { icon: iconName } = usePageIcon({ id: props.page.id });
</script>

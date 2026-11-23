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

import { useSceneIcon } from '../../composables/composables';

import type { IScenesTableColumnIconProps } from './scenes-table-column-icon.types';

defineOptions({
	name: 'ScenesTableColumnIcon',
});

const props = defineProps<IScenesTableColumnIconProps>();

const { icon: iconName } = useSceneIcon({ id: props.scene.id });
</script>

<template>
	<span v-if="display">
		{{ display.name || display.macAddress }}
	</span>
	<span
		v-else
		class="text-gray-400"
	>
		-
	</span>
</template>

<script setup lang="ts">
import { computed, type Ref, ref, watch } from 'vue';

import { useDisplay } from '../composables/composables';
import type { IDisplay } from '../store/displays.store.types';

defineOptions({
	name: 'TableColumnDisplay',
});

// Support both old interface (row with display property) and new interface (displayId)
const props = defineProps<{
	displayId?: IDisplay['id'] | null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	row?: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	filters?: any;
}>();

// Extract display ID from either prop format
const resolvedDisplayId = computed<IDisplay['id'] | null>(() => {
	if (props.displayId) {
		return props.displayId;
	}
	if (props.row?.display) {
		return props.row.display;
	}
	return null;
});

const displayIdRef: Ref<IDisplay['id'] | null> = ref(resolvedDisplayId.value);

watch(resolvedDisplayId, (newVal) => {
	displayIdRef.value = newVal;
});

const { display } = useDisplay(displayIdRef);
</script>

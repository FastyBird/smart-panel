<template>
	<span>{{ reading }}</span>
</template>
<script setup lang="ts">
import { computed } from 'vue';

import { injectStoresManager } from '../../../../common';
import { channelsPropertiesStoreKey } from '../../../../modules/devices/store/keys';

const props = defineProps<{ propertyId?: string | null }>();
const properties = injectStoresManager().getStore(channelsPropertiesStoreKey);
// Subscribe to one chosen reading, never to the source catalogue or the whole mapping table.
const reading = computed(() => {
	const property = props.propertyId ? properties.findById(props.propertyId) : null;
	const value = property?.value?.value;
	return value === null || value === undefined ? '—' : `${String(value)}${property?.unit ? ` ${property.unit}` : ''}`;
});
</script>

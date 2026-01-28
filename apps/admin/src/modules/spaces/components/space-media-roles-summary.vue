<template>
	<!-- Media roles summary - API being redesigned to routing-based architecture -->
	<template v-if="false">
		<!-- Placeholder for future V2 media routing integration -->
	</template>
</template>

<script setup lang="ts">
import type { ISpaceMediaRolesSummaryProps } from './space-media-roles-summary.types';

defineOptions({
	name: 'SpaceMediaRolesSummary',
});

defineProps<ISpaceMediaRolesSummaryProps>();

defineEmits<{
	(e: 'edit'): void;
}>();

// Note: Media domain now uses routing-based architecture (V2)
// This component will be updated when the new API endpoints are available

const reload = (): void => {
	// Stub for reload functionality
};

defineExpose({
	reload,
});
</script>

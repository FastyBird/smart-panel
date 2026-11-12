<template>
	<!--
		The router reuses the component of a route when only its parameters change, and the editor of one
		automation cannot become the editor of another: keyed by the automation, going from one flow straight
		to another mounts a new editor, once the one being left has let go (its `onBeforeRouteUpdate`).
	-->
	<view-automation-flow
		:id="props.id"
		:key="props.id"
	/>
</template>

<script setup lang="ts">
import type { IViewAutomationFlowProps } from './view-automation-flow.types';
import ViewAutomationFlow from './view-automation-flow.vue';

defineOptions({
	name: 'ViewAutomationFlowRoute',
});

const props = defineProps<IViewAutomationFlowProps>();
</script>

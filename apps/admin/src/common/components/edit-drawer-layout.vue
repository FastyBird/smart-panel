<template>
	<!-- Template 4: the add and edit form over its list. A 640 px drawer from tablet landscape (full width on tablet
	     portrait); docked beside the list on wide, without a scrim. On phone the form is its own route, so this
	     renders only the list -->
	<div
		class="flex gap-4 flex-1 min-h-0"
		data-test-id="edit-drawer-layout"
	>
		<div class="flex flex-col flex-1 min-w-0 min-h-0">
			<slot />
		</div>

		<aside
			v-if="editDrawer.mode.value === 'docked' && props.open"
			:style="{ width: `${EDIT_DRAWER_WIDTH}px` }"
			class="flex flex-col shrink-0 overflow-hidden rounded-lg border border-solid border-light bg-surface"
			data-test-id="edit-drawer-docked"
		>
			<app-bar-scope @close="emit('close')">
				<slot name="form" />
			</app-bar-scope>
		</aside>

		<el-drawer
			v-if="editDrawer.mode.value === 'drawer'"
			:model-value="props.open"
			:show-close="false"
			:size="editDrawer.drawerSize.value"
			:with-header="false"
			:before-close="onBeforeClose"
			data-test-id="edit-drawer"
		>
			<app-bar-scope @close="emit('close')">
				<slot
					v-if="props.open"
					name="form"
				/>
			</app-bar-scope>
		</el-drawer>
	</div>
</template>

<script setup lang="ts">
import { ElDrawer } from 'element-plus';

import { EDIT_DRAWER_WIDTH, useEditDrawer } from '../composables/useEditDrawer';

import AppBarScope from './app-bar-scope.vue';
import type { EditDrawerLayoutProps } from './edit-drawer-layout.types';

defineOptions({
	name: 'EditDrawerLayout',
});

const props = withDefaults(defineProps<EditDrawerLayoutProps>(), {
	beforeClose: undefined,
});

const emit = defineEmits<{
	(e: 'close'): void;
}>();

const editDrawer = useEditDrawer();

const onBeforeClose = (done: () => void): void => {
	if (props.beforeClose) {
		props.beforeClose(done);
	} else {
		emit('close');
	}
};
</script>

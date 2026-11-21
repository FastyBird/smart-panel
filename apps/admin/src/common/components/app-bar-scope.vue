<template>
	<div
		class="flex flex-col h-full"
		data-test-id="app-bar-scope"
	>
		<app-bar
			class="app-bar-scope__bar"
			:title="heading?.title"
			:subtitle="heading?.subtitle"
			:left="heading?.left ?? null"
			:left-disabled="heading?.leftDisabled"
			:actions="heading?.actions"
			:primary="heading?.primary"
			@left="heading?.onLeft?.()"
		>
			<template #end>
				<button
					v-if="props.closable"
					:aria-label="t('application.appBar.close')"
					class="flex items-center justify-center shrink-0 w-11 h-11 p-0 border-0 rounded-[var(--el-border-radius-base)] bg-transparent text-inherit cursor-pointer hover:bg-[var(--fb-sidebar-active-bg)]"
					type="button"
					data-test-id="app-bar-scope-close"
					@click="emit('close')"
				>
					<icon
						icon="mdi:close"
						width="22"
						height="22"
						aria-hidden="true"
					/>
				</button>
			</template>
		</app-bar>

		<slot />
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';

import { provideAppBarHost } from '../composables/useAppBarHost';

import type { AppBarScopeProps } from './app-bar-scope.types';
import AppBar from './app-bar.vue';

defineOptions({
	name: 'AppBarScope',
});

const props = withDefaults(defineProps<AppBarScopeProps>(), {
	closable: true,
});

const emit = defineEmits<{
	(e: 'close'): void;
}>();

const { t } = useI18n();

// A drawer is its own app bar host: the view headers inside it always draw into this bar, at every size
const { heading } = provideAppBarHost(() => true, 'drawer');
</script>

<style scoped>
/* Flush with the drawer edges: the drawer body pads its content, not its bar */
.app-bar-scope__bar {
	margin: calc(-1 * var(--el-drawer-padding-primary, 0px)) calc(-1 * var(--el-drawer-padding-primary, 0px)) 0;
}
</style>

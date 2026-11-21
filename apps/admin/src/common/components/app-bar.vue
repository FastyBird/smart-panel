<template>
	<header
		class="flex items-center gap-1 h-14 shrink-0 pl-1 pr-2 bg-[var(--fb-sidebar-bg)] text-[var(--fb-sidebar-active-text)]"
		data-test-id="app-bar"
	>
		<button
			v-if="props.left"
			:aria-label="leftLabel"
			class="flex items-center justify-center shrink-0 w-11 h-11 p-0 border-0 rounded-[var(--el-border-radius-base)] bg-transparent text-inherit cursor-pointer hover:bg-[var(--fb-sidebar-active-bg)]"
			type="button"
			data-test-id="app-bar-left"
			@click="emit('left')"
		>
			<icon
				:icon="LEFT_ICONS[props.left]"
				width="22"
				height="22"
				aria-hidden="true"
			/>
		</button>

		<div
			:class="['flex flex-col flex-1 min-w-0 leading-[1.2]', props.left ? '' : 'pl-3']"
			data-test-id="app-bar-title"
		>
			<slot name="title">
				<h1 class="m-0 text-[17px] font-600 truncate">{{ props.title }}</h1>
				<span
					v-if="props.subtitle"
					class="text-[12px] text-[var(--fb-sidebar-text)] truncate"
				>
					{{ props.subtitle }}
				</span>
			</slot>
		</div>

		<el-button
			v-if="props.primary"
			:loading="props.primary.loading"
			:disabled="props.primary.disabled"
			type="primary"
			data-test-id="app-bar-primary"
			@click="props.primary.handler()"
		>
			{{ props.primary.label }}
		</el-button>

		<template v-else>
			<button
				v-for="action in visibleActions"
				:key="action.label"
				:aria-label="action.label"
				:title="action.label"
				:disabled="action.disabled"
				class="flex items-center justify-center shrink-0 w-11 h-11 p-0 border-0 rounded-[var(--el-border-radius-base)] bg-transparent text-inherit cursor-pointer hover:bg-[var(--fb-sidebar-active-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
				type="button"
				data-test-id="app-bar-action"
				@click="action.handler()"
			>
				<icon
					:icon="action.icon"
					width="22"
					height="22"
					aria-hidden="true"
				/>
			</button>
		</template>

		<slot name="end" />
	</header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { AppBarAction, AppBarLeft, AppBarProps } from './app-bar.types';

defineOptions({
	name: 'AppBar',
});

const props = withDefaults(defineProps<AppBarProps>(), {
	title: '',
	subtitle: undefined,
	left: null,
	actions: () => [],
	primary: undefined,
});

const emit = defineEmits<{
	(e: 'left'): void;
}>();

const { t } = useI18n();

const LEFT_ICONS: Record<AppBarLeft, string> = {
	menu: 'mdi:menu',
	back: 'mdi:arrow-left',
	close: 'mdi:close',
};

const leftLabel = computed<string>(() => {
	switch (props.left) {
		case 'menu':
			return t('application.buttons.openMenu.title');
		case 'close':
			return t('application.appBar.close');
		default:
			return t('application.appBar.back');
	}
});

// The phone bar has room for two icons next to a readable title (spec section 4)
const visibleActions = computed<AppBarAction[]>(() => props.actions.slice(0, 2));
</script>

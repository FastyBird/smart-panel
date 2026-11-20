<template>
	<div
		:role="props.kind === 'error' ? 'alert' : 'status'"
		:aria-busy="props.kind === 'loading' ? 'true' : undefined"
		class="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center"
		data-test-id="state-view"
	>
		<div
			:class="[
				'flex items-center justify-center w-14 h-14 rounded-full',
				props.kind === 'error' ? 'bg-danger-soft text-danger' : 'bg-fill-light text-muted',
			]"
			aria-hidden="true"
		>
			<el-icon
				:size="28"
				:class="{ 'is-loading': props.kind === 'loading' }"
			>
				<icon :icon="iconName" />
			</el-icon>
		</div>

		<div class="flex flex-col items-center gap-1 max-w-[480px]">
			<h2 class="text-section m-0">{{ heading }}</h2>
			<p
				v-if="props.description"
				class="text-help m-0"
			>
				{{ props.description }}
			</p>
		</div>

		<div
			v-if="$slots.action"
			class="flex flex-wrap items-center justify-center gap-2 mt-1"
		>
			<slot name="action" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElIcon } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { StateViewKind, StateViewProps } from './state-view.types';

defineOptions({
	name: 'StateView',
});

const props = withDefaults(defineProps<StateViewProps>(), {
	kind: 'empty',
	icon: undefined,
	title: undefined,
	description: undefined,
});

const { t } = useI18n();

const DEFAULT_ICONS: Record<StateViewKind, string> = {
	empty: 'mdi:inbox-outline',
	loading: 'mdi:loading',
	error: 'mdi:alert-circle-outline',
	'not-found': 'mdi:help-circle-outline',
};

const DEFAULT_TITLES: Record<StateViewKind, string> = {
	empty: 'application.stateView.empty',
	loading: 'application.stateView.loading',
	error: 'application.stateView.error',
	'not-found': 'application.stateView.notFound',
};

// The loading spinner is part of the state, so a custom icon only replaces the other kinds' icons
const iconName = computed<string>((): string => (props.kind === 'loading' ? DEFAULT_ICONS.loading : (props.icon ?? DEFAULT_ICONS[props.kind])));

const heading = computed<string>((): string => props.title ?? t(DEFAULT_TITLES[props.kind]));
</script>

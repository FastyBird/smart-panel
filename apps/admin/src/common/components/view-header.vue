<template>
	<div
		v-if="!inAppBar"
		class="flex flex-wrap items-center gap-3 px-2 pt-3 pb-2 tp:px-4"
		data-test-id="view-header"
	>
		<router-link
			v-if="props.back && !props.onBack"
			:to="props.back"
			:aria-label="t('application.appBar.back')"
			class="flex items-center justify-center shrink-0 w-8 h-8 rounded-[var(--el-border-radius-base)] text-regular hover:bg-fill-light"
			data-test-id="view-header-back"
		>
			<icon
				icon="mdi:arrow-left"
				width="20"
				height="20"
				aria-hidden="true"
			/>
		</router-link>
		<button
			v-else-if="props.onBack"
			:aria-label="phoneLeft === 'close' ? t('application.appBar.close') : t('application.appBar.back')"
			:disabled="props.backDisabled"
			class="flex items-center justify-center shrink-0 w-8 h-8 p-0 border-0 rounded-[var(--el-border-radius-base)] bg-transparent text-regular cursor-pointer hover:bg-fill-light"
			type="button"
			data-test-id="view-header-back"
			@click="props.onBack()"
		>
			<icon
				:icon="phoneLeft === 'close' ? 'mdi:close' : 'mdi:arrow-left'"
				width="20"
				height="20"
				aria-hidden="true"
			/>
		</button>

		<div
			v-if="props.icon || 'icon' in $slots"
			class="flex items-center justify-center shrink-0 w-10 h-10 overflow-hidden rounded-full box-border bg-surface border border-solid border-light text-regular"
			aria-hidden="true"
			data-test-id="view-header-icon"
		>
			<slot name="icon">
				<icon
					:icon="props.icon!"
					width="22"
					height="22"
				/>
			</slot>
		</div>

		<div class="flex flex-col flex-1 min-w-[180px]">
			<div class="flex flex-wrap items-center gap-2">
				<h1 class="m-0 text-title">{{ props.title }}</h1>
				<slot name="tags" />
			</div>
			<span
				v-if="props.subtitle"
				class="text-help"
			>
				{{ props.subtitle }}
			</span>
		</div>

		<div
			v-if="'actions' in $slots"
			class="flex flex-wrap items-center gap-2"
			data-test-id="view-header-actions"
		>
			<slot name="actions" />
		</div>
	</div>

	<div
		v-else-if="showsActionsRow && 'actions' in $slots"
		class="flex flex-wrap items-center gap-2 px-2 pt-2"
		data-test-id="view-header-actions"
	>
		<slot name="actions" />
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { Icon } from '@iconify/vue';

import { type IAppBarHeading, useAppBarHost } from '../composables/useAppBarHost';
import { useSizeClass } from '../composables/useSizeClass';

import type { AppBarLeft } from './app-bar.types';
import type { ViewHeaderProps } from './view-header.types';

defineOptions({
	name: 'ViewHeader',
});

const props = withDefaults(defineProps<ViewHeaderProps>(), {
	subtitle: undefined,
	icon: undefined,
	back: undefined,
	onBack: undefined,
	backDisabled: false,
	left: undefined,
	actions: () => [],
	primary: undefined,
});

const { t } = useI18n();

const router = useRouter();

const { isPhone } = useSizeClass();

// One source for both headers (spec section 4): under an active host (the layout on phone, or a drawer) this header
// draws into the dark app bar; otherwise it is the page header
const host = useAppBarHost();

const inAppBar = computed<boolean>(() => host !== null && host.active.value);

const phoneLeft = computed<AppBarLeft>(() => props.left ?? (props.back || props.onBack ? 'back' : 'menu'));

const onLeft = (): void => {
	if (props.onBack) {
		props.onBack();
	} else if (props.back) {
		router.push(props.back);
	} else {
		router.back();
	}
};

// Left button, actions and the primary button belong to the phone bar of the page. A drawer's bar shows only the
// title (and its own Close) at every size, as the drawer's footer carries Save
const inPhoneBar = computed<boolean>(() => host?.kind === 'layout' && isPhone.value);

// The phone bar takes icon actions or one primary button, not arbitrary controls. A screen that hands it neither keeps
// its `actions` slot as a row under the bar, so no control is lost on phone
const showsActionsRow = computed<boolean>(() => inAppBar.value && host?.kind === 'layout' && props.actions.length === 0 && !props.primary);

const heading = (): IAppBarHeading => ({
	title: props.title,
	subtitle: props.subtitle,
	left: inPhoneBar.value ? phoneLeft.value : null,
	onLeft,
	leftDisabled: props.backDisabled,
	actions: inPhoneBar.value ? props.actions : [],
	primary: inPhoneBar.value ? props.primary : undefined,
});

let unregister: (() => void) | null = null;

onMounted((): void => {
	unregister = host?.register(heading) ?? null;
});

onBeforeUnmount((): void => {
	unregister?.();
	unregister = null;
});
</script>

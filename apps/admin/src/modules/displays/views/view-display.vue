<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		v-if="isDetailRoute || inDrawer"
		:title="display?.name || display?.macAddress || t('displaysModule.detail.title')"
		:subtitle="t('displaysModule.detail.title')"
		icon="mdi:monitor"
		:actions="display ? [{ icon: 'mdi:pencil', label: t('displaysModule.buttons.edit.title'), handler: onEdit }] : []"
		@back="onBack"
	>
		<template #actions>
			<el-tooltip
				v-if="display"
				:content="t('displaysModule.buttons.edit.title')"
				placement="top"
			>
				<el-button
					:aria-label="t('displaysModule.aria.edit', { display: display.name || display.macAddress })"
					plain
					data-test-id="display-edit"
					@click="onEdit"
				>
					<template #icon>
						<icon icon="mdi:pencil" />
					</template>
				</el-button>
			</el-tooltip>
		</template>
	</view-header>

	<div
		v-if="isDetailRoute || inDrawer"
		class="page-pad flex flex-col flex-1 min-h-0 box-border"
	>
		<!-- Template 4: edit opens next to the detail from tablet portrait up, as its own page on phone -->
		<edit-drawer-layout
			:open="showDrawer"
			:before-close="onCloseDrawer"
			@close="onCloseDrawer()"
		>
			<!-- Template 3: the summary card, then the tabs; the page scrolls as one -->
			<div
				v-if="display"
				class="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto"
			>
				<display-summary :display="display" />

				<el-tabs
					:model-value="activeTab"
					@tab-change="onTabChange"
				>
					<el-tab-pane name="overview">
						<template #label>
							<span class="inline-flex items-center gap-2">
								<icon icon="mdi:information-outline" />
								{{ t('displaysModule.detail.tabs.overview') }}
							</span>
						</template>

						<display-overview :display="display" />
					</el-tab-pane>

					<el-tab-pane
						name="tokens"
						lazy
					>
						<template #label>
							<span class="inline-flex items-center gap-2">
								<icon icon="mdi:key" />
								{{ t('displaysModule.detail.tabs.tokens') }}
							</span>
						</template>

						<display-tokens
							:key="display.id"
							:display="display"
						/>
					</el-tab-pane>
				</el-tabs>
			</div>

			<state-view
				v-else-if="isLoading"
				kind="loading"
				icon="mdi:monitor"
				:title="t('displaysModule.texts.loadingDisplay')"
			/>

			<state-view
				v-else
				kind="not-found"
				icon="mdi:monitor"
				:title="t('displaysModule.messages.notFound')"
			>
				<template #action>
					<el-button
						plain
						@click="onBack"
					>
						{{ t('displaysModule.buttons.back.title') }}
					</el-button>
				</template>
			</state-view>

			<template #form>
				<view-error>
					<template #icon>
						<icon icon="mdi:monitor" />
					</template>
					<template #message>
						{{ t('displaysModule.messages.loadError') }}
					</template>

					<suspense>
						<router-view v-slot="{ Component }">
							<component
								:is="Component"
								v-model:remote-form-changed="remoteFormChanged"
							/>
						</router-view>
					</suspense>
				</view-error>
			</template>
		</edit-drawer-layout>
	</div>

	<router-view
		v-else
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElMessageBox, ElTabPane, ElTabs, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBreadcrumbs, EditDrawerLayout, StateView, ViewError, ViewHeader, provideEditDrawer, useFlashMessage } from '../../../common';
import { usePages } from '../../dashboard/composables/composables';
import { useSpaces } from '../../spaces/composables';
import DisplayOverview from '../components/display-overview.vue';
import DisplaySummary from '../components/display-summary.vue';
import DisplayTokens from '../components/display-tokens.vue';
import { useDisplay } from '../composables/composables';
import { RouteNames } from '../displays.constants';
import type { IDisplay } from '../store/displays.store.types';

import type { IViewDisplayProps } from './view-display.types';

defineOptions({
	name: 'ViewDisplay',
});

const props = defineProps<IViewDisplayProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { meta } = useMeta({});
const flashMessage = useFlashMessage();

const displayId = computed(() => props.id);
const { display, isLoading } = useDisplay(displayId);

// The Overview tab names the assigned space and the home page
const { fetchSpaces, firstLoadFinished: spacesLoaded } = useSpaces();
const { fetchPages, loaded: pagesLoaded } = usePages();

// Track if display was previously loaded to detect deletion
const wasDisplayLoaded = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

// The tabs are routes, so a link can open Access tokens straight away
const isDetailRoute = computed<boolean>((): boolean => route.name === RouteNames.DISPLAY || route.name === RouteNames.DISPLAY_TOKENS);

const showDrawer = computed<boolean>((): boolean => route.name === RouteNames.DISPLAY_EDIT);

// Template 4: the edit form opens next to this page from tablet portrait up, as its own page on phone
const { inDrawer } = provideEditDrawer((): boolean => showDrawer.value);

// The tab stays as it was while the edit form is open over it
const activeTab = ref<'overview' | 'tokens'>(route.name === RouteNames.DISPLAY_TOKENS ? 'tokens' : 'overview');

watch(
	(): unknown => route.name,
	(name: unknown): void => {
		if (name === RouteNames.DISPLAY) {
			activeTab.value = 'overview';
		} else if (name === RouteNames.DISPLAY_TOKENS) {
			activeTab.value = 'tokens';
		}

		// The changed flag belongs to the open edit form; once it is gone, the next one starts clean
		if (name !== RouteNames.DISPLAY_EDIT) {
			remoteFormChanged.value = false;
		}
	}
);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		const items = [
			{
				label: t('displaysModule.breadcrumbs.displays.list'),
				route: router.resolve({ name: RouteNames.DISPLAYS }),
			},
			{
				label: t('displaysModule.breadcrumbs.displays.detail', { display: display.value?.name || display.value?.macAddress }),
				route: router.resolve({ name: RouteNames.DISPLAY, params: { id: props.id } }),
			},
		];

		if (activeTab.value === 'tokens') {
			items.push({
				label: t('displaysModule.breadcrumbs.displays.tokens'),
				route: router.resolve({ name: RouteNames.DISPLAY_TOKENS, params: { id: props.id } }),
			});
		}

		return items;
	}
);

const tabRoute = (tab: 'overview' | 'tokens') => ({
	name: tab === 'tokens' ? RouteNames.DISPLAY_TOKENS : RouteNames.DISPLAY,
	params: { id: props.id },
});

const onTabChange = (tab: string | number): void => {
	activeTab.value = tab === 'tokens' ? 'tokens' : 'overview';

	// With the edit form open the route belongs to it; the tab follows when it closes
	if (!showDrawer.value) {
		router.replace(tabRoute(activeTab.value));
	}
};

const confirmDiscard = async (): Promise<boolean> => {
	try {
		await ElMessageBox.confirm(t('displaysModule.texts.confirmDiscard'), t('displaysModule.headings.discard'), {
			confirmButtonText: t('displaysModule.buttons.discard.title'),
			cancelButtonText: t('displaysModule.buttons.keepEditing.title'),
			type: 'warning',
		});

		return true;
	} catch {
		return false;
	}
};

const onCloseDrawer = async (done?: () => void): Promise<void> => {
	if (remoteFormChanged.value && !(await confirmDiscard())) {
		return;
	}

	router.replace(tabRoute(activeTab.value));

	done?.();
};

const onEdit = (): void => {
	if (showDrawer.value) {
		return;
	}

	const to = { name: RouteNames.DISPLAY_EDIT, params: { id: props.id } };

	if (inDrawer.value) {
		router.replace(to);
	} else {
		router.push(to);
	}
};

const onBack = async (): Promise<void> => {
	if (showDrawer.value && remoteFormChanged.value && !(await confirmDiscard())) {
		return;
	}

	router.push({ name: RouteNames.DISPLAYS });
};

onBeforeMount((): void => {
	if (display.value !== null) {
		wasDisplayLoaded.value = true;
	}

	if (!spacesLoaded.value) {
		fetchSpaces();
	}

	if (!pagesLoaded.value) {
		fetchPages();
	}
});

watch(
	(): IDisplay | null => display.value,
	(val: IDisplay | null): void => {
		if (val !== null) {
			wasDisplayLoaded.value = true;
			meta.title = t('displaysModule.meta.displays.detail.title', { display: val.name || val.macAddress });
		} else if (wasDisplayLoaded.value && !isLoading.value) {
			// The display was deleted while it was open
			flashMessage.warning(t('displaysModule.messages.deletedWhileEditing'), { duration: 0 });

			router.replace({ name: RouteNames.DISPLAYS });
		}
	},
	{ immediate: true }
);
</script>

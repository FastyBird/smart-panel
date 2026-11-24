<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		v-if="isDisplaysListRoute || inDrawer"
		:title="t('displaysModule.headings.list')"
		:subtitle="t('displaysModule.subHeadings.list')"
		icon="mdi:monitor"
		:actions="phoneActions"
	>
		<template #actions>
			<el-button
				v-if="permitJoinAvailable"
				:loading="permitJoinActivating"
				type="primary"
				data-test-id="displays-permit-join"
				@click="onPermitJoin"
			>
				<template #icon>
					<icon :icon="permitJoinActive ? 'mdi:link-variant-off' : 'mdi:link-variant-plus'" />
				</template>

				<template v-if="permitJoinActive">
					{{ t('displaysModule.buttons.permitJoin.disable', { time: permitJoinRemainingTimeFormatted }) }}
				</template>
				<template v-else>
					{{ t('displaysModule.buttons.permitJoin.title') }}
				</template>
			</el-button>
		</template>
	</view-header>

	<div
		v-if="isDisplaysListRoute || inDrawer"
		class="page-pad flex flex-col flex-1 min-h-0 box-border"
	>
		<!-- Template 4: edit opens next to the list from tablet portrait up, as its own page on phone -->
		<edit-drawer-layout
			:open="showDrawer"
			:before-close="onCloseDrawer"
			@close="onCloseDrawer()"
		>
			<list-displays
				ref="list"
				v-model:filters="filters"
				v-model:sort-by="sortBy"
				v-model:sort-dir="sortDir"
				v-model:paginate-size="paginateSize"
				v-model:paginate-page="paginatePage"
				:items="displaysPaginated"
				:all-items="displays"
				:total-rows="totalRows"
				:loading="areLoading"
				:filters-active="filtersActive"
				@detail="onDisplayDetail"
				@edit="onDisplayEdit"
				@remove="onDisplayRemove"
				@reset-filters="onResetFilters"
				@bulk-action="onBulkAction"
			/>

			<template #form>
				<view-error>
					<template #icon>
						<icon icon="mdi:monitor" />
					</template>
					<template #message>
						{{ t('displaysModule.messages.loadError') }}
					</template>

					<!-- Keyed by the display: switching to another display remounts the editor, so its save goes to the
					     display now shown and not to the one opened first -->
					<suspense>
						<router-view
							:key="formKey"
							v-slot="{ Component }"
						>
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
		:key="formKey"
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBreadcrumbs, EditDrawerLayout, ViewError, ViewHeader, provideEditDrawer, useFlashMessage } from '../../../common';
import { ListDisplays } from '../components/components';
import { useDisplaysActions, useDisplaysDataSource, usePermitJoin } from '../composables/composables';
import { RouteNames } from '../displays.constants';
import { DisplaysException } from '../displays.exceptions';
import type { IDisplay } from '../store/displays.store.types';

import type { IViewDisplaysProps } from './view-displays.types';

defineOptions({
	name: 'ViewDisplays',
});

defineProps<IViewDisplaysProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('displaysModule.meta.displays.list.title'),
});

const flashMessage = useFlashMessage();

const {
	fetchDisplays,
	displays,
	displaysPaginated,
	totalRows,
	filters,
	filtersActive,
	sortBy,
	sortDir,
	paginateSize,
	paginatePage,
	areLoading,
	resetFilter,
} = useDisplaysDataSource();
const displayActions = useDisplaysActions();

const {
	isAvailable: permitJoinAvailable,
	isActive: permitJoinActive,
	remainingTimeFormatted: permitJoinRemainingTimeFormatted,
	activating: permitJoinActivating,
	fetchStatus: fetchPermitJoinStatus,
	activate: activatePermitJoin,
	deactivate: deactivatePermitJoin,
} = usePermitJoin();

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);

const list = ref<InstanceType<typeof ListDisplays> | null>(null);

const remoteFormChanged = ref<boolean>(false);

const isDisplaysListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.DISPLAYS;
});

// Template 4: the edit form opens next to this page from tablet portrait up, as its own page on phone
const { inDrawer } = provideEditDrawer((): boolean => !isDisplaysListRoute.value);

// One editor per display: a new key remounts the routed form
const formKey = computed<string>((): string => `${String(route.name)}:${typeof route.params?.id === 'string' ? route.params.id : ''}`);

// The changed flag belongs to the editor that is open. Any route change that replaces or closes it clears the flag
// before the next editor mounts, so that one starts clean. A declined discard leaves the route, and the flag, as it was
watch(formKey, (): void => {
	remoteFormChanged.value = false;
});

// The phone app bar: Search, and Permit join while the server offers it
const phoneActions = computed<{ icon: string; label: string; handler: () => void }[]>(() => [
	{ icon: 'mdi:magnify', label: t('displaysModule.fields.search.placeholder'), handler: onSearch },
	...(permitJoinAvailable.value
		? [
				{
					icon: permitJoinActive.value ? 'mdi:link-variant-off' : 'mdi:link-variant-plus',
					label: permitJoinActive.value
						? t('displaysModule.buttons.permitJoin.disable', { time: permitJoinRemainingTimeFormatted.value })
						: t('displaysModule.buttons.permitJoin.title'),
					handler: onPermitJoin,
				},
			]
		: []),
]);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('displaysModule.breadcrumbs.displays.list'),
				route: router.resolve({ name: RouteNames.DISPLAYS }),
			},
		];
	}
);

const leaveForm = (): void => {
	if (inDrawer.value) {
		router.replace({ name: RouteNames.DISPLAYS });
	} else {
		router.push({ name: RouteNames.DISPLAYS });
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

	leaveForm();

	done?.();
};

// Next to a docked form the page stays usable: replacing a changed form asks first, as closing it does
const canReplaceOpenForm = async (): Promise<boolean> => !showDrawer.value || !remoteFormChanged.value || confirmDiscard();

const onDisplayDetail = async (id: IDisplay['id']): Promise<void> => {
	if (!(await canReplaceOpenForm())) {
		return;
	}

	router.push({
		name: RouteNames.DISPLAY,
		params: {
			id,
		},
	});
};

const onDisplayEdit = async (id: IDisplay['id']): Promise<void> => {
	if ((route.name === RouteNames.DISPLAYS_EDIT && route.params.id === id) || !(await canReplaceOpenForm())) {
		return;
	}

	if (inDrawer.value) {
		router.replace({
			name: RouteNames.DISPLAYS_EDIT,
			params: {
				id,
			},
		});
	} else {
		router.push({
			name: RouteNames.DISPLAYS_EDIT,
			params: {
				id,
			},
		});
	}
};

const onDisplayRemove = (id: IDisplay['id']): void => {
	displayActions.remove(id);
};

const onBulkAction = (action: string, items: IDisplay[]): void => {
	switch (action) {
		case 'delete':
			displayActions.bulkRemove(items);
			break;
	}
};

const onResetFilters = (): void => {
	resetFilter();
};

// The phone app bar's Search action
const onSearch = (): void => {
	list.value?.focusSearch();
};

onBeforeMount((): void => {
	fetchDisplays().catch((error: unknown): void => {
		const err = error as Error;

		throw new DisplaysException('Something went wrong', err);
	});

	showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.DISPLAYS_EDIT) !== undefined;
});

const onPermitJoin = async (): Promise<void> => {
	try {
		if (permitJoinActive.value) {
			await deactivatePermitJoin();
			flashMessage.success(t('displaysModule.messages.permitJoinDeactivated'));

			// Stop countdown timer
			if (permitJoinCountdownInterval) {
				clearInterval(permitJoinCountdownInterval);
				permitJoinCountdownInterval = null;
			}
		} else {
			await activatePermitJoin();
			flashMessage.success(t('displaysModule.messages.permitJoinActivated'));

			// Start countdown timer
			startPermitJoinCountdown();
		}
	} catch (error: unknown) {
		if (error instanceof DisplaysException) {
			flashMessage.error(error.message);
		} else {
			flashMessage.error(
				permitJoinActive.value ? t('displaysModule.messages.permitJoinDeactivateError') : t('displaysModule.messages.permitJoinError')
			);
		}
	}
};

let permitJoinCountdownInterval: ReturnType<typeof setInterval> | null = null;

const startPermitJoinCountdown = (): void => {
	if (permitJoinCountdownInterval) {
		clearInterval(permitJoinCountdownInterval);
	}

	permitJoinCountdownInterval = setInterval(async () => {
		await fetchPermitJoinStatus();

		if (!permitJoinActive.value) {
			if (permitJoinCountdownInterval) {
				clearInterval(permitJoinCountdownInterval);
				permitJoinCountdownInterval = null;
			}
		}
	}, 1000);
};

onMounted(async (): Promise<void> => {
	mounted.value = true;

	if (isDisplaysListRoute.value) {
		await fetchPermitJoinStatus();

		// Start countdown if permit join is active
		if (permitJoinActive.value) {
			startPermitJoinCountdown();
		}
	}
});

onBeforeUnmount((): void => {
	if (permitJoinCountdownInterval) {
		clearInterval(permitJoinCountdownInterval);
		permitJoinCountdownInterval = null;
	}
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.DISPLAYS_EDIT) !== undefined;
	}
);
</script>

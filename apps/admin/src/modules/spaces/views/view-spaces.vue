<template>
	<app-breadcrumbs
		v-if="!isWizardRoute"
		:items="breadcrumbs"
	/>

	<view-header
		v-if="(isSpacesListRoute || inDrawer) && !isWizardRoute"
		:title="t('spacesModule.headings.list')"
		:subtitle="t('spacesModule.subHeadings.list')"
		icon="mdi:home-group"
		:actions="[
			{ icon: 'mdi:magnify', label: t('spacesModule.fields.search.placeholder'), handler: onSearch },
			{ icon: 'mdi:plus', label: t('spacesModule.buttons.add.title'), handler: onAddSpace },
		]"
	>
		<template #actions>
			<div class="flex items-center gap-2">
				<el-button
					v-if="enabledWizardOptions.length > 0"
					data-test-id="spaces-wizard"
					@click="onWizard"
				>
					<template #icon>
						<icon icon="mdi:wizard-hat" />
					</template>

					{{ t('spacesModule.buttons.wizard.title') }}
				</el-button>
				<el-button
					type="primary"
					plain
					class="ml-0!"
					data-test-id="spaces-add"
					@click="onAddSpace"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>

					{{ t('spacesModule.buttons.add.title') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<!-- On phone the header's buttons give way to the app bar's search and add; the wizard keeps a row of its own -->
	<div
		v-if="isPhone && isSpacesListRoute && enabledWizardOptions.length > 0"
		class="flex px-3 pt-3"
	>
		<el-button
			class="flex-1"
			data-test-id="spaces-wizard-small"
			@click="onWizard"
		>
			<template #icon>
				<icon icon="mdi:wizard-hat" />
			</template>

			{{ t('spacesModule.buttons.wizard.title') }}
		</el-button>
	</div>

	<div
		v-if="(isSpacesListRoute || inDrawer) && !isWizardRoute"
		class="page-pad flex flex-col flex-1 min-h-0 box-border"
	>
		<!-- Template 4: add and edit open next to the list from tablet portrait up, as their own page on phone -->
		<edit-drawer-layout
			:open="showDrawer"
			:before-close="onCloseDrawer"
			@close="onCloseDrawer()"
		>
			<list-spaces
				ref="list"
				v-model:filters="filters"
				v-model:sort-by="sortBy"
				v-model:sort-dir="sortDir"
				v-model:paginate-size="paginateSize"
				v-model:paginate-page="paginatePage"
				:items="spacesPaginated"
				:all-items="spaces"
				:total-rows="totalRows"
				:loading="areLoading"
				:filters-active="filtersActive"
				@edit="onSpaceEdit"
				@remove="onSpaceRemove"
				@reset-filters="onResetFilters"
				@bulk-action="onBulkAction"
			/>

			<template #form>
				<view-error>
					<template #icon>
						<icon icon="mdi:home-group" />
					</template>
					<template #message>
						{{ t('spacesModule.messages.loadError') }}
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
		v-if="isWizardRoute || (!isSpacesListRoute && !inDrawer)"
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>

	<!-- The space types with a setup wizard; skipped when there is only one -->
	<type-picker
		v-if="wizardPluginDialogVisible"
		:options="wizardPickerOptions"
		:model-value="null"
		:visible="wizardPluginDialogVisible"
		:title="t('spacesModule.headings.selectPlugin')"
		@update:model-value="onStartWizard"
		@update:visible="(visible: boolean) => (wizardPluginDialogVisible = visible)"
	/>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBreadcrumbs,
	EditDrawerLayout,
	TypePicker,
	type TypePickerOption,
	ViewError,
	ViewHeader,
	provideEditDrawer,
	useFlashMessage,
	useSizeClass,
} from '../../../common';
import { ListSpaces } from '../components/components';
import { useSpacesActions, useSpacesDataSource, useSpacesPlugins } from '../composables';
import { RouteNames } from '../spaces.constants';
import type { ISpace } from '../store/spaces.store.types';

defineOptions({
	name: 'ViewSpaces',
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const flashMessage = useFlashMessage();

useMeta({
	title: t('spacesModule.meta.spaces.list.title'),
});

const { isPhone } = useSizeClass();

const {
	fetchSpaces,
	spaces,
	spacesPaginated,
	totalRows,
	filters,
	filtersActive,
	sortBy,
	sortDir,
	paginateSize,
	paginatePage,
	areLoading,
	resetFilter,
} = useSpacesDataSource();
const spacesActions = useSpacesActions();
const { wizardOptions } = useSpacesPlugins();
const enabledWizardOptions = computed(() => wizardOptions.value.filter((item) => !item.disabled));

const showDrawer = ref<boolean>(false);
const wizardPluginDialogVisible = ref<boolean>(false);

const list = ref<InstanceType<typeof ListSpaces> | null>(null);

const wizardPickerOptions = computed<TypePickerOption[]>((): TypePickerOption[] =>
	wizardOptions.value.map((item) => ({
		id: item.value,
		icon: 'mdi:puzzle-outline',
		name: item.label,
		description: item.description || undefined,
		disabled: item.disabled,
	}))
);

const remoteFormChanged = ref<boolean>(false);

const isSpacesListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.SPACES;
});

// Template 4: forms open next to this page from tablet portrait up, as their own page on phone
const { inDrawer } = provideEditDrawer((): boolean => !isSpacesListRoute.value && route.name !== RouteNames.SPACES_WIZARD);

const isWizardRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.SPACES_WIZARD;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('spacesModule.breadcrumbs.spaces.list'),
				route: router.resolve({ name: RouteNames.SPACES }),
			},
		];
	}
);

const leaveForm = (): void => {
	if (inDrawer.value) {
		router.replace({ name: RouteNames.SPACES });
	} else {
		router.push({ name: RouteNames.SPACES });
	}
};

const onCloseDrawer = (done?: () => void): void => {
	if (!remoteFormChanged.value) {
		leaveForm();

		done?.();

		return;
	}

	ElMessageBox.confirm(t('spacesModule.texts.confirmDiscard'), t('spacesModule.headings.discard'), {
		confirmButtonText: t('spacesModule.buttons.yes.title'),
		cancelButtonText: t('spacesModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			leaveForm();

			done?.();
		})
		.catch((): void => {
			// Just ignore it
		});
};

// Next to a docked form the page stays usable: replacing a changed form asks first, as closing it does
const canReplaceOpenForm = async (): Promise<boolean> => {
	if (!showDrawer.value || !remoteFormChanged.value) {
		return true;
	}

	try {
		await ElMessageBox.confirm(t('spacesModule.texts.confirmDiscard'), t('spacesModule.headings.discard'), {
			confirmButtonText: t('spacesModule.buttons.yes.title'),
			cancelButtonText: t('spacesModule.buttons.no.title'),
			type: 'warning',
		});

		return true;
	} catch {
		return false;
	}
};

const onSpaceEdit = async (id: ISpace['id']): Promise<void> => {
	if (route.name === RouteNames.SPACES_EDIT && route.params.id === id) {
		return;
	}

	if (!(await canReplaceOpenForm())) {
		return;
	}

	if (inDrawer.value) {
		router.replace({
			name: RouteNames.SPACES_EDIT,
			params: {
				id,
			},
		});
	} else {
		router.push({
			name: RouteNames.SPACES_EDIT,
			params: {
				id,
			},
		});
	}
};

const onSpaceRemove = (id: ISpace['id']): void => {
	spacesActions.remove(id);
};

const onBulkAction = (action: string, items: ISpace[]): void => {
	switch (action) {
		case 'delete':
			spacesActions.bulkRemove(items);
			break;
	}
};

const onAddSpace = async (): Promise<void> => {
	if (route.name === RouteNames.SPACES_ADD || !(await canReplaceOpenForm())) {
		return;
	}

	if (inDrawer.value) {
		router.replace({
			name: RouteNames.SPACES_ADD,
		});
	} else {
		router.push({
			name: RouteNames.SPACES_ADD,
		});
	}
};

const onResetFilters = (): void => {
	resetFilter();
};

// The phone app bar's Search action
const onSearch = (): void => {
	list.value?.focusSearch();
};

const onWizard = async (): Promise<void> => {
	if (!(await canReplaceOpenForm())) {
		return;
	}

	if (enabledWizardOptions.value.length === 1 && enabledWizardOptions.value[0]) {
		onStartWizard(enabledWizardOptions.value[0].value);
		return;
	}

	wizardPluginDialogVisible.value = true;
};

const onStartWizard = (type: string): void => {
	wizardPluginDialogVisible.value = false;

	router.push({
		name: RouteNames.SPACES_WIZARD,
		params: {
			type,
		},
	});
};

onBeforeMount((): void => {
	fetchSpaces().catch((): void => {
		flashMessage.error(t('spacesModule.messages.loadError'));
	});

	showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.SPACES_ADD || matched.name === RouteNames.SPACES_EDIT) !== undefined;
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value =
			route.matched.find((matched) => matched.name === RouteNames.SPACES_ADD || matched.name === RouteNames.SPACES_EDIT) !== undefined;
	}
);
</script>

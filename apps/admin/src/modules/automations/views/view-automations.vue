<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		v-if="isAutomationsListRoute || inDrawer"
		:title="t('automations.headings.list')"
		:subtitle="t('automations.subHeadings.list')"
		:icon="AUTOMATION_DEFAULT_ICON"
		:actions="[
			{ icon: 'mdi:magnify', label: t('automations.fields.search.placeholder'), handler: onSearch },
			{ icon: 'mdi:plus', label: t('automations.buttons.add.title'), handler: onAutomationCreate },
			{ icon: 'mdi:file-document-multiple-outline', label: t('automations.buttons.fromTemplate.title'), handler: onAutomationFromTemplate },
		]"
	>
		<template #actions>
			<div class="flex items-center">
				<el-button
					type="primary"
					plain
					class="ml-2!"
					data-test-id="automations-add"
					@click="onAutomationCreate"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>

					{{ t('automations.buttons.add.title') }}
				</el-button>

				<el-button
					plain
					class="ml-2!"
					data-test-id="automations-from-template"
					@click="onAutomationFromTemplate"
				>
					<template #icon>
						<icon icon="mdi:file-document-multiple-outline" />
					</template>

					{{ t('automations.buttons.fromTemplate.title') }}
				</el-button>

				<el-button
					plain
					class="ml-2!"
					data-test-id="automations-import"
					@click="onAutomationImport"
				>
					<template #icon>
						<icon icon="mdi:file-import-outline" />
					</template>

					{{ t('automations.buttons.importYaml.title') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div
		v-if="isAutomationsListRoute || inDrawer"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2"
	>
		<!-- Template 4: add and edit open next to the list from tablet portrait up, as their own page on phone -->
		<edit-drawer-layout
			:open="showDrawer"
			:before-close="onCloseDrawer"
			@close="onCloseDrawer()"
		>
			<div class="flex flex-col gap-2 flex-1 min-h-0">
				<automation-suggestions
					:suggestions="suggestions"
					:answering="answeringSuggestions"
					@open="onSuggestionOpen"
					@dismiss="onSuggestionDismiss"
				/>

				<list-automations
					ref="list"
					v-model:filters="filters"
					v-model:sort-by="sortBy"
					v-model:sort-dir="sortDir"
					v-model:paginate-size="paginateSize"
					v-model:paginate-page="paginatePage"
					:items="automationsPaginated"
					:all-items="automations"
					:total-rows="totalRows"
					:loading="areLoading"
					:load-failed="loadFailed"
					:filters-active="filtersActive"
					:updating="updating"
					:exporting="exportingIds"
					@edit="onAutomationEdit"
					@flow="onAutomationFlow"
					@export="onAutomationExport"
					@remove="onAutomationRemove"
					@toggle-enabled="onAutomationToggleEnabled"
					@reset-filters="onResetFilters"
					@retry="onRetry"
				/>
			</div>

			<template #form>
				<view-error>
					<template #icon>
						<icon :icon="AUTOMATION_DEFAULT_ICON" />
					</template>
					<template #message>
						{{ t('automations.messages.requestError') }}
					</template>

					<suspense>
						<router-view
							:key="detailKey"
							v-slot="{ Component }"
						>
							<component
								:is="Component"
								v-model:remote-form-changed="remoteFormChanged"
								@update:remote-form-saving="onFormSaving"
							/>
						</router-view>
					</suspense>
				</view-error>
			</template>
		</edit-drawer-layout>
	</div>

	<router-view
		v-else
		:key="detailKey"
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>

	<automation-template-dialog
		v-model:visible="showTemplateDialog"
		@generated="onTemplateGenerated"
	/>

	<automation-import-dialog
		v-model:visible="showImportDialog"
		@imported="onImported"
	/>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElMessageBox } from 'element-plus';
import { v4 as uuid } from 'uuid';

import { Icon } from '@iconify/vue';

import { AppBreadcrumbs, EditDrawerLayout, ViewError, ViewHeader, provideEditDrawer } from '../../../common';
import { AUTOMATION_DEFAULT_ICON, AUTOMATION_TEMPLATE_DRAFT_QUERY, RouteNames } from '../automations.constants';
import { stashAutomationDraft } from '../automations.drafts';
import { AutomationImportDialog, AutomationSuggestions, AutomationTemplateDialog, ListAutomations } from '../components/components';
import {
	useAutomationExport,
	useAutomationSpaces,
	useAutomationSuggestions,
	useAutomationsActions,
	useAutomationsDataSource,
} from '../composables/composables';
import type { IAutomationSuggestion } from '../composables/types';
import type { IAutomation } from '../store/automations.store.types';

import type { IViewAutomationsProps } from './view-automations.types';

defineOptions({
	name: 'ViewAutomations',
});

const props = defineProps<IViewAutomationsProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('automations.headings.list'),
});

const {
	fetchAutomations,
	automations,
	automationsPaginated,
	totalRows,
	filters,
	filtersActive,
	sortBy,
	sortDir,
	paginateSize,
	paginatePage,
	areLoading,
	loadFailed,
	resetFilter,
} = useAutomationsDataSource();

const { fetchSpaces } = useAutomationSpaces();

const { updating, remove, setEnabled } = useAutomationsActions();

const { exporting, exportAutomation } = useAutomationExport();

const { suggestions, answering: answeringSuggestions, fetchSuggestions, dismiss: dismissSuggestion, toDraft } = useAutomationSuggestions();

const exportingIds = computed<IAutomation['id'][]>((): IAutomation['id'][] =>
	automations.value.filter((automation) => exporting(automation.id)).map((automation) => automation.id)
);

const showDrawer = ref<boolean>(false);
const showTemplateDialog = ref<boolean>(false);
const showImportDialog = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);
const remoteFormSaving = ref<boolean>(false);

// Moved when an open add form is discarded for a new one: the same route again is no navigation at all
const formGeneration = ref<number>(0);

// The add form takes its automation id and its template draft once, when it is set up: a draft generated while
// one is open is a new form, not the same one with another query
const detailKey = computed<string>((): string => {
	const draft = route.query[AUTOMATION_TEMPLATE_DRAFT_QUERY];

	return `${props.id ?? ''}:${typeof draft === 'string' ? draft : ''}:${formGeneration.value}`;
});

const isAutomationsListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.AUTOMATIONS;
});

// Template 4: forms open next to this page from tablet portrait up, as their own page on phone. After what its
// getter reads: the provider reads it at once
const { inDrawer } = provideEditDrawer((): boolean => !isAutomationsListRoute.value);

const list = ref<InstanceType<typeof ListAutomations> | null>(null);

// The phone app bar's Search action
const onSearch = (): void => {
	list.value?.focusSearch();
};

const isDetailRouteOpen = (): boolean => {
	return route.matched.find((matched) => matched.name === RouteNames.AUTOMATIONS_ADD || matched.name === RouteNames.AUTOMATIONS_EDIT) !== undefined;
};

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('automations.breadcrumbs.automations'),
				route: router.resolve({ name: RouteNames.AUTOMATIONS }),
			},
		];
	}
);

const navigate = (name: string, params?: { id: IAutomation['id'] }, query?: Record<string, string>): void => {
	if (inDrawer.value) {
		router.replace({ name, params, query });
	} else {
		router.push({ name, params, query });
	}
};

const onFormSaving = (saving: boolean): void => {
	remoteFormSaving.value = saving;
};

// Whether what the form in the drawer holds may be thrown away: at once when nothing was changed, otherwise
// when the user says so
const mayDiscardForm = async (): Promise<boolean> => {
	if (!remoteFormChanged.value) {
		return true;
	}

	try {
		await ElMessageBox.confirm(t('automations.texts.confirmDiscard'), t('automations.headings.discard'), {
			confirmButtonText: t('automations.buttons.yes.title'),
			cancelButtonText: t('automations.buttons.no.title'),
			type: 'warning',
		});

		return true;
	} catch {
		return false;
	}
};

// Another form takes the place of the one in the drawer only when that one may go: never while it is being
// saved, and after the same question closing the drawer asks when it holds changes. Asked before the template
// dialog opens, so a "no" leaves the form - and the flow it was generated with - as they are, and no new draft
// is made only to be thrown away.
const mayReplaceForm = async (): Promise<boolean> => {
	if (remoteFormSaving.value) {
		return false;
	}

	return mayDiscardForm();
};

const onCloseDrawer = (done?: () => void): void => {
	// A save on its way cannot be taken back, so the form stays until it is known how it went
	if (remoteFormSaving.value) {
		return;
	}

	mayDiscardForm().then((discard: boolean): void => {
		if (discard) {
			navigate(RouteNames.AUTOMATIONS);

			done?.();
		}
	});
};

// Next to a docked form the list stays usable: another automation replaces the open form only when that one may go
const onAutomationEdit = (id: IAutomation['id']): void => {
	if (router.resolve({ name: RouteNames.AUTOMATIONS_EDIT, params: { id } }).path === route.path) {
		return;
	}

	mayReplaceForm().then((replace: boolean): void => {
		if (replace) {
			navigate(RouteNames.AUTOMATIONS_EDIT, { id });
		}
	});
};

const onAutomationFlow = (id: IAutomation['id']): void => {
	// The flow editor is a page of its own, so the list stays in the history to come back to
	router.push({ name: RouteNames.AUTOMATIONS_FLOW, params: { id } });
};

const onAutomationRemove = (id: IAutomation['id']): void => {
	remove(id).catch((): void => {
		// The automation is gone from the list already
	});
};

const onAutomationToggleEnabled = (id: IAutomation['id'], enabled: boolean): void => {
	setEnabled(id, enabled).catch((): void => {
		// The automation is gone from the list already
	});
};

const onResetFilters = (): void => {
	resetFilter();
};

const onAutomationCreate = (): void => {
	mayReplaceForm().then((replace: boolean): void => {
		if (!replace) {
			return;
		}

		// Already on the add route: the form it shows was let go, so a new one takes its place. What the
		// discarded one reported is not about the new one, which starts unchanged.
		if (route.name === RouteNames.AUTOMATIONS_ADD) {
			formGeneration.value += 1;
			remoteFormChanged.value = false;
		}

		navigate(RouteNames.AUTOMATIONS_ADD);
	});
};

const onAutomationFromTemplate = (): void => {
	mayReplaceForm().then((replace: boolean): void => {
		if (replace) {
			showTemplateDialog.value = true;
		}
	});
};

// The generated flow waits under the id the new automation gets: the add form starts from its name and mode,
// and the editor opens with the flow once the automation is created
const onTemplateGenerated = (draftId: string): void => {
	navigate(RouteNames.AUTOMATIONS_ADD, undefined, { [AUTOMATION_TEMPLATE_DRAFT_QUERY]: draftId });
};

// A suggested automation opens the way a template draft does: its draft waits under the id the new automation gets,
// and nothing is created until the add form is saved
const onSuggestionOpen = (suggestion: IAutomationSuggestion): void => {
	mayReplaceForm().then((replace: boolean): void => {
		if (!replace) {
			return;
		}

		const draftId = uuid();

		stashAutomationDraft(draftId, toDraft(suggestion));

		navigate(RouteNames.AUTOMATIONS_ADD, undefined, { [AUTOMATION_TEMPLATE_DRAFT_QUERY]: draftId });
	});
};

const onSuggestionDismiss = (suggestion: IAutomationSuggestion): void => {
	void dismissSuggestion(suggestion.id);
};

const onAutomationExport = (id: IAutomation['id']): void => {
	void exportAutomation(id);
};

// Asked before the dialog opens, as for a template: the imported automation opens in its editor, which replaces the
// form in the drawer
const onAutomationImport = (): void => {
	mayReplaceForm().then((replace: boolean): void => {
		if (replace) {
			showImportDialog.value = true;
		}
	});
};

// The imported automation is created disabled; its flow opens in the editor to be checked before it is enabled
const onImported = (id: IAutomation['id']): void => {
	router.push({ name: RouteNames.AUTOMATIONS_FLOW, params: { id } });
};

const loadAutomations = (): void => {
	fetchAutomations().catch((): void => {
		// The list says so and offers to try again
	});
};

const onRetry = (): void => {
	loadAutomations();
};

onBeforeMount((): void => {
	loadAutomations();

	fetchSpaces().catch((): void => {
		// Spaces only name the column and the filter; the list works without them
	});

	// Never rejects: without Buddy there are simply no suggestions
	void fetchSuggestions();

	showDrawer.value = isDetailRouteOpen();
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value = isDetailRouteOpen();

		// What the form of the previous route reported is not about the next one: it starts unchanged
		remoteFormChanged.value = false;
		remoteFormSaving.value = false;
	}
);
</script>

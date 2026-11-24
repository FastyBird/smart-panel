<template>
	<view-header
		:title="page?.title ?? ''"
		:icon="pageIcon"
		left="close"
		:primary="{ label: t('dashboardModule.buttons.save.title'), handler: onSubmit }"
		@back="() => (remoteFormChanged ? onDiscard() : onClose())"
	/>

	<app-breadcrumbs :items="breadcrumbs" />

	<div
		v-loading="isLoading || page === null"
		:element-loading-text="t('dashboardModule.texts.pages.loadingPage')"
		class="flex flex-col overflow-hidden h-full"
	>
		<el-scrollbar
			v-if="page !== null"
			class="grow-1 p-2 tp:px-4"
		>
			<component
				:is="element?.components?.pageEditForm"
				v-if="typeof element?.components?.pageEditForm !== 'undefined'"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:page="page"
				:schema="formSchema"
			/>

			<page-edit-form
				v-else
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:page="page"
				:schema="formSchema"
			/>
		</el-scrollbar>

		<!-- Wherever the phone app bar is not there to carry Save: in the drawer, and on a page kept open past 720 px -->
		<form-footer
			v-if="page !== null"
			v-show="inDrawer || !isPhone"
			:dirty="remoteFormChanged"
			:saving="remoteFormResult === FormResult.WORKING"
			:can-save="remoteFormChanged && remoteFormResult === FormResult.NONE"
			@save="onSubmit"
			@discard="onDiscard"
			@close="onClose"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElMessageBox, ElScrollbar, vLoading } from 'element-plus';

import {
	AppBreadcrumbs,
	FormFooter,
	type IPlugin,
	type IPluginElement,
	ViewHeader,
	useEditDrawer,
	useFlashMessage,
	useSizeClass,
	useUuid,
} from '../../../common';
import { PageEditForm } from '../components/components';
import { usePage, usePageIcon, usePagesPlugins } from '../composables/composables';
import { FormResult, type FormResultType, RouteNames } from '../dashboard.constants';
import { DashboardApiException, DashboardException } from '../dashboard.exceptions';
import type { IPagePluginRoutes, IPagePluginsComponents, IPagePluginsSchemas } from '../dashboard.types';
import { PageEditFormSchema } from '../schemas/pages.schemas';
import type { IPage } from '../store/pages.store.types';

import type { IViewPageEditProps } from './view-page-edit.types';

defineOptions({
	name: 'ViewPageEdit',
});

const props = defineProps<IViewPageEditProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

// Template 4: in the drawer from tablet portrait up, its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();
const { meta } = useMeta({});
const flashMessage = useFlashMessage();

const { validate: validateUuid } = useUuid();

// Track if page was previously loaded to detect deletion
const wasPageLoaded = ref<boolean>(false);

const { page, isLoading, fetchPage } = usePage({ id: props.id });
const { icon: pageIcon } = usePageIcon({ id: props.id });

if (!validateUuid(props.id)) {
	throw new Error('Page identifier is not valid');
}

const { plugins } = usePagesPlugins();

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const isDetailRoute = computed<boolean>(
	(): boolean =>
		route.matched.find((matched) => {
			return matched.name === RouteNames.PAGE;
		}) !== undefined
);

const plugin = computed<IPlugin<IPagePluginsComponents, IPagePluginsSchemas, IPagePluginRoutes> | undefined>(() => {
	return plugins.value.find((plugin) => (plugin.elements ?? []).some((element) => element.type === page.value?.type));
});

const element = computed<IPluginElement<IPagePluginsComponents, IPagePluginsSchemas> | undefined>(() => {
	return (plugin.value?.elements ?? []).find((element) => element.type === page.value?.type);
});

const formSchema = computed<typeof PageEditFormSchema>((): typeof PageEditFormSchema => {
	if (element.value && element.value.schemas?.pageEditFormSchema) {
		return element.value.schemas?.pageEditFormSchema;
	}

	return PageEditFormSchema;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		const items = [
			{
				label: t('dashboardModule.breadcrumbs.pages.list'),
				route: router.resolve({ name: RouteNames.PAGES }),
			},
		];

		if (isDetailRoute.value) {
			items.push({
				label: t('dashboardModule.breadcrumbs.pages.detail', { page: page.value?.title }),
				route: router.resolve({ name: RouteNames.PAGE, params: { id: props.id } }),
			});
			items.push({
				label: t('dashboardModule.breadcrumbs.pages.edit', { page: page.value?.title }),
				route: router.resolve({ name: RouteNames.PAGE_EDIT, params: { id: props.id } }),
			});
		} else {
			items.push({
				label: t('dashboardModule.breadcrumbs.pages.edit', { page: page.value?.title }),
				route: router.resolve({ name: RouteNames.PAGES_EDIT, params: { id: props.id } }),
			});
		}

		return items;
	}
);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('dashboardModule.texts.misc.confirmDiscard'), t('dashboardModule.headings.misc.discard'), {
		confirmButtonText: t('dashboardModule.buttons.discard.title'),
		cancelButtonText: t('dashboardModule.buttons.keepEditing.title'),
		type: 'warning',
	})
		.then((): void => {
			if (isDetailRoute.value) {
				if (inDrawer.value) {
					router.replace({ name: RouteNames.PAGE, params: { id: props.id } });
				} else {
					router.push({ name: RouteNames.PAGE, params: { id: props.id } });
				}
			} else {
				if (inDrawer.value) {
					router.replace({ name: RouteNames.PAGES });
				} else {
					router.push({ name: RouteNames.PAGES });
				}
			}
		})
		.catch((): void => {
			// Just ignore it
		});
};

const onSubmit = (): void => {
	remoteFormSubmit.value = true;
};

const onClose = (): void => {
	if (isDetailRoute.value) {
		if (inDrawer.value) {
			router.replace({ name: RouteNames.PAGE, params: { id: props.id } });
		} else {
			router.push({ name: RouteNames.PAGE, params: { id: props.id } });
		}
	} else {
		if (inDrawer.value) {
			router.replace({ name: RouteNames.PAGES });
		} else {
			router.push({ name: RouteNames.PAGES });
		}
	}
};

onBeforeMount(async (): Promise<void> => {
	fetchPage()
		.then((): void => {
			if (!isLoading.value && page.value === null && !wasPageLoaded.value) {
				throw new DashboardException('Page not found');
			}
			// Mark as loaded if page was successfully fetched
			if (page.value !== null) {
				wasPageLoaded.value = true;
			}
		})
		.catch((error: unknown): void => {
			const err = error as Error;

			if (err instanceof DashboardApiException && err.code === 404) {
				throw new DashboardException('Page not found');
			} else {
				throw new DashboardException('Something went wrong', err);
			}
		});
});

onMounted((): void => {
	emit('update:remote-form-changed', remoteFormChanged.value);
});

watch(
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			if (isDetailRoute.value) {
				if (inDrawer.value) {
					router.replace({ name: RouteNames.PAGE, params: { id: props.id } });
				} else {
					router.push({ name: RouteNames.PAGE, params: { id: props.id } });
				}
			} else {
				if (inDrawer.value) {
					router.replace({ name: RouteNames.PAGES });
				} else {
					router.push({ name: RouteNames.PAGES });
				}
			}
		}
	}
);

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		// Only throw error if page was never loaded (initial load failed)
		if (!val && page.value === null && !wasPageLoaded.value) {
			throw new DashboardException('Page not found');
		}
	}
);

watch(
	(): IPage | null => page.value,
	(val: IPage | null): void => {
		if (val !== null) {
			wasPageLoaded.value = true;
			meta.title = t('dashboardModule.meta.pages.edit.title', { page: page.value?.title });
		} else if (wasPageLoaded.value && !isLoading.value) {
			// Page was previously loaded but is now null - it was deleted
			flashMessage.warning(t('dashboardModule.messages.pages.deletedWhileEditing'), { duration: 0 });
			// Redirect to pages list
			if (inDrawer.value) {
				router.replace({ name: RouteNames.PAGES });
			} else {
				router.push({ name: RouteNames.PAGES });
			}
		} else if (!isLoading.value && val === null && !wasPageLoaded.value) {
			// Page was never loaded - initial load failed
			throw new DashboardException('Page not found');
		}
	}
);

watch(
	(): boolean => remoteFormChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);
</script>

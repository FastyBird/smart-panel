<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				:icon="pageIcon"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ page?.title }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="() => (remoteFormChanged ? onDiscard() : onClose())"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onSubmit"
	>
		<span class="uppercase">{{ t('dashboardModule.buttons.save.title') }}</span>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<div
		v-loading="isLoading || page === null"
		:element-loading-text="t('dashboardModule.texts.pages.loadingPage')"
		class="flex flex-col overflow-hidden h-full"
	>
		<el-scrollbar
			v-if="page !== null"
			class="grow-1 p-2 md:px-4"
		>
			<component
				:is="plugin?.components?.pageEditForm"
				v-if="typeof plugin?.components?.pageEditForm !== 'undefined'"
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

		<div
			v-if="isMDDevice"
			class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 w-full h-[3rem]"
			style="background-color: var(--el-drawer-bg-color)"
		>
			<div class="p-2">
				<el-button
					v-if="remoteFormChanged"
					link
					class="mr-2"
					@click="onDiscard"
				>
					{{ t('dashboardModule.buttons.discard.title') }}
				</el-button>
				<el-button
					v-if="!remoteFormChanged"
					link
					class="mr-2"
					@click="onClose"
				>
					{{ t('dashboardModule.buttons.close.title') }}
				</el-button>

				<el-button
					:loading="remoteFormResult === FormResult.WORKING"
					:disabled="isLoading || remoteFormResult !== FormResult.NONE"
					type="primary"
					class="order-2"
					@click="onSubmit"
				>
					<template
						v-if="remoteFormResult === FormResult.OK || remoteFormResult === FormResult.ERROR"
						#icon
					>
						<icon
							v-if="remoteFormResult === FormResult.OK"
							icon="mdi:check-circle"
						/>
						<icon
							v-else-if="remoteFormResult === FormResult.ERROR"
							icon="mdi:cross-circle"
						/>
					</template>
					{{ t('dashboardModule.buttons.save.title') }}
				</el-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElIcon, ElMessageBox, ElScrollbar, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, type IPlugin, useBreakpoints, useUuid } from '../../../common';
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
const { meta } = useMeta({});

const { validate: validateUuid } = useUuid();

const { isMDDevice, isLGDevice } = useBreakpoints();

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
	return plugins.value.find((plugin) => plugin.type === page.value?.type);
});

const formSchema = computed<typeof PageEditFormSchema>((): typeof PageEditFormSchema => {
	if (plugin.value && plugin.value.schemas?.pageEditFormSchema) {
		return plugin.value.schemas?.pageEditFormSchema;
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
		confirmButtonText: t('dashboardModule.buttons.yes.title'),
		cancelButtonText: t('dashboardModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			if (isDetailRoute.value) {
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.PAGE, params: { id: props.id } });
				} else {
					router.push({ name: RouteNames.PAGE, params: { id: props.id } });
				}
			} else {
				if (isLGDevice.value) {
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
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.PAGE, params: { id: props.id } });
		} else {
			router.push({ name: RouteNames.PAGE, params: { id: props.id } });
		}
	} else {
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.PAGES });
		} else {
			router.push({ name: RouteNames.PAGES });
		}
	}
};

onBeforeMount(async (): Promise<void> => {
	fetchPage()
		.then((): void => {
			if (!isLoading.value && page.value === null) {
				throw new DashboardException('Page not found');
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
	(): boolean => isLoading.value,
	(val: boolean): void => {
		if (!val && page.value === null) {
			throw new DashboardException('Page not found');
		}
	}
);

watch(
	(): IPage | null => page.value,
	(val: IPage | null): void => {
		if (val !== null) {
			meta.title = t('dashboardModule.meta.pages.edit.title', { page: page.value?.title });
		}

		if (!isLoading.value && val === null) {
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

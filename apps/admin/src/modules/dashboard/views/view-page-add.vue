<template>
	<view-header
		:title="t('dashboardModule.headings.pages.add')"
		:subtitle="t('dashboardModule.subHeadings.pages.add')"
		icon="mdi:devices"
		left="close"
		:primary="selectedType ? { label: t('dashboardModule.buttons.save.title'), handler: onSubmit } : undefined"
		@back="() => (remoteFormChanged ? onDiscard() : onClose())"
	/>

	<app-breadcrumbs :items="breadcrumbs" />

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar class="grow-1 p-2 tp:px-4">
			<select-page-plugin v-model="selectedType" />

			<el-divider />

			<template v-if="selectedType">
				<component
					:is="element?.components?.pageAddForm"
					v-if="typeof element?.components?.pageAddForm !== 'undefined'"
					:id="newPageId"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-reset="remoteFormReset"
					v-model:remote-form-changed="remoteFormChanged"
					:schema="formSchema"
				/>

				<page-add-form
					v-else
					:id="newPageId"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-reset="remoteFormReset"
					v-model:remote-form-changed="remoteFormChanged"
					:type="selectedType"
					:schema="formSchema"
				/>
			</template>

			<el-alert
				v-else
				:title="t('dashboardModule.headings.pages.selectPlugin')"
				:description="t('dashboardModule.texts.pages.selectPlugin')"
				:closable="false"
				show-icon
				type="info"
			/>
		</el-scrollbar>

		<!-- Wherever the phone app bar is not there to carry Save: in the drawer, and on a page kept open past 720 px -->
		<form-footer
			v-show="inDrawer || !isPhone"
			:dirty="remoteFormChanged"
			:saving="remoteFormResult === FormResult.WORKING"
			:can-save="selectedType !== undefined && remoteFormResult === FormResult.NONE"
			@save="onSubmit"
			@discard="onDiscard"
			@close="onClose"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElAlert, ElDivider, ElMessageBox, ElScrollbar } from 'element-plus';

import { AppBreadcrumbs, FormFooter, type IPlugin, type IPluginElement, ViewHeader, useEditDrawer, useSizeClass, useUuid } from '../../../common';
import { PageAddForm } from '../components/components';
import SelectPagePlugin from '../components/pages/select-page-plugin.vue';
import { usePagesPlugins } from '../composables/usePagesPlugins';
import { FormResult, type FormResultType, RouteNames } from '../dashboard.constants';
import type { IPagePluginRoutes, IPagePluginsComponents, IPagePluginsSchemas } from '../dashboard.types';
import { PageAddFormSchema } from '../schemas/pages.schemas';

import type { IViewPageAddProps } from './view-page-add.types';

defineOptions({
	name: 'ViewPageAdd',
});

defineProps<IViewPageAddProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const router = useRouter();
const { t } = useI18n();

// Template 4: in the drawer from tablet portrait up, its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

useMeta({
	title: t('dashboardModule.meta.pages.add.title'),
});

const { generate: uuidGenerate } = useUuid();

const newPageId = uuidGenerate();

const { plugins } = usePagesPlugins();

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const selectedType = ref<string | undefined>(undefined);

const plugin = computed<IPlugin<IPagePluginsComponents, IPagePluginsSchemas, IPagePluginRoutes> | undefined>(() => {
	return plugins.value.find((plugin) => (plugin.elements ?? []).some((element) => element.type === selectedType.value));
});

const element = computed<IPluginElement<IPagePluginsComponents, IPagePluginsSchemas> | undefined>(() => {
	return (plugin.value?.elements ?? []).find((element) => element.type === selectedType.value);
});

const formSchema = computed<typeof PageAddFormSchema>((): typeof PageAddFormSchema => {
	if (element.value && element.value.schemas?.pageAddFormSchema) {
		return element.value.schemas?.pageAddFormSchema;
	}

	return PageAddFormSchema;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('dashboardModule.breadcrumbs.pages.list'),
				route: router.resolve({ name: RouteNames.PAGES }),
			},
			{
				label: t('dashboardModule.breadcrumbs.pages.add'),
				route: router.resolve({ name: RouteNames.PAGES_ADD }),
			},
		];
	}
);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('dashboardModule.texts.misc.confirmDiscard'), t('dashboardModule.headings.misc.discard'), {
		confirmButtonText: t('dashboardModule.buttons.discard.title'),
		cancelButtonText: t('dashboardModule.buttons.keepEditing.title'),
		type: 'warning',
	})
		.then((): void => {
			if (inDrawer.value) {
				router.replace({ name: RouteNames.PAGES });
			} else {
				router.push({ name: RouteNames.PAGES });
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
	if (inDrawer.value) {
		router.replace({ name: RouteNames.PAGES });
	} else {
		router.push({ name: RouteNames.PAGES });
	}
};

onMounted((): void => {
	emit('update:remote-form-changed', remoteFormChanged.value);
});

watch(
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			if (inDrawer.value) {
				router.replace({ name: RouteNames.PAGES });
			} else {
				router.push({ name: RouteNames.PAGES });
			}
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

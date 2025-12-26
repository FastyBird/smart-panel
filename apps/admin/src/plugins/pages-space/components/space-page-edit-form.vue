<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('dashboardModule.fields.pages.id.title')"
			prop="id"
		>
			<el-input
				v-model="model.id"
				:placeholder="t('dashboardModule.fields.pages.id.placeholder')"
				name="id"
				readonly
				disabled
			/>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.title.title')"
			prop="title"
		>
			<el-input
				v-model="model.title"
				:placeholder="t('dashboardModule.fields.pages.title.placeholder')"
				name="title"
				size="large"
			/>
		</el-form-item>

		<el-form-item
			:label="t('pagesSpacePlugin.fields.space.title')"
			prop="space"
		>
			<el-select
				v-model="model.space"
				:placeholder="t('pagesSpacePlugin.fields.space.placeholder')"
				name="space"
				:loading="loadingSpaces"
				filterable
			>
				<el-option
					v-for="item in spacesOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('pagesSpacePlugin.fields.viewMode.title')"
			prop="viewMode"
		>
			<el-select
				v-model="model.viewMode"
				:placeholder="t('pagesSpacePlugin.fields.viewMode.placeholder')"
				name="viewMode"
				clearable
			>
				<el-option
					value="simple"
					:label="t('pagesSpacePlugin.fields.viewMode.options.simple')"
				/>
				<el-option
					value="advanced"
					:label="t('pagesSpacePlugin.fields.viewMode.options.advanced')"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('pagesSpacePlugin.fields.quickActions.title')"
			prop="quickActions"
		>
			<el-select
				v-model="model.quickActions"
				:placeholder="t('pagesSpacePlugin.fields.quickActions.placeholder')"
				name="quickActions"
				multiple
				clearable
			>
				<el-option
					v-for="action in quickActionOptions"
					:key="action.value"
					:label="action.label"
					:value="action.value"
				/>
			</el-select>
			<el-text
				size="small"
				class="block mt-1 text-gray-500"
			>
				{{ t('pagesSpacePlugin.fields.quickActions.description') }}
			</el-text>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.icon.title')"
			prop="icon"
		>
			<icon-picker
				v-model="model.icon"
				:placeholder="t('dashboardModule.fields.pages.icon.placeholder')"
			/>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.order.title')"
			prop="order"
		>
			<el-input-number
				v-model="model.order"
				:placeholder="t('dashboardModule.fields.pages.order.placeholder')"
				name="order"
			/>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.showTopBar.title')"
			prop="showTopBar"
		>
			<el-switch
				v-model="model.showTopBar"
				name="showTopBar"
			/>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.displays.title')"
			:prop="['displays']"
		>
			<displays-multi-select
				v-model="model.displays"
				:placeholder="t('dashboardModule.fields.pages.displays.placeholder')"
			/>
			<el-text
				size="small"
				class="block mt-1 text-gray-500"
			>
				{{ t('dashboardModule.fields.pages.displays.description') }}
			</el-text>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect, ElSwitch, ElText, type FormRules } from 'element-plus';
import { orderBy } from 'natural-orderby';

import { IconPicker } from '../../../common';
import { DashboardException, FormResult, type FormResultType, type IPageEditFormProps, usePageEditForm } from '../../../modules/dashboard';
import { DisplaysMultiSelect } from '../../../modules/displays';
import { type ISpace, useSpaces } from '../../../modules/spaces';
import { QuickActionType } from '../pages-space.constants';
import type { ISpacePageEditForm } from '../schemas/pages.types';

defineOptions({
	name: 'SpacePageEditForm',
});

const props = withDefaults(defineProps<IPageEditFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();

const { model, formEl, formChanged, submit, formResult } = usePageEditForm<ISpacePageEditForm>({ page: props.page });

const { spaces, fetchSpaces, fetching: loadingSpaces } = useSpaces();

const rules = reactive<FormRules<ISpacePageEditForm>>({
	title: [{ required: true, message: t('dashboardModule.fields.pages.title.validation.required'), trigger: 'change' }],
	space: [{ required: true, message: t('pagesSpacePlugin.fields.space.validation.required'), trigger: 'change' }],
});

const spacesOptions = computed<{ value: ISpace['id']; label: string }[]>((): { value: ISpace['id']; label: string }[] => {
	return orderBy<ISpace>(spaces.value, [(space: ISpace) => space.name], ['asc']).map((space) => ({ value: space.id, label: space.name }));
});

const quickActionOptions = computed(() => [
	{ value: QuickActionType.LIGHTING_OFF, label: t('pagesSpacePlugin.fields.quickActions.options.lighting_off') },
	{ value: QuickActionType.LIGHTING_WORK, label: t('pagesSpacePlugin.fields.quickActions.options.lighting_work') },
	{ value: QuickActionType.LIGHTING_RELAX, label: t('pagesSpacePlugin.fields.quickActions.options.lighting_relax') },
	{ value: QuickActionType.LIGHTING_NIGHT, label: t('pagesSpacePlugin.fields.quickActions.options.lighting_night') },
	{ value: QuickActionType.BRIGHTNESS_UP, label: t('pagesSpacePlugin.fields.quickActions.options.brightness_up') },
	{ value: QuickActionType.BRIGHTNESS_DOWN, label: t('pagesSpacePlugin.fields.quickActions.options.brightness_down') },
	{ value: QuickActionType.CLIMATE_UP, label: t('pagesSpacePlugin.fields.quickActions.options.climate_up') },
	{ value: QuickActionType.CLIMATE_DOWN, label: t('pagesSpacePlugin.fields.quickActions.options.climate_down') },
]);

onBeforeMount((): void => {
	if (!loadingSpaces.value) {
		fetchSpaces().catch((error: unknown): void => {
			const err = error as Error;

			throw new DashboardException('Something went wrong', err);
		});
	}
});

watch(
	(): FormResultType => formResult.value,
	async (val: FormResultType): Promise<void> => {
		emit('update:remote-form-result', val);
	}
);

watch(
	(): boolean => props.remoteFormSubmit,
	async (val: boolean): Promise<void> => {
		if (val) {
			emit('update:remote-form-submit', false);

			submit().catch(() => {
				// The form is not valid
			});
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remote-form-reset', false);

		if (val) {
			if (!formEl.value) return;

			formEl.value.resetFields();
		}
	}
);

watch(
	(): boolean => formChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);
</script>

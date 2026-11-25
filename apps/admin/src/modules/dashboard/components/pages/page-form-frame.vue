<template>
	<!-- eslint-disable vue/no-mutating-props -- the form owns its reactive model; the frame edits the shared fields in place -->
	<!-- Host frame of a page form (spec section 7): General first, the plugin's sections, Identifiers last.
	     It sits inside the form's own el-form, so the form's rules and validation reach these fields -->
	<plugin-form-section
		:title="t('dashboardModule.sections.general')"
		data-test-id="page-form-general"
	>
		<el-form-item
			:label="t('dashboardModule.fields.pages.title.title')"
			prop="title"
		>
			<el-input
				v-model="props.model.title"
				:placeholder="t('dashboardModule.fields.pages.title.placeholder')"
				name="title"
			/>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.icon.title')"
			prop="icon"
		>
			<icon-picker
				v-model="props.model.icon"
				:placeholder="t('dashboardModule.fields.pages.icon.placeholder')"
			/>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.order.title')"
			prop="order"
		>
			<el-input-number
				v-model="props.model.order"
				:placeholder="t('dashboardModule.fields.pages.order.placeholder')"
				name="order"
			/>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.showTopBar.title')"
			prop="showTopBar"
			label-position="left"
		>
			<el-switch
				v-model="props.model.showTopBar"
				name="showTopBar"
			/>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.displays.title')"
			prop="displays"
		>
			<displays-multi-select
				v-model="props.model.displays"
				:placeholder="t('dashboardModule.fields.pages.displays.placeholder')"
			/>
			<div class="text-help mt-1">
				{{ t('dashboardModule.fields.pages.displays.description') }}
			</div>
		</el-form-item>
	</plugin-form-section>

	<!-- The plugin's own sections -->
	<slot />

	<plugin-form-section
		:title="t('dashboardModule.sections.identifiers')"
		data-test-id="page-form-identifiers"
	>
		<el-form-item
			:label="t('dashboardModule.fields.pages.id.title')"
			prop="id"
		>
			<el-input
				v-model="props.model.id"
				:placeholder="t('dashboardModule.fields.pages.id.placeholder')"
				name="id"
				readonly
				disabled
			/>
		</el-form-item>
	</plugin-form-section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElFormItem, ElInput, ElInputNumber, ElSwitch } from 'element-plus';

import { IconPicker, PluginFormSection } from '../../../../common';
import { DisplaysMultiSelect } from '../../../displays';

import type { IPageFormFrameProps } from './page-form-frame.types';

defineOptions({
	name: 'PageFormFrame',
});

const props = defineProps<IPageFormFrameProps>();

const { t } = useI18n();
</script>

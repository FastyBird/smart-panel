<template>
	<!-- eslint-disable vue/no-mutating-props -- the form owns its reactive model; the frame edits the shared fields in place -->
	<!-- Host frame of a data source form (spec section 7): the plugin's sections, Identifiers last.
	     It sits inside the form's own el-form, so the form's rules and validation reach these fields -->
	<slot />

	<plugin-form-section
		:title="t('dashboardModule.sections.identifiers')"
		data-test-id="data-source-form-identifiers"
	>
		<el-form-item
			:label="t('dashboardModule.fields.dataSources.id.title')"
			prop="id"
		>
			<el-input
				v-model="props.model.id"
				:placeholder="t('dashboardModule.fields.dataSources.id.placeholder')"
				name="id"
				readonly
				disabled
			/>
		</el-form-item>
	</plugin-form-section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElFormItem, ElInput } from 'element-plus';

import { PluginFormSection } from '../../../../common';

import type { IDataSourceFormFrameProps } from './data-source-form-frame.types';

defineOptions({
	name: 'DataSourceFormFrame',
});

const props = defineProps<IDataSourceFormFrameProps>();

const { t } = useI18n();
</script>

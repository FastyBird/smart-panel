<template>
	<el-form
		ref="formEl"
		:model="model"
		:label-position="props.layout === Layout.PHONE ? 'top' : 'right'"
		:label-width="180"
		status-icon
		:class="[ns.b()]"
	>
		<el-form-item
			:label="t('configModule.fields.logLevels.title')"
			prop="logLevels"
		>
			<el-select
				v-model="model.logLevels"
				name="logLevels"
				multiple
				filterable
				allow-create
				default-first-option
				:reserve-keyword="false"
				:placeholder="t('configModule.fields.logLevels.placeholder')"
			>
				<el-option
					v-for="item in logLevelsOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>

				<template #tag>
					<el-tag
						v-for="type in model.logLevels"
						:key="type"
						v-bind="tagPropsFor(type)"
					>
						{{ t(`configModule.logLevels.${type}`) }}
					</el-tag>
				</template>
			</el-select>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElOption, ElSelect, ElTag, useNamespace } from 'element-plus';

import { SystemModuleLogEntryType } from '../../../openapi.constants';
import { useConfigSystemEditForm } from '../composables/composables';
import { FormResult, type FormResultType, Layout } from '../config.constants';

import type { IConfigSystemFormProps } from './config-system-form.types';

defineOptions({
	name: 'ConfigSystemForm',
});

const props = withDefaults(defineProps<IConfigSystemFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
	layout: Layout.DEFAULT,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const ns = useNamespace('config-system-form');
const { t } = useI18n();

const { logLevelsOptions, model, formEl, formChanged, submit, formResult } = useConfigSystemEditForm({
	config: props.config,
});

const tagPropsFor = (lvl: SystemModuleLogEntryType) => {
	const s = lvl.toLowerCase();

	if (['fatal', 'error', 'fail'].includes(s)) {
		return { type: 'danger' as const, effect: 'light' as const };
	}

	if (['warn', 'box'].includes(s)) {
		return { type: 'warning' as const, effect: 'light' as const };
	}

	if (['success', 'ready', 'start', 'info', 'log'].includes(s)) {
		return { type: 'success' as const, effect: 'light' as const };
	}

	return {
		effect: 'plain' as const,
		class: 'tag-neutral',
	};
};

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

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'config-system-form.scss';
</style>

<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<div
			v-loading="loadingChannels"
			:element-loading-text="t('devicesModule.texts.channels.loadingChannels')"
		>
			<el-form-item
				:label="t('devicesModule.fields.channelsProperties.channel.title')"
				:prop="['channel']"
			>
				<el-select
					v-model="model.channel"
					:placeholder="t('devicesModule.fields.channelsProperties.channel.placeholder')"
					name="channel"
					size="large"
					filterable
					readonly
					disabled
				>
					<el-option
						v-for="item in channelsOptions"
						:key="item.value"
						:label="item.label"
						:value="item.value"
					/>
				</el-select>
			</el-form-item>

			<el-alert
				v-if="channel"
				type="info"
				:title="t('devicesModule.fields.channelsProperties.channel.description')"
				:description="t(`devicesModule.texts.channels.description.${channel.category}`)"
				:closable="false"
				show-icon
			/>
		</div>

		<el-divider />

		<el-form-item
			:label="t('devicesModule.fields.channelsProperties.id.title')"
			:prop="['id']"
		>
			<el-input
				v-model="model.id"
				:placeholder="t('devicesModule.fields.channelsProperties.id.placeholder')"
				name="id"
				readonly
				disabled
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesModule.fields.channelsProperties.name.title')"
			:prop="['name']"
		>
			<el-input
				v-model="model.name"
				:placeholder="t('devicesModule.fields.channelsProperties.name.placeholder')"
				name="name"
				size="large"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesModule.fields.channelsProperties.category.title')"
			:prop="['category']"
		>
			<el-select
				v-model="model.category"
				:placeholder="t('devicesModule.fields.channelsProperties.category.placeholder')"
				name="category"
				size="large"
				filterable
			>
				<el-option
					v-for="item in categoriesOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('devicesModule.fields.channelsProperties.permissions.title')"
			:prop="['permissions']"
		>
			<el-select
				v-model="model.permissions"
				:placeholder="t('devicesModule.fields.channelsProperties.permissions.placeholder')"
				name="permissions"
				multiple
			>
				<el-option
					v-for="item in permissionsOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('devicesModule.fields.channelsProperties.dataType.title')"
			:prop="['dataType']"
		>
			<el-select
				v-model="model.dataType"
				:placeholder="t('devicesModule.fields.channelsProperties.dataType.placeholder')"
				name="dataType"
			>
				<el-option
					v-for="item in dataTypesOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-alert
			v-if="model.dataType"
			type="info"
			:closable="false"
		>
			{{ t(`devicesModule.texts.channelsProperties.dataTypes.${model.dataType}`) }}
		</el-alert>

		<el-form-item
			:label="t('devicesModule.fields.channelsProperties.unit.title')"
			:prop="['unit']"
		>
			<el-input
				v-model="model.unit"
				:placeholder="t('devicesModule.fields.channelsProperties.unit.placeholder')"
				name="unit"
			/>
		</el-form-item>

		<div
			v-if="
				[
					DevicesModuleChannelPropertyData_type.char,
					DevicesModuleChannelPropertyData_type.uchar,
					DevicesModuleChannelPropertyData_type.short,
					DevicesModuleChannelPropertyData_type.ushort,
					DevicesModuleChannelPropertyData_type.int,
					DevicesModuleChannelPropertyData_type.uint,
					DevicesModuleChannelPropertyData_type.float,
				].includes(model.dataType)
			"
			class="flex flex-row gap-4"
		>
			<el-form-item
				:label="t('devicesModule.fields.channelsProperties.format.title.min')"
				:prop="['format']"
				class="grow-1"
			>
				<el-input
					v-model="model.minValue"
					:placeholder="t('devicesModule.fields.channelsProperties.format.placeholder.min')"
					name="format"
				/>
			</el-form-item>

			<el-form-item
				:label="t('devicesModule.fields.channelsProperties.format.title.max')"
				:prop="['format']"
				class="grow-1"
			>
				<el-input
					v-model="model.maxValue"
					:placeholder="t('devicesModule.fields.channelsProperties.format.placeholder.max')"
					name="format"
				/>
			</el-form-item>
		</div>

		<el-form-item
			v-if="[DevicesModuleChannelPropertyData_type.enum].includes(model.dataType)"
			:label="t('devicesModule.fields.channelsProperties.format.title.enum')"
			:prop="['format']"
		>
			<el-input-tag
				v-model="model.enumValues"
				:placeholder="t('devicesModule.fields.channelsProperties.format.placeholder.enum')"
				name="format"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesModule.fields.channelsProperties.invalid.title')"
			:prop="['invalid']"
		>
			<el-input
				v-model="model.invalid as string | number | null"
				:placeholder="t('devicesModule.fields.channelsProperties.invalid.placeholder')"
				name="invalid"
			/>
		</el-form-item>

		<el-form-item
			v-if="
				[
					DevicesModuleChannelPropertyData_type.char,
					DevicesModuleChannelPropertyData_type.uchar,
					DevicesModuleChannelPropertyData_type.short,
					DevicesModuleChannelPropertyData_type.ushort,
					DevicesModuleChannelPropertyData_type.int,
					DevicesModuleChannelPropertyData_type.uint,
					DevicesModuleChannelPropertyData_type.float,
				].includes(model.dataType)
			"
			:label="t('devicesModule.fields.channelsProperties.step.title')"
			:prop="['step']"
		>
			<el-input
				v-model="model.step"
				:placeholder="t('devicesModule.fields.channelsProperties.step.placeholder')"
				name="step"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElInput, ElInputTag, ElOption, ElSelect, type FormRules, vLoading } from 'element-plus';

import { DevicesModuleChannelPropertyData_type } from '../../../../openapi';
import { useChannelPropertyAddForm } from '../../composables/composables';
import { FormResult, type FormResultType } from '../../devices.constants';
import type { IChannelPropertyAddForm } from '../../schemas/channels.properties.types';

import type { IChannelPropertyAddFormProps } from './channel-property-add-form.types';

defineOptions({
	name: 'ChannelPropertyAddForm',
});

const props = withDefaults(defineProps<IChannelPropertyAddFormProps>(), {
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

const { categoriesOptions, channelsOptions, permissionsOptions, dataTypesOptions, formEl, model, formChanged, submit, formResult, loadingChannels } =
	useChannelPropertyAddForm({ id: props.id, type: props.type, channelId: props.channel?.id });

const rules = reactive<FormRules<IChannelPropertyAddForm>>({
	channel: [{ required: true, message: t('devicesModule.fields.channelsProperties.channel.validation.required'), trigger: 'change' }],
	category: [{ required: true, message: t('devicesModule.fields.channelsProperties.category.validation.required'), trigger: 'change' }],
	permissions: [{ required: true, message: t('devicesModule.fields.channelsProperties.permissions.validation.required'), trigger: 'change' }],
	dataType: [{ required: true, message: t('devicesModule.fields.channelsProperties.dataType.validation.required'), trigger: 'change' }],
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

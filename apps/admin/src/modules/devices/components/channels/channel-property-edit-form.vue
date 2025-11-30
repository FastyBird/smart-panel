<template>
	<el-form
		ref="formEl"
		:model="model"
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
				readonly
				disabled
			>
				<el-option
					v-for="item in categoriesOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<channel-property-form-permissions
			:key="`${channel?.category || DevicesModuleChannelCategory.generic}-${model.category}-permissions`"
			v-model="model.permissions"
			:permissions-options="permissionsOptions"
			:channel-category="channel?.category || DevicesModuleChannelCategory.generic"
			:property-category="model.category"
			disabled
		/>

		<channel-property-form-data-type
			:key="`${channel?.category || DevicesModuleChannelCategory.generic}-${model.category}-dataType`"
			v-model="model.dataType"
			:data-types-options="dataTypesOptions"
			:channel-category="channel?.category || DevicesModuleChannelCategory.generic"
			:property-category="model.category"
			disabled
		/>

		<channel-property-form-unit
			:key="`${channel?.category || DevicesModuleChannelCategory.generic}-${model.category}-unit`"
			v-model="model.unit"
			:channel-category="channel?.category || DevicesModuleChannelCategory.generic"
			:property-category="model.category"
		/>

		<channel-property-form-min-max
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
			:key="`${channel?.category || DevicesModuleChannelCategory.generic}-${model.category}-min-max`"
			v-model:min-value="model.minValue"
			v-model:max-value="model.maxValue"
			:channel-category="channel?.category || DevicesModuleChannelCategory.generic"
			:property-category="model.category"
		/>

		<channel-property-form-enum
			v-if="[DevicesModuleChannelPropertyData_type.enum].includes(model.dataType)"
			:key="`${channel?.category || DevicesModuleChannelCategory.generic}-${model.category}-enum`"
			v-model="model.enumValues"
			:channel-category="channel?.category || DevicesModuleChannelCategory.generic"
			:property-category="model.category"
		/>

		<channel-property-form-invalid
			:key="`${channel?.category || DevicesModuleChannelCategory.generic}-${model.category}-invalid`"
			v-model="model.invalid"
			:channel-category="channel?.category || DevicesModuleChannelCategory.generic"
			:property-category="model.category"
		/>

		<channel-property-form-step
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
			:key="`${channel?.category || DevicesModuleChannelCategory.generic}-${model.category}-step`"
			v-model="model.step"
			:channel-category="channel?.category || DevicesModuleChannelCategory.generic"
			:property-category="model.category"
		/>

		<el-divider />

		<el-form-item
			:label="t('devicesModule.fields.channelsProperties.enterValue.title')"
			label-position="left"
		>
			<el-switch v-model="model.enterValue" />
		</el-form-item>

		<el-alert
			v-if="model.enterValue"
			type="warning"
			:description="t('devicesModule.texts.channelsProperties.editValue')"
			:closable="false"
			show-icon
		/>

		<el-form-item
			v-if="model.enterValue"
			:label="t('devicesModule.fields.channelsProperties.value.title')"
			:prop="['value']"
			class="mt-2"
		>
			<el-input
				v-model="model.value as string"
				:placeholder="t('devicesModule.fields.channelsProperties.value.placeholder')"
				name="value"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElSwitch, vLoading } from 'element-plus';

import { DevicesModuleChannelCategory, DevicesModuleChannelPropertyData_type } from '../../../../openapi.constants';
import { useChannel, useChannelPropertyEditForm } from '../../composables/composables';
import { FormResult, type FormResultType } from '../../devices.constants';

import type { IChannelPropertyEditFormProps } from './channel-property-edit-form.types';
import ChannelPropertyFormDataType from './channel-property-form-data-type.vue';
import ChannelPropertyFormEnum from './channel-property-form-enum.vue';
import ChannelPropertyFormInvalid from './channel-property-form-invalid.vue';
import ChannelPropertyFormMinMax from './channel-property-form-min-max.vue';
import ChannelPropertyFormPermissions from './channel-property-form-permissions.vue';
import ChannelPropertyFormStep from './channel-property-form-step.vue';
import ChannelPropertyFormUnit from './channel-property-form-unit.vue';

defineOptions({
	name: 'ChannelPropertyEditForm',
});

const props = withDefaults(defineProps<IChannelPropertyEditFormProps>(), {
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
	useChannelPropertyEditForm({ property: props.property });
const { channel } = useChannel({ id: props.property.channel });

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

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
				:label="t('devicesHomeAssistantPlugin.fields.channelsProperties.channel.title')"
				:prop="['channel']"
			>
				<el-select
					v-model="model.channel"
					:placeholder="t('devicesHomeAssistantPlugin.fields.channelsProperties.channel.placeholder')"
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
			:label="t('devicesHomeAssistantPlugin.fields.channelsProperties.id.title')"
			:prop="['id']"
		>
			<el-input
				v-model="model.id"
				:placeholder="t('devicesHomeAssistantPlugin.fields.channelsProperties.id.placeholder')"
				name="id"
				readonly
				disabled
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.channelsProperties.name.title')"
			:prop="['name']"
		>
			<el-input
				v-model="model.name"
				:placeholder="t('devicesHomeAssistantPlugin.fields.channelsProperties.name.placeholder')"
				name="name"
				size="large"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.channelsProperties.category.title')"
			:prop="['category']"
		>
			<el-select
				v-model="model.category"
				:placeholder="t('devicesHomeAssistantPlugin.fields.channelsProperties.category.placeholder')"
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

		<channel-property-form-permissions
			:key="`${channel?.category || DevicesModuleChannelCategory.generic}-${model.category}-permissions`"
			v-model="model.permissions"
			:permissions-options="permissionsOptions"
			:channel-category="channel?.category || DevicesModuleChannelCategory.generic"
			:property-category="model.category"
		/>

		<channel-property-form-data-type
			:key="`${channel?.category || DevicesModuleChannelCategory.generic}-${model.category}-dataType`"
			v-model="model.dataType"
			:data-types-options="dataTypesOptions"
			:channel-category="channel?.category || DevicesModuleChannelCategory.generic"
			:property-category="model.category"
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

		<template v-if="haDeviceId">
			<el-divider />

			<el-form-item
				:label="t('devicesHomeAssistantPlugin.fields.channelsProperties.haEntityId.title')"
				:prop="['haEntityId']"
			>
				<select-discovered-device-entity
					v-model="model.haEntityId"
					:device-id="haDeviceId"
				/>
			</el-form-item>
		</template>

		<template v-if="model.haEntityId">
			<el-divider />

			<el-form-item
				:label="t('devicesHomeAssistantPlugin.fields.channelsProperties.haAttribute.title')"
				:prop="['haAttribute']"
			>
				<select-entity-attribute
					v-model="model.haAttribute"
					:entity-id="model.haEntityId"
				/>
			</el-form-item>
		</template>

		<el-divider />

		<el-form-item
			:label="t('devicesModule.fields.channelsProperties.enterValue.title')"
			label-position="left"
		>
			<el-switch v-model="enterValue" />
		</el-form-item>

		<el-alert
			v-if="enterValue"
			type="warning"
			:description="t('devicesModule.texts.channelsProperties.editValue')"
			:closable="false"
			show-icon
		/>

		<el-form-item
			v-if="enterValue"
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
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElSwitch, type FormRules, vLoading } from 'element-plus';

import {
	ChannelPropertyFormDataType,
	ChannelPropertyFormEnum,
	ChannelPropertyFormInvalid,
	ChannelPropertyFormMinMax,
	ChannelPropertyFormPermissions,
	ChannelPropertyFormStep,
	ChannelPropertyFormUnit,
	FormResult,
	type FormResultType,
	useChannelPropertyAddForm,
	useDevices,
} from '../../../modules/devices';
import { DevicesModuleChannelCategory, DevicesModuleChannelPropertyData_type } from '../../../openapi';
import type { IHomeAssistantChannelPropertyAddForm } from '../schemas/channels.properties.types';
import type { IHomeAssistantDevice } from '../store/devices.store.types';

import type { IHomeAssistantChannelPropertyAddFormProps } from './home-assistant-channel-property-add-form.types';
import SelectDiscoveredDeviceEntity from './select-discovered-device-entity.vue';
import SelectEntityAttribute from './select-entity-attribute.vue';

defineOptions({
	name: 'HomeAssistantChannelPropertyAddForm',
});

const props = withDefaults(defineProps<IHomeAssistantChannelPropertyAddFormProps>(), {
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

const { devices } = useDevices();
const { categoriesOptions, channelsOptions, permissionsOptions, dataTypesOptions, formEl, model, formChanged, submit, formResult, loadingChannels } =
	useChannelPropertyAddForm<IHomeAssistantChannelPropertyAddForm>({ id: props.id, type: props.type, channelId: props.channel?.id });

const enterValue = ref<boolean>(false);

const haDeviceId = computed<IHomeAssistantDevice['haDeviceId'] | undefined>((): IHomeAssistantDevice['haDeviceId'] | undefined => {
	const device = devices.value.find((device) => device.id === props.channel?.device);

	return device && 'haDeviceId' in device && typeof device.haDeviceId === 'string' ? device.haDeviceId : undefined;
});

const rules = reactive<FormRules<IHomeAssistantChannelPropertyAddForm>>({
	channel: [{ required: true, message: t('devicesHomeAssistantPlugin.fields.channelsProperties.channel.validation.required'), trigger: 'change' }],
	category: [{ required: true, message: t('devicesHomeAssistantPlugin.fields.channelsProperties.category.validation.required'), trigger: 'change' }],
	permissions: [
		{ required: true, message: t('devicesHomeAssistantPlugin.fields.channelsProperties.permissions.validation.required'), trigger: 'change' },
	],
	dataType: [{ required: true, message: t('devicesHomeAssistantPlugin.fields.channelsProperties.dataType.validation.required'), trigger: 'change' }],
	haEntityId: [
		{ required: true, message: t('devicesHomeAssistantPlugin.fields.channelsProperties.haEntityId.validation.required'), trigger: 'change' },
	],
	haAttribute: [
		{ required: true, message: t('devicesHomeAssistantPlugin.fields.channelsProperties.haAttribute.validation.required'), trigger: 'change' },
	],
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

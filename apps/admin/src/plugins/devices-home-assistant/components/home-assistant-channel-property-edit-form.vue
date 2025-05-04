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
				:label="t('devicesHomeAssistantPlugin.fields.channelsProperties.channel.title')"
				:prop="['channel']"
			>
				<el-select
					v-model="model.channel"
					:placeholder="t('devicesHomeAssistantPlugin.fields.channelsProperties.channel.placeholder')"
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

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.channelsProperties.permissions.title')"
			:prop="['permissions']"
		>
			<el-select
				v-model="model.permissions"
				:placeholder="t('devicesHomeAssistantPlugin.fields.channelsProperties.permissions.placeholder')"
				name="permissions"
				multiple
				readonly
				disabled
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
			:label="t('devicesHomeAssistantPlugin.fields.channelsProperties.dataType.title')"
			:prop="['dataType']"
		>
			<el-select
				v-model="model.dataType"
				:placeholder="t('devicesHomeAssistantPlugin.fields.channelsProperties.dataType.placeholder')"
				name="dataType"
				readonly
				disabled
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
			type="info"
			:closable="false"
		>
			{{ t(`devicesModule.texts.channelsProperties.dataTypes.${props.property.dataType}`) }}
		</el-alert>

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.channelsProperties.unit.title')"
			:prop="['unit']"
			class="mt-2"
		>
			<el-input
				v-model="model.unit"
				:placeholder="t('devicesHomeAssistantPlugin.fields.channelsProperties.unit.placeholder')"
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
				].includes(props.property.dataType)
			"
			class="flex flex-row gap-4"
		>
			<el-form-item
				:label="t('devicesHomeAssistantPlugin.fields.channelsProperties.format.title.min')"
				:prop="['format']"
				class="grow-1"
			>
				<el-input
					v-model="model.minValue"
					:placeholder="t('devicesHomeAssistantPlugin.fields.channelsProperties.format.placeholder.min')"
					name="format"
				/>
			</el-form-item>

			<el-form-item
				:label="t('devicesHomeAssistantPlugin.fields.channelsProperties.format.title.max')"
				:prop="['format']"
				class="grow-1"
			>
				<el-input
					v-model="model.maxValue"
					:placeholder="t('devicesHomeAssistantPlugin.fields.channelsProperties.format.placeholder.max')"
					name="format"
				/>
			</el-form-item>
		</div>

		<el-form-item
			v-if="[DevicesModuleChannelPropertyData_type.enum].includes(props.property.dataType)"
			:label="t('devicesHomeAssistantPlugin.fields.channelsProperties.format.title.enum')"
			:prop="['format']"
		>
			<el-input-tag
				v-model="model.enumValues"
				:placeholder="t('devicesHomeAssistantPlugin.fields.channelsProperties.format.placeholder.enum')"
				name="format"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesHomeAssistantPlugin.fields.channelsProperties.invalid.title')"
			:prop="['invalid']"
		>
			<el-input
				v-model="model.invalid as string | number | null"
				:placeholder="t('devicesHomeAssistantPlugin.fields.channelsProperties.invalid.placeholder')"
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
				].includes(props.property.dataType)
			"
			:label="t('devicesHomeAssistantPlugin.fields.channelsProperties.step.title')"
			:prop="['step']"
		>
			<el-input
				v-model="model.step"
				:placeholder="t('devicesHomeAssistantPlugin.fields.channelsProperties.step.placeholder')"
				name="step"
			/>
		</el-form-item>

		<template v-if="haEntityId">
			<el-divider />

			<el-form-item
				:label="t('devicesHomeAssistantPlugin.fields.channelsProperties.haAttribute.title')"
				:prop="['haAttribute']"
			>
				<select-entity-attribute
					v-model="model.haAttribute"
					:entity-id="haEntityId"
					disabled
				/>
			</el-form-item>
		</template>
	</el-form>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider, ElForm, ElFormItem, ElInput, ElInputTag, ElOption, ElSelect, vLoading } from 'element-plus';

import { FormResult, type FormResultType, useChannel, useChannelPropertyEditForm } from '../../../modules/devices';
import { DevicesModuleChannelPropertyData_type } from '../../../openapi';
import type { IHomeAssistantChannelPropertyEditForm } from '../schemas/channels.properties.types';
import type { IHomeAssistantState } from '../store/home-assistant-states.store.types';

import type { IHomeAssistantChannelPropertyEditFormProps } from './home-assistant-channel-property-edit-form.types';
import SelectEntityAttribute from './select-entity-attribute.vue';

defineOptions({
	name: 'HomeAssistantChannelPropertyEditForm',
});

const props = withDefaults(defineProps<IHomeAssistantChannelPropertyEditFormProps>(), {
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
	useChannelPropertyEditForm<IHomeAssistantChannelPropertyEditForm>({ property: props.property });
const { channel } = useChannel({ id: props.property.channel });

const haEntityId = computed<IHomeAssistantState['entityId'] | undefined>((): IHomeAssistantState['entityId'] | undefined => {
	return channel.value && 'haEntityId' in channel.value && typeof channel.value.haEntityId === 'string' ? channel.value.haEntityId : undefined;
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

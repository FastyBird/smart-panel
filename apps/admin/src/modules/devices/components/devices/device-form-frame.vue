<template>
	<!-- eslint-disable vue/no-mutating-props -- the form owns its reactive model; the frame edits the shared fields in place -->
	<!-- Host frame of a device form (spec section 7): General first, the plugin's connection section, Identifiers last.
	     It sits inside the form's own el-form, so the form's rules and validation reach these fields -->
	<plugin-form-section
		:title="t('devicesModule.sections.general')"
		data-test-id="device-form-general"
	>
		<el-form-item
			:label="t('devicesModule.fields.devices.name.title')"
			prop="name"
		>
			<el-input
				v-model="props.model.name"
				:placeholder="t('devicesModule.fields.devices.name.placeholder')"
				name="name"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesModule.fields.devices.category.title')"
			prop="category"
		>
			<el-select
				v-model="props.model.category"
				:placeholder="t('devicesModule.fields.devices.category.placeholder')"
				:disabled="props.mode === 'edit'"
				name="category"
				filterable
			>
				<el-option
					v-for="item in props.categoriesOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
		</el-form-item>

		<el-alert
			v-if="props.model.category"
			type="info"
			:title="t('devicesModule.fields.devices.category.description')"
			:description="t(`devicesModule.texts.devices.description.${props.model.category}`)"
			:closable="false"
			show-icon
		/>

		<el-form-item
			v-if="props.mode === 'edit'"
			:label="t('devicesModule.fields.devices.room.title')"
			prop="roomId"
		>
			<space-select
				v-model="props.model.roomId"
				:placeholder="t('devicesModule.fields.devices.room.placeholder')"
				filter="room"
			/>
			<div class="text-help mt-1">
				{{ t('devicesModule.fields.devices.room.hint') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('devicesModule.fields.devices.enabled.title')"
			prop="enabled"
			label-position="left"
		>
			<el-switch
				v-model="props.model.enabled"
				name="enabled"
			/>
		</el-form-item>

		<el-form-item
			:label="t('devicesModule.fields.devices.description.title')"
			prop="description"
		>
			<el-input
				v-model="props.model.description"
				:placeholder="t('devicesModule.fields.devices.description.placeholder')"
				:rows="4"
				type="textarea"
				name="description"
			/>
		</el-form-item>
	</plugin-form-section>

	<!-- The plugin's "<Integration> connection" section -->
	<slot />

	<plugin-form-section
		v-if="props.showId || props.identifier !== 'hidden'"
		:title="t('devicesModule.sections.identifiers')"
		data-test-id="device-form-identifiers"
	>
		<el-form-item
			v-if="props.showId"
			:label="t('devicesModule.fields.devices.id.title')"
			prop="id"
		>
			<el-input
				v-model="props.model.id"
				:placeholder="t('devicesModule.fields.devices.id.placeholder')"
				name="id"
				readonly
				disabled
			/>
		</el-form-item>

		<el-form-item
			v-if="props.identifier !== 'hidden'"
			:label="t('devicesModule.fields.devices.identifier.title')"
			prop="identifier"
		>
			<el-input
				v-model="props.model.identifier"
				:placeholder="t('devicesModule.fields.devices.identifier.placeholder')"
				:readonly="props.identifier === 'readonly'"
				name="identifier"
			/>
		</el-form-item>
	</plugin-form-section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElAlert, ElFormItem, ElInput, ElOption, ElSelect, ElSwitch } from 'element-plus';

import { PluginFormSection } from '../../../../common';
import { SpaceSelect } from '../../../spaces/components/components';

import type { IDeviceFormFrameProps } from './device-form-frame.types';

defineOptions({
	name: 'DeviceFormFrame',
});

const props = withDefaults(defineProps<IDeviceFormFrameProps>(), {
	showId: true,
	identifier: 'hidden',
});

const { t } = useI18n();
</script>

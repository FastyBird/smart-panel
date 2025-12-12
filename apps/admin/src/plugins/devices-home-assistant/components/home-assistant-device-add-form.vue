<template>
	<el-collapse
		v-model="activeStep"
		accordion
		expand-icon-position="left"
	>
		<!-- Step 1: Device Selection -->
		<el-collapse-item
			:title="t('devicesHomeAssistantPlugin.headings.device.deviceSelection')"
			name="one"
		>
			<template #icon>
				<el-icon :size="20">
					<icon icon="mdi:devices" />
				</el-icon>
			</template>

			<device-selection-step
				:model="model"
				:step-one-form-el="stepOneFormEl"
				:devices-options="devicesOptions"
				:devices-options-loading="devicesOptionsLoading"
				@device-change="onDeviceChange"
			/>
		</el-collapse-item>

		<!-- Step 2: Mapping Preview -->
		<el-collapse-item
			:title="t('devicesHomeAssistantPlugin.headings.device.mappingPreview')"
			name="two"
			:disabled="!model.haDeviceId"
		>
			<template #icon>
				<el-icon :size="20">
					<icon icon="mdi:eye" />
				</el-icon>
			</template>

			<mapping-preview-step
				:preview="preview"
				:is-preview-loading="isPreviewLoading"
				:preview-error="previewError"
			/>
		</el-collapse-item>

		<!-- Step 3: Mapping Customization (Optional) -->
		<el-collapse-item
			:title="t('devicesHomeAssistantPlugin.headings.device.mappingCustomization')"
			name="three"
			:disabled="!preview"
		>
			<template #icon>
				<el-icon :size="20">
					<icon icon="mdi:tune" />
				</el-icon>
			</template>

			<mapping-customization-step
				:preview="preview"
				:is-preview-loading="isPreviewLoading"
				:entity-overrides="entityOverrides"
				@update-overrides="onUpdateOverrides"
				@apply-changes="onApplyChanges"
			/>
		</el-collapse-item>

		<!-- Step 4: Device Configuration -->
		<el-collapse-item
			:title="t('devicesHomeAssistantPlugin.headings.device.deviceConfiguration')"
			name="four"
			:disabled="!preview"
		>
			<template #icon>
				<el-icon :size="20">
					<icon icon="mdi:cog" />
				</el-icon>
			</template>

			<device-configuration-step
				:model="model"
				:step-four-form-el="stepFourFormEl"
				:categories-options="categoriesOptions"
				:preview="preview"
			/>
		</el-collapse-item>
	</el-collapse>

	<!-- Step Navigation Buttons -->
	<teleport
		v-if="activeStep === 'one'"
		defer
		:to="`#${SUBMIT_FORM_SM}`"
	>
		<el-button
			:loading="formResult === FormResult.WORKING"
			:disabled="formResult !== FormResult.NONE"
			type="primary"
			@click="onProcessStep"
		>
			<template
				v-if="formResult === FormResult.ERROR"
				#icon
			>
				<icon icon="mdi:cross-circle" />
			</template>
			{{ t('devicesHomeAssistantPlugin.buttons.next') }}
		</el-button>
	</teleport>

	<teleport
		v-else-if="activeStep === 'two'"
		defer
		:to="`#${SUBMIT_FORM_SM}`"
	>
		<div class="flex gap-2">
			<el-button @click="activeStep = 'one'">
				{{ t('devicesHomeAssistantPlugin.buttons.previous') }}
			</el-button>
			<el-button
				type="primary"
				@click="onProcessStep"
			>
				{{ t('devicesHomeAssistantPlugin.buttons.next') }}
			</el-button>
		</div>
	</teleport>

	<teleport
		v-else-if="activeStep === 'three'"
		defer
		:to="`#${SUBMIT_FORM_SM}`"
	>
		<div class="flex gap-2">
			<el-button @click="activeStep = 'two'">
				{{ t('devicesHomeAssistantPlugin.buttons.previous') }}
			</el-button>
			<el-button
				type="primary"
				@click="onProcessStep"
			>
				{{ t('devicesHomeAssistantPlugin.buttons.next') }}
			</el-button>
		</div>
	</teleport>

	<teleport
		v-else-if="activeStep === 'four'"
		defer
		:to="`#${SUBMIT_FORM_SM}`"
	>
		<div class="flex gap-2">
			<el-button @click="activeStep = 'three'">
				{{ t('devicesHomeAssistantPlugin.buttons.previous') }}
			</el-button>
			<el-button
				:loading="formResult === FormResult.WORKING || isAdopting"
				:disabled="formResult !== FormResult.NONE && formResult !== FormResult.WORKING"
				type="primary"
				@click="onProcessStep"
			>
				<template
					v-if="formResult === FormResult.ERROR"
					#icon
				>
					<icon icon="mdi:cross-circle" />
				</template>
				{{ t('devicesHomeAssistantPlugin.buttons.adoptDevice') }}
			</el-button>
		</div>
	</teleport>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElButton,
	ElCollapse,
	ElCollapseItem,
	ElIcon,
} from 'element-plus';
import { Icon } from '@iconify/vue';

import { SUBMIT_FORM_SM } from '../../../common';
import { FormResult, type FormResultType, useDevices } from '../../../modules/devices';
import { useDeviceAddForm } from '../composables/useDeviceAddForm';
import DeviceConfigurationStep from './steps/device-configuration-step.vue';
import DeviceSelectionStep from './steps/device-selection-step.vue';
import MappingCustomizationStep from './steps/mapping-customization-step.vue';
import MappingPreviewStep from './steps/mapping-preview-step.vue';

import type { IHomeAssistantDeviceAddFormProps } from './home-assistant-device-add-form.types';

defineOptions({
	name: 'HomeAssistantDeviceAddForm',
});

const props = withDefaults(defineProps<IHomeAssistantDeviceAddFormProps>(), {
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

const { loaded: devicesLoaded, fetchDevices } = useDevices();

const {
	activeStep,
	preview,
	isPreviewLoading,
	previewError,
	isAdopting,
	categoriesOptions,
	devicesOptions,
	devicesOptionsLoading,
	entityOverrides,
	model,
	stepOneFormEl,
	stepTwoFormEl,
	stepThreeFormEl,
	stepFourFormEl,
	formChanged,
	submitStep,
	formResult,
} = useDeviceAddForm({
	id: props.id,
});

const onProcessStep = async (): Promise<void> => {
	try {
		await submitStep(activeStep.value);
	} catch {
		// Error is already handled in the composable
	}
};

const onDeviceChange = (): void => {
	// Device change is handled by the composable watcher
};

const onUpdateOverrides = (overrides: typeof entityOverrides.value): void => {
	entityOverrides.value = overrides;
};

const onApplyChanges = async (): Promise<void> => {
	if (!model.haDeviceId) {
		return;
	}

	try {
		await submitStep('three');
	} catch {
		// Error is already handled
	}
};

onMounted((): void => {
	if (!devicesLoaded.value) {
		fetchDevices().catch(() => {
			// Could be ignored
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

			await onProcessStep();
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remote-form-reset', false);

		if (val) {
			stepOneFormEl.value?.resetFields();
			stepTwoFormEl.value?.resetFields();
			stepThreeFormEl.value?.resetFields();
			stepFourFormEl.value?.resetFields();
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

<template>
	<el-collapse
		v-model="controlledActiveStep"
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
				ref="deviceSelectionStepRef"
				:model="model"
				:devices-options="devicesOptions"
				:devices-options-loading="devicesOptionsLoading"
				@device-change="onDeviceChange"
			/>
		</el-collapse-item>

		<!-- Step 2: Category Selection -->
		<el-collapse-item
			:title="t('devicesHomeAssistantPlugin.headings.device.categorySelection')"
			name="two"
			:disabled="!reachedSteps.has('two')"
		>
			<template #icon>
				<el-icon :size="20">
					<icon icon="mdi:tag" />
				</el-icon>
			</template>

			<category-selection-step
				ref="categorySelectionStepRef"
				:model="model"
				:categories-options="categoriesOptions"
				:suggested-category="suggestedCategory"
			/>
		</el-collapse-item>

		<!-- Step 3: Mapping Preview -->
		<el-collapse-item
			:title="t('devicesHomeAssistantPlugin.headings.device.mappingPreview')"
			name="three"
			:disabled="!reachedSteps.has('three')"
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

		<!-- Step 4: Mapping Customization (Optional) -->
		<el-collapse-item
			:title="t('devicesHomeAssistantPlugin.headings.device.mappingCustomization')"
			name="four"
			:disabled="!reachedSteps.has('four')"
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
			/>
		</el-collapse-item>

		<!-- Step 5: Device Configuration -->
		<el-collapse-item
			:title="t('devicesHomeAssistantPlugin.headings.device.deviceConfiguration')"
			name="five"
			:disabled="!reachedSteps.has('five')"
		>
			<template #icon>
				<el-icon :size="20">
					<icon icon="mdi:cog" />
				</el-icon>
			</template>

				<device-configuration-step
					ref="deviceConfigurationStepRef"
					:model="model"
					:preview="preview"
					:entity-overrides="entityOverrides"
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
			<el-button @click="onPreviousStep">
				{{ t('devicesHomeAssistantPlugin.buttons.previous') }}
			</el-button>
			<el-button
				:loading="formResult === FormResult.WORKING"
				:disabled="formResult !== FormResult.NONE"
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
			<el-button @click="onPreviousStep">
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
			<el-button @click="onPreviousStep">
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
		v-else-if="activeStep === 'five'"
		defer
		:to="`#${SUBMIT_FORM_SM}`"
	>
		<div class="flex gap-2">
			<el-button @click="onPreviousStep">
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
import { computed, nextTick, onMounted, ref, watch } from 'vue';
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
import CategorySelectionStep from './steps/category-selection-step.vue';
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

const deviceSelectionStepRef = ref<InstanceType<typeof DeviceSelectionStep> | null>(null);
const categorySelectionStepRef = ref<InstanceType<typeof CategorySelectionStep> | null>(null);
const deviceConfigurationStepRef = ref<InstanceType<typeof DeviceConfigurationStep> | null>(null);

const {
	activeStep,
	reachedSteps,
	preview,
	suggestedCategory,
	isPreviewLoading,
	previewError,
	isAdopting,
	categoriesOptions,
	devicesOptions,
	devicesOptionsLoading,
	entityOverrides,
	model,
	stepThreeFormEl,
	formChanged,
	submitStep,
	formResult,
} = useDeviceAddForm({
	id: props.id,
});

const stepOneFormEl = computed(() => deviceSelectionStepRef.value?.stepOneFormEl);
const stepTwoFormEl = computed(() => categorySelectionStepRef.value?.stepTwoFormEl);
const stepFiveFormEl = computed(() => deviceConfigurationStepRef.value?.stepFourFormEl);

// Controlled active step that validates before allowing changes
const controlledActiveStep = computed({
	get: () => activeStep.value,
	set: async (newStep: 'one' | 'two' | 'three' | 'four' | 'five') => {
		const currentStep = activeStep.value;
		
		// Prevent opening steps that haven't been reached
		if (!reachedSteps.value.has(newStep)) {
			// Revert to current step - don't allow the change
			// Use nextTick to ensure Element Plus processes the revert after its internal update
			await nextTick();
			activeStep.value = currentStep;
			return;
		}

		const stepOrder: ('one' | 'two' | 'three' | 'four' | 'five')[] = ['one', 'two', 'three', 'four', 'five'];
		const currentIndex = stepOrder.indexOf(currentStep);
		const newIndex = stepOrder.indexOf(newStep);

		// If going backwards, remove current step and all following steps from reachedSteps
		if (newIndex < currentIndex) {
			reachedSteps.value.delete(currentStep);
			if (currentIndex < stepOrder.length - 1) {
				stepOrder.slice(currentIndex + 1).forEach((step) => {
					reachedSteps.value.delete(step);
				});
			}
		}

		// Allow the change
		activeStep.value = newStep;
	},
});

const onProcessStep = async (): Promise<void> => {
	try {
		// For steps with forms in child components, we need to pass the form ref
		if (activeStep.value === 'one') {
			if (!stepOneFormEl.value) {
				console.error('Step one form reference not available', { deviceSelectionStepRef: deviceSelectionStepRef.value });
				throw new Error('Form reference not available');
			}
			await submitStep(activeStep.value, stepOneFormEl.value);
		} else if (activeStep.value === 'two') {
			if (!stepTwoFormEl.value) {
				console.error('Step two form reference not available', { categorySelectionStepRef: categorySelectionStepRef.value });
				throw new Error('Form reference not available');
			}
			await submitStep(activeStep.value, stepTwoFormEl.value);
		} else if (activeStep.value === 'five') {
			if (!stepFiveFormEl.value) {
				console.error('Step five form reference not available', { deviceConfigurationStepRef: deviceConfigurationStepRef.value });
				throw new Error('Form reference not available');
			}
			await submitStep(activeStep.value, stepFiveFormEl.value);
		} else {
			await submitStep(activeStep.value);
		}
	} catch (error) {
		// Error is already handled in the composable, but log it for debugging
		console.error('Error in onProcessStep:', error);
	}
};

const onDeviceChange = (): void => {
	// Device change is handled by the composable watcher
};

const onUpdateOverrides = (overrides: typeof entityOverrides.value): void => {
	entityOverrides.value = overrides;
};


const onPreviousStep = (): void => {
	const stepOrder: ('one' | 'two' | 'three' | 'four' | 'five')[] = ['one', 'two', 'three', 'four', 'five'];
	const currentIndex = stepOrder.indexOf(activeStep.value);
	
	if (currentIndex > 0) {
		const previousStep = stepOrder[currentIndex - 1];
		const currentStep = activeStep.value;
		
		// Remove current step and all following steps from reachedSteps
		reachedSteps.value.delete(currentStep);
		if (currentIndex < stepOrder.length - 1) {
			stepOrder.slice(currentIndex + 1).forEach((step) => {
				reachedSteps.value.delete(step);
			});
		}
		
		// Move to previous step
		activeStep.value = previousStep;
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
			stepFiveFormEl.value?.resetFields();
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

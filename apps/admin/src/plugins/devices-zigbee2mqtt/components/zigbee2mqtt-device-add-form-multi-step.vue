<template>
	<!-- Several steps (spec section 7): the steps run in a wizard-shell, which carries the actions in place of the
	     host's form footer. Every step stays mounted, so its form keeps what was entered when going back -->
	<wizard-shell
		:steps="steps"
		:current="activeStep"
		:can-continue="canContinue"
		:busy="busy"
		:next-label="activeStep === 'five' ? t('devicesZigbee2mqttPlugin.buttons.adoptDevice') : undefined"
		@back="onPreviousStep"
		@next="onProcessStep"
		@cancel="formHost.close"
		@step="onStep"
	>
		<div class="p-4">
			<device-selection-step
				v-show="activeStep === 'one'"
				ref="deviceSelectionStepRef"
				:model="model"
				:devices-options="devicesOptions"
				:devices-options-loading="devicesOptionsLoading"
				@device-change="onDeviceChange"
			/>

			<category-selection-step
				v-show="activeStep === 'two'"
				ref="categorySelectionStepRef"
				:model="model"
				:categories-options="categoriesOptions"
				:suggested-category="suggestedCategory"
			/>

			<mapping-preview-step
				v-show="activeStep === 'three'"
				:preview="preview"
				:is-preview-loading="isPreviewLoading"
				:preview-error="previewError"
			/>

			<mapping-customization-step
				v-show="activeStep === 'four'"
				ref="mappingCustomizationStepRef"
				:preview="preview"
				:is-preview-loading="isPreviewLoading"
				:expose-overrides="exposeOverrides"
				@update-overrides="onUpdateOverrides"
			/>

			<device-configuration-step
				v-show="activeStep === 'five'"
				ref="deviceConfigurationStepRef"
				:model="model"
				:preview="preview"
				:expose-overrides="exposeOverrides"
			/>
		</div>
	</wizard-shell>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, unref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { WizardShell, type WizardShellStep } from '../../../common';
import { FormResult, type FormResultType, useDeviceFormSteps, useDevices } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { useDeviceAddFormMultiStep } from '../composables/useDeviceAddFormMultiStep';

import CategorySelectionStep from './steps/category-selection-step.vue';
import DeviceConfigurationStep from './steps/device-configuration-step.vue';
import DeviceSelectionStep from './steps/device-selection-step.vue';
import MappingCustomizationStep from './steps/mapping-customization-step.vue';
import MappingPreviewStep from './steps/mapping-preview-step.vue';
import type { IZigbee2mqttDeviceAddFormMultiStepProps } from './zigbee2mqtt-device-add-form-multi-step.types';

defineOptions({
	name: 'Zigbee2mqttDeviceAddFormMultiStep',
});

const props = withDefaults(defineProps<IZigbee2mqttDeviceAddFormMultiStepProps>(), {
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
const mappingCustomizationStepRef = ref<InstanceType<typeof MappingCustomizationStep> | null>(null);
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
	exposeOverrides,
	model,
	formChanged,
	submitStep,
	clearPreview,
	formResult,
} = useDeviceAddFormMultiStep({
	id: props.id,
});

const stepOneFormEl = computed(() => {
	const exposed = deviceSelectionStepRef.value?.stepOneFormEl;
	return exposed ? unref(exposed) : undefined;
});
const stepTwoFormEl = computed(() => {
	const exposed = categorySelectionStepRef.value?.stepTwoFormEl;
	return exposed ? unref(exposed) : undefined;
});
const stepFourFormEl = computed(() => {
	const exposed = mappingCustomizationStepRef.value?.stepThreeFormEl;
	return exposed ? unref(exposed) : undefined;
});
const stepFiveFormEl = computed(() => {
	const exposed = deviceConfigurationStepRef.value?.stepFourFormEl;
	return exposed ? unref(exposed) : undefined;
});

const pendingStepChange = ref<{
	targetStep: 'one' | 'two' | 'three' | 'four' | 'five';
	currentStep: 'one' | 'two' | 'three' | 'four' | 'five';
} | null>(null);

const controlledActiveStep = computed({
	get: () => activeStep.value,
	set: (newStep: 'one' | 'two' | 'three' | 'four' | 'five' | string | null | undefined) => {
		const currentStep = activeStep.value;

		const validSteps = ['one', 'two', 'three', 'four', 'five'] as const;
		const isValidStep = newStep && validSteps.includes(newStep as (typeof validSteps)[number]);
		if (!isValidStep) {
			nextTick(() => {
				activeStep.value = currentStep;
			});
			return;
		}

		const validNewStep = newStep as 'one' | 'two' | 'three' | 'four' | 'five';

		if (!reachedSteps.value.has(validNewStep)) {
			nextTick(() => {
				activeStep.value = currentStep;
			});
			return;
		}

		const stepOrder: ('one' | 'two' | 'three' | 'four' | 'five')[] = ['one', 'two', 'three', 'four', 'five'];
		const currentIndex = stepOrder.indexOf(currentStep);
		const newIndex = stepOrder.indexOf(validNewStep);

		if (newIndex < currentIndex) {
			stepOrder.slice(newIndex + 1).forEach((step) => {
				reachedSteps.value.delete(step);
			});

			if (validNewStep === 'one' || validNewStep === 'two') {
				clearPreview();
				exposeOverrides.value = [];
			} else if (validNewStep === 'three') {
				exposeOverrides.value = [];
			}

			activeStep.value = validNewStep;
			return;
		}

		if (newIndex > currentIndex) {
			if (currentStep === 'one' || currentStep === 'two' || currentStep === 'four') {
				pendingStepChange.value = {
					targetStep: validNewStep,
					currentStep: currentStep,
				};

				nextTick(() => {
					activeStep.value = currentStep;

					nextTick(async () => {
						if (!pendingStepChange.value) return;

						const { currentStep: stepToValidate } = pendingStepChange.value;
						pendingStepChange.value = null;

						try {
							if (stepToValidate === 'one') {
								await submitStep(stepToValidate, stepOneFormEl.value);
							} else if (stepToValidate === 'two') {
								await submitStep(stepToValidate, stepTwoFormEl.value);
							} else if (stepToValidate === 'four') {
								await submitStep(stepToValidate, stepFourFormEl.value);
							}
						} catch {
							// Validation failed - stay on current step
						}
					});
				});

				return;
			} else {
				activeStep.value = validNewStep;
				return;
			}
		}

		if (newIndex === currentIndex) {
			return;
		}

		activeStep.value = validNewStep;
	},
});

// The host leaves its form footer out while these steps run; Cancel closes the form through it
const formHost = useDeviceFormSteps();

const steps = computed<WizardShellStep[]>((): WizardShellStep[] => [
	{ id: 'one', label: t('devicesZigbee2mqttPlugin.headings.device.deviceSelection') },
	{ id: 'two', label: t('devicesZigbee2mqttPlugin.headings.device.categorySelection') },
	{ id: 'three', label: t('devicesZigbee2mqttPlugin.headings.device.mappingPreview') },
	{ id: 'four', label: t('devicesZigbee2mqttPlugin.headings.device.mappingCustomization') },
	{ id: 'five', label: t('devicesZigbee2mqttPlugin.headings.device.deviceConfiguration') },
]);

const busy = computed<boolean>(
	(): boolean =>
		formResult.value === FormResult.WORKING ||
		(activeStep.value === 'four' && isPreviewLoading.value) ||
		(activeStep.value === 'five' && isAdopting.value)
);

// As the step buttons did: a check under way or just failed holds Next, and the last step waits for a preview that
// can be adopted
const canContinue = computed<boolean>((): boolean => {
	if (activeStep.value === 'three') {
		return true;
	}

	if (formResult.value !== FormResult.NONE) {
		return false;
	}

	if (activeStep.value === 'four') {
		return !isPreviewLoading.value;
	}

	return activeStep.value !== 'five' || preview.value?.readyToAdopt === true;
});

// A completed step chosen in the stepper: the same way back as the accordion headings gave
const onStep = (id: string): void => {
	controlledActiveStep.value = id as typeof controlledActiveStep.value;
};

const onProcessStep = async (): Promise<void> => {
	try {
		if (activeStep.value === 'one') {
			await submitStep(activeStep.value, stepOneFormEl.value);
		} else if (activeStep.value === 'two') {
			await submitStep(activeStep.value, stepTwoFormEl.value);
		} else if (activeStep.value === 'four') {
			await submitStep(activeStep.value, stepFourFormEl.value);
		} else if (activeStep.value === 'five') {
			await submitStep(activeStep.value, stepFiveFormEl.value);
		} else {
			await submitStep(activeStep.value);
		}
	} catch {
		// Error is handled by submitStep
	}
};

const onDeviceChange = (): void => {
	// Device change is handled by the composable watcher
};

const onUpdateOverrides = (overrides: typeof exposeOverrides.value): void => {
	exposeOverrides.value = overrides;
};

const onPreviousStep = (): void => {
	const stepOrder: ('one' | 'two' | 'three' | 'four' | 'five')[] = ['one', 'two', 'three', 'four', 'five'];
	const currentIndex = stepOrder.indexOf(activeStep.value);

	if (currentIndex > 0) {
		const previousStep = stepOrder[currentIndex - 1];
		const currentStep = activeStep.value;

		if (!previousStep) {
			return;
		}

		reachedSteps.value.delete(currentStep);
		if (currentIndex < stepOrder.length - 1) {
			stepOrder.slice(currentIndex + 1).forEach((step) => {
				reachedSteps.value.delete(step);
			});
		}

		if (previousStep === 'one' || previousStep === 'two') {
			clearPreview();
			exposeOverrides.value = [];
		} else if (previousStep === 'three') {
			exposeOverrides.value = [];
		}

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

			try {
				await onProcessStep();
			} catch {
				// Error is handled internally
			}
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	async (val: boolean): Promise<void> => {
		if (val) {
			emit('update:remote-form-reset', false);

			activeStep.value = 'one';
			reachedSteps.value = new Set(['one']);

			clearPreview();
			suggestedCategory.value = null;

			exposeOverrides.value = [];

			model.name = '';
			model.description = '';
			model.enabled = true;
			model.ieeeAddress = '';
			model.category =
				Object.values(DevicesModuleDeviceCategory).find((c) => c !== DevicesModuleDeviceCategory.generic) || DevicesModuleDeviceCategory.sensor;

			await nextTick();

			stepOneFormEl.value?.resetFields();
			stepTwoFormEl.value?.resetFields();
			if (mappingCustomizationStepRef.value?.resetForm) {
				mappingCustomizationStepRef.value.resetForm();
			}
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

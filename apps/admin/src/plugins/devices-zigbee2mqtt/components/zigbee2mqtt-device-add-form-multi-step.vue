<template>
	<el-collapse
		v-model="controlledActiveStep"
		accordion
		expand-icon-position="left"
	>
		<!-- Step 1: Device Selection -->
		<el-collapse-item
			:title="t('devicesZigbee2mqttPlugin.headings.device.deviceSelection')"
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
			:title="t('devicesZigbee2mqttPlugin.headings.device.categorySelection')"
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
			:title="t('devicesZigbee2mqttPlugin.headings.device.mappingPreview')"
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

		<!-- Step 4: Mapping Customization -->
		<el-collapse-item
			:title="t('devicesZigbee2mqttPlugin.headings.device.mappingCustomization')"
			name="four"
			:disabled="!reachedSteps.has('four')"
		>
			<template #icon>
				<el-icon :size="20">
					<icon icon="mdi:tune" />
				</el-icon>
			</template>

			<mapping-customization-step
				ref="mappingCustomizationStepRef"
				:preview="preview"
				:is-preview-loading="isPreviewLoading"
				:expose-overrides="exposeOverrides"
				@update-overrides="onUpdateOverrides"
			/>
		</el-collapse-item>

		<!-- Step 5: Device Configuration -->
		<el-collapse-item
			:title="t('devicesZigbee2mqttPlugin.headings.device.deviceConfiguration')"
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
				:expose-overrides="exposeOverrides"
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
			{{ t('devicesZigbee2mqttPlugin.buttons.next') }}
		</el-button>
	</teleport>

	<teleport
		v-else-if="activeStep === 'two'"
		defer
		:to="`#${SUBMIT_FORM_SM}`"
	>
		<div class="flex gap-2">
			<el-button @click="onPreviousStep">
				{{ t('devicesZigbee2mqttPlugin.buttons.previous') }}
			</el-button>
			<el-button
				:loading="formResult === FormResult.WORKING"
				:disabled="formResult !== FormResult.NONE"
				type="primary"
				@click="onProcessStep"
			>
				{{ t('devicesZigbee2mqttPlugin.buttons.next') }}
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
				{{ t('devicesZigbee2mqttPlugin.buttons.previous') }}
			</el-button>
			<el-button
				type="primary"
				@click="onProcessStep"
			>
				{{ t('devicesZigbee2mqttPlugin.buttons.next') }}
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
				{{ t('devicesZigbee2mqttPlugin.buttons.previous') }}
			</el-button>
			<el-button
				:loading="formResult === FormResult.WORKING || isPreviewLoading"
				:disabled="formResult !== FormResult.NONE || isPreviewLoading"
				type="primary"
				@click="onProcessStep"
			>
				{{ t('devicesZigbee2mqttPlugin.buttons.next') }}
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
				{{ t('devicesZigbee2mqttPlugin.buttons.previous') }}
			</el-button>
			<el-button
				:loading="formResult === FormResult.WORKING || isAdopting"
				:disabled="formResult !== FormResult.NONE || !preview?.readyToAdopt"
				type="primary"
				@click="onProcessStep"
			>
				<template
					v-if="formResult === FormResult.ERROR"
					#icon
				>
					<icon icon="mdi:cross-circle" />
				</template>
				{{ t('devicesZigbee2mqttPlugin.buttons.adoptDevice') }}
			</el-button>
		</div>
	</teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, unref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCollapse, ElCollapseItem, ElIcon } from 'element-plus';
import { Icon } from '@iconify/vue';

import { SUBMIT_FORM_SM } from '../../../common';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { FormResult, type FormResultType, useDevices } from '../../../modules/devices';
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
				Object.values(DevicesModuleDeviceCategory).find((c) => c !== DevicesModuleDeviceCategory.generic) ||
				DevicesModuleDeviceCategory.sensor;

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

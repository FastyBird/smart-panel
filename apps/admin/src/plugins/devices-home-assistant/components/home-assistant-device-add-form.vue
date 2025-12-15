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
				ref="mappingCustomizationStepRef"
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
				:loading="formResult === FormResult.WORKING || isPreviewLoading"
				:disabled="formResult !== FormResult.NONE || isPreviewLoading"
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
				{{ t('devicesHomeAssistantPlugin.buttons.adoptDevice') }}
			</el-button>
		</div>
	</teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, unref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElButton,
	ElCollapse,
	ElCollapseItem,
	ElIcon,
} from 'element-plus';
import { Icon } from '@iconify/vue';

import { SUBMIT_FORM_SM } from '../../../common';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
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
	entityOverrides,
	model,
	formChanged,
	submitStep,
	clearPreview,
	formResult,
} = useDeviceAddForm({
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

// Track pending step change that requires validation
const pendingStepChange = ref<{
	targetStep: 'one' | 'two' | 'three' | 'four' | 'five';
	currentStep: 'one' | 'two' | 'three' | 'four' | 'five';
} | null>(null);

// Controlled active step that validates before allowing changes
const controlledActiveStep = computed({
	get: () => activeStep.value,
	set: (newStep: 'one' | 'two' | 'three' | 'four' | 'five' | string | null | undefined) => {
		const currentStep = activeStep.value;
		
		// Handle empty/invalid values from ElCollapse in accordion mode when panel is collapsed
		// This prevents the wizard from breaking when collapse emits empty string or null
		const validSteps = ['one', 'two', 'three', 'four', 'five'] as const;
		const isValidStep = newStep && validSteps.includes(newStep as typeof validSteps[number]);
		if (!isValidStep) {
			// Revert to current step - don't allow collapse to empty state
			// Schedule revert in nextTick to ensure Element Plus processes it after its internal update
			nextTick(() => {
				activeStep.value = currentStep;
			});
			return;
		}
		
		// TypeScript now knows newStep is a valid step
		const validNewStep = newStep as 'one' | 'two' | 'three' | 'four' | 'five';
		
		// Prevent opening steps that haven't been reached
		if (!reachedSteps.value.has(validNewStep)) {
			// Revert to current step - don't allow the change
			// Schedule revert in nextTick to ensure Element Plus processes it after its internal update
			nextTick(() => {
				activeStep.value = currentStep;
			});
			return;
		}

		const stepOrder: ('one' | 'two' | 'three' | 'four' | 'five')[] = ['one', 'two', 'three', 'four', 'five'];
		const currentIndex = stepOrder.indexOf(currentStep);
		const newIndex = stepOrder.indexOf(validNewStep);

		// If going backwards, remove all steps after validNewStep (including currentStep and any intermediate steps)
		if (newIndex < currentIndex) {
			// Remove all steps from newIndex + 1 onwards (all steps after the target step)
			stepOrder.slice(newIndex + 1).forEach((step) => {
				reachedSteps.value.delete(step);
			});
			
			// Clear step-dependent state when going back to earlier steps
			// This prevents stale mapping data from being used after changing earlier choices
			if (validNewStep === 'one' || validNewStep === 'two') {
				// Going back to device/category selection: clear preview and entityOverrides
				// These depend on device/category, so they must be regenerated
				clearPreview();
				entityOverrides.value = [];
			} else if (validNewStep === 'three') {
				// Going back to preview step: clear entityOverrides
				// Preview should still be valid, but overrides should be reset
				entityOverrides.value = [];
			}
			// Going back to step 4: keep entityOverrides (they're still valid for current preview)
			
			// Allow the change (going backwards doesn't require validation)
			activeStep.value = validNewStep;
			return;
		}

		// If going forward to a previously-reached step, validate current step first
		// This ensures preview and data are up-to-date before proceeding
		// Critical: Step 4 -> Step 5 requires validation to refresh preview with updated entityOverrides
		if (newIndex > currentIndex) {
			// Only validate if the current step requires validation before proceeding
			// Steps 1, 2, and 4 require validation; step 3 doesn't
			if (currentStep === 'one' || currentStep === 'two' || currentStep === 'four') {
				// Prevent the change immediately and schedule validation
				// This ensures ElCollapse doesn't get into an inconsistent state
				pendingStepChange.value = {
					targetStep: validNewStep,
					currentStep: currentStep,
				};
				
				// Revert to current step synchronously to prevent ElCollapse from seeing invalid state
				// We need to schedule this in nextTick to ensure it happens after ElCollapse's internal update
				nextTick(() => {
					activeStep.value = currentStep;
					
					// Schedule validation to run after the revert completes
					nextTick(async () => {
						if (!pendingStepChange.value) return;
						
						const { currentStep: stepToValidate } = pendingStepChange.value;
						pendingStepChange.value = null;
						
						try {
							// Validate and submit current step - this will advance to next step automatically
							// For step 4, this also refreshes the preview with updated entityOverrides
							if (stepToValidate === 'one') {
								await submitStep(stepToValidate, stepOneFormEl.value);
							} else if (stepToValidate === 'two') {
								await submitStep(stepToValidate, stepTwoFormEl.value);
							} else if (stepToValidate === 'four') {
								await submitStep(stepToValidate, stepFourFormEl.value);
							}
							// submitStep() automatically advances to the next step, so we're done
							// If user was trying to jump multiple steps, they'll be on the next step
							// and can navigate again if needed
						} catch {
							// Validation failed - stay on current step
							// submitStep() already handles error display
							// activeStep is already set to currentStep, so no revert needed
						}
					});
				});
				
				return;
			} else {
				// Step 3 or other steps don't require validation, allow navigation
				activeStep.value = validNewStep;
				return;
			}
		}

		// Same step - no change needed
		if (newIndex === currentIndex) {
			return;
		}

		// Allow the change (shouldn't reach here, but kept as fallback)
		activeStep.value = validNewStep;
	},
});

const onProcessStep = async (): Promise<void> => {
	try {
		// For steps with forms in child components, we need to pass the form ref
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
		// submitStep() already handles error display and formResult state internally
		// We catch here to prevent unhandled promise rejections
		// The error is already handled by submitStep(), so we just need to prevent it from bubbling
		// This ensures consistent UI state even when validation/API failures occur
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
		
		// Clear step-dependent state when going back to earlier steps
		// This prevents stale mapping data from being used after changing earlier choices
		if (previousStep === 'one' || previousStep === 'two') {
			// Going back to device/category selection: clear preview and entityOverrides
			// These depend on device/category, so they must be regenerated
			clearPreview();
			entityOverrides.value = [];
		} else if (previousStep === 'three') {
			// Going back to preview step: clear entityOverrides
			// Preview should still be valid, but overrides should be reset
			entityOverrides.value = [];
		}
		// Going back to step 4: keep entityOverrides (they're still valid for current preview)
		
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

			try {
				await onProcessStep();
			} catch {
				// onProcessStep() already handles errors internally via submitStep()
				// We catch here to prevent unhandled promise rejections during remote-triggered submits
				// This ensures consistent UI state even when validation/API failures occur
			}
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	async (val: boolean): Promise<void> => {
		emit('update:remote-form-reset', false);

		if (val) {
			// Reset wizard state FIRST - this ensures UI is in correct state
			activeStep.value = 'one';
			reachedSteps.value = new Set(['one']);
			
			// Clear preview and related state
			clearPreview();
			suggestedCategory.value = null;
			
			// Clear entity overrides (controls form state in step 4)
			entityOverrides.value = [];
			
			// Reset model to initial values
			// Keep id and type as they are props/constants
			model.name = '';
			model.description = '';
			model.enabled = true;
			model.haDeviceId = '';
			// Reset category to default (first non-generic category or sensor)
			model.category = Object.values(DevicesModuleDeviceCategory).find(
				(c) => c !== DevicesModuleDeviceCategory.generic
			) || DevicesModuleDeviceCategory.sensor;
			
			// Wait for prop changes to propagate to child components
			await nextTick();
			
			// Reset form fields (this clears validation state and resets to initial values)
			stepOneFormEl.value?.resetFields();
			stepTwoFormEl.value?.resetFields();
			// Step 3 (mapping preview) has no form - it's just a display component
			// Step 4: Use the exposed resetForm method to properly reset form and checkbox state
			// Note: We use resetForm() instead of stepFourFormEl.value?.resetFields() because
			// resetForm() properly clears the form model and ensures all state is reset.
			// The checkbox states are controlled by entityOverrides prop (cleared above),
			// but resetForm() ensures the form model and validation state are also cleared.
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

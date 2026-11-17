<template>
	<virtual-wizard-layout
		enabled
		:wide="activeStep !== 0"
		:review="activeStep === 2"
		:title="
			activeStep === 0
				? t('devicesVirtualPlugin.wizard.projection.deviceTitle')
				: activeStep === 2
					? t('devicesVirtualPlugin.wizard.layout.reviewTitle')
					: undefined
		"
		:description="
			activeStep === 0
				? t('devicesVirtualPlugin.wizard.category.description')
				: activeStep === 2
					? t('devicesVirtualPlugin.wizard.projection.reviewDescription')
					: undefined
		"
	>
		<virtual-wizard-details-step
			v-if="activeStep === 0"
			v-model:name="state.name"
			v-model:room-id="state.roomId"
			v-model:zone-ids="state.zoneIds"
			:category="state.category"
		>
			<template #category><virtual-wizard-category-step v-model="state.category" /></template>
		</virtual-wizard-details-step>
		<virtual-wizard-mapping-step
			v-else-if="activeStep === 1"
			ref="mappingStep"
			v-model="state.mappings"
			v-model:optional-channels="state.optionalChannels"
			:category="state.category"
			@update:valid="onMappingValidChange"
			@update:busy="mappingBusy = $event"
		/>
		<virtual-wizard-review-step
			v-else
			ref="reviewStep"
			:category="state.category"
			:mappings="state.mappings"
			:name="state.name"
			:room-id="state.roomId"
			:zone-ids="state.zoneIds"
			:show-create-action="false"
			@edit-details="activeStep = 0"
			@edit-mapping="activeStep = 1"
			@created="onCreated"
			@submitting="submitting = $event"
		/>
		<template #aside><virtual-projection-spec-summary :category="state.category" /></template>
	</virtual-wizard-layout>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { useBreakpoints } from '../../../common';
import { RouteNames as DevicesRouteNames } from '../../../modules/devices';
import { useDeviceWizardComplete, useDeviceWizardData, useDeviceWizardFlow } from '../../../modules/devices/components/wizard/device-wizard-flow';
import { useWizardValidation } from '../../../modules/devices/components/wizard/use-wizard-validation';
import type { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import VirtualWizardLayout from '../components/virtual-wizard-layout.vue';
import VirtualProjectionSpecSummary from '../components/wizard/virtual-projection-spec-summary.vue';
import VirtualWizardCategoryStep from '../components/wizard/virtual-wizard-category-step.vue';
import VirtualWizardDetailsStep from '../components/wizard/virtual-wizard-details-step.vue';
import VirtualWizardMappingStep from '../components/wizard/virtual-wizard-mapping-step.vue';
import type { IVirtualWizardReviewCreatedPayload } from '../components/wizard/virtual-wizard-review-step.types';
import VirtualWizardReviewStep from '../components/wizard/virtual-wizard-review-step.vue';
import type { IVirtualWizardState } from '../components/wizard/virtual-wizard.types';
import { provideVirtualWizardPlacement } from '../composables/use-virtual-wizard-placement';
import { VIRTUAL_SELECTABLE_CATEGORIES } from '../devices-virtual.constants';

defineOptions({
	name: 'ViewVirtualDeviceWizard',
});

const { t } = useI18n();
const complete = useDeviceWizardComplete();
const router = useRouter();

const { isLGDevice } = useBreakpoints();

// Owned here and handed down to whichever step is active. Each of the three steps reads and writes
// the same object as it mounts; nothing about this location changes when the active step does.
const state = useDeviceWizardData<IVirtualWizardState>('projection', () => ({
	category: null,
	mappings: [],
	name: '',
	roomId: null,
	zoneIds: [],
	optionalChannels: [],
}));

const STEP_COUNT = 3;

// 0 = device, 1 = mapping, 2 = review. Drives both `el-steps`' `active` prop and
// which single step component is mounted below.
const activeStep = ref<number>(0);

// Mirrors the mapping step's own `update:valid`. That step already hard-blocks an incompatible
// mapping internally, but until this was wired up nothing consumed the event, so the block was
// decorative — it stopped the mapping from being usable, not the wizard from moving past it.
const mappingValid = ref<boolean>(false);
const mappingBusy = ref(false);
const advancing = ref(false);
const mappingStep = ref<{ validate: () => Promise<boolean> } | null>(null);

// Set once the review step's own create action succeeds. Its presence — not `activeStep` — is what
// switches the chrome from "still building" (Cancel/Back/Next) to "done" (View device only): the
// device already exists at that point, so stepping back into the wizard to "keep building" it no
// longer makes sense.
const createdDevice = ref<IVirtualWizardReviewCreatedPayload | null>(null);
const reviewStep = ref<{ canCreate: boolean; onCreate: () => Promise<void> } | null>(null);

// True while the review step's create is in flight. The wizard renders its steps with `v-if`, so going
// Back unmounts the step that is mid-request — the request carries on, and the freshly mounted Review
// the user reaches next has a submit state of its own and will happily send a second one. Two virtual
// devices from one intent, and Cancel has the same shape: leaving does not stop the device appearing.
// Holding the wizard still until the request settles is what makes the step's own guard mean anything.
const submitting = ref<boolean>(false);

const isLastStep = computed<boolean>((): boolean => activeStep.value === STEP_COUNT - 1);

const canAdvance = computed(() =>
	activeStep.value === 0
		? state.category !== null && VIRTUAL_SELECTABLE_CATEGORIES.includes(state.category) && !!state.name.trim()
		: activeStep.value === 1 && mappingValid.value
);

const onCancel = (): void => {
	// Guarded here as well as on the buttons, because the controls are duplicated for small screens and
	// one of them is an app-bar button with no disabled state of its own. The handler is the single place
	// every route out of the wizard passes through.
	if (submitting.value || advancing.value) {
		return;
	}

	if (isLGDevice.value) {
		router.replace({ name: DevicesRouteNames.DEVICES });
	} else {
		router.push({ name: DevicesRouteNames.DEVICES });
	}
};

const onBack = (): void => {
	if (submitting.value || advancing.value) {
		return;
	}

	if (activeStep.value === 0) {
		return;
	}

	activeStep.value -= 1;
};

const validation = useWizardValidation(activeStep, () => ({
	...(activeStep.value === 0 && (!state.category || !VIRTUAL_SELECTABLE_CATEGORIES.includes(state.category))
		? { category: t('devicesModule.fields.devices.category.validation.required') }
		: {}),
	...(activeStep.value === 1 && !mappingValid.value ? { mappings: t('devicesModule.wizard.validation.invalidValue') } : {}),
	...(activeStep.value === 0 && !state.name.trim() ? { name: t('devicesModule.fields.devices.name.validation.required') } : {}),
}));
const onNext = async (): Promise<void> => {
	if (submitting.value || advancing.value || (activeStep.value === 1 && mappingBusy.value) || isLastStep.value) return;
	advancing.value = true;
	try {
		if (activeStep.value === 1) mappingValid.value = (await mappingStep.value?.validate()) ?? false;
		if (validation.validate() && canAdvance.value) activeStep.value++;
	} finally {
		advancing.value = false;
	}
};

const onMappingValidChange = (value: boolean): void => {
	mappingValid.value = value;
};

// Driven by the review step's own `created` event, emitted only after its create POST has
// succeeded and every best-effort follow-up (zone assignment, hiding the source) has settled. The
// shell never issues a create call of its own — see the review step for why bypassing
// `devicesStore.add()` and posting through the backend client directly is deliberate.
const onCreated = (payload: IVirtualWizardReviewCreatedPayload): void => {
	createdDevice.value = payload;
	complete();
};

const onViewDevice = (): void => {
	if (createdDevice.value === null) {
		return;
	}

	const target = { name: DevicesRouteNames.DEVICE, params: { id: createdDevice.value.id } };

	if (isLGDevice.value) {
		router.replace(target);
	} else {
		router.push(target);
	}
};

// A virtual device's mappings are keyed by the *category's* spec channels and properties, so they
// stop meaning anything the moment the category itself changes. Left in place, the mapping step's
// next mount would adopt them as its starting `selections` (its own `modelValue` watcher trusts
// whatever it is handed), seeding it with entries keyed by slots that do not exist under the new
// category — invisible to the UI, but still counted by `hasMapping`, which would let an empty
// mapping report itself complete. `name`/`roomId`/`zoneIds` are not spec-shaped, so they are left
// alone; the name and placement remain the user's choices.
watch(
	(): DevicesModuleDeviceCategory | null => state.category,
	(value, previous): void => {
		if (previous === null || previous === undefined || previous === value) {
			return;
		}

		state.mappings = [];
		state.optionalChannels = [];
		mappingValid.value = false;
	}
);

defineExpose({
	activeStep,
	canAdvance,
	createdDevice,
});
useDeviceWizardFlow(
	computed(() => ({
		steps: ['device', 'mapping', 'review'].map((step) => t(`devicesVirtualPlugin.wizard.steps.${step}`)),
		activeStep: activeStep.value,
		busy: submitting.value || advancing.value,
		dirty: !createdDevice.value && (state.category !== null || !!state.name.trim()),
		actions: createdDevice.value
			? [{ id: 'view-device', label: t('devicesVirtualPlugin.wizard.viewDevice'), variant: 'primary', handler: onViewDevice }]
			: [
					...(activeStep.value > 0
						? [{ id: 'back', label: t('devicesModule.wizard.actions.back'), variant: 'default' as const, handler: onBack }]
						: []),
					{ id: 'cancel', label: t('devicesModule.wizard.actions.cancel'), variant: 'link', handler: onCancel },
					isLastStep.value
						? {
								id: 'create',
								label: t('devicesVirtualPlugin.wizard.review.create'),
								variant: 'primary',
								disabled: !reviewStep.value?.canCreate,
								handler: () => reviewStep.value?.onCreate(),
							}
						: {
								id: 'next',
								label: t('devicesModule.wizard.actions.next'),
								variant: 'primary',
								handler: onNext,
								loading: advancing.value,
								disabled: activeStep.value === 1 && mappingBusy.value,
							},
				],
	}))
);

provideVirtualWizardPlacement(computed(() => ({ roomId: state.roomId, zoneIds: state.zoneIds })));
</script>

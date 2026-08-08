<template>
	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:wizard-hat"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('devicesVirtualPlugin.wizard.title') }}
		</template>

		<template #subtitle>
			{{ t('devicesVirtualPlugin.wizard.subtitle') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="onCancel"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:heading="t('devicesVirtualPlugin.wizard.title')"
		:sub-heading="t('devicesVirtualPlugin.wizard.subtitle')"
		icon="mdi:wizard-hat"
	>
		<template
			v-if="isMDDevice"
			#extra
		>
			<div class="flex items-center">
				<el-button
					v-if="createdDevice === null"
					:disabled="submitting"
					data-test-id="wizard-cancel"
					@click="onCancel"
				>
					{{ t('devicesModule.buttons.cancel.title') }}
				</el-button>
				<el-button
					v-else
					type="primary"
					data-test-id="wizard-view-device"
					@click="onViewDevice"
				>
					{{ t('devicesVirtualPlugin.wizard.viewDevice') }}
				</el-button>

				<el-button
					v-if="createdDevice === null && activeStep > 0"
					class="ml-2!"
					:disabled="submitting"
					data-test-id="wizard-back"
					@click="onBack"
				>
					{{ t('devicesModule.wizard.actions.back') }}
				</el-button>

				<el-button
					v-if="createdDevice === null && !isLastStep"
					type="primary"
					class="ml-2!"
					:disabled="!canAdvance"
					data-test-id="wizard-next"
					@click="onNext"
				>
					{{ t('devicesModule.wizard.actions.next') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2">
		<el-card
			shadow="never"
			class="max-h-full flex flex-col overflow-hidden box-border"
			body-class="p-0! max-h-full overflow-hidden flex flex-col"
		>
			<template #header>
				<el-steps
					:active="activeStep"
					finish-status="success"
					align-center
				>
					<el-step :title="t('devicesVirtualPlugin.wizard.steps.category')" />
					<el-step :title="t('devicesVirtualPlugin.wizard.steps.mapping')" />
					<el-step :title="t('devicesVirtualPlugin.wizard.steps.details')" />
					<el-step :title="t('devicesVirtualPlugin.wizard.steps.review')" />
				</el-steps>
			</template>

			<el-scrollbar class="flex-1 overflow-hidden h-full">
				<!--
					Only the active step is ever mounted (`v-if`, not `v-show`/`keep-alive`): the mapping
					step's `modelValue` watcher is `immediate: true` and would emit `[]` the moment it saw a
					null category, and the review step depends on the details step having already fetched
					rooms/zones. Mounting every step at once — or independently of the others — risks both.
					Forward navigation is strictly linear (Next is gated per step below), so by the time the
					review step mounts, the details step has always mounted at least once first.
				-->
				<div class="p-4">
					<virtual-wizard-category-step
						v-if="activeStep === 0"
						v-model="state.category"
					/>

					<virtual-wizard-mapping-step
						v-else-if="activeStep === 1"
						v-model="state.mappings"
						:category="state.category"
						@update:valid="onMappingValidChange"
					/>

					<virtual-wizard-details-step
						v-else-if="activeStep === 2"
						v-model:name="state.name"
						v-model:room-id="state.roomId"
						v-model:zone-ids="state.zoneIds"
						:category="state.category"
					/>

					<!-- Step 4: review. It renders and drives its own "Create device" action — the shell
						must not add a competing Finish/Create button, or a click could create two devices. -->
					<virtual-wizard-review-step
						v-else
						:category="state.category"
						:mappings="state.mappings"
						:name="state.name"
						:room-id="state.roomId"
						:zone-ids="state.zoneIds"
						@created="onCreated"
						@submitting="submitting = $event"
					/>
				</div>
			</el-scrollbar>
		</el-card>
	</div>

	<div
		v-if="!isMDDevice"
		class="mt-2 flex justify-end lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2"
	>
		<el-button
			v-if="createdDevice === null && activeStep > 0"
			:disabled="submitting"
			data-test-id="wizard-back"
			@click="onBack"
		>
			{{ t('devicesModule.wizard.actions.back') }}
		</el-button>

		<el-button
			v-if="createdDevice === null"
			class="ml-2!"
			:disabled="submitting"
			data-test-id="wizard-cancel"
			@click="onCancel"
		>
			{{ t('devicesModule.buttons.cancel.title') }}
		</el-button>
		<el-button
			v-else
			type="primary"
			class="ml-2!"
			data-test-id="wizard-view-device"
			@click="onViewDevice"
		>
			{{ t('devicesVirtualPlugin.wizard.viewDevice') }}
		</el-button>

		<el-button
			v-if="createdDevice === null && !isLastStep"
			type="primary"
			class="ml-2!"
			:disabled="!canAdvance"
			data-test-id="wizard-next"
			@click="onNext"
		>
			{{ t('devicesModule.wizard.actions.next') }}
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElButton, ElCard, ElIcon, ElScrollbar, ElStep, ElSteps } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { RouteNames as DevicesRouteNames } from '../../../modules/devices';
import type { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import VirtualWizardCategoryStep from '../components/wizard/virtual-wizard-category-step.vue';
import VirtualWizardDetailsStep from '../components/wizard/virtual-wizard-details-step.vue';
import VirtualWizardMappingStep from '../components/wizard/virtual-wizard-mapping-step.vue';
import type { IVirtualWizardReviewCreatedPayload } from '../components/wizard/virtual-wizard-review-step.types';
import VirtualWizardReviewStep from '../components/wizard/virtual-wizard-review-step.vue';
import type { IVirtualWizardState } from '../components/wizard/virtual-wizard.types';
import { RouteNames } from '../devices-virtual.constants';

defineOptions({
	name: 'ViewVirtualDeviceWizard',
});

const { t } = useI18n();
const router = useRouter();

const { isMDDevice, isLGDevice } = useBreakpoints();

useMeta({
	title: t('devicesVirtualPlugin.wizard.title'),
});

// Owned here and handed down to whichever step is active. Each of the four steps reads and writes
// the same object as it mounts; nothing about this location changes when the active step does.
const state = reactive<IVirtualWizardState>({
	category: null,
	mappings: [],
	name: '',
	roomId: null,
	zoneIds: [],
});

const STEP_COUNT = 4;

// 0 = category, 1 = mapping, 2 = details, 3 = review. Drives both `el-steps`' `active` prop and
// which single step component is mounted below.
const activeStep = ref<number>(0);

// Mirrors the mapping step's own `update:valid`. That step already hard-blocks an incompatible
// mapping internally, but until this was wired up nothing consumed the event, so the block was
// decorative — it stopped the mapping from being usable, not the wizard from moving past it.
const mappingValid = ref<boolean>(false);

// Set once the review step's own create action succeeds. Its presence — not `activeStep` — is what
// switches the chrome from "still building" (Cancel/Back/Next) to "done" (View device only): the
// device already exists at that point, so stepping back into the wizard to "keep building" it no
// longer makes sense.
const createdDevice = ref<IVirtualWizardReviewCreatedPayload | null>(null);

// True while the review step's create is in flight. The wizard renders its steps with `v-if`, so going
// Back unmounts the step that is mid-request — the request carries on, and the freshly mounted Review
// the user reaches next has a submit state of its own and will happily send a second one. Two virtual
// devices from one intent, and Cancel has the same shape: leaving does not stop the device appearing.
// Holding the wizard still until the request settles is what makes the step's own guard mean anything.
const submitting = ref<boolean>(false);

const isLastStep = computed<boolean>((): boolean => activeStep.value === STEP_COUNT - 1);

// Per-step gating for the Next button. Only ever consulted for the step currently on screen: the
// mapping step's validity while it is *not* mounted is irrelevant, and gets re-synced the instant it
// remounts, since its own `isValid` watcher is `immediate: true`.
const canAdvance = computed<boolean>((): boolean => {
	if (activeStep.value === 0) {
		return state.category !== null;
	}

	if (activeStep.value === 1) {
		return mappingValid.value;
	}

	if (activeStep.value === 2) {
		return state.name.trim().length > 0;
	}

	// Step 3 (review) has no Next of its own — the review step owns the final action.
	return false;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('devicesModule.breadcrumbs.devices.list'),
				route: router.resolve({ name: DevicesRouteNames.DEVICES }),
			},
			{
				label: t('devicesVirtualPlugin.wizard.breadcrumb'),
				route: router.resolve({ name: RouteNames.WIZARD }),
			},
		];
	}
);

const onCancel = (): void => {
	// Guarded here as well as on the buttons, because the controls are duplicated for small screens and
	// one of them is an app-bar button with no disabled state of its own. The handler is the single place
	// every route out of the wizard passes through.
	if (submitting.value) {
		return;
	}

	if (isLGDevice.value) {
		router.replace({ name: DevicesRouteNames.DEVICES });
	} else {
		router.push({ name: DevicesRouteNames.DEVICES });
	}
};

const onBack = (): void => {
	if (submitting.value) {
		return;
	}

	if (activeStep.value === 0) {
		return;
	}

	activeStep.value -= 1;
};

const onNext = (): void => {
	if (!canAdvance.value || isLastStep.value) {
		return;
	}

	activeStep.value += 1;
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
// alone; the details step regenerates its suggested name by itself once it next mounts against the
// new category.
watch(
	(): DevicesModuleDeviceCategory | null => state.category,
	(value, previous): void => {
		if (previous === null || previous === undefined || previous === value) {
			return;
		}

		state.mappings = [];
		mappingValid.value = false;
	}
);

defineExpose({
	activeStep,
	canAdvance,
	createdDevice,
});
</script>

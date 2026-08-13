<template>
	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon><icon icon="mdi:test-tube" /></template>
		<template #title>{{ t('simulatorPlugin.wizard.title') }}</template>
		<template #subtitle>{{ t('simulatorPlugin.wizard.subtitle') }}</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="onCancel"
	>
		<template #icon><icon icon="mdi:chevron-left" /></template>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:heading="t('simulatorPlugin.wizard.title')"
		:sub-heading="t('simulatorPlugin.wizard.subtitle')"
		icon="mdi:test-tube"
	>
		<template
			v-if="isMDDevice"
			#extra
		>
			<el-button
				:disabled="generating"
				data-test-id="wizard-cancel"
				@click="onCancel"
			>
				{{ t('devicesModule.buttons.cancel.title') }}
			</el-button>
			<el-button
				v-if="activeStep === 1"
				:disabled="generating"
				data-test-id="wizard-back"
				@click="activeStep = 0"
			>
				{{ t('devicesModule.wizard.actions.back') }}
			</el-button>
			<el-button
				v-if="activeStep === 0"
				type="primary"
				:disabled="!canReview"
				data-test-id="wizard-next"
				@click="activeStep = 1"
			>
				{{ t('devicesModule.wizard.actions.next') }}
			</el-button>
			<el-button
				v-else-if="activeStep === 1"
				type="primary"
				:loading="generating"
				data-test-id="wizard-generate"
				@click="onGenerate"
			>
				{{ t('simulatorPlugin.wizard.actions.generate') }}
			</el-button>
			<el-button
				v-else
				type="primary"
				data-test-id="wizard-generate-more"
				@click="onGenerateMore"
			>
				{{ t('simulatorPlugin.wizard.actions.generateMore') }}
			</el-button>
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
					<el-step :title="t('simulatorPlugin.wizard.steps.configure')" />
					<el-step :title="t('simulatorPlugin.wizard.steps.review')" />
					<el-step :title="t('simulatorPlugin.wizard.steps.results')" />
				</el-steps>
			</template>

			<el-scrollbar class="flex-1 overflow-hidden h-full">
				<div class="p-4">
					<div
						v-if="activeStep === 0"
						class="space-y-4"
						data-test-id="wizard-configure"
					>
						<el-alert
							v-if="categoriesError"
							type="error"
							:title="categoriesError"
							:closable="false"
							show-icon
						>
							<el-button
								size="small"
								:loading="loadingCategories"
								data-test-id="wizard-retry-categories"
								@click="onRetryCategories"
							>
								{{ t('simulatorPlugin.wizard.actions.retryCategories') }}
							</el-button>
						</el-alert>

						<el-alert
							v-if="roomsError"
							type="error"
							:title="roomsError"
							:closable="false"
							show-icon
							data-test-id="wizard-rooms-error"
						>
							<el-button
								size="small"
								:loading="loadingRooms"
								data-test-id="wizard-retry-rooms"
								@click="onRetryRooms"
							>
								{{ t('simulatorPlugin.wizard.actions.retryRooms') }}
							</el-button>
						</el-alert>

						<el-form label-position="top">
							<el-form-item
								:label="t('simulatorPlugin.wizard.fields.category')"
								required
							>
								<el-select
									v-model="form.category"
									:loading="loadingCategories"
									filterable
									class="w-full"
									data-test-id="wizard-category"
								>
									<el-option
										v-for="category in categories"
										:key="category.category"
										:label="category.name"
										:value="category.category"
									/>
								</el-select>
							</el-form-item>

							<div class="grid grid-cols-1 md:grid-cols-2 gap-x-4">
								<el-form-item
									:label="t('simulatorPlugin.wizard.fields.namePrefix')"
									required
								>
									<el-input
										v-model="form.namePrefix"
										data-test-id="wizard-name-prefix"
									/>
								</el-form-item>

								<el-form-item :label="t('simulatorPlugin.wizard.fields.count')">
									<el-input-number
										v-model="form.count"
										:min="1"
										:max="20"
										:step="1"
										step-strictly
										controls-position="right"
										class="w-full"
										data-test-id="wizard-count"
									/>
								</el-form-item>
							</div>

							<el-form-item :label="t('devicesModule.fields.devices.room.title')">
								<el-select
									v-model="form.roomId"
									:loading="loadingRooms"
									filterable
									clearable
									class="w-full"
									data-test-id="wizard-room"
								>
									<el-option
										v-for="room in roomOptions"
										:key="room.value"
										:label="room.label"
										:value="room.value"
									/>
								</el-select>
							</el-form-item>

							<el-form-item :label="t('simulatorPlugin.wizard.fields.structure')">
								<div class="flex flex-col gap-2">
									<el-checkbox v-model="form.requiredChannelsOnly">
										{{ t('simulatorPlugin.wizard.fields.requiredChannelsOnly') }}
									</el-checkbox>
									<el-checkbox v-model="form.requiredPropertiesOnly">
										{{ t('simulatorPlugin.wizard.fields.requiredPropertiesOnly') }}
									</el-checkbox>
								</div>
							</el-form-item>

							<el-form-item>
								<el-checkbox v-model="form.autoSimulate">
									{{ t('simulatorPlugin.wizard.fields.autoSimulate') }}
								</el-checkbox>
							</el-form-item>

							<div v-if="form.autoSimulate">
								<el-form-item :label="t('simulatorPlugin.wizard.fields.simulateInterval')">
									<el-input-number
										v-model="form.simulateInterval"
										:min="1000"
										:max="60000"
										:step="1000"
										class="w-full"
									/>
								</el-form-item>
							</div>

							<el-form-item :label="t('simulatorPlugin.wizard.fields.behaviorMode')">
								<el-select
									v-model="form.behaviorMode"
									class="w-full"
									data-test-id="wizard-behavior-mode"
								>
									<el-option
										:label="t('simulatorPlugin.wizard.behaviorModes.default')"
										:value="SimulatorPluginBehaviorMode.default"
									/>
									<el-option
										:label="t('simulatorPlugin.wizard.behaviorModes.realistic')"
										:value="SimulatorPluginBehaviorMode.realistic"
									/>
								</el-select>
							</el-form-item>
						</el-form>
					</div>

					<div
						v-else-if="activeStep === 1"
						class="space-y-4"
						data-test-id="wizard-review"
					>
						<el-alert
							v-if="generationError"
							type="error"
							:title="generationError"
							:closable="false"
							show-icon
						/>
						<el-alert
							type="info"
							:title="t('simulatorPlugin.wizard.review.title', { count: form.count })"
							:description="t('simulatorPlugin.wizard.review.description')"
							:closable="false"
							show-icon
						/>

						<el-descriptions
							:column="1"
							border
						>
							<el-descriptions-item :label="t('simulatorPlugin.wizard.fields.category')">
								{{ selectedCategory?.name }}
							</el-descriptions-item>
							<el-descriptions-item :label="t('devicesModule.fields.devices.room.title')">
								{{ selectedRoomLabel }}
							</el-descriptions-item>
						</el-descriptions>

						<el-table
							:data="previewNames"
							max-height="360"
							data-test-id="wizard-preview-names"
						>
							<el-table-column
								type="index"
								width="70"
							/>
							<el-table-column :label="t('simulatorPlugin.wizard.fields.deviceName')">
								<template #default="{ row }: { row: string }">{{ row }}</template>
							</el-table-column>
						</el-table>
					</div>

					<div
						v-else
						class="space-y-4"
						data-test-id="wizard-results"
					>
						<el-alert
							:type="failedCount === 0 ? 'success' : succeededCount === 0 ? 'error' : 'warning'"
							:title="t('simulatorPlugin.wizard.results.summary', { succeeded: succeededCount, failed: failedCount })"
							:closable="false"
							show-icon
						/>

						<el-table :data="results">
							<el-table-column
								prop="name"
								:label="t('simulatorPlugin.wizard.fields.deviceName')"
							/>
							<el-table-column :label="t('simulatorPlugin.wizard.results.status')">
								<template #default="{ row }: { row: ISimulatorGenerationResult }">
									<el-tag :type="row.success ? 'success' : 'danger'">
										{{ t(row.success ? 'simulatorPlugin.wizard.results.created' : 'simulatorPlugin.wizard.results.failed') }}
									</el-tag>
								</template>
							</el-table-column>
							<el-table-column :label="t('simulatorPlugin.wizard.results.details')">
								<template #default="{ row }: { row: ISimulatorGenerationResult }">
									<el-button
										v-if="row.success && row.deviceId"
										link
										type="primary"
										:data-test-id="`wizard-view-device-${row.deviceId}`"
										@click="onViewDevice(row.deviceId)"
									>
										{{ t('simulatorPlugin.wizard.actions.viewDevice') }}
									</el-button>
									<span v-else>{{ row.error }}</span>
								</template>
							</el-table-column>
						</el-table>
					</div>
				</div>
			</el-scrollbar>
		</el-card>
	</div>

	<div
		v-if="!isMDDevice"
		class="mt-2 flex justify-end lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2"
	>
		<el-button
			v-if="activeStep === 1"
			:disabled="generating"
			data-test-id="wizard-back"
			@click="activeStep = 0"
		>
			{{ t('devicesModule.wizard.actions.back') }}
		</el-button>
		<el-button
			:disabled="generating"
			data-test-id="wizard-cancel"
			@click="onCancel"
		>
			{{ t('devicesModule.buttons.cancel.title') }}
		</el-button>
		<el-button
			v-if="activeStep === 0"
			type="primary"
			:disabled="!canReview"
			data-test-id="wizard-next"
			@click="activeStep = 1"
		>
			{{ t('devicesModule.wizard.actions.next') }}
		</el-button>
		<el-button
			v-else-if="activeStep === 1"
			type="primary"
			:loading="generating"
			data-test-id="wizard-generate"
			@click="onGenerate"
		>
			{{ t('simulatorPlugin.wizard.actions.generate') }}
		</el-button>
		<el-button
			v-else
			type="primary"
			data-test-id="wizard-generate-more"
			@click="onGenerateMore"
		>
			{{ t('simulatorPlugin.wizard.actions.generateMore') }}
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, onBeforeRouteLeave, useRouter } from 'vue-router';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElCheckbox,
	ElDescriptions,
	ElDescriptionsItem,
	ElForm,
	ElFormItem,
	ElInput,
	ElInputNumber,
	ElOption,
	ElScrollbar,
	ElSelect,
	ElStep,
	ElSteps,
	ElTable,
	ElTableColumn,
	ElTag,
} from 'element-plus';
import { orderBy } from 'natural-orderby';

import { Icon } from '@iconify/vue';

import {
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	ViewHeader,
	injectStoresManager,
	useBreakpoints,
	useLogger,
} from '../../../common';
import { RouteNames as DevicesRouteNames } from '../../../modules/devices';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { spacesStoreKey } from '../../../modules/spaces/store/keys';
import type { ISpace } from '../../../modules/spaces/store/spaces.store.types';
import { type DevicesModuleDeviceCategory, SimulatorPluginBehaviorMode } from '../../../openapi.constants';
import { type ISimulatorGenerationResult, useSimulatorGenerationWizard } from '../composables';
import { RouteNames } from '../simulator.constants';

defineOptions({ name: 'ViewSimulatorDeviceWizard' });

const { t } = useI18n();
const router = useRouter();
const logger = useLogger();
const { isMDDevice, isLGDevice } = useBreakpoints();
const spacesStore = injectStoresManager().getStore(spacesStoreKey);

useMeta({ title: t('simulatorPlugin.wizard.title') });

const { categories, loadingCategories, categoriesError, results, generating, generationError, fetchCategories, generate, reset } =
	useSimulatorGenerationWizard();

const activeStep = ref<number>(0);
const loadingRooms = ref<boolean>(false);
const roomsError = ref<string | null>(null);
const form = reactive({
	category: null as DevicesModuleDeviceCategory | null,
	count: 1,
	namePrefix: '',
	roomId: null as string | null,
	requiredChannelsOnly: false,
	requiredPropertiesOnly: false,
	autoSimulate: false,
	simulateInterval: 5000,
	behaviorMode: SimulatorPluginBehaviorMode.default,
});

const roomOptions = computed<{ value: string; label: string }[]>(() =>
	orderBy(
		spacesStore.findAll().filter((space: ISpace): boolean => space.type === SpaceType.ROOM),
		[(space: ISpace): string => space.name],
		['asc']
	).map((space: ISpace) => ({ value: space.id, label: space.name }))
);
const selectedCategory = computed(() => categories.value.find((category) => category.category === form.category));
const selectedRoomLabel = computed(
	() => roomOptions.value.find((room) => room.value === form.roomId)?.label ?? t('simulatorPlugin.wizard.review.noRoom')
);
const previewNames = computed<string[]>(() =>
	Array.from({ length: form.count }, (_, index): string => (form.count === 1 ? form.namePrefix.trim() : `${form.namePrefix.trim()} ${index + 1}`))
);
const canReview = computed<boolean>(
	() =>
		form.category !== null &&
		form.namePrefix.trim().length > 0 &&
		Number.isInteger(form.count) &&
		form.count >= 1 &&
		form.count <= 20 &&
		(!form.autoSimulate || (Number.isInteger(form.simulateInterval) && form.simulateInterval >= 1000 && form.simulateInterval <= 60000))
);
const succeededCount = computed<number>(() => results.value.filter((result) => result.success).length);
const failedCount = computed<number>(() => results.value.length - succeededCount.value);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(() => [
	{ label: t('devicesModule.breadcrumbs.devices.list'), route: router.resolve({ name: DevicesRouteNames.DEVICES }) },
	{ label: t('simulatorPlugin.wizard.breadcrumb'), route: router.resolve({ name: RouteNames.WIZARD }) },
]);

onBeforeRouteLeave((): boolean => !generating.value);

const onCancel = (): void => {
	if (generating.value) return;

	const target = { name: DevicesRouteNames.DEVICES };
	if (isLGDevice.value) router.replace(target);
	else router.push(target);
};

const onGenerate = async (): Promise<void> => {
	if (!canReview.value || generating.value || form.category === null) return;

	try {
		await generate({
			category: form.category,
			count: form.count,
			namePrefix: form.namePrefix.trim(),
			roomId: form.roomId,
			requiredChannelsOnly: form.requiredChannelsOnly,
			requiredPropertiesOnly: form.requiredPropertiesOnly,
			autoSimulate: form.autoSimulate,
			simulateInterval: form.simulateInterval,
			behaviorMode: form.behaviorMode,
		});
		activeStep.value = 2;
	} catch {
		// The composable exposes a user-facing error and keeps the reviewed form intact for correction.
	}
};

const onGenerateMore = (): void => {
	reset();
	activeStep.value = 0;
};

const onRetryCategories = (): void => {
	fetchCategories().catch((error: unknown): void => logger.error('Failed to load simulator categories', error));
};

const loadRooms = async (): Promise<void> => {
	loadingRooms.value = true;
	roomsError.value = null;

	try {
		await spacesStore.fetch();
	} catch (error) {
		roomsError.value = t('simulatorPlugin.wizard.errors.roomsLoadFailed');
		logger.error('Failed to load rooms', error);
	} finally {
		loadingRooms.value = false;
	}
};

const onRetryRooms = (): void => {
	void loadRooms();
};

const onViewDevice = (id: string): void => {
	const target = { name: DevicesRouteNames.DEVICE, params: { id } };
	if (isLGDevice.value) router.replace(target);
	else router.push(target);
};

onBeforeMount((): void => {
	fetchCategories().catch((error: unknown): void => logger.error('Failed to load simulator categories', error));
	void loadRooms();
});

defineExpose({ activeStep, form, previewNames, onRetryCategories, onRetryRooms, onViewDevice });
</script>

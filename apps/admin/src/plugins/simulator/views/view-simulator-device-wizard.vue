<template>
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

		<el-form
			label-position="top"
			status-icon
		>
			<el-form-item
				:error="validation.error('category')"
				:label="t('devicesModule.fields.devices.category.title')"
				required
			>
				<el-select
					v-model="form.category"
					:placeholder="t('devicesModule.fields.devices.category.placeholder')"
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
					:error="validation.error('namePrefix')"
					:label="t('simulatorPlugin.wizard.fields.namePrefix')"
					required
				>
					<el-input
						v-model="form.namePrefix"
						data-test-id="wizard-name-prefix"
					/>
				</el-form-item>

				<el-form-item
					:error="validation.error('count')"
					required
					:label="t('simulatorPlugin.wizard.fields.count')"
				>
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
					:placeholder="t('devicesModule.fields.devices.room.placeholder')"
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
				<div class="text-xs text-gray-500 mt-1">{{ t('devicesModule.fields.devices.room.hint') }}</div>
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
				<el-form-item
					:error="validation.error('simulateInterval')"
					required
					:label="t('simulatorPlugin.wizard.fields.simulateInterval')"
				>
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
			<el-descriptions-item :label="t('devicesModule.fields.devices.category.title')">
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
</template>
<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import {
	ElAlert,
	ElButton,
	ElCheckbox,
	ElDescriptions,
	ElDescriptionsItem,
	ElForm,
	ElFormItem,
	ElInput,
	ElInputNumber,
	ElOption,
	ElSelect,
	ElTable,
	ElTableColumn,
	ElTag,
} from 'element-plus';
import { orderBy } from 'natural-orderby';

import { injectStoresManager, useBreakpoints, useLogger } from '../../../common';
import { RouteNames as DevicesRouteNames } from '../../../modules/devices';
import { useDeviceWizardFlow } from '../../../modules/devices/components/wizard/device-wizard-flow';
import { useWizardValidation } from '../../../modules/devices/components/wizard/use-wizard-validation';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { spacesStoreKey } from '../../../modules/spaces/store/keys';
import type { ISpace } from '../../../modules/spaces/store/spaces.store.types';
import { type DevicesModuleDeviceCategory, SimulatorPluginBehaviorMode } from '../../../openapi.constants';
import { type ISimulatorGenerationResult, useSimulatorGenerationWizard } from '../composables';

defineOptions({ name: 'ViewSimulatorDeviceWizard' });

const { t } = useI18n();
const router = useRouter();
const logger = useLogger();
const { isLGDevice } = useBreakpoints();
const spacesStore = injectStoresManager().getStore(spacesStoreKey);

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
const validation = useWizardValidation(activeStep, () => ({
	category: form.category ? undefined : t('devicesModule.fields.devices.category.validation.required'),
	namePrefix: form.namePrefix.trim() ? undefined : t('devicesModule.wizard.validation.required'),
	count:
		Number.isInteger(form.count) && form.count >= 1 && form.count <= 20
			? undefined
			: t('devicesModule.wizard.validation.numberRange', { minimum: 1, maximum: 20 }),
	simulateInterval:
		!form.autoSimulate || (Number.isInteger(form.simulateInterval) && form.simulateInterval >= 1000 && form.simulateInterval <= 60000)
			? undefined
			: t('devicesModule.wizard.validation.numberRange', { minimum: 1000, maximum: 60000 }),
}));
const succeededCount = computed<number>(() => results.value.filter((result) => result.success).length);
const failedCount = computed<number>(() => results.value.length - succeededCount.value);

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
useDeviceWizardFlow(
	computed(() => ({
		steps: ['configure', 'review', 'results'].map((step) => t(`simulatorPlugin.wizard.steps.${step}`)),
		activeStep: activeStep.value,
		busy: generating.value,
		dirty: activeStep.value < 2 && (form.category !== null || !!form.namePrefix.trim()),
		actions: [
			...(activeStep.value === 1
				? [
						{
							id: 'back',
							label: t('devicesModule.wizard.actions.back'),
							variant: 'default' as const,
							handler: () => {
								activeStep.value = 0;
							},
						},
					]
				: []),
			{ id: 'cancel', label: t('devicesModule.buttons.cancel.title'), variant: 'link', handler: onCancel },
			activeStep.value === 0
				? {
						id: 'next',
						label: t('devicesModule.wizard.actions.next'),
						variant: 'primary',
						disabled: loadingCategories.value || !!categoriesError.value,
						handler: () => {
							if (validation.validate()) activeStep.value = 1;
						},
					}
				: activeStep.value === 1
					? { id: 'generate', label: t('simulatorPlugin.wizard.actions.generate'), variant: 'primary', handler: onGenerate }
					: { id: 'generate-more', label: t('simulatorPlugin.wizard.actions.generateMore'), variant: 'primary', handler: onGenerateMore },
		],
	}))
);
</script>

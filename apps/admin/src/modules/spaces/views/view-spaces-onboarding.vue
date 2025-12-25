<template>
	<div class="view-spaces-onboarding">
		<app-bar :items="breadcrumbs" />

		<div class="p-4">
			<el-card>
				<template #header>
					<div class="flex items-center justify-between">
						<span class="text-lg font-semibold">{{ t('spacesModule.onboarding.title') }}</span>
					</div>
				</template>

				<el-steps :active="currentStep" finish-status="success" class="mb-6">
					<el-step :title="t('spacesModule.onboarding.steps.spaces.title')" />
					<el-step :title="t('spacesModule.onboarding.steps.displays.title')" />
					<el-step :title="t('spacesModule.onboarding.steps.devices.title')" />
					<el-step :title="t('spacesModule.onboarding.steps.summary.title')" />
				</el-steps>

				<div v-loading="isLoading">
					<!-- Step 1: Spaces -->
					<div v-if="currentStep === 0" class="step-content">
						<p class="mb-4 text-gray-600">{{ t('spacesModule.onboarding.steps.spaces.description') }}</p>

						<div v-if="proposedSpaces.length > 0" class="mb-4">
							<h4 class="mb-2 font-medium">{{ t('spacesModule.onboarding.steps.spaces.proposed') }}</h4>
							<div class="space-y-2">
								<div
									v-for="(space, index) in proposedSpaces"
									:key="index"
									class="flex items-center justify-between rounded border p-3"
								>
									<div class="flex items-center gap-3">
										<el-checkbox v-model="space.selected" />
										<span>{{ space.name }}</span>
										<el-tag size="small" type="info">{{ space.deviceCount }} {{ t('spacesModule.onboarding.devices') }}</el-tag>
									</div>
									<el-button size="small" type="danger" @click="removeProposedSpace(index)">
										<el-icon><icon icon="mdi:delete" /></el-icon>
									</el-button>
								</div>
							</div>
						</div>

						<div v-else class="mb-4 text-center text-gray-500">
							{{ t('spacesModule.onboarding.steps.spaces.noProposals') }}
						</div>

						<div class="mb-4">
							<h4 class="mb-2 font-medium">{{ t('spacesModule.onboarding.steps.spaces.addManual') }}</h4>
							<div class="flex gap-2">
								<el-input v-model="newSpaceName" :placeholder="t('spacesModule.onboarding.steps.spaces.placeholder')" />
								<el-button type="primary" :disabled="!newSpaceName.trim()" @click="handleAddSpace">
									{{ t('spacesModule.buttons.add.title') }}
								</el-button>
							</div>
						</div>

						<div v-if="existingSpaces.length > 0" class="mb-4">
							<h4 class="mb-2 font-medium">{{ t('spacesModule.onboarding.steps.spaces.existing') }}</h4>
							<div class="flex flex-wrap gap-2">
								<el-tag v-for="space in existingSpaces" :key="space.id" size="large">
									{{ space.name }}
								</el-tag>
							</div>
						</div>
					</div>

					<!-- Step 2: Displays -->
					<div v-if="currentStep === 1" class="step-content">
						<p class="mb-4 text-gray-600">{{ t('spacesModule.onboarding.steps.displays.description') }}</p>

						<div v-if="displays.length > 0" class="space-y-3">
							<div v-for="display in displays" :key="display.id" class="flex items-center justify-between rounded border p-3">
								<span>{{ display.name || display.id }}</span>
								<el-select
									:model-value="displayAssignments[display.id]"
									:placeholder="t('spacesModule.onboarding.selectSpace')"
									clearable
									style="width: 200px"
									@update:model-value="(val: string | null) => setDisplayAssignment(display.id, val)"
								>
									<el-option
										v-for="space in allSpaces"
										:key="space.id"
										:label="space.name"
										:value="space.id"
									/>
								</el-select>
							</div>
						</div>
						<div v-else class="text-center text-gray-500">
							{{ t('spacesModule.onboarding.steps.displays.noDisplays') }}
						</div>
					</div>

					<!-- Step 3: Devices -->
					<div v-if="currentStep === 2" class="step-content">
						<p class="mb-4 text-gray-600">{{ t('spacesModule.onboarding.steps.devices.description') }}</p>

						<div v-if="devices.length > 0">
							<el-table :data="devices" style="width: 100%" max-height="400">
								<el-table-column prop="name" :label="t('spacesModule.onboarding.deviceName')" min-width="200" />
								<el-table-column :label="t('spacesModule.onboarding.assignedSpace')" width="250">
									<template #default="{ row }">
										<el-select
											:model-value="deviceAssignments[row.id]"
											:placeholder="t('spacesModule.onboarding.selectSpace')"
											clearable
											style="width: 100%"
											@update:model-value="(val: string | null) => setDeviceAssignment(row.id, val)"
										>
											<el-option
												v-for="space in allSpaces"
												:key="space.id"
												:label="space.name"
												:value="space.id"
											/>
										</el-select>
									</template>
								</el-table-column>
							</el-table>
						</div>
						<div v-else class="text-center text-gray-500">
							{{ t('spacesModule.onboarding.steps.devices.noDevices') }}
						</div>
					</div>

					<!-- Step 4: Summary -->
					<div v-if="currentStep === 3" class="step-content">
						<p class="mb-4 text-gray-600">{{ t('spacesModule.onboarding.steps.summary.description') }}</p>

						<el-descriptions :column="2" border>
							<el-descriptions-item :label="t('spacesModule.onboarding.summary.totalSpaces')">
								{{ summary.spaceCount }}
							</el-descriptions-item>
							<el-descriptions-item :label="t('spacesModule.onboarding.summary.assignedDevices')">
								{{ summary.assignedDevices }}
							</el-descriptions-item>
							<el-descriptions-item :label="t('spacesModule.onboarding.summary.unassignedDevices')">
								{{ summary.unassignedDevices }}
							</el-descriptions-item>
							<el-descriptions-item :label="t('spacesModule.onboarding.summary.assignedDisplays')">
								{{ summary.assignedDisplays }}
							</el-descriptions-item>
						</el-descriptions>

						<div v-if="allSpaces.length > 0" class="mt-4">
							<h4 class="mb-2 font-medium">{{ t('spacesModule.onboarding.summary.bySpace') }}</h4>
							<el-table :data="spaceSummaryData" style="width: 100%">
								<el-table-column prop="name" :label="t('spacesModule.onboarding.spaceName')" />
								<el-table-column prop="devices" :label="t('spacesModule.onboarding.devices')" width="120" align="center" />
								<el-table-column prop="displays" :label="t('spacesModule.onboarding.displays')" width="120" align="center" />
							</el-table>
						</div>
					</div>
				</div>

				<div class="mt-6 flex justify-between">
					<el-button v-if="currentStep > 0" @click="prevStep">
						{{ t('spacesModule.buttons.previous.title') }}
					</el-button>
					<div v-else></div>

					<div class="flex gap-2">
						<el-button @click="handleCancel">
							{{ t('spacesModule.buttons.cancel.title') }}
						</el-button>
						<el-button v-if="currentStep < 3" type="primary" @click="handleNext">
							{{ t('spacesModule.buttons.next.title') }}
						</el-button>
						<el-button v-else type="primary" :loading="isLoading" @click="handleFinish">
							{{ t('spacesModule.buttons.finish.title') }}
						</el-button>
					</div>
				</div>
			</el-card>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Icon } from '@iconify/vue';
import {
	ElButton,
	ElCard,
	ElCheckbox,
	ElDescriptions,
	ElDescriptionsItem,
	ElIcon,
	ElInput,
	ElMessage,
	ElOption,
	ElSelect,
	ElStep,
	ElSteps,
	ElTable,
	ElTableColumn,
	ElTag,
} from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { AppBar } from '../../../common';
import { useSpacesOnboarding, type DeviceInfo, type DisplayInfo } from '../composables';
import { RouteNames } from '../spaces.constants';
import type { ISpace } from '../store';

const { t } = useI18n();
const router = useRouter();

const {
	isLoading,
	currentStep,
	spaces,
	proposedSpaces,
	deviceAssignments,
	displayAssignments,
	fetchProposedSpaces,
	fetchDevices,
	fetchDisplays,
	fetchExistingSpaces,
	createSpacesFromProposals,
	setDeviceAssignment,
	setDisplayAssignment,
	applyAssignments,
	nextStep,
	prevStep,
	addManualSpace,
	removeProposedSpace,
	initializeDeviceAssignments,
	initializeDisplayAssignments,
	getSummary,
} = useSpacesOnboarding();

const newSpaceName = ref('');
const devices = ref<DeviceInfo[]>([]);
const displays = ref<DisplayInfo[]>([]);
const existingSpaces = ref<ISpace[]>([]);

const breadcrumbs = computed(() => [
	{ label: t('spacesModule.headings.spaces'), route: RouteNames.SPACES },
	{ label: t('spacesModule.onboarding.title') },
]);

const allSpaces = computed(() => [...existingSpaces.value, ...spaces.value]);

const summary = computed(() => getSummary());

const spaceSummaryData = computed(() =>
	allSpaces.value.map((space) => ({
		name: space.name,
		devices: summary.value.devicesBySpace[space.id] ?? 0,
		displays: summary.value.displaysBySpace[space.id] ?? 0,
	}))
);

onMounted(async () => {
	try {
		// Fetch existing data
		existingSpaces.value = await fetchExistingSpaces();
		devices.value = await fetchDevices();
		displays.value = await fetchDisplays();

		// Initialize assignments from current data
		initializeDeviceAssignments(devices.value);
		initializeDisplayAssignments(displays.value);

		// Fetch proposed spaces based on device names
		await fetchProposedSpaces();
	} catch {
		ElMessage.error(t('spacesModule.messages.loadError'));
	}
});

const handleAddSpace = (): void => {
	if (newSpaceName.value.trim()) {
		addManualSpace(newSpaceName.value.trim());
		newSpaceName.value = '';
	}
};

const handleNext = async (): Promise<void> => {
	if (currentStep.value === 0) {
		// Create spaces from proposals before moving to next step
		try {
			const createdSpaces = await createSpacesFromProposals();
			if (createdSpaces.length > 0) {
				ElMessage.success(t('spacesModule.onboarding.messages.spacesCreated', { count: createdSpaces.length }));
			}
		} catch {
			ElMessage.error(t('spacesModule.messages.createError'));
			return;
		}
	}
	nextStep();
};

const handleCancel = (): void => {
	router.push({ name: RouteNames.SPACES });
};

const handleFinish = async (): Promise<void> => {
	try {
		const result = await applyAssignments();
		ElMessage.success(
			t('spacesModule.onboarding.messages.completed', {
				devices: result.devicesAssigned,
				displays: result.displaysAssigned,
			})
		);
		router.push({ name: RouteNames.SPACES });
	} catch {
		ElMessage.error(t('spacesModule.messages.saveError'));
	}
};
</script>

<style scoped>
.view-spaces-onboarding {
	min-height: 100vh;
	background-color: var(--el-bg-color-page);
}

.step-content {
	min-height: 300px;
}
</style>

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
			{{ t('spacesModule.onboarding.title') }}
		</template>

		<template #subtitle>
			{{ t('spacesModule.subHeadings.onboarding') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="handleCancel"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:heading="t('spacesModule.onboarding.title')"
		:sub-heading="t('spacesModule.subHeadings.onboarding')"
		icon="mdi:wizard-hat"
	>
		<template
			v-if="isMDDevice"
			#extra
		>
			<div class="flex items-center gap-2">
				<el-button
					link
					@click="handleCancel"
				>
					{{ t('spacesModule.buttons.cancel.title') }}
				</el-button>
				<el-button
					v-if="currentStep > 0"
					@click="prevStep"
				>
					{{ t('spacesModule.buttons.previous.title') }}
				</el-button>
				<el-button
					v-if="currentStep < 3"
					type="primary"
					@click="handleNext"
				>
					{{ t('spacesModule.buttons.next.title') }}
				</el-button>
				<el-button
					v-else
					type="primary"
					:loading="isLoading"
					@click="handleFinish"
				>
					{{ t('spacesModule.buttons.finish.title') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div
		class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2"
	>
		<el-card
			shadow="never"
			class="max-h-full flex flex-col overflow-hidden box-border"
			body-class="p-0! max-h-full overflow-hidden flex flex-col"
		>
			<template #header>
				<el-steps
					:active="currentStep"
					finish-status="success"
					align-center
				>
					<el-step :title="t('spacesModule.onboarding.steps.spaces.title')" />
					<el-step :title="t('spacesModule.onboarding.steps.displays.title')" />
					<el-step :title="t('spacesModule.onboarding.steps.devices.title')" />
					<el-step :title="t('spacesModule.onboarding.steps.summary.title')" />
				</el-steps>
			</template>

			<el-scrollbar class="flex-1 overflow-hidden">
				<div
					v-loading="isLoading"
					class="p-4"
				>
					<!-- Step 1: Spaces -->
					<div v-if="currentStep === 0">
						<el-alert
							type="info"
							:title="t('spacesModule.onboarding.steps.spaces.description')"
							:closable="false"
							show-icon
							class="!mb-4"
						/>

						<div>
							<div v-if="proposedSpaces.length > 0">
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
										<el-button
											size="small"
											type="warning"
											plain
											@click="removeProposedSpace(index)"
										>
											<template #icon>
												<icon icon="mdi:trash" />
											</template>
										</el-button>
									</div>
								</div>
							</div>

							<el-alert
								v-else
								type="info"
								:title="t('spacesModule.onboarding.steps.spaces.noProposals')"
								:closable="false"
								show-icon
								class="!mb-4"
							/>

							<div v-if="existingSpaces.length > 0" class="mb-4">
								<h4 class="mb-2 font-medium">{{ t('spacesModule.onboarding.steps.spaces.existing') }}</h4>
								<div class="flex flex-wrap gap-2">
									<el-tag v-for="space in existingSpaces" :key="space.id" size="large">
										{{ space.name }}
									</el-tag>
								</div>
							</div>
						</div>

						<div v-if="customSpaces.length > 0" class="mb-4">
							<h4 class="mb-2 font-medium">{{ t('spacesModule.onboarding.steps.spaces.custom') }}</h4>
							<div class="space-y-2">
								<div
									v-for="(space, index) in customSpaces"
									:key="index"
									class="flex items-center justify-between rounded border p-3"
								>
									<div class="flex items-center gap-3">
										<el-checkbox v-model="space.selected" />
										<span>{{ space.name }}</span>
									</div>
									<el-button
										size="small"
										type="warning"
										plain
										@click="removeCustomSpace(index)"
									>
										<template #icon>
											<icon icon="mdi:trash" />
										</template>
									</el-button>
								</div>
							</div>
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
					</div>

					<!-- Step 2: Displays -->
					<div v-if="currentStep === 1">
						<el-alert
							type="info"
							:title="t('spacesModule.onboarding.steps.displays.description')"
							:closable="false"
							show-icon
							class="!mb-4"
						/>

						<div v-if="displays.length > 0">
							<el-table :data="displays" class="w-full">
								<el-table-column prop="name" :label="t('spacesModule.onboarding.displayName')" min-width="200">
									<template #default="{ row }">
										<div>
											<div>{{ row.name || row.id }}</div>
											<div v-if="row.macAddress" class="text-xs text-gray-500 mt-1">
												{{ row.macAddress }}
											</div>
										</div>
									</template>
								</el-table-column>
								<el-table-column :label="t('spacesModule.onboarding.assignedSpace')" width="250">
									<template #default="{ row }">
										<el-select
											:model-value="displayAssignments[row.id]"
											:placeholder="t('spacesModule.onboarding.selectSpace')"
											clearable
											class="w-full"
											@update:model-value="(val: string | null) => setDisplayAssignment(row.id, val)"
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

						<el-result v-else class="h-full w-full">
							<template #icon>
								<icon-with-child :size="80">
									<template #primary>
										<icon icon="mdi:monitor" />
									</template>
									<template #secondary>
										<icon icon="mdi:information" />
									</template>
								</icon-with-child>
							</template>

							<template #title>
								{{ t('spacesModule.onboarding.steps.displays.noDisplays') }}
							</template>
						</el-result>
					</div>

					<!-- Step 3: Devices -->
					<div v-if="currentStep === 2">
						<el-alert
							type="info"
							:title="t('spacesModule.onboarding.steps.devices.description')"
							:closable="false"
							show-icon
							class="!mb-4"
						/>

						<div v-if="devices.length > 0">
							<el-table :data="devices" class="w-full">
								<el-table-column prop="name" :label="t('spacesModule.onboarding.deviceName')" min-width="200">
									<template #default="{ row }">
										<div>
											<div>{{ row.name }}</div>
											<div v-if="row.description" class="text-xs text-gray-500 mt-1">
												{{ row.description }}
											</div>
										</div>
									</template>
								</el-table-column>
								<el-table-column :label="t('spacesModule.onboarding.assignedSpace')" width="250">
									<template #default="{ row }">
										<el-select
											:model-value="deviceAssignments[row.id]"
											:placeholder="t('spacesModule.onboarding.selectSpace')"
											clearable
											class="w-full"
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

						<el-result v-else class="h-full w-full">
							<template #icon>
								<icon-with-child :size="80">
									<template #primary>
										<icon icon="mdi:power-plug" />
									</template>
									<template #secondary>
										<icon icon="mdi:information" />
									</template>
								</icon-with-child>
							</template>

							<template #title>
								{{ t('spacesModule.onboarding.steps.devices.noDevices') }}
							</template>
						</el-result>
					</div>

					<!-- Step 4: Summary -->
					<div v-if="currentStep === 3">
						<el-alert
							type="info"
							:title="t('spacesModule.onboarding.steps.summary.description')"
							:closable="false"
							show-icon
							class="!mb-4"
						/>

						<el-card shadow="never" header-class="py-2! px-4!" body-class="px-0!">
							<template #header>
								<div class="font-semibold">
									{{ t('spacesModule.onboarding.summary.overview') }}
								</div>
							</template>

							<div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
								<div>
									<div class="text-2xl font-bold text-blue-600">{{ summary.spaceCount }}</div>
									<div class="text-sm text-gray-500">{{ t('spacesModule.onboarding.summary.totalSpaces') }}</div>
								</div>
								<div>
									<div class="text-2xl font-bold text-green-600">{{ summary.assignedDevices }}</div>
									<div class="text-sm text-gray-500">{{ t('spacesModule.onboarding.summary.assignedDevices') }}</div>
								</div>
								<div>
									<div class="text-2xl font-bold text-yellow-600">{{ summary.unassignedDevices }}</div>
									<div class="text-sm text-gray-500">{{ t('spacesModule.onboarding.summary.unassignedDevices') }}</div>
								</div>
								<div>
									<div class="text-2xl font-bold text-green-600">{{ summary.assignedDisplays }}</div>
									<div class="text-sm text-gray-500">{{ t('spacesModule.onboarding.summary.assignedDisplays') }}</div>
								</div>
								<div>
									<div class="text-2xl font-bold text-yellow-600">{{ summary.unassignedDisplays }}</div>
									<div class="text-sm text-gray-500">{{ t('spacesModule.onboarding.summary.unassignedDisplays') }}</div>
								</div>
							</div>
						</el-card>

						<div v-if="allSpaces.length > 0" class="mt-4">
							<h4 class="mb-2 font-medium">{{ t('spacesModule.onboarding.summary.bySpace') }}</h4>
							<el-table :data="spaceSummaryData" class="w-full">
								<el-table-column prop="name" :label="t('spacesModule.onboarding.spaceName')" />
								<el-table-column prop="devices" :label="t('spacesModule.onboarding.devices')" width="120" align="center" />
								<el-table-column prop="displays" :label="t('spacesModule.onboarding.displays')" width="120" align="center" />
							</el-table>
						</div>
					</div>
				</div>

				<div
					v-if="!isMDDevice"
					class="mt-6 flex justify-between"
				>
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
			</el-scrollbar>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Icon } from '@iconify/vue';
import {
	ElAlert,
	ElButton,
	ElCard,
	ElCheckbox,
	ElIcon,
	ElInput,
	ElOption,
	ElResult,
	ElSelect,
	ElScrollbar,
	ElStep,
	ElSteps,
	ElTable,
	ElTableColumn,
	ElTag,
	vLoading,
} from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import {
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	IconWithChild,
	ViewHeader,
	useBreakpoints,
	useFlashMessage,
} from '../../../common';
import { useSpacesOnboarding, type DeviceInfo, type DisplayInfo } from '../composables';
import { RouteNames } from '../spaces.constants';

const { t } = useI18n();
const router = useRouter();
const flashMessage = useFlashMessage();

const { isMDDevice, isLGDevice } = useBreakpoints();

useMeta({
	title: t('spacesModule.meta.spaces.onboarding.title'),
});

const {
	isLoading,
	currentStep,
	existingSpaces,
	spaces,
	proposedSpaces,
	customSpaces,
	deviceAssignments,
	displayAssignments,
	fetchProposedSpaces,
	fetchDevices,
	fetchDisplays,
	fetchExistingSpaces,
	createDraftSpacesFromProposals,
	createSpacesFromProposals,
	setDeviceAssignment,
	setDisplayAssignment,
	applyAssignments,
	nextStep,
	prevStep,
	addManualSpace,
	removeProposedSpace,
	removeCustomSpace,
	initializeDeviceAssignments,
	initializeDisplayAssignments,
	getSummary,
} = useSpacesOnboarding();

const newSpaceName = ref('');
const devices = ref<DeviceInfo[]>([]);
const displays = ref<DisplayInfo[]>([]);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('spacesModule.breadcrumbs.spaces.list'),
				route: router.resolve({ name: RouteNames.SPACES }),
			},
			{
				label: t('spacesModule.breadcrumbs.spaces.onboarding'),
				route: router.resolve({ name: RouteNames.SPACES_ONBOARDING }),
			},
		];
	}
);

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
		await fetchExistingSpaces();
		devices.value = await fetchDevices();
		displays.value = await fetchDisplays();

		// Initialize assignments from current data
		initializeDeviceAssignments(devices.value);
		initializeDisplayAssignments(displays.value);

		// Fetch proposed spaces based on device names
		await fetchProposedSpaces();
	} catch {
		flashMessage.error(t('spacesModule.messages.loadError'));
	}
});

const handleAddSpace = (): void => {
	if (newSpaceName.value.trim()) {
		addManualSpace(newSpaceName.value.trim());
		newSpaceName.value = '';
	}
};

const handleNext = (): void => {
	if (currentStep.value === 0) {
		// Create draft spaces when moving to step 2 (devices assignment)
		createDraftSpacesFromProposals();
	}
	nextStep();
};

const handleCancel = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SPACES });
	} else {
		router.push({ name: RouteNames.SPACES });
	}
};

const handleFinish = async (): Promise<void> => {
	try {
		// First, create spaces from proposals and custom spaces
		await createSpacesFromProposals();
		
		// Then, apply device and display assignments
		const result = await applyAssignments();
		
		flashMessage.success(
			t('spacesModule.onboarding.messages.completed', {
				devices: result.devicesAssigned,
				displays: result.displaysAssigned,
			})
		);
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.SPACES });
		} else {
			router.push({ name: RouteNames.SPACES });
		}
	} catch {
		flashMessage.error(t('spacesModule.messages.saveError'));
	}
};
</script>

<template>
	<div class="py-4 px-4 max-w-lg mx-auto">
		<p class="text-gray-500 mb-4">
			{{ t('onboardingModule.spaces.description') }}
		</p>

		<!-- Quick add by category -->
		<div class="mb-4">
			<div class="text-sm font-medium mb-2">{{ t('onboardingModule.spaces.quickAdd') }}</div>
			<div class="flex flex-wrap gap-2">
				<el-button
					v-for="cat in quickCategories"
					:key="cat.value"
					size="small"
					:type="hasCategory(cat.value) ? 'primary' : 'default'"
					:plain="hasCategory(cat.value)"
					@click="toggleCategory(cat.value)"
				>
					<template #icon>
						<icon :icon="cat.icon" />
					</template>
					{{ cat.label }}
				</el-button>
			</div>
		</div>

		<el-divider content-position="left">{{ t('onboardingModule.spaces.orAddCustom') }}</el-divider>

		<!-- Custom space name input -->
		<div class="flex flex-row items-end gap-2 mb-4">
			<el-form-item
				:label="t('onboardingModule.spaces.fields.name')"
				class="flex-1 mb-0!"
			>
				<el-input
					v-model="customName"
					:placeholder="t('onboardingModule.spaces.placeholders.name')"
					@keyup.enter="addCustomSpace"
				/>
			</el-form-item>
			<el-button
				type="primary"
				:disabled="!customName.trim()"
				@click="addCustomSpace"
			>
				{{ t('onboardingModule.spaces.buttons.add') }}
			</el-button>
		</div>

		<!-- Added spaces list -->
		<div
			v-if="spacesToCreate.length > 0"
			class="border border-gray-200 rounded-lg overflow-hidden"
		>
			<div class="text-sm font-medium px-3 py-2 bg-gray-50 border-b border-gray-200">
				{{ t('onboardingModule.spaces.roomsToCreate', { count: spacesToCreate.length }) }}
			</div>
			<div class="divide-y divide-gray-200">
				<div
					v-for="(space, index) in spacesToCreate"
					:key="index"
					class="flex items-center justify-between px-3 py-2"
				>
					<div class="flex items-center gap-2">
						<icon
							v-if="space.icon"
							:icon="space.icon"
							class="text-gray-500"
						/>
						<span>{{ space.name }}</span>
						<el-tag
							v-if="space.category"
							size="small"
							type="info"
						>
							{{ space.category }}
						</el-tag>
						<el-tag
							v-if="devicesForSpace(space.name).length > 0"
							size="small"
							type="success"
						>
							{{ devicesForSpace(space.name).length }} {{ t('onboardingModule.spaces.devices.count') }}
						</el-tag>
					</div>
					<el-button
						text
						type="danger"
						size="small"
						@click="removeSpace(index)"
					>
						<template #icon>
							<icon icon="mdi:close" />
						</template>
					</el-button>
				</div>
			</div>
		</div>

		<!-- Device assignment section -->
		<template v-if="discoveredDevices.length > 0">
			<el-divider content-position="left">{{ t('onboardingModule.spaces.devices.title') }}</el-divider>

			<!-- Bulk assignment controls -->
			<div
				v-if="selectedDeviceIds.length > 0"
				class="flex items-center gap-2 mb-3"
			>
				<span class="text-sm text-gray-500">
					{{ t('onboardingModule.spaces.devices.selected', { count: selectedDeviceIds.length }) }}
				</span>
				<el-select
					v-model="bulkAssignTarget"
					:placeholder="t('onboardingModule.spaces.devices.assignTo')"
					size="small"
					clearable
					class="w-48"
				>
					<el-option
						v-for="space in spacesToCreate"
						:key="space.name"
						:label="space.name"
						:value="space.name"
					/>
				</el-select>
				<el-button
					size="small"
					type="primary"
					:disabled="!bulkAssignTarget"
					@click="bulkAssign"
				>
					{{ t('onboardingModule.spaces.devices.assign') }}
				</el-button>
				<el-button
					size="small"
					@click="selectedDeviceIds = []"
				>
					{{ t('onboardingModule.spaces.devices.clearSelection') }}
				</el-button>
			</div>

			<!-- Unassigned devices -->
			<div
				v-if="unassignedDevices.length > 0"
				class="border border-gray-200 rounded-lg overflow-hidden mb-3"
			>
				<div class="text-sm font-medium px-3 py-2 bg-orange-50 border-b border-gray-200 flex items-center gap-2">
					<icon
						icon="mdi:help-circle-outline"
						class="text-orange-500"
					/>
					{{ t('onboardingModule.spaces.devices.unassigned', { count: unassignedDevices.length }) }}
				</div>
				<div class="divide-y divide-gray-200">
					<div
						v-for="device in unassignedDevices"
						:key="device.id"
						class="flex items-center gap-3 px-3 py-2"
					>
						<el-checkbox
							:model-value="selectedDeviceIds.includes(device.id)"
							@change="toggleDeviceSelection(device.id)"
						/>
						<div class="flex-1 min-w-0">
							<div class="text-sm truncate">{{ device.name }}</div>
							<div
								v-if="device.description"
								class="text-xs text-gray-400 truncate"
							>
								{{ device.description }}
							</div>
						</div>
						<el-select
							:model-value="deviceAssignments[device.id] ?? ''"
							:placeholder="t('onboardingModule.spaces.devices.selectSpace')"
							size="small"
							clearable
							class="w-40"
							@update:model-value="assignDevice(device.id, $event || null)"
						>
							<el-option
								v-for="space in spacesToCreate"
								:key="space.name"
								:label="space.name"
								:value="space.name"
							/>
						</el-select>
					</div>
				</div>
			</div>

			<!-- Assigned devices -->
			<div
				v-if="assignedDevices.length > 0"
				class="border border-gray-200 rounded-lg overflow-hidden mb-3"
			>
				<div class="text-sm font-medium px-3 py-2 bg-green-50 border-b border-gray-200 flex items-center gap-2">
					<icon
						icon="mdi:check-circle-outline"
						class="text-green-500"
					/>
					{{ t('onboardingModule.spaces.devices.assigned', { count: assignedDevices.length }) }}
				</div>
				<div class="divide-y divide-gray-200">
					<div
						v-for="device in assignedDevices"
						:key="device.id"
						class="flex items-center gap-3 px-3 py-2"
					>
						<el-checkbox
							:model-value="selectedDeviceIds.includes(device.id)"
							@change="toggleDeviceSelection(device.id)"
						/>
						<div class="flex-1 min-w-0">
							<div class="text-sm truncate">{{ device.name }}</div>
							<div
								v-if="device.description"
								class="text-xs text-gray-400 truncate"
							>
								{{ device.description }}
							</div>
						</div>
						<el-select
							:model-value="deviceAssignments[device.id] ?? ''"
							:placeholder="t('onboardingModule.spaces.devices.selectSpace')"
							size="small"
							clearable
							class="w-40"
							@update:model-value="assignDevice(device.id, $event || null)"
						>
							<el-option
								v-for="space in spacesToCreate"
								:key="space.name"
								:label="space.name"
								:value="space.name"
							/>
						</el-select>
					</div>
				</div>
			</div>
		</template>

		<el-alert
			type="info"
			:title="t('onboardingModule.spaces.hint')"
			:closable="false"
			show-icon
			class="mt-4!"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCheckbox, ElDivider, ElFormItem, ElInput, ElOption, ElSelect, ElTag } from 'element-plus';
import { Icon } from '@iconify/vue';

import { ROOM_DEFINITIONS, useAppOnboarding } from '../composables/composables';

defineOptions({
	name: 'StepSpaces',
});

const { t } = useI18n();
const {
	spacesToCreate,
	discoveredDevices,
	deviceAssignments,
	accountCreated,
	fetchDevices,
	suggestSpacesFromDevices,
} = useAppOnboarding();

const customName = ref('');
const selectedDeviceIds = ref<string[]>([]);
const bulkAssignTarget = ref<string>('');

const quickCategories = ROOM_DEFINITIONS.filter((r) => r.category !== null && r.i18nKey !== null).map((r) => ({
	value: r.category!,
	label: t(`onboardingModule.spaces.categories.${r.i18nKey}`),
	icon: r.icon,
}));

const findCategoryMeta = (category: string): { label: string; icon: string } | undefined => {
	return quickCategories.find((c) => c.value === category);
};

const hasCategory = (category: string): boolean => {
	const meta = findCategoryMeta(category);
	return spacesToCreate.some((s) => s.category === category || (meta && s.name.toLowerCase() === meta.label.toLowerCase()));
};

const toggleCategory = (category: string): void => {
	const meta = findCategoryMeta(category);
	const existingIndex = spacesToCreate.findIndex(
		(s) => s.category === category || (meta && s.name.toLowerCase() === meta.label.toLowerCase()),
	);

	if (existingIndex >= 0) {
		const spaceName = spacesToCreate[existingIndex].name;

		spacesToCreate.splice(existingIndex, 1);

		// Clear assignments pointing to the removed space
		clearAssignmentsForSpace(spaceName);
	} else {
		spacesToCreate.push({
			name: meta?.label ?? category,
			category,
			icon: meta?.icon ?? 'mdi:home',
		});
	}
};

const addCustomSpace = (): void => {
	const name = customName.value.trim();
	if (!name) return;

	spacesToCreate.push({
		name,
		category: null,
		icon: null,
	});

	customName.value = '';
};

const removeSpace = (index: number): void => {
	const spaceName = spacesToCreate[index].name;

	spacesToCreate.splice(index, 1);

	// Clear assignments pointing to the removed space
	clearAssignmentsForSpace(spaceName);
};

const clearAssignmentsForSpace = (spaceName: string): void => {
	for (const deviceId of Object.keys(deviceAssignments)) {
		if (deviceAssignments[deviceId] === spaceName) {
			deviceAssignments[deviceId] = null;
		}
	}

	// Clear bulk-assign dropdown if it pointed to the removed space
	if (bulkAssignTarget.value === spaceName) {
		bulkAssignTarget.value = '';
	}
};

const devicesForSpace = (spaceName: string): string[] => {
	return Object.entries(deviceAssignments)
		.filter(([, name]) => name === spaceName)
		.map(([id]) => id);
};

const unassignedDevices = computed(() => {
	return discoveredDevices.filter((d) => !deviceAssignments[d.id]);
});

const assignedDevices = computed(() => {
	return discoveredDevices.filter((d) => !!deviceAssignments[d.id]);
});

const assignDevice = (deviceId: string, spaceName: string | null): void => {
	deviceAssignments[deviceId] = spaceName;
};

const toggleDeviceSelection = (deviceId: string): void => {
	const idx = selectedDeviceIds.value.indexOf(deviceId);

	if (idx >= 0) {
		selectedDeviceIds.value.splice(idx, 1);
	} else {
		selectedDeviceIds.value.push(deviceId);
	}
};

const bulkAssign = (): void => {
	if (!bulkAssignTarget.value) return;

	for (const deviceId of selectedDeviceIds.value) {
		deviceAssignments[deviceId] = bulkAssignTarget.value;
	}

	selectedDeviceIds.value = [];
	bulkAssignTarget.value = '';
};

onMounted(async () => {
	// Only fetch devices if the user is authenticated (account created)
	if (accountCreated.value) {
		const fetched = await fetchDevices();

		if (fetched && discoveredDevices.length > 0) {
			suggestSpacesFromDevices();
		}
	}
});
</script>

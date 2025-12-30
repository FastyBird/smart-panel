<template>
	<div v-loading="loading">
		<el-table
			v-if="displays.length > 0"
			:data="displays"
			style="width: 100%"
		>
			<el-table-column :label="t('spacesModule.onboarding.displayName')" min-width="200">
				<template #default="{ row }">
					<div class="flex items-center gap-2">
						<el-avatar :size="32">
							<icon icon="mdi:monitor" class="w[20px] h[20px]" />
						</el-avatar>
						<div>
							<div class="font-medium">{{ row.name || row.macAddress }}</div>
							<div class="text-xs text-gray-500">
								{{ row.macAddress }}
							</div>
						</div>
					</div>
				</template>
			</el-table-column>

			<el-table-column label="" width="100" align="center">
				<template #default="{ row }">
					<el-tag
						:type="row.online ? 'success' : 'danger'"
						size="small"
					>
						{{ row.online ? 'Online' : 'Offline' }}
					</el-tag>
				</template>
			</el-table-column>

			<el-table-column :label="t('spacesModule.table.columns.actions')" width="120" align="right">
				<template #default="{ row }">
					<el-dropdown trigger="click">
						<el-button link>
							<icon icon="mdi:dots-vertical" />
						</el-button>
						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item @click="onReassignDisplay(row)">
									<icon icon="mdi:swap-horizontal" class="mr-2" />
									{{ t('spacesModule.detail.displays.reassign') }}
								</el-dropdown-item>
								<el-dropdown-item divided @click="onRemoveDisplay(row)">
									<icon icon="mdi:close" class="mr-2 text-red-500" />
									<span class="text-red-500">{{ t('spacesModule.detail.displays.remove') }}</span>
								</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>
				</template>
			</el-table-column>
		</el-table>

		<el-empty
			v-else
			:description="t('spacesModule.detail.displays.empty')"
			:image-size="60"
		>
			<el-button type="primary" @click="openAddDialog">
				{{ t('spacesModule.detail.displays.add') }}
			</el-button>
		</el-empty>
	</div>

	<!-- Add Display Dialog -->
	<el-dialog
		v-model="showAddDialog"
		:title="t('spacesModule.detail.displays.selectDisplay')"
		width="600px"
	>
		<el-table
			v-if="availableDisplays.length > 0"
			:data="availableDisplays"
			max-height="400px"
			@row-click="onSelectDisplay"
		>
			<el-table-column :label="t('spacesModule.onboarding.displayName')" min-width="200">
				<template #default="{ row }">
					<div class="flex items-center gap-2">
						<el-avatar :size="32">
							<icon icon="mdi:monitor" class="w[20px] h[20px]" />
						</el-avatar>
						<div>
							<div class="font-medium">{{ row.name || row.macAddress }}</div>
							<div class="text-xs text-gray-500">
								{{ row.macAddress }}
							</div>
						</div>
					</div>
				</template>
			</el-table-column>

			<el-table-column :label="t('spacesModule.onboarding.assignedSpace')" width="150">
				<template #default="{ row }">
					<el-tag v-if="row.spaceId" size="small" type="warning">
						{{ getSpaceName(row.spaceId) }}
					</el-tag>
					<span v-else class="text-gray-400 text-sm">-</span>
				</template>
			</el-table-column>
		</el-table>

		<el-empty
			v-else
			:description="t('spacesModule.detail.displays.noAvailable')"
			:image-size="60"
		/>

		<template #footer>
			<el-button @click="showAddDialog = false">
				{{ t('spacesModule.buttons.cancel.title') }}
			</el-button>
		</template>
	</el-dialog>

	<!-- Reassign Display Dialog -->
	<el-dialog
		v-model="showReassignDialog"
		:title="t('spacesModule.detail.displays.reassign')"
		width="400px"
	>
		<p class="mb-4">{{ t('spacesModule.detail.displays.selectRoom') }}</p>

		<el-select
			v-model="selectedTargetSpace"
			:placeholder="t('spacesModule.onboarding.selectSpace')"
			clearable
			class="w-full"
		>
			<el-option
				v-for="space in roomSpaces"
				:key="space.id"
				:label="space.name"
				:value="space.id"
				:disabled="space.id === props.spaceId"
			/>
		</el-select>

		<template #footer>
			<el-button @click="showReassignDialog = false">
				{{ t('spacesModule.buttons.cancel.title') }}
			</el-button>
			<el-button type="primary" :loading="isReassigning" @click="confirmReassign">
				{{ t('spacesModule.buttons.save.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, toRef } from 'vue';

import { Icon } from '@iconify/vue';
import {
	ElAvatar,
	ElButton,
	ElDialog,
	ElDropdown,
	ElDropdownItem,
	ElDropdownMenu,
	ElEmpty,
	ElMessageBox,
	ElOption,
	ElSelect,
	ElTable,
	ElTableColumn,
	ElTag,
	vLoading,
} from 'element-plus';
import { useI18n } from 'vue-i18n';

import { injectStoresManager, useFlashMessage } from '../../../common';
import type { IDisplay } from '../../displays/store/displays.store.types';
import { displaysStoreKey } from '../../displays/store/keys';
import { useSpaceDisplays } from '../composables';
import { SpaceType } from '../spaces.constants';
import { spacesStoreKey } from '../store';

import type { ISpaceDisplaysSectionProps } from './space-displays-section.types';

defineOptions({
	name: 'SpaceDisplaysSection',
});

const props = defineProps<ISpaceDisplaysSectionProps>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const storesManager = injectStoresManager();
const displaysStore = storesManager.getStore(displaysStoreKey);
const spacesStore = storesManager.getStore(spacesStoreKey);

const spaceIdRef = toRef(props, 'spaceId');

const {
	displays,
	loading,
	fetchDisplays,
	reassignDisplay,
	removeDisplay,
} = useSpaceDisplays(spaceIdRef);

const showAddDialog = ref(false);
const showReassignDialog = ref(false);
const selectedDisplay = ref<IDisplay | null>(null);
const selectedTargetSpace = ref<string | null>(null);
const isReassigning = ref(false);

// Get all room-type spaces for reassignment
const roomSpaces = computed(() => {
	return spacesStore.findAll().filter((space) => space.type === SpaceType.ROOM);
});

// Get available displays (not assigned to current space)
const availableDisplays = computed(() => {
	return displaysStore.findAll().filter((display) => {
		// Show all displays that are not in the current space
		return display.spaceId !== props.spaceId;
	});
});

const getSpaceName = (spaceId: string): string => {
	const space = spacesStore.findById(spaceId);
	return space?.name || 'Unknown';
};

const openAddDialog = (): void => {
	showAddDialog.value = true;
};

const onSelectDisplay = async (display: IDisplay): Promise<void> => {
	try {
		await reassignDisplay(display.id, props.spaceId);
		showAddDialog.value = false;
		flashMessage.success(t('spacesModule.messages.edited', { space: display.name || display.macAddress }));
	} catch {
		flashMessage.error(t('spacesModule.messages.saveError'));
	}
};

const onReassignDisplay = (display: IDisplay): void => {
	selectedDisplay.value = display;
	selectedTargetSpace.value = null;
	showReassignDialog.value = true;
};

const confirmReassign = async (): Promise<void> => {
	if (!selectedDisplay.value) return;

	isReassigning.value = true;

	try {
		await reassignDisplay(selectedDisplay.value.id, selectedTargetSpace.value);
		showReassignDialog.value = false;
		flashMessage.success(t('spacesModule.messages.edited', { space: selectedDisplay.value.name || selectedDisplay.value.macAddress }));
	} catch {
		flashMessage.error(t('spacesModule.messages.saveError'));
	} finally {
		isReassigning.value = false;
	}
};

const onRemoveDisplay = async (display: IDisplay): Promise<void> => {
	try {
		await ElMessageBox.confirm(
			t('spacesModule.detail.displays.confirmRemove', { name: display.name || display.macAddress }),
			{
				type: 'warning',
			}
		);

		await removeDisplay(display.id);
		flashMessage.success(t('spacesModule.messages.edited', { space: display.name || display.macAddress }));
	} catch (error) {
		// User cancelled or error occurred
		if (error !== 'cancel') {
			flashMessage.error(t('spacesModule.messages.saveError'));
		}
	}
};

onMounted(async () => {
	await fetchDisplays();
});

// Expose methods for parent component
defineExpose({
	openAddDialog,
});
</script>

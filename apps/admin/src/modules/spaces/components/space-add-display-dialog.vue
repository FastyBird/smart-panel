<template>
	<el-dialog
		v-model="visible"
		:title="t('spacesModule.detail.displays.selectDisplay')"
		class="max-w-[700px]"
		@close="onClose"
	>
		<el-input
			v-model="searchQuery"
			:placeholder="t('displaysModule.fields.search.placeholder')"
			clearable
			class="mb-4"
		>
			<template #prefix>
				<icon icon="mdi:magnify" />
			</template>
		</el-input>

		<el-table
			:data="filteredAvailableDisplays"
			max-height="400px"
			table-layout="fixed"
			row-key="id"
		>
			<template #empty>
				<div
					v-if="availableDisplays.length === 0"
					class="h-full w-full leading-normal"
				>
					<el-result class="h-full w-full">
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
							{{ t('spacesModule.detail.displays.noAvailable') }}
						</template>
					</el-result>
				</div>

				<div
					v-else-if="searchQuery.trim() && filteredAvailableDisplays.length === 0"
					class="h-full w-full leading-normal"
				>
					<el-result class="h-full w-full">
						<template #icon>
							<icon-with-child :size="80">
								<template #primary>
									<icon icon="mdi:monitor" />
								</template>
								<template #secondary>
									<icon icon="mdi:filter-multiple" />
								</template>
							</icon-with-child>
						</template>

						<template #title>
							<el-text class="block">
								{{ t('displaysModule.texts.noFilteredDisplays') }}
							</el-text>
						</template>
					</el-result>
				</div>
			</template>

			<el-table-column :label="t('spacesModule.onboarding.displayName')" min-width="200">
				<template #default="{ row }">
					<div class="flex items-center gap-2">
						<el-avatar :size="32">
							<icon icon="mdi:monitor" class="w[20px] h[20px]" />
						</el-avatar>
						<div>
							<template v-if="row.name">
								<strong class="block">{{ row.name }}</strong>
								<el-text
									size="small"
									class="block leading-4"
									truncated
								>
									{{ row.macAddress }}
								</el-text>
							</template>
							<template v-else>
								<div class="font-medium">{{ row.macAddress }}</div>
							</template>
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

			<el-table-column label="" width="150" align="right">
				<template #default="{ row }">
					<el-button
						:type="row.spaceId ? 'warning' : 'default'"
						plain
						size="small"
						:loading="assigningDisplayId === row.id"
						@click="onAssignDisplay(row)"
					>
						<template #icon>
							<icon :icon="row.spaceId ? 'mdi:swap-horizontal' : 'mdi:plus'" />
						</template>
						{{ row.spaceId ? t('spacesModule.detail.displays.reassign') : t('spacesModule.detail.displays.assign') }}
					</el-button>
				</template>
			</el-table-column>
		</el-table>

		<template #footer>
			<el-button @click="onClose">
				{{ t('spacesModule.buttons.close.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAvatar, ElButton, ElDialog, ElInput, ElResult, ElTable, ElTableColumn, ElTag, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { IconWithChild, injectStoresManager, useFlashMessage } from '../../../common';
import type { IDisplay } from '../../displays/store/displays.store.types';
import { displaysStoreKey } from '../../displays/store/keys';
import { useSpaceDisplays } from '../composables';
import { spacesStoreKey } from '../store';

import type { ISpaceAddDisplayDialogProps } from './space-add-display-dialog.types';

defineOptions({
	name: 'SpaceAddDisplayDialog',
});

const props = defineProps<ISpaceAddDisplayDialogProps>();

const emit = defineEmits<{
	(e: 'update:visible', visible: boolean): void;
	(e: 'display-added'): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const storesManager = injectStoresManager();
const displaysStore = storesManager.getStore(displaysStoreKey);
const spacesStore = storesManager.getStore(spacesStoreKey);

const searchQuery = ref('');
const assigningDisplayId = ref<string | null>(null);

const {
	reassignDisplay,
} = useSpaceDisplays(computed(() => props.spaceId));

// Get available displays (not assigned to current space)
const availableDisplays = computed(() => {
	return displaysStore.findAll()
		.filter((display) => {
			// Show all displays that are not in the current space
			return display.spaceId !== props.spaceId;
		})
		.sort((a, b) => {
			const nameA = a.name || a.macAddress;
			const nameB = b.name || b.macAddress;
			return nameA.localeCompare(nameB);
		});
});

// Filter available displays by search query
const filteredAvailableDisplays = computed(() => {
	const filtered = !searchQuery.value.trim()
		? availableDisplays.value
		: availableDisplays.value.filter((display) => {
			const query = searchQuery.value.toLowerCase();
			return (display.name || '').toLowerCase().includes(query) ||
				display.macAddress.toLowerCase().includes(query);
		});

	return filtered.sort((a, b) => {
		const nameA = a.name || a.macAddress;
		const nameB = b.name || b.macAddress;
		return nameA.localeCompare(nameB);
	});
});

const getSpaceName = (spaceId: string): string => {
	const space = spacesStore.findById(spaceId);
	return space?.name || 'Unknown';
};

const visible = computed({
	get: () => props.visible,
	set: (val) => emit('update:visible', val),
});

const onClose = (): void => {
	visible.value = false;
	searchQuery.value = '';
	assigningDisplayId.value = null;
};

const onAssignDisplay = async (display: IDisplay): Promise<void> => {
	assigningDisplayId.value = display.id;
	try {
		await reassignDisplay(display.id, props.spaceId);
		onClose();
		flashMessage.success(t('spacesModule.messages.edited', { space: display.name || display.macAddress }));
		emit('display-added');
	} catch {
		flashMessage.error(t('spacesModule.messages.saveError'));
	} finally {
		assigningDisplayId.value = null;
	}
};

watch(
	() => props.visible,
	(val) => {
		if (!val) {
			searchQuery.value = '';
			assigningDisplayId.value = null;
		}
	}
);
</script>


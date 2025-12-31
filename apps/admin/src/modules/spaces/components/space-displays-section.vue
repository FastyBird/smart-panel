<template>
	<el-table
		v-loading="loading"
		:element-loading-text="t('spacesModule.detail.displays.loading')"
		:data="displays"
		table-layout="fixed"
		row-key="id"
	>
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

			<el-table-column :label="t('displaysModule.table.columns.state.title')" width="100" align="center">
				<template #default="{ row }">
					<el-tag
						:type="row.online ? 'success' : 'danger'"
						size="small"
					>
						{{ row.online ? 'Online' : 'Offline' }}
					</el-tag>
				</template>
			</el-table-column>

			<el-table-column label="" width="220" align="right">
				<template #default="{ row }">
					<div class="flex items-center gap-2 justify-end">
						<el-button
							type="warning"
							plain
							size="small"
							@click="onReassignDisplay(row)"
						>
							<template #icon>
								<icon icon="mdi:swap-horizontal" />
							</template>
							{{ t('spacesModule.detail.displays.reassign') }}
						</el-button>
						<el-button
							type="danger"
							plain
							size="small"
							@click="onRemoveDisplay(row)"
						>
							<template #icon>
								<icon icon="mdi:close" />
							</template>
							{{ t('spacesModule.detail.displays.remove') }}
						</el-button>
					</div>
				</template>
			</el-table-column>

		<template #empty>
			<div
				v-if="loading"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:monitor" />
							</template>
							<template #secondary>
								<icon icon="mdi:database-refresh" />
							</template>
						</icon-with-child>
					</template>
				</el-result>
			</div>

			<div
				v-else
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
						{{ t('spacesModule.detail.displays.empty') }}
					</template>

					<template #extra>
						<el-button
							type="primary"
							plain
							@click="openAddDialog"
						>
							<template #icon>
								<icon icon="mdi:plus" />
							</template>

							{{ t('spacesModule.detail.displays.add') }}
						</el-button>
					</template>
				</el-result>
			</div>
		</template>
	</el-table>

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
import { onMounted, ref, toRef } from 'vue';

import { Icon } from '@iconify/vue';
import {
	ElAvatar,
	ElButton,
	ElDialog,
	ElMessageBox,
	ElOption,
	ElResult,
	ElSelect,
	ElTable,
	ElTableColumn,
	ElTag,
	ElText,
	vLoading,
} from 'element-plus';
import { useI18n } from 'vue-i18n';

import { IconWithChild, useFlashMessage } from '../../../common';
import type { IDisplay } from '../../displays/store/displays.store.types';
import { useSpaceDisplays, useSpaces } from '../composables';

import type { ISpaceDisplaysSectionProps } from './space-displays-section.types';

defineOptions({
	name: 'SpaceDisplaysSection',
});

const props = defineProps<ISpaceDisplaysSectionProps>();

const emit = defineEmits<{
	(e: 'open-add-dialog'): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const { roomSpaces } = useSpaces();

const spaceIdRef = toRef(props, 'spaceId');

const {
	displays,
	loading,
	fetchDisplays,
	removeDisplay,
	reassignDisplay,
} = useSpaceDisplays(spaceIdRef);

const showReassignDialog = ref(false);
const selectedDisplay = ref<IDisplay | null>(null);
const selectedTargetSpace = ref<string | null>(null);
const isReassigning = ref(false);

const openAddDialog = (): void => {
	// Emit event to parent to open dialog
	emit('open-add-dialog');
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

const onRemoveDisplay = (display: IDisplay): void => {
	const displayName = display.name || display.macAddress;

	ElMessageBox.confirm(
		t('spacesModule.detail.displays.confirmRemove', { name: displayName }),
		t('spacesModule.detail.displays.removeHeading'),
		{
			confirmButtonText: t('spacesModule.buttons.yes.title'),
			cancelButtonText: t('spacesModule.buttons.no.title'),
			type: 'warning',
		}
	)
		.then(async (): Promise<void> => {
			try {
				await removeDisplay(display.id);
				flashMessage.success(t('spacesModule.detail.displays.removed', { name: displayName }));
			} catch {
				flashMessage.error(t('spacesModule.messages.saveError'));
			}
		})
		.catch((): void => {
			flashMessage.info(t('spacesModule.detail.displays.removeCanceled'));
		});
};

onMounted(async () => {
	await fetchDisplays();
});

// Expose methods for parent component
defineExpose({
	openAddDialog,
	fetchDisplays,
});
</script>

<template>
	<!-- One backup's actions: Download in view, Restore and Delete in the more menu, as both overwrite or lose data -->
	<div class="inline-flex items-center gap-1 shrink-0">
		<el-button
			text
			:loading="props.downloading"
			:disabled="props.busy"
			data-test-id="system-backup-download"
			@click="emit('download', props.backup)"
		>
			<template #icon>
				<icon icon="mdi:download" />
			</template>
			{{ t('systemModule.backups.buttons.download') }}
		</el-button>

		<el-tooltip
			:content="t('systemModule.backups.buttons.moreTooltip')"
			placement="top"
		>
			<el-dropdown
				trigger="click"
				placement="bottom-end"
				:disabled="props.busy"
				@command="onCommand"
			>
				<el-button
					:aria-label="t('systemModule.backups.buttons.more', { name: props.backup.name || props.backup.id })"
					:loading="props.busy"
					text
					circle
					data-test-id="system-backup-more"
				>
					<template #icon>
						<icon icon="mdi:dots-horizontal" />
					</template>
				</el-button>

				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item
							command="restore"
							data-test-id="system-backup-restore"
						>
							{{ t('systemModule.backups.buttons.restore') }}
						</el-dropdown-item>
						<el-dropdown-item
							command="delete"
							divided
							class="text-danger!"
							data-test-id="system-backup-delete"
						>
							{{ t('systemModule.backups.buttons.delete') }}
						</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>
		</el-tooltip>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IBackup } from '../composables/useBackups';

defineOptions({
	name: 'SystemBackupActions',
});

const props = withDefaults(
	defineProps<{
		backup: IBackup;
		downloading?: boolean;
		/** Restored or deleted right now */
		busy?: boolean;
	}>(),
	{
		downloading: false,
		busy: false,
	}
);

const emit = defineEmits<{
	(e: 'download', backup: IBackup): void;
	(e: 'restore', backup: IBackup): void;
	(e: 'delete', backup: IBackup): void;
}>();

const { t } = useI18n();

const onCommand = (command: 'restore' | 'delete'): void => {
	if (command === 'restore') {
		emit('restore', props.backup);
	} else {
		emit('delete', props.backup);
	}
};
</script>

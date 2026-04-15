<template>
	<div>
		<div class="p-4">
			<el-alert
				:title="t('systemModule.backups.description')"
				type="info"
				:closable="false"
			/>
		</div>

		<div
			v-loading="loading"
			class="min-h-[100px]"
		>
			<el-table
				:data="backups"
				class="w-full"
				table-layout="fixed"
			>
				<template #empty>
					<div
						v-if="loading"
						class="h-full w-full leading-normal"
					>
						<el-result class="h-full w-full">
							<template #icon>
								<icon-with-child :size="80">
									<template #primary>
										<icon icon="mdi:backup-restore" />
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
										<icon icon="mdi:backup-restore" />
									</template>
									<template #secondary>
										<icon icon="mdi:information" />
									</template>
								</icon-with-child>
							</template>

							<template #title>
								{{ t('systemModule.backups.noBackups') }}
							</template>
						</el-result>
					</div>
				</template>

				<el-table-column
					:label="t('systemModule.backups.columns.name')"
					prop="name"
					min-width="150"
				>
					<template #default="{ row }">
						<div>
							<strong class="block">{{ row.name || row.id }}</strong>
							<el-text
								v-if="row.contributions && row.contributions.length"
								size="small"
								type="info"
								class="block leading-4"
								truncated
							>
								{{ row.contributions.length }} {{ t('systemModule.backups.contributions') }}
							</el-text>
						</div>
					</template>
				</el-table-column>

				<el-table-column
					:label="t('systemModule.backups.columns.version')"
					prop="version"
					width="120"
				/>

				<el-table-column
					:label="t('systemModule.backups.columns.created')"
					prop="created_at"
					width="180"
				>
					<template #default="{ row }">
						{{ formatDate(row.created_at) }}
					</template>
				</el-table-column>

				<el-table-column
					:label="t('systemModule.backups.columns.size')"
					prop="size_bytes"
					width="120"
				>
					<template #default="{ row }">
						{{ formatSize(row.size_bytes) }}
					</template>
				</el-table-column>

				<el-table-column
					:label="t('systemModule.backups.columns.actions')"
					width="240"
					align="right"
				>
					<template #default="{ row }">
						<div @click.stop>
							<el-button
								size="small"
								plain
								:loading="downloadingId === row.id"
								@click="onDownloadBackup(row)"
							>
								<template #icon>
									<icon icon="mdi:download" />
								</template>
							</el-button>

							<el-button
								size="small"
								type="warning"
								plain
								:loading="restoringId === row.id"
								@click="onRestoreBackup(row)"
							>
								<template #icon>
									<icon icon="mdi:backup-restore" />
								</template>
							</el-button>

							<el-button
								size="small"
								type="danger"
								plain
								:loading="deletingId === row.id"
								@click="onDeleteBackup(row)"
							>
								<template #icon>
									<icon icon="mdi:delete" />
								</template>
							</el-button>
						</div>
					</template>
				</el-table-column>
			</el-table>
		</div>

		<!-- Create Backup Dialog -->
		<el-dialog
			v-model="showCreateDialog"
			:title="t('systemModule.backups.createDialog.title')"
			class="max-w-[500px]"
			@close="onCreateDialogClose"
		>
			<el-form
				ref="createFormEl"
				:model="createForm"
				label-position="top"
			>
				<el-form-item
					:label="t('systemModule.backups.createDialog.name')"
					prop="name"
				>
					<el-input
						v-model="createForm.name"
						:placeholder="t('systemModule.backups.createDialog.namePlaceholder')"
					/>
				</el-form-item>
			</el-form>

			<template #footer>
				<el-button @click="showCreateDialog = false">
					{{ t('systemModule.buttons.cancel.title') }}
				</el-button>
				<el-button
					type="primary"
					:loading="creating"
					@click="onCreateBackup"
				>
					{{ t('systemModule.backups.createDialog.submit') }}
				</el-button>
			</template>
		</el-dialog>

		<!-- Restore Confirmation Dialog -->
		<el-dialog
			v-model="showRestoreDialog"
			:title="t('systemModule.backups.restoreDialog.title')"
			class="max-w-[500px]"
		>
			<el-alert
				:title="t('systemModule.backups.restoreDialog.warning')"
				type="warning"
				:closable="false"
				show-icon
			/>

			<p class="mt-3">
				{{ t('systemModule.backups.restoreDialog.message', { name: restoreTarget?.name || restoreTarget?.id }) }}
			</p>

			<template #footer>
				<el-button @click="showRestoreDialog = false">
					{{ t('systemModule.buttons.cancel.title') }}
				</el-button>
				<el-button
					type="danger"
					:loading="restoringId !== null"
					@click="onConfirmRestore"
				>
					{{ t('systemModule.backups.restoreDialog.confirm') }}
				</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElDialog,
	ElForm,
	ElFormItem,
	ElInput,
	ElMessageBox,
	ElResult,
	ElTable,
	ElTableColumn,
	ElText,
	type FormInstance,
	vLoading,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import { IconWithChild, useFlashMessage } from '../../../common';
import type { IBackup } from '../composables/useBackups';
import { useBackups } from '../composables/useBackups';

interface ICreateBackupForm {
	name: string;
}

defineOptions({
	name: 'SystemBackups',
});

const { t } = useI18n();
const flashMessage = useFlashMessage();

const { backups, loading, creating, fetchBackups, createBackup, deleteBackup, restoreBackup, downloadBackup, uploadBackup } = useBackups();

const showCreateDialog = ref(false);
const showRestoreDialog = ref(false);
const deletingId = ref<string | null>(null);
const restoringId = ref<string | null>(null);
const downloadingId = ref<string | null>(null);
const restoreTarget = ref<IBackup | null>(null);

const createFormEl = ref<FormInstance | undefined>(undefined);

const createForm = reactive<ICreateBackupForm>({
	name: '',
});

const formatDate = (date: string): string => {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(new Date(date));
};

const formatSize = (bytes: number): string => {
	if (bytes < 1024) {
		return `${bytes} B`;
	}

	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}

	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const resetCreateForm = (): void => {
	createForm.name = '';
	createFormEl.value?.resetFields();
};

const onCreateDialogClose = (): void => {
	resetCreateForm();
};

const onCreateBackup = async (): Promise<void> => {
	creating.value = true;

	try {
		const result = await createBackup(createForm.name || undefined);

		if (result) {
			showCreateDialog.value = false;
			resetCreateForm();

			flashMessage.success(t('systemModule.backups.messages.created'));
		} else {
			flashMessage.error(t('systemModule.backups.messages.createError'));
		}
	} catch {
		flashMessage.error(t('systemModule.backups.messages.createError'));
	}
};

const onDeleteBackup = (backup: IBackup): void => {
	ElMessageBox.confirm(
		t('systemModule.backups.deleteDialog.message', { name: backup.name || backup.id }),
		t('systemModule.backups.deleteDialog.title'),
		{
			confirmButtonText: t('systemModule.buttons.yes.title'),
			cancelButtonText: t('systemModule.buttons.cancel.title'),
			type: 'warning',
			confirmButtonClass: 'el-button--danger',
		},
	)
		.then(async () => {
			deletingId.value = backup.id;

			try {
				const result = await deleteBackup(backup.id);

				if (result) {
					flashMessage.success(t('systemModule.backups.messages.deleted'));
				} else {
					flashMessage.error(t('systemModule.backups.messages.deleteError'));
				}
			} catch {
				flashMessage.error(t('systemModule.backups.messages.deleteError'));
			} finally {
				deletingId.value = null;
			}
		})
		.catch(() => {
			// Cancelled
		});
};

const onRestoreBackup = (backup: IBackup): void => {
	restoreTarget.value = backup;
	showRestoreDialog.value = true;
};

const onConfirmRestore = async (): Promise<void> => {
	if (!restoreTarget.value) {
		return;
	}

	restoringId.value = restoreTarget.value.id;

	try {
		const result = await restoreBackup(restoreTarget.value.id);

		if (result) {
			showRestoreDialog.value = false;
			restoreTarget.value = null;

			flashMessage.success(t('systemModule.backups.messages.restored'));
		} else {
			flashMessage.error(t('systemModule.backups.messages.restoreError'));
		}
	} catch {
		flashMessage.error(t('systemModule.backups.messages.restoreError'));
	} finally {
		restoringId.value = null;
	}
};

const onDownloadBackup = async (backup: IBackup): Promise<void> => {
	downloadingId.value = backup.id;

	try {
		await downloadBackup(backup);
	} catch {
		flashMessage.error(t('systemModule.backups.messages.downloadError'));
	} finally {
		downloadingId.value = null;
	}
};

const onUploadBackup = async (options: { file: File }): Promise<void> => {
	try {
		const result = await uploadBackup(options.file);

		if (result) {
			flashMessage.success(t('systemModule.backups.messages.uploaded'));
		} else {
			flashMessage.error(t('systemModule.backups.messages.uploadError'));
		}
	} catch {
		flashMessage.error(t('systemModule.backups.messages.uploadError'));
	}
};

const openCreateDialog = (): void => {
	showCreateDialog.value = true;
};

defineExpose({ openCreateDialog, onUploadBackup });

onMounted(async () => {
	await fetchBackups();
});
</script>

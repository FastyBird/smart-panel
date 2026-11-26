<template>
	<state-view
		v-if="loading && backups.length === 0"
		kind="loading"
		icon="mdi:backup-restore"
		:title="t('systemModule.backups.loading')"
		class="flex-1"
	/>

	<state-view
		v-else-if="failed && backups.length === 0"
		kind="error"
		icon="mdi:backup-restore"
		:title="t('systemModule.backups.messages.loadError')"
		class="flex-1"
		data-test-id="system-backups-error"
	>
		<template #action>
			<el-button
				plain
				@click="fetchBackups"
			>
				{{ t('systemModule.buttons.retry.title') }}
			</el-button>
		</template>
	</state-view>

	<!-- Template 5, settings and status: how recent the last backup is, then the backups and the upload of one -->
	<settings-layout
		v-else
		:sections="sections"
	>
		<template #banner>
			<el-alert
				:type="banner.type"
				:title="banner.title"
				:description="banner.description"
				:closable="false"
				show-icon
				data-test-id="system-backups-banner"
			/>
		</template>

		<settings-section
			id="backups"
			:title="t('systemModule.backups.title')"
			:description="t('systemModule.backups.description')"
			icon="mdi:backup-restore"
		>
			<el-input
				v-if="backups.length > 0"
				v-model="searchQuery"
				:placeholder="t('systemModule.backups.search.placeholder')"
				:aria-label="t('systemModule.backups.search.placeholder')"
				class="max-w-[320px] mb-4"
				clearable
				data-test-id="system-backups-search"
			>
				<template #prefix>
					<icon
						icon="mdi:magnify"
						aria-hidden="true"
					/>
				</template>
			</el-input>

			<state-view
				v-if="filteredBackups.length === 0"
				kind="empty"
				icon="mdi:backup-restore"
				:title="backups.length === 0 ? t('systemModule.backups.noBackups') : t('systemModule.backups.noMatches')"
				data-test-id="system-backups-empty"
			>
				<template #action>
					<el-button
						v-if="backups.length === 0"
						type="primary"
						@click="openCreateDialog"
					>
						{{ t('systemModule.backups.buttons.create') }}
					</el-button>
					<el-button
						v-else
						plain
						@click="searchQuery = ''"
					>
						{{ t('systemModule.buttons.resetFilters.title') }}
					</el-button>
				</template>
			</state-view>

			<!-- Phone: one row per backup, its details under the name -->
			<ul
				v-else-if="isPhone"
				class="flex flex-col m-0 p-0 list-none"
				data-test-id="system-backups-rows"
			>
				<li
					v-for="(backup, index) in filteredBackups"
					:key="backup.id"
					:class="['flex items-start gap-3 py-3', index > 0 ? 'border-t border-t-solid border-light' : '']"
					data-test-id="system-backups-row"
				>
					<div class="flex flex-col gap-0.5 flex-1 min-w-0">
						<span class="text-card-title break-words">{{ backup.name || backup.id }}</span>
						<span class="text-help">
							{{ formatDate(backup.created_at) }} · {{ formatSize(backup.size_bytes) }} ·
							<span class="text-mono">{{ backup.version }}</span>
						</span>
					</div>

					<system-backup-actions
						:backup="backup"
						:downloading="downloadingId === backup.id"
						:busy="isBusy(backup)"
						@download="onDownloadBackup"
						@restore="onRestoreBackup"
						@delete="onDeleteBackup"
					/>
				</li>
			</ul>

			<el-table
				v-else
				:data="filteredBackups"
				class="w-full"
				table-layout="fixed"
				data-test-id="system-backups-table"
			>
				<el-table-column
					:label="t('systemModule.backups.columns.name')"
					prop="name"
					min-width="180"
				>
					<template #default="{ row }: { row: IBackup }">
						<div class="flex flex-col min-w-0">
							<span class="text-card-title truncate">{{ row.name || row.id }}</span>
							<span
								v-if="row.contributions && row.contributions.length"
								class="text-help truncate"
							>
								{{ row.contributions.length }} {{ t('systemModule.backups.contributions') }}
							</span>
						</div>
					</template>
				</el-table-column>

				<el-table-column
					v-if="!isTabletPortrait"
					:label="t('systemModule.backups.columns.version')"
					prop="version"
					width="140"
				>
					<template #default="{ row }: { row: IBackup }">
						<span class="text-mono truncate">{{ row.version }}</span>
					</template>
				</el-table-column>

				<el-table-column
					:label="t('systemModule.backups.columns.created')"
					prop="created_at"
					width="180"
				>
					<template #default="{ row }: { row: IBackup }">
						{{ formatDate(row.created_at) }}
					</template>
				</el-table-column>

				<el-table-column
					:label="t('systemModule.backups.columns.size')"
					prop="size_bytes"
					width="100"
					align="right"
				>
					<template #default="{ row }: { row: IBackup }">
						<span class="tabular-nums">{{ formatSize(row.size_bytes) }}</span>
					</template>
				</el-table-column>

				<el-table-column
					:label="t('systemModule.backups.columns.actions')"
					width="168"
					align="right"
				>
					<template #default="{ row }: { row: IBackup }">
						<system-backup-actions
							:backup="row"
							:downloading="downloadingId === row.id"
							:busy="isBusy(row)"
							@download="onDownloadBackup"
							@restore="onRestoreBackup"
							@delete="onDeleteBackup"
						/>
					</template>
				</el-table-column>
			</el-table>
		</settings-section>

		<settings-section
			id="upload"
			:title="t('systemModule.backups.upload.title')"
			:description="t('systemModule.backups.upload.description')"
			icon="mdi:upload"
		>
			<div class="flex flex-wrap items-center gap-3">
				<el-button
					:loading="uploading"
					data-test-id="system-backups-upload"
					@click="openUploadPicker"
				>
					<template #icon>
						<icon icon="mdi:upload" />
					</template>
					{{ t('systemModule.backups.buttons.upload') }}
				</el-button>
				<span class="text-help">{{ t('systemModule.backups.upload.hint') }}</span>
			</div>
		</settings-section>
	</settings-layout>

	<input
		ref="uploadInput"
		type="file"
		accept=".tar.gz,.gz"
		class="hidden"
		data-test-id="system-backups-upload-input"
		@change="onUploadPicked"
	/>

	<el-dialog
		v-model="showCreateDialog"
		:title="t('systemModule.backups.createDialog.title')"
		:width="isPhone ? '100%' : '480px'"
		append-to-body
		@close="onCreateDialogClose"
	>
		<el-form
			ref="createFormEl"
			:model="createForm"
			label-position="top"
			@submit.prevent="onCreateBackup"
		>
			<el-form-item
				:label="t('systemModule.backups.createDialog.name')"
				prop="name"
			>
				<el-input
					v-model="createForm.name"
					:placeholder="t('systemModule.backups.createDialog.namePlaceholder')"
					data-test-id="system-backups-create-name"
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
				data-test-id="system-backups-create-submit"
				@click="onCreateBackup"
			>
				{{ t('systemModule.backups.createDialog.submit') }}
			</el-button>
		</template>
	</el-dialog>

	<el-dialog
		v-model="showRestoreDialog"
		:title="t('systemModule.backups.restoreDialog.title')"
		:width="isPhone ? '100%' : '480px'"
		append-to-body
	>
		<el-alert
			:title="t('systemModule.backups.restoreDialog.warning')"
			type="warning"
			:closable="false"
			show-icon
		/>

		<p class="text-body mt-3 mb-0">
			{{ t('systemModule.backups.restoreDialog.message', { name: restoreTarget?.name || restoreTarget?.id }) }}
		</p>

		<template #footer>
			<el-button @click="showRestoreDialog = false">
				{{ t('systemModule.buttons.cancel.title') }}
			</el-button>
			<el-button
				type="danger"
				:loading="restoringId !== null"
				data-test-id="system-backups-restore-confirm"
				@click="onConfirmRestore"
			>
				{{ t('systemModule.backups.buttons.restore') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElDialog, ElForm, ElFormItem, ElInput, ElMessageBox, ElTable, ElTableColumn, type FormInstance } from 'element-plus';

import { Icon } from '@iconify/vue';

import { SettingsLayout, type SettingsLayoutSection, SettingsSection, StateView, useFlashMessage, useSizeClass } from '../../../common';
import type { IBackup } from '../composables/useBackups';
import { useBackups } from '../composables/useBackups';
import { formatSize } from '../utils/system.utils';

import SystemBackupActions from './system-backup-actions.vue';

interface ICreateBackupForm {
	name: string;
}

defineOptions({
	name: 'SystemBackups',
});

const { t } = useI18n();
const flashMessage = useFlashMessage();
const { isPhone, isTabletPortrait } = useSizeClass();

const { backups, loading, failed, creating, fetchBackups, createBackup, deleteBackup, restoreBackup, downloadBackup, uploadBackup } = useBackups();

// A backup this old or older gets the banner's reminder
const STALE_AFTER_DAYS = 30;

const showCreateDialog = ref<boolean>(false);
const showRestoreDialog = ref<boolean>(false);
const deletingId = ref<string | null>(null);
const restoringId = ref<string | null>(null);
const downloadingId = ref<string | null>(null);
const uploading = ref<boolean>(false);
const restoreTarget = ref<IBackup | null>(null);

const uploadInput = ref<HTMLInputElement | null>(null);

const searchQuery = ref<string>('');

const filteredBackups = computed<IBackup[]>((): IBackup[] => {
	const query = searchQuery.value.trim().toLowerCase();

	if (query === '') {
		return backups.value;
	}

	return backups.value.filter((backup) => {
		return (
			(backup.name ?? '').toLowerCase().includes(query) || backup.id.toLowerCase().includes(query) || backup.version.toLowerCase().includes(query)
		);
	});
});

const sections = computed<SettingsLayoutSection[]>((): SettingsLayoutSection[] => [
	{ id: 'backups', label: t('systemModule.backups.title'), icon: 'mdi:backup-restore', count: backups.value.length },
	{ id: 'upload', label: t('systemModule.backups.upload.title'), icon: 'mdi:upload' },
]);

const latestBackup = computed<IBackup | null>((): IBackup | null =>
	backups.value.reduce<IBackup | null>(
		(latest, backup) => (latest === null || Date.parse(backup.created_at) > Date.parse(latest.created_at) ? backup : latest),
		null
	)
);

const banner = computed<{ type: 'success' | 'warning'; title: string; description: string }>(() => {
	const latest = latestBackup.value;

	if (latest === null) {
		return {
			type: 'warning',
			title: t('systemModule.backups.banner.noneTitle'),
			description: t('systemModule.backups.banner.noneDescription'),
		};
	}

	const when = formatDate(latest.created_at);

	if (Date.now() - Date.parse(latest.created_at) >= STALE_AFTER_DAYS * 24 * 60 * 60 * 1000) {
		return {
			type: 'warning',
			title: t('systemModule.backups.banner.staleTitle', { days: STALE_AFTER_DAYS }),
			description: t('systemModule.backups.banner.lastBackup', { date: when }),
		};
	}

	return {
		type: 'success',
		title: t('systemModule.backups.banner.okTitle'),
		description: t('systemModule.backups.banner.lastBackup', { date: when }),
	};
});

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

// One action at a time per backup: no download while it is restored or deleted, and so on
const isBusy = (backup: IBackup): boolean => deletingId.value === backup.id || restoringId.value === backup.id;

const resetCreateForm = (): void => {
	createForm.name = '';
	createFormEl.value?.resetFields();
};

const onCreateDialogClose = (): void => {
	resetCreateForm();
};

const onCreateBackup = async (): Promise<void> => {
	if (creating.value) {
		return;
	}

	try {
		// Treat whitespace-only input as empty so the backend generates a default name
		// instead of persisting a blank-looking entry that still passes non-empty validation
		const trimmedName = createForm.name.trim();
		const result = await createBackup(trimmedName.length > 0 ? trimmedName : undefined);

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
			confirmButtonText: t('systemModule.backups.buttons.delete'),
			cancelButtonText: t('systemModule.buttons.cancel.title'),
			type: 'warning',
			confirmButtonClass: 'el-button--danger',
		}
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
	if (!restoreTarget.value || restoringId.value !== null) {
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

const onUploadBackup = async (file: File): Promise<void> => {
	uploading.value = true;

	try {
		const result = await uploadBackup(file);

		if (result) {
			flashMessage.success(t('systemModule.backups.messages.uploaded'));
		} else {
			flashMessage.error(t('systemModule.backups.messages.uploadError'));
		}
	} catch {
		flashMessage.error(t('systemModule.backups.messages.uploadError'));
	} finally {
		uploading.value = false;
	}
};

const openUploadPicker = (): void => {
	if (uploading.value) {
		return;
	}

	uploadInput.value?.click();
};

const onUploadPicked = (event: Event): void => {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];

	// Cleared, so picking the same file again still reports a change
	input.value = '';

	if (file) {
		void onUploadBackup(file);
	}
};

const openCreateDialog = (): void => {
	showCreateDialog.value = true;
};

defineExpose({ openCreateDialog, openUploadPicker });

onMounted(async () => {
	await fetchBackups();
});
</script>

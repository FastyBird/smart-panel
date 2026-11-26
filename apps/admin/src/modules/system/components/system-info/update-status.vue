<template>
	<!-- The software update section: the installed and the latest version, when it was last checked, and the one action
	     that fits: check, or install what was found -->
	<div
		class="flex flex-col gap-4"
		data-test-id="update-status"
	>
		<div class="flex flex-wrap items-center gap-3">
			<status-tag
				:status="state.status"
				:label="state.label"
				data-test-id="update-status-state"
			/>

			<span class="flex-1" />

			<el-button
				v-if="!updateAvailable"
				:loading="loading"
				:disabled="isUpdating"
				data-test-id="update-status-check"
				@click="onCheckForUpdates"
			>
				<template #icon>
					<icon icon="mdi:refresh" />
				</template>
				{{ t('systemModule.buttons.update.checkForUpdates') }}
			</el-button>
			<el-button
				v-else
				type="primary"
				data-test-id="update-status-install"
				@click="onOpenUpdateDialog"
			>
				<template #icon>
					<icon icon="mdi:download" />
				</template>
				{{ t('systemModule.buttons.update.installUpdate') }}
			</el-button>
		</div>

		<kv-grid
			:items="details"
			:cols="3"
		/>
	</div>

	<el-dialog
		v-model="showUpdateDialog"
		:title="t('systemModule.headings.update.title')"
		:close-on-click-modal="!isUpdating && !waitingForRestart"
		:close-on-press-escape="!isUpdating && !waitingForRestart"
		:show-close="!isUpdating && !waitingForRestart"
	>
		<div class="mb-4">
			{{ t('systemModule.messages.update.confirmInstall', { version: latestVersion }) }}
		</div>

		<el-alert
			v-if="updateType === 'major'"
			type="warning"
			:title="t('systemModule.messages.update.majorUpdateWarning', { version: latestVersion })"
			class="mb-4"
			:closable="false"
		/>

		<template v-if="isUpdating || status === 'failed' || status === 'complete'">
			<el-progress
				:percentage="progressPercent || 0"
				:status="status === 'failed' ? 'exception' : status === 'complete' ? 'success' : undefined"
				class="mb-2"
			/>
			<el-text
				v-if="waitingForRestart"
				class="block mb-4"
			>
				{{ t('systemModule.texts.update.waitingForRestart') }}
			</el-text>
			<el-text
				v-else-if="phase"
				class="block mb-4"
			>
				{{ phase }}
			</el-text>
		</template>

		<el-alert
			v-if="status === 'complete'"
			type="success"
			:title="t('systemModule.messages.update.updateComplete')"
			class="mb-4"
			:closable="false"
		/>

		<el-alert
			v-if="error"
			type="error"
			:title="t(error)"
			class="mb-4"
			:closable="false"
		/>

		<template #footer>
			<el-button
				v-if="!isUpdating && status !== 'complete'"
				@click="showUpdateDialog = false"
			>
				{{ t('systemModule.buttons.cancel.title') }}
			</el-button>
			<el-button
				v-if="!isUpdating && status !== 'complete'"
				type="primary"
				@click="onInstallUpdate"
			>
				<template #icon>
					<icon icon="mdi:download" />
				</template>
				{{ t('systemModule.buttons.update.installUpdate') }}
			</el-button>
			<el-button
				v-if="status === 'complete'"
				@click="showUpdateDialog = false"
			>
				{{ t('systemModule.buttons.close.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElDialog, ElNotification, ElProgress, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { KvGrid, type KvGridItem, StatusTag, type StatusTagStatus } from '../../../../common';
import { useUpdateStatus } from '../../composables/composables';

defineOptions({
	name: 'UpdateStatus',
});

const { t, locale } = useI18n();

const showUpdateDialog = ref<boolean>(false);

const {
	currentVersion,
	latestVersion,
	updateAvailable,
	updateType,
	lastChecked,
	status,
	phase,
	progressPercent,
	error,
	loading,
	waitingForRestart,
	isUpdating,
	fetchStatus,
	checkForUpdates,
	installUpdate,
} = useUpdateStatus();

watch(showUpdateDialog, (visible, wasVisible): void => {
	if (wasVisible && !visible && status.value === 'complete') {
		// The update replaces hashed admin assets. Load the new bundle before
		// navigating to a lazy-loaded page from this pre-update browser session.
		window.location.reload();
	}
});

const lastCheckedFormatted = computed<string | null>((): string | null => {
	if (!lastChecked.value) {
		return null;
	}

	return new Intl.DateTimeFormat(locale.value, {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(lastChecked.value);
});

// "Up to date" only once the backend answered: the installed version is known from its first status response, so
// without it the state is being checked, or could not be read
const state = computed<{ status: StatusTagStatus; label: string }>((): { status: StatusTagStatus; label: string } => {
	if (updateAvailable.value && latestVersion.value) {
		return { status: 'warn', label: t('systemModule.texts.update.available', { version: latestVersion.value }) };
	}

	if (currentVersion.value === null) {
		return { status: 'info', label: loading.value ? t('systemModule.texts.update.checking') : t('systemModule.texts.update.noVersionInfo') };
	}

	return { status: 'ok', label: t('systemModule.texts.update.upToDate') };
});

// The latest version carries the size of the step, "1.4.0 (minor)"
const details = computed<KvGridItem[]>((): KvGridItem[] => [
	{ label: t('systemModule.labels.update.currentVersion'), value: currentVersion.value, mono: true },
	{
		label: t('systemModule.labels.update.latestVersion'),
		value: latestVersion.value ? (updateType.value ? `${latestVersion.value} (${updateType.value})` : latestVersion.value) : null,
		mono: true,
	},
	{ label: t('systemModule.labels.update.lastChecked'), value: lastCheckedFormatted.value },
]);

const onOpenUpdateDialog = (): void => {
	if (!isUpdating.value) {
		status.value = 'idle';
		phase.value = null;
		progressPercent.value = null;
		error.value = null;
	}

	showUpdateDialog.value = true;
};

const onCheckForUpdates = async (): Promise<void> => {
	try {
		await checkForUpdates();
	} catch {
		ElNotification.error(t('systemModule.messages.update.checkFailed'));
	}
};

const onInstallUpdate = async (): Promise<void> => {
	try {
		await installUpdate(updateType.value === 'major');

		ElNotification.success(t('systemModule.messages.update.updateStarted'));
	} catch {
		ElNotification.error(t('systemModule.messages.update.installFailed'));
	}
};

onMounted((): void => {
	void fetchStatus();
});
</script>

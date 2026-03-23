<template>
	<el-card
		class="md:m-2 xs:my-1"
		body-class="p-0!"
	>
		<el-descriptions
			:label-width="170"
			:column="1"
			border
		>
			<template #title>
				<div class="flex flex-row items-center pt-2 pl-2 min-h-10">
					<el-icon
						class="mr-2"
						size="28"
					>
						<icon icon="mdi:update" />
					</el-icon>
					{{ t('systemModule.headings.update.title') }}
					<el-tag
						v-if="updateAvailable"
						type="warning"
						class="ml-2"
					>
						{{ t('systemModule.texts.update.available') }}
					</el-tag>
				</div>
			</template>

			<el-descriptions-item :label="t('systemModule.labels.update.currentVersion')">
				{{ currentVersion || '-' }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('systemModule.labels.update.latestVersion')">
				<span v-if="latestVersion">
					{{ latestVersion }}
					<el-tag
						v-if="updateType"
						size="small"
						:type="updateTypeColor"
						class="ml-2"
					>
						{{ updateType }}
					</el-tag>
				</span>
				<span v-else>-</span>
			</el-descriptions-item>
			<el-descriptions-item :label="t('systemModule.labels.update.lastChecked')">
				{{ lastCheckedFormatted || '-' }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('systemModule.labels.update.actions')">
				<el-button
					v-if="!updateAvailable"
					size="small"
					:loading="loading"
					:disabled="isUpdating"
					@click="onCheckForUpdates"
				>
					<template #icon>
						<icon icon="mdi:refresh" />
					</template>
					{{ t('systemModule.buttons.update.checkForUpdates') }}
				</el-button>
				<el-button
					v-else
					size="small"
					type="primary"
					@click="onOpenUpdateDialog"
				>
					<template #icon>
						<icon icon="mdi:download" />
					</template>
					{{ t('systemModule.buttons.update.installUpdate') }}
				</el-button>
			</el-descriptions-item>
		</el-descriptions>
	</el-card>

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

		<template v-if="isUpdating || status === 'failed'">
			<el-progress
				:percentage="waitingForRestart ? 90 : (progressPercent || 0)"
				:status="status === 'failed' ? 'exception' : undefined"
				:indeterminate="waitingForRestart"
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
				link
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
				link
				@click="showUpdateDialog = false"
			>
				{{ t('systemModule.buttons.close.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElDescriptions,
	ElDescriptionsItem,
	ElDialog,
	ElIcon,
	ElNotification,
	ElProgress,
	ElTag,
	ElText,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import { useUpdateStatus } from '../../composables/composables';

defineOptions({
	name: 'UpdateStatus',
});

const { t } = useI18n();

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

const updateTypeColor = computed<'danger' | 'warning' | 'success' | 'info'>((): 'danger' | 'warning' | 'success' | 'info' => {
	switch (updateType.value) {
		case 'major':
			return 'danger';
		case 'minor':
			return 'warning';
		case 'patch':
			return 'success';
		default:
			return 'info';
	}
});

const lastCheckedFormatted = computed<string | null>((): string | null => {
	if (!lastChecked.value) {
		return null;
	}

	return new Intl.DateTimeFormat('en-US', {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(lastChecked.value);
});

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

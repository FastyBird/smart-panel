<template>
	<el-card class="mb-4">
		<template #header>
			<div class="flex justify-between items-center">
				<span class="font-600">{{ t('systemModule.headings.update.title') }}</span>
				<el-tag
					v-if="updateAvailable"
					type="warning"
				>
					{{ t('systemModule.texts.update.available') }}
				</el-tag>
			</div>
		</template>

		<el-descriptions
			:column="1"
			border
		>
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
		</el-descriptions>

		<div class="mt-4 flex gap-2">
			<el-button
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
				v-if="updateAvailable && !isUpdating"
				type="primary"
				@click="onInstallUpdate"
			>
				<template #icon>
					<icon icon="mdi:download" />
				</template>
				{{ t('systemModule.buttons.update.installUpdate') }}
			</el-button>
		</div>

		<template v-if="isUpdating || status === 'failed'">
			<el-progress
				:percentage="progressPercent || 0"
				:status="status === 'failed' ? 'exception' : undefined"
				class="mt-4"
			/>
			<el-text
				v-if="phase"
				class="block mt-2"
			>
				{{ phase }}
			</el-text>
		</template>

		<el-alert
			v-if="status === 'complete'"
			type="success"
			:title="t('systemModule.messages.update.updateComplete')"
			class="mt-4"
			:closable="false"
		/>

		<el-alert
			v-if="error"
			type="error"
			:title="t(error)"
			class="mt-4"
			:closable="false"
		/>
	</el-card>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElDescriptions,
	ElDescriptionsItem,
	ElMessageBox,
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

const onCheckForUpdates = async (): Promise<void> => {
	try {
		await checkForUpdates();
	} catch {
		ElNotification.error(t('systemModule.messages.update.checkFailed'));
	}
};

const onInstallUpdate = async (): Promise<void> => {
	const isMajor = updateType.value === 'major';

	try {
		await ElMessageBox.confirm(
			isMajor
				? t('systemModule.messages.update.majorUpdateWarning', { version: latestVersion.value })
				: t('systemModule.messages.update.confirmInstall', { version: latestVersion.value }),
			t('systemModule.headings.update.confirmTitle'),
			{
				confirmButtonText: t('systemModule.buttons.yes.title'),
				cancelButtonText: t('systemModule.buttons.cancel.title'),
				type: isMajor ? 'warning' : 'info',
			}
		);
	} catch {
		// User cancelled the confirmation dialog
		return;
	}

	try {
		await installUpdate(isMajor);

		ElNotification.success(t('systemModule.messages.update.updateStarted'));
	} catch {
		ElNotification.error(t('systemModule.messages.update.installFailed'));
	}
};

onMounted((): void => {
	void fetchStatus();
});
</script>

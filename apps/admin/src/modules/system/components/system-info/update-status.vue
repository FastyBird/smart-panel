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
						v-if="updateAvailable && latestVersion"
						type="warning"
						class="ml-2"
					>
						{{ t('systemModule.texts.update.available', { version: latestVersion }) }}
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
			<el-descriptions-item :label="t('systemModule.labels.update.channel')">
				<el-select
					v-model="selectedChannel"
					size="small"
					class="w-60!"
					:disabled="savingChannel || isUpdating"
					@change="onChannelChange"
				>
					<el-option
						v-for="option in channelOptions"
						:key="option.value"
						:value="option.value"
						:label="option.label"
					/>
				</el-select>
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

		<div
			v-if="channelIsLessStable"
			class="p-2"
		>
			<el-alert
				type="warning"
				:title="t('systemModule.texts.update.lessStableChannel', { channel: selectedChannelLabel })"
				:description="t('systemModule.texts.update.lessStableChannelDescription')"
				:closable="false"
				show-icon
			/>
		</div>
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
import { computed, onMounted, ref, watch } from 'vue';
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
	ElOption,
	ElProgress,
	ElSelect,
	ElTag,
	ElText,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import { injectStoresManager } from '../../../../common';
import { SystemModuleUpdateChannel } from '../../../../openapi.constants';
import { configModulesStoreKey } from '../../../config/store/keys';
import { useUpdateStatus } from '../../composables/composables';
import { SYSTEM_MODULE_NAME } from '../../system.constants';

// Derived from the generated enum so a channel added to the API cannot be missed here.
type UpdateChannel = `${SystemModuleUpdateChannel}`;

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

const storesManager = injectStoresManager();
const configModulesStore = storesManager.getStore(configModulesStoreKey);

const savingChannel = ref<boolean>(false);

const configuredChannel = computed<UpdateChannel>((): UpdateChannel => {
	const config = configModulesStore.findByType(SYSTEM_MODULE_NAME) as { updateChannel?: UpdateChannel } | null;

	return config?.updateChannel ?? 'auto';
});

const selectedChannel = ref<UpdateChannel>(configuredChannel.value);

// The store is populated asynchronously, and a failed save reverts the stored value - either way
// the control has to follow the store rather than keep whatever was last picked in the UI.
watch(configuredChannel, (channel: UpdateChannel): void => {
	selectedChannel.value = channel;
});

/**
 * Mirror of the backend's channel detection: the pre-release identifier of the installed version,
 * or null when it carries one this project does not publish.
 */
const detectChannel = (version: string): Exclude<UpdateChannel, 'auto'> | null => {
	const core = version.replace(/^v/, '').split('+')[0];
	const separator = core.indexOf('-');

	if (separator === -1) {
		return 'stable';
	}

	const [identifier] = core.slice(separator + 1).split('.');

	if (identifier === 'alpha') return 'alpha';
	if (identifier === 'beta') return 'beta';

	return null;
};

const installedChannel = computed<Exclude<UpdateChannel, 'auto'> | null>((): Exclude<UpdateChannel, 'auto'> | null => {
	return currentVersion.value ? detectChannel(currentVersion.value) : null;
});

const channelOptions = computed<{ value: UpdateChannel; label: string }[]>((): { value: UpdateChannel; label: string }[] => [
	{
		value: 'auto',
		label: installedChannel.value
			? t('systemModule.fields.update.channel.values.autoDetected', {
					channel: t(`systemModule.fields.update.channel.values.${installedChannel.value}`),
				})
			: t('systemModule.fields.update.channel.values.auto'),
	},
	{ value: 'stable', label: t('systemModule.fields.update.channel.values.stable') },
	{ value: 'beta', label: t('systemModule.fields.update.channel.values.beta') },
	{ value: 'alpha', label: t('systemModule.fields.update.channel.values.alpha') },
]);

const selectedChannelLabel = computed<string>((): string => {
	return selectedChannel.value === 'auto'
		? t('systemModule.fields.update.channel.values.auto')
		: t(`systemModule.fields.update.channel.values.${selectedChannel.value}`);
});

/** Least → most stable, matching the backend's channel precedence. */
const CHANNEL_PRECEDENCE: Exclude<UpdateChannel, 'auto'>[] = ['alpha', 'beta', 'stable'];

const channelIsLessStable = computed<boolean>((): boolean => {
	if (selectedChannel.value === 'auto' || installedChannel.value === null) {
		return false;
	}

	return CHANNEL_PRECEDENCE.indexOf(selectedChannel.value) < CHANNEL_PRECEDENCE.indexOf(installedChannel.value);
});

const onChannelChange = async (channel: UpdateChannel): Promise<void> => {
	savingChannel.value = true;

	try {
		await configModulesStore.edit({
			data: {
				type: SYSTEM_MODULE_NAME,
				updateChannel: channel,
			} as never,
		});
	} catch {
		selectedChannel.value = configuredChannel.value;

		ElNotification.error(t('systemModule.messages.update.channelNotChanged'));

		return;
	} finally {
		savingChannel.value = false;
	}

	// The backend drops its cached lookup when the config changes, so a re-check is what turns the
	// new channel into a visible answer instead of leaving the card on the old one. It is reported
	// separately: the channel is already saved, so a failing check is a failed check, not a failed
	// save, and must not revert the control.
	await onCheckForUpdates();
};

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
	// The store rejects an edit for a module it has not loaded, and this card is reachable without
	// ever opening the system config form - so the config is pulled in here rather than assumed.
	void configModulesStore.get({ type: SYSTEM_MODULE_NAME });
});
</script>

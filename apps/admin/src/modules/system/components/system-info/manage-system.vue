<template>
	<el-row
		justify="center"
		class="cursor-pointer"
		@click="showRestartDialog = true"
	>
		<el-col
			:span="3"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<el-avatar :size="32">
					<icon
						icon="mdi:restart"
						class="w[20px] h[20px]"
					/>
				</el-avatar>
			</div>
		</el-col>
		<el-col :span="19">
			<el-text
				size="large"
				class="block font-600 text-lg"
			>
				{{ t('systemModule.headings.manage.restart') }}
			</el-text>
			<el-text
				class="block"
				data-test-id="restart-info"
			>
				{{ isGateway ? t('systemModule.texts.manage.rebootGateway') : t('systemModule.texts.manage.rebootDevice') }}
			</el-text>
		</el-col>
		<el-col
			:span="2"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<icon
					icon="mdi:keyboard-arrow-right"
					class="w[32px] h[32px]"
				/>
			</div>
		</el-col>
	</el-row>

	<el-divider />

	<el-row
		justify="center"
		class="cursor-pointer"
		@click="onPowerOff"
	>
		<el-col
			:span="3"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<el-avatar :size="32">
					<icon
						icon="mdi:power-settings-new"
						class="w[20px] h[20px]"
					/>
				</el-avatar>
			</div>
		</el-col>
		<el-col :span="19">
			<el-text
				size="large"
				class="block font-600 text-lg"
			>
				{{ t('systemModule.headings.manage.powerOff') }}
			</el-text>
			<el-text
				class="block"
				data-test-id="power-off-info"
			>
				{{ isGateway ? t('systemModule.texts.manage.powerOffGateway') : t('systemModule.texts.manage.powerOffDevice') }}
			</el-text>
		</el-col>
		<el-col
			:span="2"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<icon
					icon="mdi:keyboard-arrow-right"
					class="w[32px] h[32px]"
				/>
			</div>
		</el-col>
	</el-row>

	<el-divider />

	<el-row
		justify="center"
		class="mb-4 cursor-pointer"
		@click="onFactoryReset"
	>
		<el-col
			:span="3"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<el-avatar :size="32">
					<icon
						icon="mdi:vacuum-cleaner"
						class="w[20px] h[20px]"
					/>
				</el-avatar>
			</div>
		</el-col>
		<el-col :span="19">
			<el-text
				size="large"
				class="block font-600 text-lg"
			>
				{{ t('systemModule.headings.manage.factoryReset') }}
			</el-text>
			<el-text
				class="block"
				data-test-id="factory-reset-info"
			>
				{{ isGateway ? t('systemModule.texts.manage.factoryResetGateway') : t('systemModule.texts.manage.factoryResetDevice') }}
			</el-text>
		</el-col>
		<el-col
			:span="2"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<icon
					icon="mdi:keyboard-arrow-right"
					class="w[32px] h[32px]"
				/>
			</div>
		</el-col>
	</el-row>

	<el-divider />

	<el-row
		justify="center"
		class="mb-4 cursor-pointer"
		@click="onShowLogs"
	>
		<el-col
			:span="3"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<el-avatar :size="32">
					<icon
						icon="mdi:console"
						class="w[20px] h[20px]"
					/>
				</el-avatar>
			</div>
		</el-col>
		<el-col :span="19">
			<el-text
				size="large"
				class="block font-600 text-lg"
			>
				{{ t('systemModule.headings.manage.systemLogs') }}
			</el-text>
			<el-text
				class="block"
				data-test-id="system-logs-info"
			>
				{{ t('systemModule.texts.manage.systemLogs') }}
			</el-text>
		</el-col>
		<el-col
			:span="2"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<icon
					icon="mdi:keyboard-arrow-right"
					class="w[32px] h[32px]"
				/>
			</div>
		</el-col>
	</el-row>

	<restart-confirm-dialog
		:visible="showRestartDialog"
		:is-gateway="isGateway"
		@close="showRestartDialog = false"
		@service-restart="onHandleServiceRestart"
		@system-reboot="onHandleSystemReboot"
	/>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElAvatar, ElCol, ElDivider, ElRow, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useConfigModule } from '../../../config/composables/composables';
import type { IDisplaysConfigModule } from '../../../displays/store/config.store.types';
import { useSystemActions } from '../../composables/composables';
import { RouteNames } from '../../system.constants';

import RestartConfirmDialog from './restart-confirm-dialog.vue';

defineOptions({
	name: 'ManageSystem',
});

const emit = defineEmits<{
	(e: 'close'): void;
}>();

const { t } = useI18n();
const router = useRouter();

const { configModule: displaysConfig } = useConfigModule({ type: 'displays-module' });

const isGateway = computed<boolean>((): boolean => {
	const config = displaysConfig.value as IDisplaysConfigModule | null;

	return config !== null && config.deploymentMode !== 'all-in-one';
});

const { onServiceRestart, onSystemReboot, onPowerOff, onFactoryReset } = useSystemActions();

const showRestartDialog = ref(false);

const onHandleServiceRestart = (): void => {
	showRestartDialog.value = false;
	void onServiceRestart();
};

const onHandleSystemReboot = (): void => {
	showRestartDialog.value = false;
	void onSystemReboot();
};

const onShowLogs = (): void => {
	emit('close');

	router.push({ name: RouteNames.SYSTEM_LOGS });
};
</script>

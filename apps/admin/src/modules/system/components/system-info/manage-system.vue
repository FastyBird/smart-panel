<template>
	<!-- The Manage system section: one row per action, its consequence spelled out, the button naming the verb. Each
	     action confirms in a dialog first; power off and factory reset are the destructive ones. On phone the button
	     wraps under the text, lined up with it -->
	<ul
		class="flex flex-col m-0 p-0 list-none"
		data-test-id="manage-system"
	>
		<li
			v-for="(action, index) in actions"
			:key="action.id"
			:class="['flex flex-wrap items-center gap-x-4 gap-y-2 py-3', index > 0 ? 'border-t border-t-solid border-light' : '']"
			:data-action-id="action.id"
		>
			<div
				:class="['flex items-center justify-center shrink-0 w-10 h-10 rounded-full', action.danger ? 'bg-danger-soft' : 'bg-fill-light']"
				aria-hidden="true"
			>
				<icon
					:icon="action.icon"
					width="22"
					height="22"
					:class="action.danger ? 'text-danger' : 'text-secondary'"
				/>
			</div>

			<div class="flex flex-col gap-0.5 flex-[1_1_240px] min-w-0">
				<span class="text-card-title">{{ action.title }}</span>
				<span
					class="text-help"
					:data-test-id="`${action.id}-info`"
				>
					{{ action.description }}
				</span>
			</div>

			<el-button
				v-if="action.handler"
				:type="action.danger ? 'danger' : undefined"
				plain
				class="ml-14 tp:ml-0"
				:data-test-id="`${action.id}-button`"
				@click="action.handler"
			>
				{{ action.button }}
			</el-button>
			<el-button
				v-else-if="action.route"
				class="ml-14 tp:ml-0"
				:data-test-id="`${action.id}-button`"
				@click="router.push(action.route)"
			>
				{{ action.button }}
				<template #icon>
					<icon icon="mdi:chevron-right" />
				</template>
			</el-button>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { type RouteLocationRaw, useRouter } from 'vue-router';

import { ElButton } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useConfigModule } from '../../../config/composables/composables';
import type { IDisplaysConfigModule } from '../../../displays/store/config.store.types';
import { useSystemActions } from '../../composables/composables';
import { RouteNames } from '../../system.constants';

defineOptions({
	name: 'ManageSystem',
});

interface IManageAction {
	id: string;
	icon: string;
	title: string;
	description: string;
	button: string;
	danger?: boolean;
	handler?: () => void;
	route?: RouteLocationRaw;
}

const { t } = useI18n();
const router = useRouter();

const { configModule: displaysConfig } = useConfigModule({ type: 'displays-module' });

const isGateway = computed<boolean>((): boolean => {
	const config = displaysConfig.value as IDisplaysConfigModule | null;

	return config !== null && config.deploymentMode !== 'all-in-one';
});

const { onServiceRestart, onSystemReboot, onPowerOff, onFactoryReset } = useSystemActions();

const actions = computed<IManageAction[]>((): IManageAction[] => [
	{
		id: 'service-restart',
		icon: 'mdi:restart',
		title: t('systemModule.headings.manage.serviceRestart'),
		description: t('systemModule.texts.manage.serviceRestartDevice'),
		button: t('systemModule.buttons.manage.serviceRestart'),
		handler: onServiceRestart,
	},
	{
		id: 'system-reboot',
		icon: 'mdi:restart-alert',
		title: t('systemModule.headings.manage.systemReboot'),
		description: isGateway.value ? t('systemModule.texts.manage.rebootGateway') : t('systemModule.texts.manage.rebootDevice'),
		button: t('systemModule.buttons.manage.systemReboot'),
		handler: onSystemReboot,
	},
	{
		id: 'power-off',
		icon: 'mdi:power-settings-new',
		title: t('systemModule.headings.manage.powerOff'),
		description: isGateway.value ? t('systemModule.texts.manage.powerOffGateway') : t('systemModule.texts.manage.powerOffDevice'),
		button: t('systemModule.buttons.manage.powerOff'),
		danger: true,
		handler: onPowerOff,
	},
	{
		id: 'factory-reset',
		icon: 'mdi:vacuum-cleaner',
		title: t('systemModule.headings.manage.factoryReset'),
		description: isGateway.value ? t('systemModule.texts.manage.factoryResetGateway') : t('systemModule.texts.manage.factoryResetDevice'),
		button: t('systemModule.buttons.manage.factoryReset'),
		danger: true,
		handler: onFactoryReset,
	},
	{
		id: 'system-backups',
		icon: 'mdi:backup-restore',
		title: t('systemModule.headings.manage.systemBackups'),
		description: t('systemModule.texts.manage.systemBackups'),
		button: t('systemModule.buttons.manage.open'),
		route: { name: RouteNames.SYSTEM_BACKUPS },
	},
	{
		id: 'system-logs',
		icon: 'mdi:console',
		title: t('systemModule.headings.manage.systemLogs'),
		description: t('systemModule.texts.manage.systemLogs'),
		button: t('systemModule.buttons.manage.open'),
		route: { name: RouteNames.SYSTEM_LOGS },
	},
]);
</script>

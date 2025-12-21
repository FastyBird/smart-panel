<template>
	<el-card
		shadow="never"
		class="service-item"
		body-class="p-3!"
	>
		<div class="flex flex-col gap-3">
			<!-- Header: Plugin name, Service ID, and Status -->
			<div class="flex items-center justify-between gap-4">
				<div class="flex items-center gap-3 min-w-0 flex-1">
					<!-- Service Icon -->
					<div class="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800">
						<icon
							:icon="serviceIcon"
							class="w-5 h-5"
							:class="iconColorClass"
						/>
					</div>

					<!-- Service Info -->
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2 flex-wrap">
							<span class="font-medium text-base truncate">{{ service.pluginName }}</span>
							<el-tag
								size="small"
								type="info"
							>
								{{ service.serviceId }}
							</el-tag>
						</div>
						<div class="flex items-center gap-2 mt-1">
							<el-tag
								:type="stateTagType"
								size="small"
								effect="light"
							>
								<template #default>
									<div class="flex items-center gap-1">
										<icon
											v-if="isTransitioning"
											icon="mdi:loading"
											class="animate-spin w-3 h-3"
										/>
										{{ stateLabel }}
									</div>
								</template>
							</el-tag>
							<el-tag
								v-if="!service.enabled"
								type="warning"
								size="small"
								effect="light"
							>
								{{ t('extensionsModule.services.texts.pluginDisabled') }}
							</el-tag>
							<el-tag
								v-if="service.healthy !== undefined"
								:type="service.healthy ? 'success' : 'danger'"
								size="small"
								effect="light"
							>
								{{ service.healthy ? t('extensionsModule.services.labels.healthy') : t('extensionsModule.services.labels.unhealthy') }}
							</el-tag>
						</div>
					</div>
				</div>

				<!-- Actions -->
				<div class="flex items-center gap-2">
					<el-tooltip
						v-if="canStart"
						:content="startTooltip"
						placement="top"
					>
						<el-button
							type="success"
							size="small"
							plain
							:disabled="!canStartAction"
							:loading="acting"
							@click="onStart"
						>
							<template #icon>
								<icon icon="mdi:play" />
							</template>
							{{ t('extensionsModule.services.buttons.start') }}
						</el-button>
					</el-tooltip>

					<el-tooltip
						v-if="canStop"
						:content="stopTooltip"
						placement="top"
					>
						<el-button
							type="danger"
							size="small"
							plain
							:disabled="!canStopAction"
							:loading="acting"
							@click="onStop"
						>
							<template #icon>
								<icon icon="mdi:stop" />
							</template>
							{{ t('extensionsModule.services.buttons.stop') }}
						</el-button>
					</el-tooltip>

					<el-tooltip
						v-if="canRestart"
						:content="restartTooltip"
						placement="top"
					>
						<el-button
							type="primary"
							size="small"
							plain
							:disabled="!canRestartAction"
							:loading="acting"
							@click="onRestart"
						>
							<template #icon>
								<icon icon="mdi:restart" />
							</template>
							{{ t('extensionsModule.services.buttons.restart') }}
						</el-button>
					</el-tooltip>
				</div>
			</div>

			<!-- Details Row -->
			<div class="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
				<div
					v-if="service.state === 'started' && service.uptimeMs !== undefined"
					class="flex items-center gap-1"
				>
					<icon
						icon="mdi:clock-outline"
						class="w-4 h-4"
					/>
					<span>{{ t('extensionsModule.services.labels.uptime') }}: {{ formattedUptime }}</span>
				</div>

				<div
					v-if="service.startCount > 0"
					class="flex items-center gap-1"
				>
					<icon
						icon="mdi:counter"
						class="w-4 h-4"
					/>
					<span>{{ t('extensionsModule.services.labels.startCount') }}: {{ service.startCount }}</span>
				</div>

				<div
					v-if="service.lastStartedAt"
					class="flex items-center gap-1"
				>
					<icon
						icon="mdi:play-circle-outline"
						class="w-4 h-4"
					/>
					<span>{{ t('extensionsModule.services.labels.lastStarted') }}: {{ formattedLastStarted }}</span>
				</div>
			</div>

			<!-- Error Display -->
			<el-alert
				v-if="service.state === 'error' && service.lastError"
				type="error"
				:title="t('extensionsModule.services.labels.lastError')"
				:description="service.lastError"
				show-icon
				:closable="false"
			/>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCard, ElTag, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { ExtensionsModuleServiceState } from '../../../openapi.constants';
import type { IService } from '../store/services.store.types';

defineOptions({
	name: 'ServiceItem',
});

interface IServiceItemProps {
	service: IService;
	acting?: boolean;
}

interface IServiceItemEmits {
	(e: 'start'): void;
	(e: 'stop'): void;
	(e: 'restart'): void;
}

const props = defineProps<IServiceItemProps>();
const emit = defineEmits<IServiceItemEmits>();

const { t } = useI18n();

// State computations
const isTransitioning = computed<boolean>(() => {
	return props.service.state === ExtensionsModuleServiceState.starting ||
		props.service.state === ExtensionsModuleServiceState.stopping;
});

const isStopped = computed<boolean>(() => {
	return props.service.state === ExtensionsModuleServiceState.stopped ||
		props.service.state === ExtensionsModuleServiceState.error;
});

const isRunning = computed<boolean>(() => {
	return props.service.state === ExtensionsModuleServiceState.started;
});

// Visibility
const canStart = computed<boolean>(() => isStopped.value);
const canStop = computed<boolean>(() => isRunning.value);
const canRestart = computed<boolean>(() => isRunning.value);

// Action availability
const canStartAction = computed<boolean>(() => {
	return canStart.value && props.service.enabled && !isTransitioning.value && !props.acting;
});

const canStopAction = computed<boolean>(() => {
	return canStop.value && !isTransitioning.value && !props.acting;
});

const canRestartAction = computed<boolean>(() => {
	return canRestart.value && props.service.enabled && !isTransitioning.value && !props.acting;
});

// Tooltips
const startTooltip = computed<string>(() => {
	if (!props.service.enabled) {
		return t('extensionsModule.services.tooltips.disabledPlugin');
	}
	if (isTransitioning.value) {
		return t('extensionsModule.services.tooltips.transitioning');
	}
	return t('extensionsModule.services.tooltips.startService');
});

const stopTooltip = computed<string>(() => {
	if (isTransitioning.value) {
		return t('extensionsModule.services.tooltips.transitioning');
	}
	return t('extensionsModule.services.tooltips.stopService');
});

const restartTooltip = computed<string>(() => {
	if (!props.service.enabled) {
		return t('extensionsModule.services.tooltips.disabledPlugin');
	}
	if (isTransitioning.value) {
		return t('extensionsModule.services.tooltips.transitioning');
	}
	return t('extensionsModule.services.tooltips.restartService');
});

// State display
const stateLabel = computed<string>(() => {
	const stateKey = props.service.state as string;
	return t(`extensionsModule.services.states.${stateKey}`);
});

const stateTagType = computed<'success' | 'info' | 'warning' | 'danger'>(() => {
	switch (props.service.state) {
		case ExtensionsModuleServiceState.started:
			return 'success';
		case ExtensionsModuleServiceState.stopped:
			return 'info';
		case ExtensionsModuleServiceState.starting:
		case ExtensionsModuleServiceState.stopping:
			return 'warning';
		case ExtensionsModuleServiceState.error:
			return 'danger';
		default:
			return 'info';
	}
});

const serviceIcon = computed<string>(() => {
	switch (props.service.state) {
		case ExtensionsModuleServiceState.started:
			return 'mdi:check-circle';
		case ExtensionsModuleServiceState.stopped:
			return 'mdi:stop-circle';
		case ExtensionsModuleServiceState.starting:
		case ExtensionsModuleServiceState.stopping:
			return 'mdi:loading';
		case ExtensionsModuleServiceState.error:
			return 'mdi:alert-circle';
		default:
			return 'mdi:help-circle';
	}
});

const iconColorClass = computed<string>(() => {
	switch (props.service.state) {
		case ExtensionsModuleServiceState.started:
			return 'text-green-500';
		case ExtensionsModuleServiceState.stopped:
			return 'text-gray-400';
		case ExtensionsModuleServiceState.starting:
		case ExtensionsModuleServiceState.stopping:
			return 'text-yellow-500 animate-spin';
		case ExtensionsModuleServiceState.error:
			return 'text-red-500';
		default:
			return 'text-gray-400';
	}
});

// Format uptime
const formattedUptime = computed<string>(() => {
	if (props.service.uptimeMs === undefined) {
		return '-';
	}

	const totalSeconds = Math.floor(props.service.uptimeMs / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);

	const parts: string[] = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

	return parts.join(' ');
});

// Format last started
const formattedLastStarted = computed<string>(() => {
	if (!props.service.lastStartedAt) {
		return '-';
	}

	const date = new Date(props.service.lastStartedAt);
	return date.toLocaleString();
});

// Event handlers
const onStart = (): void => {
	emit('start');
};

const onStop = (): void => {
	emit('stop');
};

const onRestart = (): void => {
	emit('restart');
};
</script>

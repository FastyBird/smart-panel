<template>
	<article
		:aria-label="extensionName ?? service.extensionType"
		class="flex flex-col gap-3 p-4 bg-surface border border-solid border-light rounded-lg"
		:data-service="`${service.extensionType}:${service.serviceId}`"
		data-test-id="service-item"
	>
		<!-- Header: the extension and service, their state, and the actions the state allows -->
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="flex items-start gap-3 min-w-0 flex-[1_1_280px]">
				<span
					class="flex items-center justify-center shrink-0 w-10 h-10 rounded-lg bg-fill"
					aria-hidden="true"
				>
					<icon
						:icon="serviceIcon"
						width="20"
						height="20"
						:class="iconColorClass"
					/>
				</span>

				<div class="flex flex-col gap-1 min-w-0 flex-1">
					<div class="flex items-center gap-2 flex-wrap min-w-0">
						<h3 class="text-card-title m-0 truncate">{{ extensionName ?? service.extensionType }}</h3>
						<span class="text-mono text-secondary">{{ service.serviceId }}</span>
					</div>
					<span class="text-caption text-mono truncate">{{ service.extensionType }}</span>
					<div class="flex items-center gap-2 flex-wrap">
						<status-tag
							:status="stateStatus"
							:label="stateLabel"
						/>
						<status-tag
							v-if="!service.enabled"
							status="warn"
							:label="t('extensionsModule.services.texts.extensionDisabled')"
						/>
						<status-tag
							v-if="isAlwaysActive"
							status="primary"
							:label="t('extensionsModule.services.activationPolicies.always')"
						/>
						<status-tag
							v-if="service.healthy !== undefined"
							:status="service.healthy ? 'ok' : 'danger'"
							:label="service.healthy ? t('extensionsModule.services.labels.healthy') : t('extensionsModule.services.labels.unhealthy')"
						/>
					</div>
				</div>
			</div>

			<div class="flex items-center gap-2 shrink-0">
				<el-tooltip
					v-if="canStart"
					:content="startTooltip"
					placement="top"
				>
					<span>
						<el-button
							plain
							:disabled="!canStartAction"
							:loading="acting"
							data-test-id="service-start"
							@click="onStart"
						>
							<template #icon>
								<icon icon="mdi:play" />
							</template>
							{{ t('extensionsModule.services.buttons.start') }}
						</el-button>
					</span>
				</el-tooltip>

				<el-tooltip
					v-if="canStop"
					:content="stopTooltip"
					placement="top"
				>
					<span>
						<el-button
							plain
							:disabled="!canStopAction"
							:loading="acting"
							data-test-id="service-stop"
							@click="onStop"
						>
							<template #icon>
								<icon icon="mdi:stop" />
							</template>
							{{ t('extensionsModule.services.buttons.stop') }}
						</el-button>
					</span>
				</el-tooltip>

				<el-tooltip
					v-if="canRestart"
					:content="restartTooltip"
					placement="top"
				>
					<span>
						<el-button
							plain
							:disabled="!canRestartAction"
							:loading="acting"
							data-test-id="service-restart"
							@click="onRestart"
						>
							<template #icon>
								<icon icon="mdi:restart" />
							</template>
							{{ t('extensionsModule.services.buttons.restart') }}
						</el-button>
					</span>
				</el-tooltip>
			</div>
		</div>

		<!-- Details -->
		<dl class="flex flex-wrap items-center gap-x-6 gap-y-1 m-0 text-help">
			<div
				v-if="service.state === 'started' && service.uptimeMs !== undefined"
				class="flex items-center gap-1"
			>
				<icon
					icon="mdi:clock-outline"
					aria-hidden="true"
				/>
				<dt>{{ t('extensionsModule.services.labels.uptime') }}:</dt>
				<dd class="m-0">{{ formattedUptime }}</dd>
			</div>

			<div
				v-if="service.startCount > 0"
				class="flex items-center gap-1"
			>
				<icon
					icon="mdi:counter"
					aria-hidden="true"
				/>
				<dt>{{ t('extensionsModule.services.labels.startCount') }}:</dt>
				<dd class="m-0">{{ service.startCount }}</dd>
			</div>

			<div
				v-if="service.lastStartedAt"
				class="flex items-center gap-1"
			>
				<icon
					icon="mdi:play-circle-outline"
					aria-hidden="true"
				/>
				<dt>{{ t('extensionsModule.services.labels.lastStarted') }}:</dt>
				<dd class="m-0">{{ formattedLastStarted }}</dd>
			</div>

			<div class="flex items-center gap-1">
				<icon
					icon="mdi:target"
					aria-hidden="true"
				/>
				<dt>{{ t('extensionsModule.services.labels.desiredState') }}:</dt>
				<dd class="m-0">{{ desiredStateLabel }}</dd>
			</div>
		</dl>

		<el-alert
			v-if="service.lastError"
			:type="service.state === ExtensionsModuleServiceState.error ? 'error' : 'warning'"
			:title="t('extensionsModule.services.labels.lastError')"
			:description="service.lastError"
			show-icon
			:closable="false"
		/>
	</article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { StatusTag } from '../../../common';
import type { StatusTagStatus } from '../../../common/components/status-tag.types';
import {
	ExtensionsModuleServiceActivationPolicy,
	ExtensionsModuleServiceDesiredState,
	ExtensionsModuleServiceState,
} from '../../../openapi.constants';
import type { IService } from '../store/services.store.types';

defineOptions({
	name: 'ServiceItem',
});

interface IServiceItemProps {
	service: IService;
	extensionName?: string;
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
	return props.service.state === ExtensionsModuleServiceState.started ||
		props.service.state === ExtensionsModuleServiceState.starting;
});

const isAlwaysActive = computed<boolean>(() => {
	return props.service.activationPolicy === ExtensionsModuleServiceActivationPolicy.always;
});

// Visibility
const canStart = computed<boolean>(() => isStopped.value);
const canStop = computed<boolean>(() => isRunning.value);
const canRestart = computed<boolean>(() => props.service.state === ExtensionsModuleServiceState.started);

// Action availability
const canStartAction = computed<boolean>(() => {
	return canStart.value && props.service.desiredState === ExtensionsModuleServiceDesiredState.started && !isTransitioning.value && !props.acting;
});

const canStopAction = computed<boolean>(() => {
	return canStop.value && props.service.state !== ExtensionsModuleServiceState.stopping && !props.acting;
});

const canRestartAction = computed<boolean>(() => {
	return canRestart.value && props.service.desiredState === ExtensionsModuleServiceDesiredState.started && !isTransitioning.value && !props.acting;
});

// Tooltips
const startTooltip = computed<string>(() => {
	if (props.service.desiredState === ExtensionsModuleServiceDesiredState.stopped) {
		return t('extensionsModule.services.tooltips.disabledExtension');
	}
	if (isTransitioning.value) {
		return t('extensionsModule.services.tooltips.transitioning');
	}
	return t('extensionsModule.services.tooltips.startService');
});

const stopTooltip = computed<string>(() => {
	if (props.service.state === ExtensionsModuleServiceState.stopping) {
		return t('extensionsModule.services.tooltips.transitioning');
	}
	return t('extensionsModule.services.tooltips.stopService');
});

const restartTooltip = computed<string>(() => {
	if (props.service.desiredState === ExtensionsModuleServiceDesiredState.stopped) {
		return t('extensionsModule.services.tooltips.disabledExtension');
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

const desiredStateLabel = computed<string>(() => {
	return t(`extensionsModule.services.desiredStates.${props.service.desiredState}`);
});

const stateStatus = computed<StatusTagStatus>(() => {
	switch (props.service.state) {
		case ExtensionsModuleServiceState.started:
			return 'ok';
		case ExtensionsModuleServiceState.starting:
		case ExtensionsModuleServiceState.stopping:
			return 'warn';
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
			return 'text-success';
		case ExtensionsModuleServiceState.starting:
		case ExtensionsModuleServiceState.stopping:
			return 'text-warning animate-spin';
		case ExtensionsModuleServiceState.error:
			return 'text-danger';
		default:
			return 'text-muted';
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

<template>
	<div data-test-id="protect-connection-status">
		<el-divider content-position="left">{{ t('devicesUnifiProtectPlugin.sections.status') }}</el-divider>

		<el-alert
			v-if="statusStore.stale"
			type="warning"
			show-icon
			:closable="false"
			class="mb-3"
			:title="statusStore.status ? t('devicesUnifiProtectPlugin.status.stale') : t('devicesUnifiProtectPlugin.status.loadFailed')"
			data-test-id="protect-status-stale"
		/>

		<dl
			v-if="statusStore.status"
			class="protect-connection-status__details"
		>
			<template
				v-for="row in rows"
				:key="row.id"
			>
				<dt>{{ row.label }}</dt>
				<dd :data-test-id="`protect-status-${row.id}`">{{ row.value }}</dd>
			</template>
		</dl>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, unref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider } from 'element-plus';

import { injectStoresManager } from '../../../common';
import { protectStatusStoreKey } from '../store/keys';

import type { IProtectConnectionStatusProps } from './protect-connection-status.types';

const DEFAULT_POLL_INTERVAL_MS = 30_000;

defineOptions({
	name: 'ProtectConnectionStatus',
});

const props = withDefaults(defineProps<IProtectConnectionStatusProps>(), {
	pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
});

interface IStatusRow {
	id: string;
	label: string;
	value: string;
}

const { t, te, locale } = useI18n();

const statusStore = injectStoresManager().getStore(protectStatusStoreKey);

// Held while mounted, so the status stays current; the store pauses it while the page is hidden.
const releasePolling = statusStore.startPolling();

onBeforeUnmount((): void => releasePolling());

const notAvailable = computed<string>((): string => t('devicesUnifiProtectPlugin.status.notAvailable'));

/** A translated label for a backend value, or the raw value when this admin does not know it (a newer backend). */
const labelOf = (key: string, value: string): string => (te(key) ? t(key) : value);

const orNotAvailable = (value: string | null | undefined): string => (typeof value === 'string' && value !== '' ? value : notAvailable.value);

const yesNo = (value: boolean): string => t(value ? 'devicesUnifiProtectPlugin.status.yes' : 'devicesUnifiProtectPlugin.status.no');

/** A time in the app locale, or the raw value when it does not parse. */
const formatTime = (value: string | null | undefined): string => {
	if (typeof value !== 'string' || value === '') {
		return notAvailable.value;
	}

	const date = new Date(value);

	return Number.isNaN(date.getTime())
		? value
		: new Intl.DateTimeFormat(String(unref(locale)), { dateStyle: 'medium', timeStyle: 'medium' }).format(date);
};

/** "Streaming", or "Polling every N s" from the Protect poll interval. */
const realtimeText = (state: string): string => {
	if (state === 'polling') {
		const interval =
			typeof props.pollIntervalMs === 'number' && Number.isFinite(props.pollIntervalMs) && props.pollIntervalMs > 0
				? props.pollIntervalMs
				: DEFAULT_POLL_INTERVAL_MS;

		return t('devicesUnifiProtectPlugin.status.realtime.polling', { seconds: Math.round(interval / 1000) });
	}

	return labelOf(`devicesUnifiProtectPlugin.status.realtime.${state}`, state);
};

const rows = computed<IStatusRow[]>((): IStatusRow[] => {
	const status = statusStore.status;

	if (!status) {
		return [];
	}

	const row = (id: string, label: string, value: string): IStatusRow => ({
		id,
		label: t(`devicesUnifiProtectPlugin.status.fields.${label}`),
		value,
	});

	// The sentence comes from the category; the backend's own message follows it.
	const lastError = [
		status.lastErrorCategory
			? te(`devicesUnifiProtectPlugin.errorCategories.${status.lastErrorCategory}`)
				? t(`devicesUnifiProtectPlugin.errorCategories.${status.lastErrorCategory}`, { minimum: status.minimumVersion })
				: status.lastErrorCategory
			: null,
		status.lastError,
	]
		.filter((part): part is string => typeof part === 'string' && part !== '')
		.join(' ');

	return [
		row(
			'connection-state',
			'connectionState',
			labelOf(`devicesUnifiProtectPlugin.status.connectionStates.${status.connectionState}`, status.connectionState)
		),
		row('service-state', 'serviceState', labelOf(`devicesUnifiProtectPlugin.status.serviceStates.${status.serviceState}`, status.serviceState)),
		row('enabled', 'enabled', yesNo(status.enabled)),
		row('configured', 'configured', yesNo(status.configured)),
		row('healthy', 'healthy', yesNo(status.healthy)),
		row('tls-mode', 'tlsMode', labelOf(`devicesUnifiProtectPlugin.config.tls.mode.${status.tlsMode}`, status.tlsMode)),
		row('application-version', 'applicationVersion', orNotAvailable(status.applicationVersion)),
		row('minimum-version', 'minimumVersion', status.minimumVersion),
		row('nvr-id', 'nvrId', orNotAvailable(status.nvrId)),
		row('nvr-name', 'nvrName', orNotAvailable(status.nvrName)),
		row('last-connected-at', 'lastConnectedAt', formatTime(status.lastConnectedAt)),
		row('last-error', 'lastError', orNotAvailable(lastError)),
		row('reconnect-attempt', 'reconnectAttempt', String(status.reconnectAttempt)),
		row('next-retry-at', 'nextRetryAt', formatTime(status.nextRetryAt)),
		row('realtime-state', 'realtimeState', realtimeText(status.realtimeState)),
		row('ignored-event-count', 'ignoredEventCount', String(status.ignoredEventCount)),
	];
});
</script>

<style scoped>
.protect-connection-status__details {
	display: grid;
	grid-template-columns: max-content 1fr;
	column-gap: 0.75rem;
	row-gap: 0.25rem;
	font-size: var(--el-font-size-small);
}

.protect-connection-status__details dt {
	color: var(--el-text-color-secondary);
}
</style>

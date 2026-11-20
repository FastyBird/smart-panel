<template>
	<div data-test-id="protect-discovered-consoles">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<span class="font-medium">{{ t('devicesUnifiProtectPlugin.discovery.title') }}</span>

			<el-button
				:loading="scanInProgress"
				data-test-id="protect-discovery-scan"
				@click="onScan"
			>
				{{ t('devicesUnifiProtectPlugin.discovery.scan') }}
			</el-button>
		</div>

		<div
			v-if="scanInProgress"
			class="mt-2"
			data-test-id="protect-discovery-progress"
		>
			<el-progress
				:percentage="100"
				:indeterminate="true"
				:show-text="false"
			/>
			<p class="mt-1 text-xs text-[var(--el-text-color-secondary)]">{{ t('devicesUnifiProtectPlugin.discovery.scanning') }}</p>
		</div>

		<el-alert
			v-if="loadFailed"
			type="warning"
			show-icon
			:closable="false"
			:title="t(`devicesUnifiProtectPlugin.discovery.${loadFailed}`)"
			class="mt-2"
			data-test-id="protect-discovery-load-failed"
		/>

		<el-alert
			v-else-if="discoveryStore.discovery?.status === DevicesUnifiProtectPluginDiscoveryStatus.failed"
			type="warning"
			show-icon
			:closable="false"
			:title="t('devicesUnifiProtectPlugin.discovery.failed')"
			class="mt-2"
		/>

		<p
			v-else-if="discoveryStore.discovery?.status === DevicesUnifiProtectPluginDiscoveryStatus.completed && consoles.length === 0"
			class="mt-2 text-xs text-[var(--el-text-color-secondary)]"
			data-test-id="protect-discovery-empty"
		>
			{{ t('devicesUnifiProtectPlugin.discovery.empty') }}
		</p>

		<ul
			v-if="consoles.length > 0"
			class="mt-2 flex flex-col gap-2"
		>
			<li
				v-for="entry in consoles"
				:key="entry.mac"
				class="protect-discovered-consoles__item"
				data-test-id="protect-console"
			>
				<div class="flex flex-wrap items-start justify-between gap-2">
					<div class="min-w-0">
						<div class="font-medium">{{ entry.hostname ?? entry.probe.name ?? entry.mac }}</div>
						<div class="text-xs text-[var(--el-text-color-secondary)]">{{ consoleDetails(entry) }}</div>
					</div>

					<div class="flex gap-2">
						<el-button
							size="small"
							:loading="discoveryStore.isProbing(entry.host)"
							data-test-id="protect-console-check"
							@click="check(entry.host)"
						>
							{{ t('devicesUnifiProtectPlugin.discovery.check') }}
						</el-button>
						<el-button
							size="small"
							type="primary"
							plain
							data-test-id="protect-console-use"
							@click="emit('use', preferredHostOf(entry))"
						>
							{{ t('devicesUnifiProtectPlugin.discovery.use') }}
						</el-button>
					</div>
				</div>

				<p
					v-if="probeErrors[protectProbeKey(entry.host)]"
					class="mt-1 text-xs text-[var(--el-color-danger)]"
				>
					{{ t(`devicesUnifiProtectPlugin.discovery.${probeErrors[protectProbeKey(entry.host)]}`) }}
				</p>

				<ul
					v-else-if="checkedProbe(entry.host)"
					class="mt-1 text-xs"
					data-test-id="protect-probe-result"
				>
					<li
						v-for="line in probeLines(checkedProbe(entry.host)!)"
						:key="line"
					>
						{{ line }}
					</li>
				</ul>
			</li>
		</ul>

		<div class="mt-3 flex flex-wrap items-center gap-2">
			<el-button
				size="small"
				:disabled="typedHost === null"
				:loading="typedHost !== null && discoveryStore.isProbing(typedHost, port)"
				data-test-id="protect-check-host"
				@click="typedHost !== null && check(typedHost, port)"
			>
				{{ t('devicesUnifiProtectPlugin.discovery.checkHost') }}
			</el-button>
		</div>

		<p
			v-if="typedHost !== null && probeErrors[protectProbeKey(typedHost, port)]"
			class="mt-1 text-xs text-[var(--el-color-danger)]"
			data-test-id="protect-host-probe-error"
		>
			{{ t(`devicesUnifiProtectPlugin.discovery.${probeErrors[protectProbeKey(typedHost, port)]}`) }}
		</p>

		<div
			v-else-if="typedHost !== null && checkedProbe(typedHost, port)"
			data-test-id="protect-host-probe"
		>
			<ul class="mt-1 text-xs">
				<li
					v-for="line in probeLines(checkedProbe(typedHost, port)!)"
					:key="line"
				>
					{{ line }}
				</li>
			</ul>

			<el-button
				v-if="typedPreferredHost !== null"
				size="small"
				type="primary"
				link
				data-test-id="protect-host-probe-use"
				@click="emit('use', typedPreferredHost)"
			>
				{{ t('devicesUnifiProtectPlugin.discovery.useHost', { host: typedPreferredHost }) }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElProgress } from 'element-plus';

import { injectStoresManager } from '../../../common';
import { DevicesUnifiProtectPluginDiscoveryStatus, DevicesUnifiProtectPluginProbeStatus } from '../../../openapi.constants';
import { ProtectScanStillRunningException, ProtectTimeoutException } from '../devices-unifi-protect.exceptions';
import { isValidProtectHost } from '../schemas/config.schemas';
import { protectDiscoveryStoreKey } from '../store/keys';
import { protectProbeKey } from '../store/protect-discovery.store';
import type { IProtectDiscoveredConsole, IProtectProbe } from '../store/protect.types';

import { normalizeProtectHost } from './protect-config-form.utils';
import type { IProtectDiscoveredConsolesProps } from './protect-discovered-consoles.types';

defineOptions({
	name: 'ProtectDiscoveredConsoles',
});

const props = withDefaults(defineProps<IProtectDiscoveredConsolesProps>(), {
	host: null,
});

const emit = defineEmits<{
	(e: 'use', host: string): void;
}>();

const { t } = useI18n();

const discoveryStore = injectStoresManager().getStore(protectDiscoveryStoreKey);

/** Why the list could not be shown; also the locale key of the message. */
const loadFailed = ref<'loadFailed' | 'scanFailed' | 'stillScanning' | null>(null);

/** A scan this client runs or follows, or one the backend reports in progress (also on mount, for a scan started elsewhere). */
const scanInProgress = computed<boolean>(
	(): boolean => discoveryStore.scanning || discoveryStore.discovery?.status === DevicesUnifiProtectPluginDiscoveryStatus.scanning
);

/** Probes started from this component that failed, by `protectProbeKey`. */
const probeErrors = reactive<Record<string, 'probeTimeout' | 'probeFailed'>>({});

/** Keys this component checked; a probe's details are shown only after a check, not for the scan's own probe. */
const checked = reactive<Set<string>>(new Set());

const consoles = computed<IProtectDiscoveredConsole[]>((): IProtectDiscoveredConsole[] => discoveryStore.discovery?.consoles ?? []);

const typedHost = computed<string | null>((): string | null => {
	const host = (props.host ?? '').trim();

	return host !== '' && isValidProtectHost(host) ? host : null;
});

const checkedProbe = (host: string, port?: number): IProtectProbe | null => {
	const key = protectProbeKey(host, port);

	return checked.has(key) ? (discoveryStore.probes[key] ?? null) : null;
};

const typedPreferredHost = computed<string | null>((): string | null => {
	if (typedHost.value === null) {
		return null;
	}

	const preferred = checkedProbe(typedHost.value, props.port)?.preferredHost ?? null;

	return preferred !== null && normalizeProtectHost(preferred) !== normalizeProtectHost(typedHost.value) ? preferred : null;
});

/** The host to save: the newest probe's preference (the direct connect domain when its certificate is valid). */
const preferredHostOf = (entry: IProtectDiscoveredConsole): string =>
	discoveryStore.probes[protectProbeKey(entry.host)]?.preferredHost ?? entry.probe.preferredHost ?? entry.host;

const consoleDetails = (entry: IProtectDiscoveredConsole): string =>
	[entry.model, entry.host, entry.firmware ? t('devicesUnifiProtectPlugin.discovery.firmware', { version: entry.firmware }) : null]
		.filter((value): value is string => typeof value === 'string' && value !== '')
		.join(' · ');

/** What a check found: whether Protect runs there, and whether its direct connect domain has a valid certificate. */
const probeLines = (probe: IProtectProbe): string[] => {
	if (probe.status === DevicesUnifiProtectPluginProbeStatus.unreachable) {
		return [t('devicesUnifiProtectPlugin.discovery.unreachable')];
	}

	if (probe.status === DevicesUnifiProtectPluginProbeStatus.not_console) {
		return [t('devicesUnifiProtectPlugin.discovery.notConsole')];
	}

	const lines = [t(`devicesUnifiProtectPlugin.discovery.protect.${probe.protect}`)];
	const domain = probe.certificate?.domain ?? probe.directConnectDomain ?? null;

	if (domain === null) {
		lines.push(t('devicesUnifiProtectPlugin.discovery.domain.none'));
	} else if (!probe.certificate || probe.certificate.valid === null || probe.certificate.valid === undefined) {
		lines.push(t('devicesUnifiProtectPlugin.discovery.domain.unknown', { domain }));
	} else {
		lines.push(t(`devicesUnifiProtectPlugin.discovery.domain.${probe.certificate.valid ? 'valid' : 'invalid'}`, { domain }));

		if (!probe.certificate.domainResolvesToHost) {
			lines.push(t('devicesUnifiProtectPlugin.discovery.domain.elsewhere', { domain }));
		}
	}

	return lines;
};

const check = async (host: string, port?: number): Promise<void> => {
	const key = protectProbeKey(host, port);

	delete probeErrors[key];
	checked.add(key);

	try {
		await discoveryStore.probe(port === undefined ? { host } : { host, port });
	} catch (error) {
		probeErrors[key] = error instanceof ProtectTimeoutException ? 'probeTimeout' : 'probeFailed';
	}
};

const onScan = async (): Promise<void> => {
	loadFailed.value = null;

	try {
		await discoveryStore.scan();
	} catch (error) {
		loadFailed.value = error instanceof ProtectScanStillRunningException ? 'stillScanning' : 'scanFailed';
	}
};

onMounted(async (): Promise<void> => {
	try {
		await discoveryStore.fetch();
	} catch (error) {
		loadFailed.value = error instanceof ProtectScanStillRunningException ? 'stillScanning' : 'loadFailed';
	}
});
</script>

<style scoped>
.protect-discovered-consoles__item {
	padding: 0.5rem 0.75rem;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: var(--el-border-radius-base);
}
</style>

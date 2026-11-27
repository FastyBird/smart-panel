<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-alert
			type="info"
			:title="t('devicesUnifiProtectPlugin.config.title')"
			:description="t('devicesUnifiProtectPlugin.config.description')"
			:closable="false"
		/>

		<el-divider
			class="mt-3"
			content-position="left"
		>
			{{ t('devicesUnifiProtectPlugin.sections.console') }}
		</el-divider>

		<protect-discovered-consoles
			:host="model.host"
			:port="model.port"
			class="mb-4"
			@use="onUseHost"
		/>

		<div class="grid grid-cols-1 tp:grid-cols-[1fr_10rem] gap-4">
			<el-form-item
				:label="t('devicesUnifiProtectPlugin.config.host.label')"
				prop="host"
				:error="fieldErrors['host']"
			>
				<el-input
					v-model="model.host"
					name="host"
					:placeholder="t('devicesUnifiProtectPlugin.config.host.placeholder')"
					inputmode="url"
					autocomplete="off"
					autocapitalize="off"
					autocorrect="off"
					spellcheck="false"
				/>
			</el-form-item>

			<el-form-item
				:label="t('devicesUnifiProtectPlugin.config.port.label')"
				prop="port"
				:error="fieldErrors['port']"
			>
				<el-input-number
					v-model="model.port"
					name="port"
					:min="1"
					:max="65535"
					:controls="false"
					class="w-full"
				/>
			</el-form-item>
		</div>

		<el-divider content-position="left">{{ t('devicesUnifiProtectPlugin.sections.apiKey') }}</el-divider>

		<el-form-item
			:label="t('devicesUnifiProtectPlugin.config.apiKey.label')"
			prop="apiKey"
			:error="fieldErrors['apiKey']"
		>
			<config-secret-input
				v-model="model.apiKey"
				:configured="model.apiKeyConfigured"
				name="apiKey"
				:placeholder="t('devicesUnifiProtectPlugin.config.apiKey.placeholder')"
			/>
			<p
				class="mt-1 text-xs text-[var(--el-text-color-secondary)]"
				data-test-id="protect-api-key-help"
			>
				{{ t('devicesUnifiProtectPlugin.config.apiKeyHelp') }}
			</p>
		</el-form-item>

		<el-divider content-position="left">{{ t('devicesUnifiProtectPlugin.sections.certificate') }}</el-divider>

		<el-form-item
			:label="t('devicesUnifiProtectPlugin.config.tls.label')"
			prop="tls.mode"
		>
			<el-radio-group
				v-model="model.tls.mode"
				name="tlsMode"
			>
				<el-radio value="verify">{{ t('devicesUnifiProtectPlugin.config.tls.mode.verify') }}</el-radio>
				<el-radio value="pinned">{{ t('devicesUnifiProtectPlugin.config.tls.mode.pinned') }}</el-radio>
			</el-radio-group>
		</el-form-item>

		<el-form-item
			v-if="model.tls.mode === 'verify'"
			:label="t('devicesUnifiProtectPlugin.config.tls.serverName.label')"
			prop="tls.serverName"
			:error="fieldErrors['tls.serverName']"
		>
			<el-input
				v-model="model.tls.serverName"
				name="serverName"
				autocomplete="off"
				autocapitalize="off"
				autocorrect="off"
				spellcheck="false"
			/>
			<div
				v-if="suggestedServerName !== null || directConnectDomain !== null"
				class="mt-1 flex flex-wrap gap-2"
			>
				<el-button
					v-if="suggestedServerName !== null"
					size="small"
					link
					type="primary"
					data-test-id="protect-fill-suggested"
					@click="model.tls.serverName = suggestedServerName"
				>
					{{ t('devicesUnifiProtectPlugin.config.tls.serverName.useSuggested', { name: suggestedServerName }) }}
				</el-button>
				<el-button
					v-if="directConnectDomain !== null"
					size="small"
					link
					type="primary"
					data-test-id="protect-fill-direct-connect"
					@click="model.tls.serverName = directConnectDomain"
				>
					{{ t('devicesUnifiProtectPlugin.config.tls.serverName.useDirectConnect', { name: directConnectDomain }) }}
				</el-button>
			</div>
		</el-form-item>

		<el-form-item
			v-else
			:label="t('devicesUnifiProtectPlugin.config.tls.fingerprint.label')"
			prop="tls.fingerprintSha256"
			:error="fieldErrors['tls.fingerprintSha256']"
		>
			<el-input
				v-model="model.tls.fingerprintSha256"
				name="fingerprintSha256"
				autocomplete="off"
				autocapitalize="off"
				autocorrect="off"
				spellcheck="false"
			/>
		</el-form-item>

		<el-collapse
			class="mt-4"
			data-test-id="protect-advanced"
		>
			<el-collapse-item :title="t('devicesUnifiProtectPlugin.sections.advanced')">
				<el-form-item
					:label="t('devicesUnifiProtectPlugin.config.streamHostOverride.label')"
					prop="streamHostOverride"
					:error="fieldErrors['streamHostOverride']"
				>
					<el-input
						v-model="model.streamHostOverride"
						name="streamHostOverride"
						inputmode="url"
						autocomplete="off"
						autocapitalize="off"
						autocorrect="off"
						spellcheck="false"
					/>
				</el-form-item>

				<el-form-item
					:label="t('devicesUnifiProtectPlugin.config.defaultStreamQuality.label')"
					prop="defaultStreamQuality"
				>
					<el-radio-group
						v-model="model.defaultStreamQuality"
						name="defaultStreamQuality"
					>
						<el-radio
							v-for="quality in STREAM_QUALITIES"
							:key="quality"
							:value="quality"
						>
							{{ t(`devicesUnifiProtectPlugin.config.defaultStreamQuality.${quality}`) }}
						</el-radio>
					</el-radio-group>
				</el-form-item>

				<div class="grid grid-cols-1 tp:grid-cols-2 gap-4">
					<el-form-item
						:label="t('devicesUnifiProtectPlugin.config.snapshotMinIntervalMs.label')"
						prop="snapshotMinIntervalMs"
						:error="fieldErrors['snapshotMinIntervalMs']"
					>
						<el-input-number
							v-model="model.snapshotMinIntervalMs"
							name="snapshotMinIntervalMs"
							:min="MIN_PROTECT_SNAPSHOT_MIN_INTERVAL_MS"
							:max="MAX_PROTECT_SNAPSHOT_MIN_INTERVAL_MS"
							:step="500"
							class="w-full"
						/>
					</el-form-item>

					<el-form-item
						:label="t('devicesUnifiProtectPlugin.config.pollIntervalMs.label')"
						prop="pollIntervalMs"
						:error="fieldErrors['pollIntervalMs']"
					>
						<el-input-number
							v-model="model.pollIntervalMs"
							name="pollIntervalMs"
							:min="MIN_PROTECT_POLL_INTERVAL_MS"
							:max="MAX_PROTECT_POLL_INTERVAL_MS"
							:step="5000"
							class="w-full"
						/>
					</el-form-item>
				</div>
			</el-collapse-item>
		</el-collapse>

		<el-divider content-position="left">{{ t('devicesUnifiProtectPlugin.sections.test') }}</el-divider>

		<protect-test-connection
			:result="currentTest"
			:testing="statusStore.testing"
			:timed-out="timedOut"
			:request-failed="requestFailed"
			:request-failed-detail="requestFailed ? failedDetail : null"
			:hint="testHint"
			:trustable="trustable"
			@test="runTest"
			@trust="onTrust"
		/>

		<protect-connection-status :poll-interval-ms="savedPollIntervalMs" />
	</el-form>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCollapse,
	ElCollapseItem,
	ElDivider,
	ElForm,
	ElFormItem,
	ElInput,
	ElInputNumber,
	ElRadio,
	ElRadioGroup,
	type FormRules,
} from 'element-plus';

import { deepClone, injectStoresManager } from '../../../common';
import { ConfigSecretInput, FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import {
	MAX_PROTECT_POLL_INTERVAL_MS,
	MAX_PROTECT_SNAPSHOT_MIN_INTERVAL_MS,
	MIN_PROTECT_POLL_INTERVAL_MS,
	MIN_PROTECT_SNAPSHOT_MIN_INTERVAL_MS,
} from '../devices-unifi-protect.constants';
import { ProtectApiException } from '../devices-unifi-protect.exceptions';
import {
	isBlankProtectApiKeyReplacement,
	isIpAddress,
	isValidProtectHost,
	isValidProtectServerName,
	normalizeProtectFingerprint,
} from '../schemas/config.schemas';
import type { IProtectConfigEditForm } from '../schemas/config.types';
import { protectDiscoveryStoreKey, protectStatusStoreKey } from '../store/keys';
import type { IProtectTestConnection, IProtectTestTarget } from '../store/protect.types';

import type { IProtectConfigFormProps } from './protect-config-form.types';
import {
	type IProtectConnectionFields,
	type ProtectTestHint,
	type ProtectTrustable,
	buildTestRequest,
	findProtectProbe,
	isSameProtectTarget,
	protectConnectionKey,
	protectTestTarget,
	protectTrustable,
} from './protect-config-form.utils';
import ProtectConnectionStatus from './protect-connection-status.vue';
import ProtectDiscoveredConsoles from './protect-discovered-consoles.vue';
import ProtectTestConnection from './protect-test-connection.vue';

defineOptions({
	name: 'ProtectConfigForm',
});

const props = withDefaults(defineProps<IProtectConfigFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
	remoteFormErrors: () => [],
	layout: Layout.DEFAULT,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', value: boolean): void;
	(e: 'update:remote-form-result', value: FormResultType): void;
	(e: 'update:remote-form-reset', value: boolean): void;
	(e: 'update:remote-form-changed', value: boolean): void;
}>();

const STREAM_QUALITIES = ['high', 'medium', 'low'] as const;

const { t } = useI18n();

const storesManager = injectStoresManager();
const statusStore = storesManager.getStore(protectStatusStoreKey);
const discoveryStore = storesManager.getStore(protectDiscoveryStoreKey);

/** The connection settings as the backend stores them; never a typed key, only whether one is stored. */
const connectionOf = (value: IProtectConnectionFields): IProtectConnectionFields => ({
	host: value.host ?? null,
	port: value.port,
	apiKey: undefined,
	apiKeyConfigured: value.apiKeyConfigured === true,
	tls: deepClone(value.tls),
});

// Taken before the edit model, which wraps the same object, can change it.
const savedConnection = ref<IProtectConnectionFields>(connectionOf(props.config as unknown as IProtectConfigEditForm));

/** The poll interval the backend runs with; the status panel describes that one, not an unsaved edit. */
const savedPollIntervalMs = ref<number>((props.config as unknown as IProtectConfigEditForm).pollIntervalMs);

/** Takes the configuration the backend confirmed as the baseline for the test and the status panel. */
const markBaseline = (value: IProtectConfigEditForm): void => {
	savedConnection.value = connectionOf(value);
	savedPollIntervalMs.value = value.pollIntervalMs;
};

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IProtectConfigEditForm>({
	config: props.config,
	messages: {
		success: t('devicesUnifiProtectPlugin.messages.config.updated'),
		error: t('devicesUnifiProtectPlugin.messages.config.updateFailed'),
	},
});

const fieldErrors = computed<Record<string, string | undefined>>(() =>
	Object.fromEntries(props.remoteFormErrors.map((error) => [error.field, error.message]))
);

const formTarget = computed<IProtectTestTarget | null>((): IProtectTestTarget | null => protectTestTarget(model));

// Only the hint is kept here: the request itself carries a typed key and is built when the test runs.
const testHint = computed<ProtectTestHint | null>((): ProtectTestHint | null => {
	const plan = buildTestRequest(model, savedConnection.value);

	return 'disabled' in plan ? plan.hint : null;
});

/**
 * Bumped by every edit of what a test runs with: host, port, TLS mode, server name, pin, and the API key (a typed value,
 * marking it for removal, going back to the stored one). Only the form holds it; no store keeps the key or anything
 * derived from it. Synchronous, so an edit made right before a test (as trusting a certificate does) is counted first.
 */
const connectionEdit = ref<number>(0);

watch(
	[(): string => protectConnectionKey(model), (): unknown => model.apiKey],
	(): void => {
		connectionEdit.value++;
	},
	{ flush: 'sync' }
);

/** The connection edit the last test this form started ran under; null before its first test. */
const testedEdit = ref<number | null>(null);

/**
 * An outcome counts only while the connection is still the one this form tested: any edit since, even one made while
 * the test ran, retires it.
 */
const testIsCurrent = computed<boolean>((): boolean => testedEdit.value === connectionEdit.value);

/**
 * A result counts only for the connection it was run with: no connection edit since the test started, and the host,
 * port and TLS mode it was run for (compared as the backend normalises a host).
 */
const currentTest = computed<IProtectTestConnection | null>((): IProtectTestConnection | null => {
	const last = statusStore.lastTest;

	return last !== null && testIsCurrent.value && isSameProtectTarget(last.target, formTarget.value) ? last.result : null;
});

const trustable = computed<ProtectTrustable>((): ProtectTrustable => protectTrustable(currentTest.value, model.tls));

const timedOutTarget = ref<IProtectTestTarget | null>(null);
const failedTarget = ref<IProtectTestTarget | null>(null);
/** The backend's reason for a refused test request, shown under the generic sentence. */
const failedDetail = ref<string | null>(null);

const timedOut = computed<boolean>((): boolean => testIsCurrent.value && isSameProtectTarget(timedOutTarget.value, formTarget.value));
const requestFailed = computed<boolean>((): boolean => testIsCurrent.value && isSameProtectTarget(failedTarget.value, formTarget.value));

const suggestedServerName = computed<string | null>((): string | null => currentTest.value?.suggestedServerName ?? null);

const directConnectDomain = computed<string | null>((): string | null => {
	const domain = findProtectProbe(model.host, model.port, discoveryStore.probes, discoveryStore.discovery)?.directConnectDomain ?? null;

	return domain !== null && isValidProtectServerName(domain) && domain !== suggestedServerName.value ? domain : null;
});

/** The backend's message for a refused request; dropped if it would echo the typed key back into the page. */
const refusalDetail = (error: unknown, apiKey: string | null): string | null => {
	if (!(error instanceof ProtectApiException) || error.message.trim() === '') {
		return null;
	}

	return apiKey !== null && error.message.includes(apiKey) ? null : error.message;
};

/** The status panel is current after a save or a test; a failed read only marks it stale, so it never throws out of the form. */
const refreshStatus = async (): Promise<void> => {
	try {
		await statusStore.fetch({ fresh: true });
	} catch {
		// The store's `stale` flag already shows it.
	}
};

const runTest = async (): Promise<void> => {
	const plan = buildTestRequest(model, savedConnection.value);

	if ('disabled' in plan || statusStore.testing) {
		return;
	}

	timedOutTarget.value = null;
	failedTarget.value = null;
	failedDetail.value = null;
	testedEdit.value = connectionEdit.value;

	try {
		const outcome = await statusStore.testConnection(plan.request, plan.target);

		if ('timedOut' in outcome) {
			timedOutTarget.value = plan.target;
		}
	} catch (error) {
		failedTarget.value = plan.target;
		failedDetail.value = refusalDetail(error, 'data' in plan.request && 'api_key' in plan.request.data ? plan.request.data.api_key : null);
	}

	await refreshStatus();
};

/**
 * Pins the certificate of the current result (Q2) and tests again. The test component offers trust only when
 * `trustable` allows it; this re-checks that the fingerprint is the current result's, so nothing else gets pinned.
 */
const onTrust = async (fingerprint: string): Promise<void> => {
	if (trustable.value === 'none' || currentTest.value?.certificate?.fingerprintSha256 !== fingerprint) {
		return;
	}

	model.tls.mode = 'pinned';
	model.tls.fingerprintSha256 = fingerprint;

	statusStore.clearLastTest();

	timedOutTarget.value = null;
	failedTarget.value = null;

	// A candidate test when a key is typed, the saved test when the pin is already stored; otherwise the hint shows.
	await runTest();
};

const onUseHost = (host: string, port: number): void => {
	model.host = host;
	model.port = port;
};

const rangeMessage = (key: string, min: number, max: number): string => t(`devicesUnifiProtectPlugin.config.${key}.invalid`, { min, max });

// Mirrors ProtectConfigEditFormSchema (and through it the backend rules cited there) so errors show per field.
const rules = computed<FormRules<IProtectConfigEditForm>>(() => ({
	host: [
		{
			validator: (_rule, value, callback) => {
				if (typeof value === 'string' && value.trim() !== '' && !isValidProtectHost(value.trim())) {
					callback(new Error(t('devicesUnifiProtectPlugin.config.host.invalid')));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
		},
	],
	port: [
		{ required: true, message: t('devicesUnifiProtectPlugin.config.port.invalid'), trigger: ['change', 'blur'] },
		{ type: 'integer', min: 1, max: 65535, message: t('devicesUnifiProtectPlugin.config.port.invalid'), trigger: ['change', 'blur'] },
	],
	apiKey: [
		{
			validator: (_rule, value, callback) => {
				if (isBlankProtectApiKeyReplacement(value)) {
					callback(new Error(t('devicesUnifiProtectPlugin.config.apiKey.invalid')));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
		},
	],
	'tls.serverName': [
		{
			validator: (_rule, value, callback) => {
				const serverName = typeof value === 'string' ? value.trim() : '';
				const host = (model.host ?? '').trim();

				if (serverName !== '' && !isValidProtectServerName(serverName)) {
					callback(new Error(t('devicesUnifiProtectPlugin.config.tls.serverName.invalid')));
				} else if (serverName === '' && model.tls.mode === 'verify' && isIpAddress(host)) {
					// findProtectConfigError: verify with an IP host needs a server name, or the connector cannot start (Q3).
					callback(new Error(t('devicesUnifiProtectPlugin.config.tls.serverName.required')));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
		},
	],
	'tls.fingerprintSha256': [
		{
			validator: (_rule, value, callback) => {
				if (model.tls.mode === 'pinned' && normalizeProtectFingerprint(value) === null) {
					callback(new Error(t('devicesUnifiProtectPlugin.config.tls.fingerprint.required')));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
		},
	],
	streamHostOverride: [
		{
			validator: (_rule, value, callback) => {
				if (typeof value === 'string' && value.trim() !== '' && !isValidProtectHost(value.trim())) {
					callback(new Error(t('devicesUnifiProtectPlugin.config.streamHostOverride.invalid')));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
		},
	],
	snapshotMinIntervalMs: [
		{
			type: 'integer',
			required: true,
			min: MIN_PROTECT_SNAPSHOT_MIN_INTERVAL_MS,
			max: MAX_PROTECT_SNAPSHOT_MIN_INTERVAL_MS,
			message: rangeMessage('snapshotMinIntervalMs', MIN_PROTECT_SNAPSHOT_MIN_INTERVAL_MS, MAX_PROTECT_SNAPSHOT_MIN_INTERVAL_MS),
			trigger: ['change', 'blur'],
		},
	],
	pollIntervalMs: [
		{
			type: 'integer',
			required: true,
			min: MIN_PROTECT_POLL_INTERVAL_MS,
			max: MAX_PROTECT_POLL_INTERVAL_MS,
			message: rangeMessage('pollIntervalMs', MIN_PROTECT_POLL_INTERVAL_MS, MAX_PROTECT_POLL_INTERVAL_MS),
			trigger: ['change', 'blur'],
		},
	],
}));

onMounted((): void => {
	// A result from an earlier visit is not this form's. One still running lands in the store but stays hidden: this form
	// shows only the tests it ran, under the connection it holds (`testedEdit`).
	if (!statusStore.testing) {
		statusStore.clearLastTest();
	}
});

// A host that re-reads the configuration hands over a new object; that read is the saved baseline from then on. Only the
// object is watched, not its fields: before such a read the edit model may wrap this very object, and following its
// fields would take unsaved edits for saved ones.
watch(
	() => props.config,
	(config) => markBaseline(config as unknown as IProtectConfigEditForm)
);
watch(formResult, (value) => emit('update:remote-form-result', value));
watch(formChanged, (value) => emit('update:remote-form-changed', value));
watch(
	() => props.remoteFormSubmit,
	(value) => {
		if (!value) return;
		emit('update:remote-form-submit', false);
		void submit()
			.then(async (): Promise<void> => {
				markBaseline(model);

				await refreshStatus();
			})
			.catch(() => undefined);
	}
);
watch(
	() => props.remoteFormReset,
	(value) => {
		emit('update:remote-form-reset', false);
		if (value) formEl.value?.resetFields();
	}
);
</script>

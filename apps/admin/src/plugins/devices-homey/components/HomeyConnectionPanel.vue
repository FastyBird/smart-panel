<template>
	<el-card
		shadow="never"
		class="mt-6"
		data-test-id="homey-connection-panel"
	>
		<template #header>
			<div class="flex items-center justify-between gap-3">
				<div>
					<div class="font-medium">{{ t('devicesHomeyPlugin.status.title') }}</div>
					<div class="text-xs text-gray-500 mt-1">{{ t('devicesHomeyPlugin.status.description') }}</div>
				</div>

				<el-button
					plain
					:loading="statusStore.fetching"
					:disabled="statusStore.testing"
					data-test-id="homey-refresh-status"
					@click="refreshStatus"
				>
					{{ t('devicesHomeyPlugin.status.refresh') }}
				</el-button>
			</div>
		</template>

		<el-alert
			v-if="statusLoadFailed"
			type="warning"
			:closable="false"
			:title="t('devicesHomeyPlugin.status.loadFailed')"
			class="mb-4"
		/>

		<el-descriptions
			v-if="statusStore.status"
			:border="true"
			:column="2"
			class="mb-4"
		>
			<el-descriptions-item :label="t('devicesHomeyPlugin.status.fields.connection')">
				<el-tag :type="statusTagType(statusStore.status.connectionState)">
					{{ t(`devicesHomeyPlugin.status.states.${statusStore.status.connectionState}`) }}
				</el-tag>
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesHomeyPlugin.status.fields.homey')">
				{{ formatHomeyIdentity(statusStore.status.homeyName, statusStore.status.homeyId) }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesHomeyPlugin.status.fields.version')">
				{{ statusStore.status.homeyVersion ?? notAvailable }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesHomeyPlugin.status.fields.lastSync')">
				{{ formatTimestamp(statusStore.status.lastInventorySyncAt) }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesHomeyPlugin.status.fields.lastEvent')">
				{{ formatTimestamp(statusStore.status.lastEventAt) }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesHomeyPlugin.status.fields.adoptedDevices')">
				{{ statusStore.status.adoptedDeviceCount }}
			</el-descriptions-item>
		</el-descriptions>

		<el-alert
			v-if="statusStore.status?.lastError"
			type="error"
			:closable="false"
			:title="statusStore.status.lastError"
			:description="errorGuidance(statusStore.status.lastErrorCategory)"
			class="mb-4"
		/>

		<div class="font-medium">{{ t('devicesHomeyPlugin.connectionTest.title') }}</div>
		<p class="text-sm text-gray-500 mt-1 mb-3">
			{{ t('devicesHomeyPlugin.connectionTest.description') }}
		</p>

		<div class="flex flex-wrap gap-2">
			<el-button
				:loading="statusStore.testing"
				:disabled="savedTestDisabled"
				data-test-id="homey-test-saved"
				@click="testSavedConnection"
			>
				{{ t('devicesHomeyPlugin.connectionTest.saved') }}
			</el-button>
			<el-button
				type="primary"
				plain
				:loading="statusStore.testing"
				:disabled="candidateTestDisabled"
				data-test-id="homey-test-candidate"
				@click="testCandidateConnection"
			>
				{{ t('devicesHomeyPlugin.connectionTest.candidate') }}
			</el-button>
		</div>

		<p
			v-if="!statusStore.status?.configured"
			class="text-xs text-gray-500 mt-2"
		>
			{{ t('devicesHomeyPlugin.connectionTest.savedUnavailable') }}
		</p>
		<p
			v-if="candidateRequest === null"
			class="text-xs text-gray-500 mt-1"
		>
			{{ t('devicesHomeyPlugin.connectionTest.candidateUnavailable') }}
		</p>

		<el-alert
			v-if="testRequestFailed"
			type="error"
			:closable="false"
			:title="t('devicesHomeyPlugin.connectionTest.requestFailed')"
			class="mt-4"
		/>
		<el-alert
			v-else-if="statusStore.lastTest?.success"
			type="success"
			:closable="false"
			:title="t('devicesHomeyPlugin.connectionTest.success')"
			:description="t('devicesHomeyPlugin.connectionTest.successDescription', { identity: testedHomeyIdentity })"
			class="mt-4"
		/>
		<el-alert
			v-else-if="statusStore.lastTest"
			type="error"
			:closable="false"
			:title="t('devicesHomeyPlugin.connectionTest.failure')"
			:description="testFailureDescription"
			class="mt-4"
		/>
	</el-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCard, ElDescriptions, ElDescriptionsItem, ElTag } from 'element-plus';

import { useHomeyStatus } from '../store/homey-status.store';
import type { IHomeyStatus } from '../store/homey.types';

import { createCandidateHomeyConnectionTestRequest, createSavedHomeyConnectionTestRequest, formatHomeyTimestamp } from './homey-config-form.utils';

defineOptions({ name: 'HomeyConnectionPanel' });

const props = withDefaults(
	defineProps<{
		candidateUrl?: string | null;
		candidateApiKey?: string | null;
	}>(),
	{
		candidateUrl: null,
		candidateApiKey: undefined,
	}
);

const { t } = useI18n();
const statusStore = useHomeyStatus();
const statusLoadFailed = ref(false);
const testRequestFailed = ref(false);
let testGeneration = 0;

const notAvailable = computed<string>(() => t('devicesHomeyPlugin.status.notAvailable'));
const candidateRequest = computed(() => createCandidateHomeyConnectionTestRequest(props.candidateUrl, props.candidateApiKey));
const savedTestDisabled = computed<boolean>(() => statusStore.testing || statusStore.status?.configured !== true);
const candidateTestDisabled = computed<boolean>(() => statusStore.testing || candidateRequest.value === null);
const testedHomeyIdentity = computed<string>(() => {
	const identity = [statusStore.lastTest?.homeyName, statusStore.lastTest?.homeyId, statusStore.lastTest?.homeyVersion]
		.filter((value): value is string => typeof value === 'string' && value !== '')
		.join(' · ');

	return identity || notAvailable.value;
});
const testFailureDescription = computed<string>(() => {
	const result = statusStore.lastTest;
	const reason = result?.error ?? t('devicesHomeyPlugin.connectionTest.failureFallback');
	const guidance = errorGuidance(result?.errorCategory);

	return guidance ? `${reason} ${guidance}` : reason;
});

const statusTagType = (state: IHomeyStatus['connectionState']): 'success' | 'warning' | 'danger' | 'info' => {
	if (state === 'connected') return 'success';
	if (state === 'degraded_polling' || state === 'reconnecting') return 'warning';
	if (state === 'authentication_failed' || state === 'error') return 'danger';

	return 'info';
};

const errorGuidance = (category: IHomeyStatus['lastErrorCategory']): string => (category ? t(`devicesHomeyPlugin.status.guidance.${category}`) : '');

const formatTimestamp = (value: string | null | undefined): string => formatHomeyTimestamp(value) ?? notAvailable.value;

const formatHomeyIdentity = (name: string | null | undefined, id: string | null | undefined): string => {
	const identity = [name, id].filter((value): value is string => typeof value === 'string' && value !== '').join(' · ');

	return identity || notAvailable.value;
};

const refreshStatus = async (): Promise<void> => {
	statusLoadFailed.value = false;

	try {
		await statusStore.fetch();
	} catch {
		statusLoadFailed.value = true;
	}
};

const runConnectionTest = async (request: ReturnType<typeof createSavedHomeyConnectionTestRequest>): Promise<void> => {
	if (statusStore.testing) return;

	const generation = ++testGeneration;
	testRequestFailed.value = false;

	try {
		await statusStore.testConnection(request);
	} catch {
		if (generation === testGeneration) testRequestFailed.value = true;
	} finally {
		if (generation !== testGeneration) statusStore.clearLastTest();
	}
};

const testSavedConnection = async (): Promise<void> => runConnectionTest(createSavedHomeyConnectionTestRequest());

const testCandidateConnection = async (): Promise<void> => {
	if (candidateRequest.value === null) return;

	await runConnectionTest(candidateRequest.value);
};

const invalidateConnectionTestResult = (): void => {
	testGeneration += 1;
	testRequestFailed.value = false;
	statusStore.clearLastTest();
};

watch(() => [props.candidateUrl, props.candidateApiKey], invalidateConnectionTestResult);

onMounted(() => {
	invalidateConnectionTestResult();
	void refreshStatus();
});

onBeforeUnmount(invalidateConnectionTestResult);
</script>

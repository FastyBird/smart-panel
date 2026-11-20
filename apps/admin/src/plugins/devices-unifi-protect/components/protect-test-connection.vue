<template>
	<div data-test-id="protect-test-connection">
		<div class="flex flex-wrap items-center gap-2">
			<el-button
				:loading="testing"
				:disabled="testing || hint !== null"
				data-test-id="protect-test-button"
				@click="emit('test')"
			>
				{{ t('devicesUnifiProtectPlugin.testConnection.button') }}
			</el-button>
		</div>

		<p
			v-if="hint !== null"
			class="mt-1 text-xs text-[var(--el-text-color-secondary)]"
			data-test-id="protect-test-hint"
		>
			{{ t(`devicesUnifiProtectPlugin.testConnection.hints.${hint}`) }}
		</p>

		<el-alert
			v-if="timedOut"
			type="warning"
			show-icon
			:closable="false"
			class="mt-3"
			data-test-id="protect-test-timeout"
		>
			<template #title>{{ t('devicesUnifiProtectPlugin.testConnection.timeout.title') }}</template>

			<p>{{ t('devicesUnifiProtectPlugin.testConnection.timeout.description') }}</p>

			<el-button
				size="small"
				class="mt-2"
				:disabled="testing || hint !== null"
				data-test-id="protect-test-retry"
				@click="emit('test')"
			>
				{{ t('devicesUnifiProtectPlugin.testConnection.retry') }}
			</el-button>
		</el-alert>

		<el-alert
			v-else-if="requestFailed"
			type="error"
			show-icon
			:closable="false"
			class="mt-3"
			data-test-id="protect-test-request-failed"
		>
			<template #title>{{ t('devicesUnifiProtectPlugin.testConnection.requestFailed') }}</template>

			<p
				v-if="requestFailedDetail"
				class="text-xs"
				data-test-id="protect-test-request-failed-detail"
			>
				{{ requestFailedDetail }}
			</p>
		</el-alert>

		<template v-else-if="result !== null">
			<el-alert
				v-if="result.success"
				type="success"
				show-icon
				:closable="false"
				:title="t('devicesUnifiProtectPlugin.testConnection.success')"
				class="mt-3"
				data-test-id="protect-test-success"
			>
				<dl class="protect-test-connection__details">
					<dt>{{ t('devicesUnifiProtectPlugin.testConnection.fields.console') }}</dt>
					<dd>{{ consoleIdentity }}</dd>

					<dt>{{ t('devicesUnifiProtectPlugin.testConnection.fields.version') }}</dt>
					<dd>{{ result.applicationVersion ?? notAvailable }}</dd>

					<dt>{{ t('devicesUnifiProtectPlugin.testConnection.fields.nvr') }}</dt>
					<dd>{{ result.nvrName ?? notAvailable }}</dd>
				</dl>
			</el-alert>

			<el-alert
				v-else
				type="error"
				show-icon
				:closable="false"
				class="mt-3"
				data-test-id="protect-test-failure"
			>
				<template #title>{{ failureSentence }}</template>

				<p
					v-if="result.error"
					class="text-xs"
					data-test-id="protect-test-failure-detail"
				>
					{{ result.error }}
				</p>
			</el-alert>

			<dl class="protect-test-connection__details mt-2">
				<dt>{{ t('devicesUnifiProtectPlugin.testConnection.fields.minimumVersion') }}</dt>
				<dd data-test-id="protect-test-minimum-version">{{ result.minimumVersion }}</dd>

				<dt>{{ t('devicesUnifiProtectPlugin.testConnection.fields.versionSupported') }}</dt>
				<dd data-test-id="protect-test-version-supported">{{ versionSupportedText }}</dd>
			</dl>

			<protect-certificate
				v-if="result.certificate"
				:certificate="result.certificate"
				:trustable="trustable"
				@trust="(fingerprint: string) => emit('trust', fingerprint)"
			/>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton } from 'element-plus';

import ProtectCertificate from './protect-certificate.vue';
import type { IProtectTestConnectionProps } from './protect-test-connection.types';

defineOptions({
	name: 'ProtectTestConnection',
});

const props = withDefaults(defineProps<IProtectTestConnectionProps>(), {
	testing: false,
	timedOut: false,
	requestFailed: false,
	requestFailedDetail: null,
	hint: null,
	trustable: 'none',
});

const emit = defineEmits<{
	(e: 'test'): void;
	(e: 'trust', fingerprint: string): void;
}>();

const { t } = useI18n();

const notAvailable = computed<string>((): string => t('devicesUnifiProtectPlugin.testConnection.notAvailable'));

const consoleIdentity = computed<string>((): string => {
	const identity = [props.result?.consoleName, props.result?.consoleModel]
		.filter((value): value is string => typeof value === 'string' && value !== '')
		.join(' · ');

	return identity || notAvailable.value;
});

// The sentence comes from the category; the backend's message is only shown under it.
const failureSentence = computed<string>((): string => {
	const category = props.result?.errorCategory;

	return category
		? t(`devicesUnifiProtectPlugin.errorCategories.${category}`, { minimum: props.result?.minimumVersion })
		: t('devicesUnifiProtectPlugin.testConnection.failed');
});

const versionSupportedText = computed<string>((): string => {
	const supported = props.result?.versionSupported;

	if (supported === true) return t('devicesUnifiProtectPlugin.testConnection.version.supported');
	if (supported === false) return t('devicesUnifiProtectPlugin.testConnection.version.unsupported');

	return t('devicesUnifiProtectPlugin.testConnection.version.unknown');
});
</script>

<style scoped>
.protect-test-connection__details {
	display: grid;
	grid-template-columns: max-content 1fr;
	column-gap: 0.75rem;
	row-gap: 0.25rem;
	font-size: var(--el-font-size-small);
}

.protect-test-connection__details dt {
	color: var(--el-text-color-secondary);
}
</style>

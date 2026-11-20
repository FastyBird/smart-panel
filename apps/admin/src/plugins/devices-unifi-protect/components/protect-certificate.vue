<template>
	<div
		class="mt-3"
		data-test-id="protect-certificate"
	>
		<el-descriptions
			:title="t('devicesUnifiProtectPlugin.certificate.title')"
			:column="1"
			border
			size="small"
		>
			<el-descriptions-item :label="t('devicesUnifiProtectPlugin.certificate.subject')">
				{{ certificate.subjectCommonName ?? notAvailable }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesUnifiProtectPlugin.certificate.issuer')">
				{{ certificate.issuerCommonName ?? notAvailable }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesUnifiProtectPlugin.certificate.altNames')">
				{{ certificate.subjectAltNames.length > 0 ? certificate.subjectAltNames.join(', ') : notAvailable }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesUnifiProtectPlugin.certificate.validity')">
				{{
					t('devicesUnifiProtectPlugin.certificate.validityRange', {
						from: formatProtectDate(certificate.validFrom),
						to: formatProtectDate(certificate.validTo),
					})
				}}
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesUnifiProtectPlugin.certificate.selfSigned')">
				<span data-test-id="protect-certificate-self-signed">{{ yesNo(certificate.selfSigned) }}</span>
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesUnifiProtectPlugin.certificate.trusted')">
				<span data-test-id="protect-certificate-trusted">{{ yesNo(certificate.trusted) }}</span>
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesUnifiProtectPlugin.certificate.fingerprint')">
				<code class="break-all">{{ certificate.fingerprintSha256 }}</code>
			</el-descriptions-item>
		</el-descriptions>

		<div
			v-if="trustable === 'untrusted'"
			class="mt-2"
		>
			<el-button
				type="primary"
				plain
				data-test-id="protect-certificate-trust"
				@click="emitTrust"
			>
				{{ t('devicesUnifiProtectPlugin.certificate.trust') }}
			</el-button>
			<p class="mt-1 text-xs text-[var(--el-text-color-secondary)]">
				{{ t('devicesUnifiProtectPlugin.certificate.trustHint') }}
			</p>
		</div>

		<el-alert
			v-else-if="trustable === 'changed'"
			type="warning"
			show-icon
			:closable="false"
			class="mt-2"
			data-test-id="protect-certificate-changed"
		>
			<template #title>{{ t('devicesUnifiProtectPlugin.certificate.changed.title') }}</template>

			<p>{{ t('devicesUnifiProtectPlugin.certificate.changed.description') }}</p>

			<div
				v-if="confirming"
				class="mt-2"
			>
				<p class="font-semibold">{{ t('devicesUnifiProtectPlugin.certificate.changed.confirmText') }}</p>
				<div class="mt-2 flex flex-wrap gap-2">
					<el-button
						type="warning"
						data-test-id="protect-certificate-confirm"
						@click="emitTrust"
					>
						{{ t('devicesUnifiProtectPlugin.certificate.changed.confirm') }}
					</el-button>
					<el-button
						data-test-id="protect-certificate-cancel"
						@click="confirming = false"
					>
						{{ t('devicesUnifiProtectPlugin.certificate.changed.cancel') }}
					</el-button>
				</div>
			</div>

			<el-button
				v-else
				type="warning"
				plain
				class="mt-2"
				data-test-id="protect-certificate-replace"
				@click="confirming = true"
			>
				{{ t('devicesUnifiProtectPlugin.certificate.changed.replace') }}
			</el-button>
		</el-alert>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElDescriptions, ElDescriptionsItem } from 'element-plus';

import type { IProtectCertificateProps } from './protect-certificate.types';
import { formatProtectDate } from './protect-config-form.utils';

defineOptions({
	name: 'ProtectCertificate',
});

const props = defineProps<IProtectCertificateProps>();

const emit = defineEmits<{
	(e: 'trust', fingerprint: string): void;
}>();

const { t } = useI18n();

const confirming = ref<boolean>(false);

const notAvailable = computed<string>((): string => t('devicesUnifiProtectPlugin.certificate.notAvailable'));

const yesNo = (value: boolean): string => t(value ? 'devicesUnifiProtectPlugin.certificate.yes' : 'devicesUnifiProtectPlugin.certificate.no');

const emitTrust = (): void => {
	confirming.value = false;

	emit('trust', props.certificate.fingerprintSha256);
};

// A confirmation given for one certificate must not carry over to another.
watch(
	(): string => props.certificate.fingerprintSha256,
	(): void => {
		confirming.value = false;
	}
);
</script>

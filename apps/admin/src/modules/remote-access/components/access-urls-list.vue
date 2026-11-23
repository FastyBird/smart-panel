<template>
	<div class="grid gap-6 dt:grid-cols-2">
		<div
			class="flex flex-col gap-3 min-w-0"
			data-test-id="access-urls-internal"
		>
			<h3 class="m-0 text-card-title">{{ t('remoteAccessModule.headings.internalUrl') }}</h3>

			<template v-if="internal">
				<copy-field
					:value="internal"
					data-test-id="access-url"
				/>
				<access-url-qr
					:open="openQrUrl === internal"
					:image="qrDataUrls[internal]"
					@toggle="toggleQr(internal)"
				/>
			</template>

			<copy-field
				v-for="candidate in candidates"
				:key="candidate"
				:value="candidate"
				data-test-id="access-url-candidate"
			/>
		</div>

		<div
			class="flex flex-col gap-3 min-w-0"
			data-test-id="access-urls-external"
		>
			<h3 class="m-0 text-card-title">{{ t('remoteAccessModule.headings.externalUrls') }}</h3>

			<p
				v-if="external.length === 0"
				class="m-0 text-help"
				data-test-id="access-urls-no-external"
			>
				{{ t('remoteAccessModule.texts.noExternalUrls') }}
			</p>

			<div
				v-for="(endpoint, index) in external"
				:key="endpoint.url"
				class="flex flex-col gap-2"
				data-test-id="access-url-external"
			>
				<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
					<span class="text-label">{{ endpoint.label }}</span>
					<status-tag
						v-if="index === 0"
						status="primary"
						:label="t('remoteAccessModule.texts.primary')"
					/>
					<status-tag
						:status="endpoint.https ? 'ok' : 'warn'"
						:label="endpoint.https ? t('remoteAccessModule.texts.https') : t('remoteAccessModule.texts.http')"
					/>
					<status-tag
						:status="endpoint.scope === 'public' ? 'warn' : 'info'"
						:label="endpoint.scope === 'public' ? t('remoteAccessModule.texts.public') : t('remoteAccessModule.texts.private')"
					/>
				</div>

				<copy-field
					:value="endpoint.url"
					data-test-id="access-url"
				/>
				<access-url-qr
					:open="openQrUrl === endpoint.url"
					:image="qrDataUrls[endpoint.url]"
					@toggle="toggleQr(endpoint.url)"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import QRCode from 'qrcode';

import { CopyField, StatusTag, useFlashMessage } from '../../../common';
import { useRemoteAccessUrls } from '../composables';

import AccessUrlQr from './access-url-qr.vue';

defineOptions({
	name: 'AccessUrlsList',
});

const { t } = useI18n();
const flashMessage = useFlashMessage();

const { internal, candidates, external } = useRemoteAccessUrls();

const openQrUrl = ref<string | null>(null);
const qrDataUrls = reactive<Record<string, string>>({});

const toggleQr = async (url: string): Promise<void> => {
	if (openQrUrl.value === url) {
		openQrUrl.value = null;

		return;
	}

	openQrUrl.value = url;

	if (!qrDataUrls[url]) {
		try {
			qrDataUrls[url] = await QRCode.toDataURL(url, { width: 180, margin: 2 });
		} catch {
			flashMessage.error(t('remoteAccessModule.messages.qrFailed'));

			// Only clear the selection if it is still this URL: a slower, now-stale request must not
			// clobber a newer selection the user already switched to while this one was pending.
			if (openQrUrl.value === url) {
				openQrUrl.value = null;
			}
		}
	}
};
</script>

<template>
	<div class="flex flex-col gap-6">
		<div>
			<h3 class="text-sm font-semibold text-gray-500 mb-2">
				{{ t('remoteAccessModule.headings.internalUrl') }}
			</h3>

			<template v-if="internal">
				<div class="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
					<span class="font-mono text-sm flex-1 break-all">{{ internal }}</span>
					<el-button
						size="small"
						:aria-label="t('remoteAccessModule.buttons.copy.title')"
						@click="copyUrl(internal)"
					>
						<icon icon="mdi:content-copy" />
					</el-button>
					<el-button
						size="small"
						:aria-label="t('remoteAccessModule.buttons.showQr.title')"
						@click="toggleQr(internal)"
					>
						<icon icon="mdi:qrcode" />
					</el-button>
				</div>

				<div
					v-if="openQrUrl === internal && qrDataUrls[internal]"
					class="flex justify-center mt-2"
				>
					<img
						:src="qrDataUrls[internal]"
						:alt="t('remoteAccessModule.texts.qrAlt')"
						width="180"
						height="180"
					/>
				</div>
			</template>

			<ul
				v-if="candidates.length > 0"
				class="mt-2 flex flex-col gap-1"
			>
				<li
					v-for="candidate in candidates"
					:key="candidate"
					class="flex items-center gap-2 text-sm text-gray-500"
				>
					<span class="font-mono flex-1 break-all">{{ candidate }}</span>
					<el-button
						size="small"
						text
						:aria-label="t('remoteAccessModule.buttons.copy.title')"
						@click="copyUrl(candidate)"
					>
						<icon icon="mdi:content-copy" />
					</el-button>
				</li>
			</ul>
		</div>

		<div>
			<h3 class="text-sm font-semibold text-gray-500 mb-2">
				{{ t('remoteAccessModule.headings.externalUrls') }}
			</h3>

			<el-alert
				v-if="external.length === 0"
				type="info"
				:title="t('remoteAccessModule.texts.noExternalUrls')"
				:closable="false"
			/>

			<div
				v-for="(endpoint, index) in external"
				:key="endpoint.url"
				class="flex flex-col gap-1 rounded border border-gray-200 px-3 py-2 mb-2"
			>
				<div class="flex items-center gap-2">
					<span class="text-sm font-medium">{{ endpoint.label }}</span>
					<el-tag
						v-if="index === 0"
						type="success"
						size="small"
					>
						{{ t('remoteAccessModule.texts.primary') }}
					</el-tag>
					<el-tag
						:type="endpoint.https ? 'success' : 'warning'"
						size="small"
					>
						{{ endpoint.https ? t('remoteAccessModule.texts.https') : t('remoteAccessModule.texts.http') }}
					</el-tag>
					<el-tag
						:type="endpoint.scope === 'public' ? 'warning' : 'info'"
						size="small"
					>
						{{ endpoint.scope === 'public' ? t('remoteAccessModule.texts.public') : t('remoteAccessModule.texts.private') }}
					</el-tag>
				</div>

				<div class="flex items-center gap-2">
					<span class="font-mono text-sm flex-1 break-all">{{ endpoint.url }}</span>
					<el-button
						size="small"
						:aria-label="t('remoteAccessModule.buttons.copy.title')"
						@click="copyUrl(endpoint.url)"
					>
						<icon icon="mdi:content-copy" />
					</el-button>
					<el-button
						size="small"
						:aria-label="t('remoteAccessModule.buttons.showQr.title')"
						@click="toggleQr(endpoint.url)"
					>
						<icon icon="mdi:qrcode" />
					</el-button>
				</div>

				<div
					v-if="openQrUrl === endpoint.url && qrDataUrls[endpoint.url]"
					class="flex justify-center mt-1"
				>
					<img
						:src="qrDataUrls[endpoint.url]"
						:alt="t('remoteAccessModule.texts.qrAlt')"
						width="180"
						height="180"
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElTag } from 'element-plus';
import QRCode from 'qrcode';

import { Icon } from '@iconify/vue';

import { useFlashMessage } from '../../../common';
import { useRemoteAccessUrls } from '../composables';

defineOptions({
	name: 'AccessUrlsList',
});

const { t } = useI18n();
const flashMessage = useFlashMessage();

const { internal, candidates, external } = useRemoteAccessUrls();

const openQrUrl = ref<string | null>(null);
const qrDataUrls = reactive<Record<string, string>>({});

const copyUrl = async (url: string): Promise<void> => {
	try {
		await navigator.clipboard.writeText(url);
		flashMessage.success(t('remoteAccessModule.messages.urlCopied'));
	} catch {
		flashMessage.error(t('remoteAccessModule.messages.copyFailed'));
	}
};

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
			openQrUrl.value = null;
		}
	}
};
</script>

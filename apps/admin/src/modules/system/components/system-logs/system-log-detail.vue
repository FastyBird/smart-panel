<template>
	<!-- One log entry: its level and message first, then where it came from, then its arguments and the raw record -->
	<div
		class="flex flex-col gap-4"
		data-test-id="system-log-detail"
	>
		<div class="flex flex-col gap-2">
			<div class="flex flex-wrap items-center gap-2">
				<status-tag
					:status="logLevelStatus(props.systemLog.type)"
					:label="t(`systemModule.levels.${props.systemLog.type}`)"
					data-test-id="system-log-detail-level"
				/>
				<span class="text-help">{{ t(`systemModule.sources.${props.systemLog.source}`) }}</span>
				<span
					v-if="props.systemLog.tag"
					class="text-help"
				>
					· {{ props.systemLog.tag }}
				</span>
			</div>

			<p
				:class="['m-0 break-words whitespace-pre-wrap', props.systemLog.message ? 'text-body' : 'text-secondary']"
				data-test-id="system-log-detail-message"
			>
				{{ props.systemLog.message ?? t('systemModule.fields.systemLogs.message.noMessage') }}
			</p>
		</div>

		<kv-grid
			:items="details"
			:cols="2"
		/>

		<section
			v-if="hasArgs"
			class="flex flex-col gap-2"
		>
			<h3 class="m-0 text-card-title">{{ t('systemModule.fields.systemLogs.args.title') }}</h3>
			<pre
				class="m-0 p-3 rounded-[var(--el-border-radius-base)] bg-fill-light text-mono text-[12px] leading-[18px] overflow-auto"
				data-test-id="system-log-detail-args"
				>{{ pretty(props.systemLog.args) }}</pre
			>
		</section>

		<section class="flex flex-col gap-2">
			<div class="flex items-center gap-2">
				<h3 class="m-0 text-card-title flex-1">{{ t('systemModule.fields.systemLogs.rawJson.title') }}</h3>
				<el-button
					size="small"
					data-test-id="system-log-detail-copy"
					@click="onCopy"
				>
					<template #icon>
						<icon icon="mdi:content-copy" />
					</template>
					{{ t('systemModule.buttons.copyJson.title') }}
				</el-button>
			</div>
			<pre
				class="m-0 p-3 rounded-[var(--el-border-radius-base)] bg-fill-light text-mono text-[12px] leading-[18px] overflow-auto max-h-[360px]"
				data-test-id="system-log-detail-raw"
				>{{ pretty(props.systemLog) }}</pre
			>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

import { Icon } from '@iconify/vue';

import { KvGrid, type KvGridItem, StatusTag, useFlashMessage } from '../../../../common';
import { logLevelStatus } from '../../utils/system.utils';

import type { ISystemLogsDetailProps } from './system-log-detail.types';

defineOptions({
	name: 'SystemLogDetail',
});

const props = defineProps<ISystemLogsDetailProps>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const hasArgs = computed<boolean>((): boolean => {
	const args = props.systemLog.args;

	return Array.isArray(args) ? args.length > 0 : args !== null && args !== undefined;
});

const formatDate = (iso: string | null | undefined): string | null =>
	iso ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(iso)) : null;

// Only what the entry carries: a backend line has no browser, an admin line no ingest time
const details = computed<KvGridItem[]>((): KvGridItem[] => {
	const entry = props.systemLog;

	const items: KvGridItem[] = [
		{ label: t('systemModule.fields.systemLogs.timestamp.title'), value: formatDate(entry.ts) },
		{ label: t('systemModule.fields.systemLogs.ingestedAt.title'), value: formatDate(entry.ingestedAt) },
		{ label: t('systemModule.fields.systemLogs.user.title'), value: entry.user?.id, mono: true },
		{ label: t('systemModule.fields.systemLogs.appVersion.title'), value: entry.context?.appVersion, mono: true },
		// A link only to a web page: the URL is whatever the reporting client sent
		{
			label: t('systemModule.fields.systemLogs.url.title'),
			value: entry.context?.url,
			href: entry.context?.url && /^https?:\/\//i.test(entry.context.url) ? entry.context.url : undefined,
		},
		{ label: t('systemModule.fields.systemLogs.userAgent.title'), value: entry.context?.userAgent },
		{ label: t('systemModule.fields.systemLogs.locale.title'), value: entry.context?.locale },
	];

	// The time is always there; the rest only when the entry has it
	return items.filter((item, index) => index === 0 || (item.value !== null && item.value !== undefined && item.value !== ''));
});

const pretty = (value: unknown): string => {
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
};

// Whether the text reached the clipboard: the legacy fallback reports a refusal by returning false, not by throwing
const copyText = async (text: string): Promise<boolean> => {
	try {
		await navigator.clipboard.writeText(text);

		return true;
	} catch {
		// Fallback for Safari / non-HTTPS — use legacy execCommand
		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.style.position = 'fixed';
		textarea.style.opacity = '0';
		document.body.appendChild(textarea);
		textarea.select();

		let copied = false;

		try {
			copied = document.execCommand('copy');
		} catch {
			copied = false;
		} finally {
			document.body.removeChild(textarea);
		}

		return copied;
	}
};

const onCopy = async (): Promise<void> => {
	if (await copyText(pretty(props.systemLog))) {
		flashMessage.success(t('systemModule.messages.systemLogs.copied'));
	} else {
		flashMessage.error(t('systemModule.messages.systemLogs.copyFailed'));
	}
};
</script>

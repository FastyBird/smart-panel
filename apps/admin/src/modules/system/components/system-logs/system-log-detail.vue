<template>
	<div
		:class="[ns.b()]"
		class="space-y-4"
	>
		<el-descriptions
			:column="1"
			border
		>
			<el-descriptions-item :label="t('systemModule.fields.systemLogs.timestamp.title')">
				<span class="font-mono">{{ systemLog.ts }}</span>
			</el-descriptions-item>

			<el-descriptions-item
				v-if="systemLog.ingestedAt"
				:label="t('systemModule.fields.systemLogs.ingestedAt.title')"
			>
				<span class="font-mono">{{ systemLog.ingestedAt }}</span>
			</el-descriptions-item>

			<el-descriptions-item :label="t('systemModule.fields.systemLogs.source.title')">
				<el-tag
					size="small"
					effect="plain"
					class="justify-self-start"
				>
					{{ systemLog.source }}
				</el-tag>
			</el-descriptions-item>

			<el-descriptions-item :label="t('systemModule.fields.systemLogs.level.title')">
				<el-tag
					v-bind="levelTagProps(systemLog.type)"
					size="small"
					class="justify-self-start"
				>
					{{ systemLog.type }}
				</el-tag>
			</el-descriptions-item>

			<el-descriptions-item :label="t('systemModule.fields.systemLogs.message.title')">
				{{ systemLog.message ?? `(${t('systemModule.fields.systemLogs.message.noMessage')})` }}
			</el-descriptions-item>

			<el-descriptions-item
				v-if="systemLog.tag"
				:label="t('systemModule.fields.systemLogs.tag.title')"
			>
				{{ systemLog.tag }}
			</el-descriptions-item>

			<el-descriptions-item
				v-if="systemLog.user?.id"
				:label="t('systemModule.fields.systemLogs.user.title')"
			>
				<span class="font-mono">{{ systemLog.user.id }}</span>
			</el-descriptions-item>

			<el-descriptions-item
				v-if="systemLog.context?.appVersion"
				:label="t('systemModule.fields.systemLogs.appVersion.title')"
			>
				{{ systemLog.context?.appVersion }}
			</el-descriptions-item>

			<el-descriptions-item
				v-if="systemLog.context?.url"
				:label="t('systemModule.fields.systemLogs.url.title')"
			>
				<a
					:href="systemLog.context.url"
					target="_blank"
					class="text-primary hover:underline"
				>
					{{ systemLog.context.url }}
				</a>
			</el-descriptions-item>

			<el-descriptions-item
				v-if="systemLog.context?.userAgent"
				:label="t('systemModule.fields.systemLogs.userAgent.title')"
			>
				<span class="text-xs">{{ systemLog.context?.userAgent }}</span>
			</el-descriptions-item>

			<el-descriptions-item
				v-if="systemLog.context?.locale"
				:label="t('systemModule.fields.systemLogs.locale.title')"
			>
				{{ systemLog.context.locale }}
			</el-descriptions-item>
		</el-descriptions>

		<el-tabs
			type="card"
			class="mt-2"
		>
			<el-tab-pane
				v-if="systemLog.args"
				:label="t('systemModule.fields.systemLogs.args.title')"
			>
				<pre class="p-2 bg-gray-50 rounded text-xs overflow-auto">{{ pretty(systemLog.args) }}</pre>
			</el-tab-pane>

			<el-tab-pane :label="t('systemModule.fields.systemLogs.rawJson.title')">
				<pre class="p-2 bg-gray-50 rounded text-xs overflow-auto">{{ pretty(systemLog) }}</pre>

				<div class="flex gap-2">
					<el-button
						size="small"
						@click="copy(pretty(systemLog))"
					>
						{{ t('systemModule.buttons.copyJson.title') }}
					</el-button>
				</div>
			</el-tab-pane>
		</el-tabs>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElDescriptions, ElDescriptionsItem, ElTabPane, ElTabs, ElTag, useNamespace } from 'element-plus';

import { ConfigModuleSystemLog_levels } from '../../../../openapi.constants';

import type { ISystemLogsDetailProps } from './system-log-detail.types';

defineOptions({
	name: 'SystemLogDetail',
});

defineProps<ISystemLogsDetailProps>();

const ns = useNamespace('system-log-detail');
const { t } = useI18n();

const pretty = (v: unknown): string => {
	try {
		return JSON.stringify(v, null, 2);
	} catch {
		return String(v);
	}
};

const copy = (text: string): void => {
	navigator.clipboard?.writeText(text);
};

const levelTagProps = (lvl: ConfigModuleSystemLog_levels) => {
	const s = lvl.toLowerCase();

	if (['fatal', 'error', 'fail'].includes(s)) {
		return { type: 'danger' as const, effect: 'light' as const };
	}

	if (['warn', 'box'].includes(s)) {
		return { type: 'warning' as const, effect: 'light' as const };
	}

	if (['success', 'ready', 'start', 'info', 'log'].includes(s)) {
		return { type: 'success' as const, effect: 'light' as const };
	}

	return {
		effect: 'plain' as const,
		class: 'tag-neutral',
	};
};
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'system-log-detail.scss';
</style>

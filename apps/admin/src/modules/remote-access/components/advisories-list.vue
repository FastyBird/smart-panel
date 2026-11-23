<template>
	<state-view
		v-if="rows.length === 0"
		icon="mdi:shield-check-outline"
		:title="t('remoteAccessModule.texts.noAdvisories')"
		data-test-id="advisories-empty"
	/>

	<!-- One row per advisory at every size: a few short messages read better as a list than as a wide table -->
	<ul
		v-else
		class="flex flex-col m-0 p-0 list-none"
		data-test-id="advisories-list"
	>
		<li
			v-for="(row, index) in rows"
			:key="row.rowKey"
			:class="['flex flex-col gap-1.5 py-3', index > 0 ? 'border-t border-t-solid border-light' : 'pt-0', index === rows.length - 1 ? 'pb-0' : '']"
			:data-code="row.code"
			data-test-id="advisory"
		>
			<div class="flex items-start gap-3">
				<status-tag
					:status="severityStatus(row.severity)"
					:label="t(`remoteAccessModule.severity.${row.severity}`)"
					class="shrink-0"
				/>
				<p
					class="m-0 flex-1 min-w-0 text-body break-words"
					data-test-id="advisory-message"
				>
					<template v-if="row.consoleLinkOffset >= 0">
						<span>{{ row.message.slice(0, row.consoleLinkOffset) }}</span>
						<el-link
							:href="tailscaleDnsConsoleUrl"
							target="_blank"
							rel="noopener noreferrer"
						>
							{{ tailscaleDnsConsoleUrl }}
						</el-link>
						<span>{{ row.message.slice(row.consoleLinkOffset + tailscaleDnsConsoleUrl.length) }}</span>
					</template>
					<template v-else>{{ row.message }}</template>
				</p>
			</div>
			<span class="text-caption break-all">
				{{ row.provider ?? t('remoteAccessModule.texts.moduleSource') }} ·
				<code class="text-caption">{{ row.code }}</code>
			</span>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElLink } from 'element-plus';

import { StateView, StatusTag, type StatusTagStatus } from '../../../common';
import { useRemoteAccessStatus } from '../composables';
import type { IRemoteAccessAdvisory } from '../store/remote-access-status.store.types';

defineOptions({
	name: 'AdvisoriesList',
});

const { t } = useI18n();

const { advisories } = useRemoteAccessStatus();
const tailscaleDnsConsoleUrl = 'https://login.tailscale.com/admin/dns';

// The index is part of the key, so two advisories that share a code and provider still get their own rows
const rows = computed<(IRemoteAccessAdvisory & { rowKey: string; consoleLinkOffset: number })[]>(() =>
	advisories.value.map((advisory, index) => ({
		...advisory,
		rowKey: `${advisory.code}-${advisory.provider ?? 'module'}-${index}`,
		consoleLinkOffset:
			advisory.code === 'tailnet-https-disabled' && advisory.provider === 'remote-access-tailscale-plugin'
				? advisory.message.indexOf(tailscaleDnsConsoleUrl)
				: -1,
	}))
);

const severityStatus = (severity: IRemoteAccessAdvisory['severity']): StatusTagStatus => {
	switch (severity) {
		case 'critical':
			return 'critical';
		case 'warning':
			return 'warn';
		default:
			return 'info';
	}
};
</script>

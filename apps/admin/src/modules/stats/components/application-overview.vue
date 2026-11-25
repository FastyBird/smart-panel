<template>
	<!-- Template 6: the Smart Panel panel -->
	<el-card
		shadow="never"
		body-class="flex flex-col gap-3 p-4!"
		data-test-id="application-overview"
	>
		<span class="text-card-title">{{ t('statsModule.headings.applicationOverview') }}</span>

		<div class="grid grid-cols-1 tp:grid-cols-3 gap-4">
			<div class="flex flex-col gap-1 min-w-0">
				<span class="text-label">{{ t('statsModule.fields.applicationOverview.version.title') }}</span>
				<span class="text-body font-medium truncate">{{ appVersion }}</span>
			</div>

			<div class="flex flex-col gap-1 min-w-0">
				<span class="inline-flex items-center gap-1 text-label">
					{{ t('statsModule.fields.applicationOverview.apip95.title') }}
					<el-tooltip
						:content="t('statsModule.fields.applicationOverview.apip95.tooltip')"
						placement="top"
					>
						<icon
							icon="mdi:information-outline"
							width="14"
							height="14"
							class="text-muted"
							:aria-label="t('statsModule.fields.applicationOverview.apip95.tooltip')"
							role="img"
						/>
					</el-tooltip>
				</span>
				<span class="text-body font-medium">{{ apiModuleSection?.p95Ms5m.value ?? 0 }} ms</span>
			</div>

			<div class="flex flex-col gap-1 min-w-0 items-start">
				<span class="text-label">{{ t('statsModule.fields.applicationOverview.webSocket.title') }}</span>
				<status-tag
					:status="socketsConnected ? 'ok' : 'warn'"
					:label="
						socketsConnected
							? t('statsModule.fields.applicationOverview.webSocket.state.connected')
							: t('statsModule.fields.applicationOverview.webSocket.state.disconnected')
					"
				/>
			</div>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { StatusTag, useSockets } from '../../../common';

import type { IApplicationOverviewProps } from './application-overview.types';

defineOptions({
	name: 'ApplicationOverview',
});

withDefaults(defineProps<IApplicationOverviewProps>(), {
	loading: false,
});

const { t } = useI18n();

const { connected: socketsConnected } = useSockets();

const appVersion = ref<string>(__APP_VERSION__);
</script>

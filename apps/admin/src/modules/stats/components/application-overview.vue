<template>
	<el-card
		shadow="never"
		header-class="px-3! py-3! font-bold"
	>
		<template #header>
			{{ t('statsModule.headings.applicationOverview') }}
		</template>

		<div class="grid grid-cols-3 gap-2">
			<div>
				<div class="color-[var(--el-text-color-secondary)] flex flex-row items-center">
					{{ t('statsModule.fields.applicationOverview.version.title') }}
				</div>
				<div class="font-bold text-lg mt-1">
					{{ appVersion }}
				</div>
			</div>

			<div>
				<div class="color-[var(--el-text-color-secondary)] flex flex-row items-center">
					<el-tooltip
						:content="t('statsModule.fields.applicationOverview.apip95.tooltip')"
						placement="top-start"
					>
						<el-icon
							class="mr-2"
							:size="14"
						>
							<icon icon="mdi:info-circle-outline" />
						</el-icon>
					</el-tooltip>

					{{ t('statsModule.fields.applicationOverview.apip95.title') }}
				</div>
				<div class="font-bold text-lg mt-1">{{ apiModuleSection?.p95Ms5m.value ?? 0 }} ms</div>
			</div>

			<div>
				<div class="color-[var(--el-text-color-secondary)] flex flex-row items-center">
					{{ t('statsModule.fields.applicationOverview.webSocket.title') }}
				</div>
				<div class="font-bold text-lg mt-1 flex flex-row items-center">
					<span :class="{ 'color-[var(--el-color-success)]': socketsConnected, 'color-[var(--el-color-warning)]': !socketsConnected }">
						{{
							socketsConnected
								? t('statsModule.fields.applicationOverview.webSocket.state.connected')
								: t('statsModule.fields.applicationOverview.webSocket.state.disconnected')
						}}
					</span>
				</div>
			</div>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard, ElIcon, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useSockets } from '../../../common';

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

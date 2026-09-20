<template>
	<div class="channel-input-diagnostics space-y-4">
		<!-- Capabilities Section -->
		<div>
			<h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
				{{ t('devicesModule.diagnostics.capabilitiesTitle') }}
			</h4>

			<div
				v-if="isLoadingCapabilities"
				class="py-2"
			>
				<el-skeleton
					animated
					:rows="1"
				/>
			</div>

			<div
				v-else-if="capabilities"
				class="flex flex-wrap gap-2 items-center"
			>
				<template v-if="capabilities.supported_events && capabilities.supported_events.length > 0">
					<el-tag
						v-for="evt in capabilities.supported_events"
						:key="evt"
						size="small"
						effect="plain"
						class="font-mono"
					>
						{{ evt }}
					</el-tag>
				</template>
				<span
					v-else-if="isAnalogInput"
					class="text-xs text-gray-500 dark:text-gray-400 italic"
				>
					{{ t('devicesModule.diagnostics.noDiscreteEvents') }}
				</span>
				<span
					v-else
					class="text-xs text-gray-400 italic"
				>
					{{ t('devicesModule.diagnostics.noCapabilities') }}
				</span>
			</div>

			<div
				v-else
				class="text-xs text-gray-400 italic"
			>
				{{ t('devicesModule.diagnostics.noCapabilities') }}
			</div>
		</div>

		<!-- Live Diagnostics Section -->
		<div>
			<div class="flex items-center justify-between mb-2">
				<div class="flex items-center space-x-2">
					<h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
						{{ t('devicesModule.diagnostics.liveEventsTitle') }}
					</h4>
					<span class="text-xs text-gray-400">({{ occurrences.length }})</span>
				</div>

				<el-button
					v-if="occurrences.length > 0"
					size="small"
					text
					type="danger"
					@click="onClearEvents"
				>
					<template #icon>
						<icon icon="mdi:broom" />
					</template>
					{{ t('devicesModule.diagnostics.clearEvents') }}
				</el-button>
			</div>

			<div
				v-if="occurrences.length === 0"
				class="py-4 text-center text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded"
			>
				{{ t('devicesModule.diagnostics.noOccurrences') }}
			</div>

			<el-table
				v-else
				:data="occurrences"
				size="small"
				stripe
				class="w-full"
			>
				<el-table-column
					prop="receivedAt"
					:label="t('devicesModule.diagnostics.columnTimestamp')"
					width="120"
				>
					<template #default="{ row }">
						<span class="font-mono text-xs text-gray-500 dark:text-gray-400">
							{{ formatTimestamp(row.receivedAt) }}
						</span>
					</template>
				</el-table-column>

				<el-table-column
					prop="event"
					:label="t('devicesModule.diagnostics.columnEvent')"
				>
					<template #default="{ row }">
						<el-tag
							size="small"
							:type="getEventTagType(row.event)"
							class="font-mono"
						>
							{{ row.event }}
						</el-tag>
					</template>
				</el-table-column>

				<el-table-column
					prop="data"
					:label="t('devicesModule.diagnostics.columnData')"
				>
					<template #default="{ row }">
						<span class="font-mono text-xs text-gray-700 dark:text-gray-300">
							{{ row.data !== null && row.data !== undefined ? JSON.stringify(row.data) : '-' }}
						</span>
					</template>
				</el-table-column>

				<el-table-column
					prop="nativeEventType"
					:label="t('devicesModule.diagnostics.columnNativeType')"
				>
					<template #default="{ row }">
						<span
							v-if="row.nativeEventType"
							class="font-mono text-xs text-gray-500 dark:text-gray-400"
						>
							{{ row.nativeEventType }}
						</span>
						<span
							v-else
							class="text-xs text-gray-400 dark:text-gray-600"
						>
							-
						</span>
					</template>
				</el-table-column>
			</el-table>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElSkeleton, ElTable, ElTableColumn, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { MODULES_PREFIX } from '../../../../app.constants';
import { injectStoresManager, useBackend } from '../../../../common';
import { DevicesModuleChannelCategory } from '../../../../openapi.constants';
import { DEVICES_MODULE_PREFIX } from '../../devices.constants';
import type { IChannelInputOccurrence } from '../../store/channel-input-occurrences.store.types';
import type { IChannel } from '../../store/channels.store.types';
import { channelInputOccurrencesStoreKey } from '../../store/keys';

interface IChannelInputDiagnosticsProps {
	channel: IChannel;
}

interface IChannelCapabilities {
	channel_id: string;
	device_id: string;
	category?: string;
	is_input?: boolean;
	input_category?: string;
	supported_events?: string[];
	event_metadata?: Record<string, unknown>;
}

const props = defineProps<IChannelInputDiagnosticsProps>();

const { t } = useI18n();
const backend = useBackend();
const storesManager = injectStoresManager();
const occurrencesStore = storesManager.getStore(channelInputOccurrencesStoreKey);

const capabilities = ref<IChannelCapabilities | null>(null);
const isLoadingCapabilities = ref<boolean>(false);

const isAnalogInput = computed<boolean>(() => {
	const isInput = capabilities.value?.is_input ?? props.channel.category === DevicesModuleChannelCategory.analog_input;
	const category = capabilities.value?.category ?? props.channel.category;
	return isInput && category === DevicesModuleChannelCategory.analog_input;
});

const occurrences = computed<IChannelInputOccurrence[]>(() => {
	return occurrencesStore.findByChannel(props.channel.id);
});

const onClearEvents = (): void => {
	occurrencesStore.clear(props.channel.id);
};

const getEventTagType = (event: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' | undefined => {
	switch (event.toLowerCase()) {
		case 'press':
		case 'click':
		case 'single':
			return 'success';
		case 'double_press':
		case 'double_click':
		case 'triple_press':
			return 'warning';
		case 'long_press':
		case 'hold':
			return 'danger';
		case 'release':
		case 'up':
		case 'down':
			return 'info';
		default:
			return undefined;
	}
};

const formatTimestamp = (ts: string | number): string => {
	try {
		const date = new Date(ts);
		if (isNaN(date.getTime())) {
			return String(ts);
		}
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');
		const ms = String(date.getMilliseconds()).padStart(3, '0');
		return `${hours}:${minutes}:${seconds}.${ms}`;
	} catch {
		return String(ts);
	}
};

const fetchCapabilities = async (): Promise<void> => {
	isLoadingCapabilities.value = true;
	try {
		const response = await backend.client.GET(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/channels/{id}/input-capabilities`, {
			params: {
				path: { id: props.channel.id },
			},
		});
		if (response.data && response.data.data) {
			capabilities.value = response.data.data as IChannelCapabilities;
		}
	} catch {
		capabilities.value = null;
	} finally {
		isLoadingCapabilities.value = false;
	}
};

onMounted(async () => {
	await fetchCapabilities();
});
</script>

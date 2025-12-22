<template>
	<el-card
		class="mt-2"
		body-class="p-0!"
	>
		<dl class="grid m-0">
			<dt
				class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('devicesModule.texts.devices.category') }}
			</dt>
			<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
				<el-text>
					{{ t(`devicesModule.categories.devices.${device.category}`) }}
				</el-text>
			</dd>
			<dt
				class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('devicesModule.texts.devices.channels') }}
			</dt>
			<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
				<el-text>
					<i18n-t
						keypath="devicesModule.texts.devices.channelsCount"
						:plural="channels.length"
					>
						<template #count>
							<strong>{{ channels.length }}</strong>
						</template>
					</i18n-t>
				</el-text>
			</dd>
			<dt
				class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('devicesModule.texts.devices.status') }}
			</dt>
			<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
				<el-text>
					<el-tag
						:type="stateColor"
						size="small"
					>
						{{ t(`devicesModule.states.${String(device.status?.status ?? DevicesModuleDeviceConnectionStatus.unknown).toLowerCase()}`) }}
					</el-tag>
				</el-text>
			</dd>
			<dt
				class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('devicesModule.texts.devices.validation') }}
			</dt>
			<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
				<el-text>
					<el-tag
						v-if="validationLoading"
						size="small"
						type="info"
					>
						<icon
							icon="mdi:loading"
							class="animate-spin"
						/>
					</el-tag>
					<el-tag
						v-else-if="isValid === true"
						size="small"
						type="success"
					>
						{{ t('devicesModule.validation.status.valid') }}
					</el-tag>
					<el-tag
						v-else-if="isValid === false"
						size="small"
						type="danger"
					>
						{{ t('devicesModule.validation.status.invalid') }}
						<template v-if="errorCount > 0 || warningCount > 0">
							({{ errorCount }} {{ t('devicesModule.validation.errors') }}, {{ warningCount }} {{ t('devicesModule.validation.warnings') }})
						</template>
					</el-tag>
					<el-tag
						v-else
						size="small"
						type="info"
					>
						{{ t('devicesModule.validation.status.unknown') }}
					</el-tag>
				</el-text>
			</dd>
			<device-detail-description
				v-if="deviceInfoChannel"
				:device="device"
				:channel="deviceInfoChannel"
			/>
			<dt
				class="b-r b-r-solid py-1 px-2 flex items-center justify-end"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('devicesModule.texts.devices.alerts') }}
			</dt>
			<dd class="col-start-2 m-0 p-2 flex items-center min-w-[8rem]">
				<el-text>
					<el-tag
						size="small"
						:type="alerts.length === 0 ? 'success' : 'danger'"
					>
						<i18n-t
							keypath="devicesModule.texts.devices.alertsCount"
							:plural="alerts.length"
						>
							<template #count>
								<strong>{{ alerts.length }}</strong>
							</template>
						</i18n-t>
					</el-tag>
				</el-text>
			</dd>
		</dl>
	</el-card>

	<!-- Validation Issues Section -->
	<el-card
		v-if="issues.length > 0"
		class="mt-4"
		body-class="p-0!"
		shadow="never"
	>
		<template #header>
			<div class="flex items-center gap-2">
				<el-icon
					color="var(--el-color-danger)"
					:size="18"
				>
					<icon icon="mdi:alert-circle-outline" />
				</el-icon>
				<span>{{ t('devicesModule.validation.issuesTitle') }}</span>
				<el-tag
					type="danger"
					size="small"
				>
					{{ issues.length }}
				</el-tag>
			</div>
		</template>

		<el-table
			:data="issues"
			size="small"
			class="w-full"
		>
			<el-table-column
				:label="t('devicesModule.validation.table.severity')"
				prop="severity"
				:width="100"
			>
				<template #default="scope">
					<el-tag
						:type="scope.row.severity === 'error' ? 'danger' : 'warning'"
						size="small"
					>
						{{ scope.row.severity === 'error' ? t('devicesModule.validation.severity.error') : t('devicesModule.validation.severity.warning') }}
					</el-tag>
				</template>
			</el-table-column>
			<el-table-column
				:label="t('devicesModule.validation.table.type')"
				prop="type"
				:width="150"
			>
				<template #default="scope">
					{{ t(`devicesModule.validation.issueTypes.${scope.row.type}`, scope.row.type) }}
				</template>
			</el-table-column>
			<el-table-column
				:label="t('devicesModule.validation.table.message')"
				prop="message"
			/>
			<el-table-column
				:label="t('devicesModule.validation.table.channel')"
				prop="channelCategory"
				:width="150"
			>
				<template #default="scope">
					<template v-if="scope.row.channelCategory">
						{{ t(`devicesModule.categories.channels.${scope.row.channelCategory}`, scope.row.channelCategory) }}
					</template>
					<span
						v-else
						class="text-gray-400"
					>
						-
					</span>
				</template>
			</el-table-column>
		</el-table>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { I18nT, useI18n } from 'vue-i18n';

import { ElCard, ElIcon, ElTable, ElTableColumn, ElTag, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { injectStoresManager } from '../../../../common';
import { DevicesModuleChannelCategory, DevicesModuleDeviceConnectionStatus } from '../../../../openapi.constants';
import { useChannels } from '../../composables/composables';
import { type StateColor } from '../../devices.constants';
import type { IChannel } from '../../store/channels.store.types';
import { devicesValidationStoreKey } from '../../store/keys';

import DeviceDetailDescription from './device-detail-description.vue';
import type { IDeviceDetailProps } from './device-detail.types';

defineOptions({
	name: 'DeviceDetail',
});

const props = defineProps<IDeviceDetailProps>();

const { t } = useI18n();

const { channels } = useChannels({ deviceId: props.device.id });

// Get validation data using findById getter
const storesManager = injectStoresManager();
const validationStore = storesManager.getStore(devicesValidationStoreKey);

const validationResult = computed(() => validationStore.findById(props.device.id));
const isValid = computed<boolean | null>(() => validationResult.value?.isValid ?? null);
const issues = computed(() => validationResult.value?.issues ?? []);
const errorCount = computed<number>(() => issues.value.filter((i) => i.severity === 'error').length);
const warningCount = computed<number>(() => issues.value.filter((i) => i.severity === 'warning').length);
const validationLoading = computed<boolean>(() => validationStore.fetching() || validationStore.getting(props.device.id));

const alerts: string[] = [];

const deviceInfoChannel = computed<IChannel | undefined>((): IChannel | undefined => {
	return channels.value.find((channel) => channel.category === DevicesModuleChannelCategory.device_information);
});

const stateColor = computed<StateColor>((): StateColor => {
	if ([DevicesModuleDeviceConnectionStatus.unknown].includes(props.device.status.status)) {
		return undefined;
	}

	if (
		[DevicesModuleDeviceConnectionStatus.connected, DevicesModuleDeviceConnectionStatus.ready, DevicesModuleDeviceConnectionStatus.running].includes(
			props.device.status.status
		)
	) {
		return 'success';
	} else if ([DevicesModuleDeviceConnectionStatus.init].includes(props.device.status.status)) {
		return 'info';
	} else if (
		[
			DevicesModuleDeviceConnectionStatus.disconnected,
			DevicesModuleDeviceConnectionStatus.stopped,
			DevicesModuleDeviceConnectionStatus.sleeping,
		].includes(props.device.status.status)
	) {
		return 'warning';
	}

	return 'danger';
});
</script>

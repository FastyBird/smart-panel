<template>
	<el-row>
		<el-col
			:xs="24"
			:sm="12"
			:md="8"
		>
			<el-card
				class="md:m-2 xs:my-1"
				body-class="p-0!"
			>
				<el-descriptions
					:label-width="170"
					:column="1"
					border
				>
					<template #title>
						<div class="flex flex-row items-center pt-2 pl-2 min-h-10">
							<el-icon
								class="mr-2"
								size="28"
							>
								<icon icon="mdi:chip" />
							</el-icon>
							Hardware info
						</div>
					</template>

					<el-descriptions-item :label="t('systemModule.systemInfo.cpuLoad')">
						{{ formatNumber(props.systemInfo?.cpuLoad ?? 0, { maximumFractionDigits: 2 }) }} %
					</el-descriptions-item>
					<el-descriptions-item :label="t('systemModule.systemInfo.memoryUsage')">
						{{ formatNumber((props.systemInfo?.memory.used ?? 0) / 1024 / 1024, { maximumFractionDigits: 0 }) }} MB /
						{{ formatNumber((props.systemInfo?.memory.total ?? 0) / 1024 / 1024, { maximumFractionDigits: 0 }) }} MB
					</el-descriptions-item>
					<el-descriptions-item
						v-if="props.systemInfo?.temperature.cpu"
						:label="t('systemModule.systemInfo.cpuTemperature')"
					>
						{{ props.systemInfo?.temperature.cpu }} °C
					</el-descriptions-item>
					<el-descriptions-item
						v-else
						:label="t('systemModule.systemInfo.cpuTemperature')"
					>
						{{ t('application.value.notAvailable') }}
					</el-descriptions-item>
					<el-descriptions-item
						v-if="props.systemInfo?.temperature.gpu"
						:label="t('systemModule.systemInfo.gpuTemperature')"
					>
						{{ props.systemInfo?.temperature.gpu }} °C
					</el-descriptions-item>
					<el-descriptions-item
						v-else
						:label="t('systemModule.systemInfo.gpuTemperature')"
					>
						{{ t('application.value.notAvailable') }}
					</el-descriptions-item>
				</el-descriptions>
			</el-card>
		</el-col>

		<el-col
			:xs="24"
			:sm="12"
			:md="8"
		>
			<el-card
				class="md:m-2 xs:my-1"
				body-class="p-0!"
			>
				<el-descriptions
					:label-width="170"
					:column="1"
					border
				>
					<template #title>
						<div class="flex flex-row items-center pt-2 pl-2 min-h-10">
							<el-icon
								class="mr-2"
								size="28"
							>
								<icon icon="mdi:server-outline" />
							</el-icon>
							Operating system
						</div>
					</template>

					<el-descriptions-item :label="t('systemModule.systemInfo.osPlatform')">
						{{ props.systemInfo?.os.platform }}
					</el-descriptions-item>
					<el-descriptions-item :label="t('systemModule.systemInfo.osDistro')">
						{{ props.systemInfo?.os.distro }}
					</el-descriptions-item>
					<el-descriptions-item :label="t('systemModule.systemInfo.osRelease')">
						{{ props.systemInfo?.os.release }}
					</el-descriptions-item>
					<el-descriptions-item :label="t('systemModule.systemInfo.uptime')">
						{{ props.systemInfo?.os.uptime }}
					</el-descriptions-item>
				</el-descriptions>
			</el-card>
		</el-col>

		<el-col
			:xs="24"
			:sm="12"
			:md="8"
		>
			<el-card
				class="md:m-2 xs:my-1"
				body-class="p-0!"
			>
				<el-descriptions
					:label-width="170"
					:column="1"
					border
				>
					<template #title>
						<div class="flex flex-row items-center pt-2 pl-2 min-h-10">
							<el-icon
								class="mr-2"
								size="28"
							>
								<icon icon="mdi:local-area-network" />
							</el-icon>
							Network
						</div>
					</template>

					<el-descriptions-item :label="t('systemModule.systemInfo.networkInterface')">
						{{ props.systemInfo?.defaultNetwork.interface }}
					</el-descriptions-item>
					<el-descriptions-item :label="t('systemModule.systemInfo.ip4Address')">
						{{ props.systemInfo?.defaultNetwork.ip4 }}
					</el-descriptions-item>
					<el-descriptions-item :label="t('systemModule.systemInfo.ip6Address')">
						{{ props.systemInfo?.defaultNetwork.ip6 }}
					</el-descriptions-item>
					<el-descriptions-item :label="t('systemModule.systemInfo.macAddress')">
						{{ props.systemInfo?.defaultNetwork.mac }}
					</el-descriptions-item>
				</el-descriptions>
			</el-card>
		</el-col>

		<el-col
			v-for="display in props.displays"
			:key="display.id"
			:xs="24"
			:sm="12"
			:md="8"
		>
			<el-card
				class="md:m-2 xs:my-1"
				body-class="p-0!"
			>
				<el-descriptions
					:label-width="170"
					:column="1"
					border
				>
					<template #title>
						<div class="flex flex-row items-center pt-2 pl-2 min-h-10">
							<el-icon
								class="mr-2"
								size="28"
							>
								<icon icon="mdi:monitor" />
							</el-icon>
							<div class="flex flex-col">
								Display
								<small class="block text-">{{ display.uid }}</small>
							</div>
						</div>
					</template>

					<el-descriptions-item :label="t('systemModule.systemInfo.screenWidth')">{{ display.screenWidth }}px</el-descriptions-item>
					<el-descriptions-item :label="t('systemModule.systemInfo.screenHeight')">{{ display.screenHeight }}px</el-descriptions-item>
					<el-descriptions-item :label="t('systemModule.systemInfo.pixelRatio')">
						{{ display.pixelRatio }}
					</el-descriptions-item>
					<el-descriptions-item>
						<template #label>
							{{ t('systemModule.systemInfo.layout') }}
							<el-button
								type="primary"
								size="small"
								plain
								class="ml-2"
								:title="t('systemModule.buttons.edit.title')"
								@click="emit('edit-display', display.id)"
							>
								<template #icon>
									<icon icon="mdi:pencil" />
								</template>
							</el-button>
						</template>
						{{ t('systemModule.systemInfo.layoutSettings', { cols: display.cols, rows: display.rows, unitSize: display.unitSize }) }}
					</el-descriptions-item>
				</el-descriptions>
			</el-card>
		</el-col>

		<el-col
			:xs="24"
			:sm="12"
			:md="8"
		>
			<el-card
				class="md:m-2 xs:my-1"
				body-class="p-0!"
			>
				<el-descriptions
					:label-width="230"
					:column="1"
					border
				>
					<template #title>
						<div class="flex flex-row items-center pt-2 pl-2 min-h-10">
							<el-icon
								class="mr-2"
								size="28"
							>
								<icon icon="mdi:alert" />
							</el-icon>
							Throttle status
						</div>
					</template>

					<template v-if="props.throttleStatus">
						<el-descriptions-item :label="t('systemModule.systemInfo.undervoltage')">
							<el-tag
								v-if="props.throttleStatus.undervoltage"
								type="danger"
								size="small"
							>
								{{ t('systemModule.states.error') }}
							</el-tag>
							<el-tag
								v-else
								type="success"
								size="small"
							>
								{{ t('systemModule.states.ok') }}
							</el-tag>
						</el-descriptions-item>
						<el-descriptions-item :label="t('systemModule.systemInfo.frequencyCapping')">
							<el-tag
								v-if="props.throttleStatus.frequencyCapping"
								type="danger"
								size="small"
							>
								{{ t('systemModule.states.error') }}
							</el-tag>
							<el-tag
								v-else
								type="success"
								size="small"
							>
								{{ t('systemModule.states.ok') }}
							</el-tag>
						</el-descriptions-item>
						<el-descriptions-item :label="t('systemModule.systemInfo.throttling')">
							<el-tag
								v-if="props.throttleStatus.throttling"
								type="danger"
								size="small"
							>
								{{ t('systemModule.states.error') }}
							</el-tag>
							<el-tag
								v-else
								type="success"
								size="small"
							>
								{{ t('systemModule.states.ok') }}
							</el-tag>
						</el-descriptions-item>
						<el-descriptions-item :label="t('systemModule.systemInfo.softTempLimit')">
							<el-tag
								v-if="props.throttleStatus.softTempLimit"
								type="danger"
								size="small"
							>
								{{ t('systemModule.states.error') }}
							</el-tag>
							<el-tag
								v-else
								type="success"
								size="small"
							>
								{{ t('systemModule.states.ok') }}
							</el-tag>
						</el-descriptions-item>
					</template>
					<template v-else>
						<el-descriptions-item :label="t('systemModule.systemInfo.undervoltage')">
							{{ t('application.value.notAvailable') }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('systemModule.systemInfo.frequencyCapping')">
							{{ t('application.value.notAvailable') }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('systemModule.systemInfo.throttling')">
							{{ t('application.value.notAvailable') }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('systemModule.systemInfo.softTempLimit')">
							{{ t('application.value.notAvailable') }}
						</el-descriptions-item>
					</template>
				</el-descriptions>
			</el-card>
		</el-col>
	</el-row>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard, ElCol, ElDescriptions, ElDescriptionsItem, ElIcon, ElRow, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { formatNumber } from '../../../common';
import type { IDisplayProfile } from '../store/displays-profiles.store.types';
import { Layout } from '../system.constants';

import type { ISystemInfoDetailProps } from './system-info-detail.types';

defineOptions({
	name: 'SystemInfoDetail',
});

const emit = defineEmits<{
	(e: 'edit-display', id: IDisplayProfile['id']): void;
}>();

const props = withDefaults(defineProps<ISystemInfoDetailProps>(), {
	layout: Layout.DEFAULT,
});

const { t } = useI18n();
</script>

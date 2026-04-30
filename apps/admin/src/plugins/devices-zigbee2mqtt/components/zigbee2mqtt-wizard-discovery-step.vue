<template>
	<div class="flex flex-col gap-3 h-full overflow-hidden">
		<el-alert
			v-if="!bridgeOnline"
			type="warning"
			:closable="false"
			show-icon
			class="shrink-0"
		>
			<template #title>
				{{ t('devicesZigbee2mqttPlugin.wizard.bridge.offline.title') }}
			</template>
			<template #default>
				<div class="flex flex-col gap-2">
					<el-text>
						{{ t('devicesZigbee2mqttPlugin.wizard.bridge.offline.message') }}
					</el-text>
					<router-link
						:to="{ name: ConfigRouteNames.CONFIG_PLUGIN_EDIT, params: { plugin: DEVICES_ZIGBEE2MQTT_PLUGIN_NAME } }"
						class="text-primary"
					>
						{{ t('devicesZigbee2mqttPlugin.wizard.bridge.offline.openConfig') }}
					</router-link>
				</div>
			</template>
		</el-alert>

		<template v-else>
			<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between shrink-0">
				<div class="flex min-w-0 flex-1 flex-col gap-1">
					<template v-if="permitJoin.active">
						<el-text>
							{{ t('devicesZigbee2mqttPlugin.wizard.steps.discovery.pairingActive', { remaining: permitJoin.remainingSeconds }) }}
						</el-text>
						<el-progress
							:percentage="permitJoinPercentage"
							:status="permitJoinPercentage <= 25 ? 'warning' : undefined"
						/>
					</template>
				</div>

				<div class="flex flex-wrap gap-2">
					<el-button
						v-if="!permitJoin.active"
						type="primary"
						:disabled="!bridgeOnline"
						@click="emit('enable-permit-join')"
					>
						<template #icon>
							<icon icon="mdi:plus-circle-outline" />
						</template>
						{{ t('devicesZigbee2mqttPlugin.wizard.steps.discovery.permitJoin') }}
					</el-button>

					<el-button
						v-else
						type="warning"
						@click="emit('disable-permit-join')"
					>
						<template #icon>
							<icon icon="mdi:close-circle-outline" />
						</template>
						{{ t('devicesZigbee2mqttPlugin.wizard.steps.discovery.cancelPairing') }}
					</el-button>

					<el-button
						:disabled="adoptableDevices.length === 0"
						@click="onAutoPickAll"
					>
						<template #icon>
							<icon icon="mdi:checkbox-multiple-marked-outline" />
						</template>
						{{ t('devicesZigbee2mqttPlugin.wizard.steps.discovery.autoPickAll') }}
					</el-button>

					<el-button
						:disabled="!hasAnySelected"
						@click="onClearSelection"
					>
						<template #icon>
							<icon icon="mdi:checkbox-multiple-blank-outline" />
						</template>
						{{ t('devicesZigbee2mqttPlugin.wizard.steps.discovery.clearSelection') }}
					</el-button>
				</div>
			</div>

			<el-table
				:data="sortedDevices"
				class="h-full w-full flex-grow"
				table-layout="fixed"
				:empty-text="t('devicesZigbee2mqttPlugin.wizard.steps.discovery.empty')"
			>
				<el-table-column width="60">
					<template #default="{ row }: { row: IZ2mWizardDevice }">
						<el-checkbox
							:model-value="selected[row.ieeeAddress] === true"
							:disabled="!isAdoptableStatus(row.status)"
							@change="(value: boolean | string | number) => onToggleRow(row.ieeeAddress, value === true)"
						/>
					</template>
				</el-table-column>

				<el-table-column
					prop="friendlyName"
					:label="t('devicesZigbee2mqttPlugin.wizard.columns.friendlyName')"
					min-width="200"
					sortable
					:sort-method="sortByFriendlyName"
				>
					<template #default="{ row }: { row: IZ2mWizardDevice }">
						<code class="text-sm">{{ row.friendlyName }}</code>
					</template>
				</el-table-column>

				<el-table-column
					:label="t('devicesZigbee2mqttPlugin.wizard.columns.manufacturer')"
					min-width="180"
					sortable
					:sort-method="sortByManufacturer"
				>
					<template #default="{ row }: { row: IZ2mWizardDevice }">
						<small
							v-if="row.manufacturer || row.model"
							class="text-gray-500"
						>
							{{ [row.manufacturer, row.model].filter(Boolean).join(' · ') }}
						</small>
						<small
							v-else
							class="text-gray-400"
						>
							&mdash;
						</small>
					</template>
				</el-table-column>

				<el-table-column
					prop="status"
					:label="t('devicesZigbee2mqttPlugin.wizard.columns.status')"
					width="180"
					sortable
					:sort-method="sortByStatus"
				>
					<template #default="{ row }: { row: IZ2mWizardDevice }">
						<el-tag :type="statusTagType(row.status)">
							{{ t(`devicesZigbee2mqttPlugin.wizard.status.${statusI18nKey(row.status)}`) }}
						</el-tag>
					</template>
				</el-table-column>
			</el-table>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCheckbox, ElProgress, ElTable, ElTableColumn, ElTag, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { orderBy } from 'natural-orderby';

import { RouteNames as ConfigRouteNames } from '../../../modules/config';
import { isAdoptableStatus } from '../composables/useDevicesWizard';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_NAME } from '../devices-zigbee2mqtt.constants';
import type { IZ2mWizardDevice, IZ2mWizardDeviceStatus, IZ2mWizardPermitJoin } from '../schemas/wizard.types';

defineOptions({
	name: 'Zigbee2mqttWizardDiscoveryStep',
});

interface IProps {
	devices: IZ2mWizardDevice[];
	selected: Record<string, boolean>;
	permitJoin: IZ2mWizardPermitJoin;
	bridgeOnline: boolean;
}

const props = defineProps<IProps>();

const emit = defineEmits<{
	(e: 'enable-permit-join'): void;
	(e: 'disable-permit-join'): void;
	(e: 'update:selected', value: Record<string, boolean>): void;
}>();

const { t } = useI18n();

const compareLocale = (a: string | null | undefined, b: string | null | undefined): number => {
	const left = (a ?? '').toString();
	const right = (b ?? '').toString();
	return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
};

// Group adoptable devices first, then by ieeeAddress — matches the wizard composable's
// default ordering so the table opens with new pairings on top.
const sortedDevices = computed<IZ2mWizardDevice[]>(() =>
	orderBy(props.devices, [(device) => (isAdoptableStatus(device.status) ? 0 : 1), (device) => device.ieeeAddress], ['asc', 'asc'])
);

const adoptableDevices = computed<IZ2mWizardDevice[]>(() => props.devices.filter((device) => isAdoptableStatus(device.status)));

const hasAnySelected = computed<boolean>(() => Object.values(props.selected).some((value) => value === true));

const permitJoinPercentage = computed<number>(() => {
	if (!props.permitJoin.active) {
		return 0;
	}

	// 254 seconds is the typical Zigbee permit-join window — clamp the bar so it always fits.
	const total = Math.max(props.permitJoin.remainingSeconds, 1);

	return Math.min(100, Math.round((total / 254) * 100));
});

const sortByFriendlyName = (a: IZ2mWizardDevice, b: IZ2mWizardDevice): number => compareLocale(a.friendlyName, b.friendlyName);

const sortByManufacturer = (a: IZ2mWizardDevice, b: IZ2mWizardDevice): number => {
	const aLabel = [a.manufacturer, a.model].filter(Boolean).join(' ');
	const bLabel = [b.manufacturer, b.model].filter(Boolean).join(' ');
	return compareLocale(aLabel, bLabel);
};

// Group adoptable devices ahead of unsupported/failed ones, then by friendlyName inside each
// bucket — matches the discovery composable's default ordering.
const sortByStatus = (a: IZ2mWizardDevice, b: IZ2mWizardDevice): number => {
	const order = (status: IZ2mWizardDeviceStatus): number => (isAdoptableStatus(status) ? 0 : 1);
	const diff = order(a.status) - order(b.status);
	return diff !== 0 ? diff : compareLocale(a.friendlyName, b.friendlyName);
};

const statusTagType = (status: IZ2mWizardDeviceStatus): 'success' | 'warning' | 'info' | 'danger' => {
	if (status === 'ready') {
		return 'success';
	}

	if (status === 'already_registered') {
		return 'info';
	}

	if (status === 'unsupported') {
		return 'warning';
	}

	return 'danger';
};

const statusI18nKey = (status: IZ2mWizardDeviceStatus): string => {
	if (status === 'already_registered') {
		return 'alreadyRegistered';
	}

	return status;
};

const onToggleRow = (ieeeAddress: string, value: boolean): void => {
	const next: Record<string, boolean> = { ...props.selected, [ieeeAddress]: value };

	emit('update:selected', next);
};

const onAutoPickAll = (): void => {
	const next: Record<string, boolean> = { ...props.selected };

	for (const device of adoptableDevices.value) {
		next[device.ieeeAddress] = true;
	}

	emit('update:selected', next);
};

const onClearSelection = (): void => {
	const next: Record<string, boolean> = {};

	for (const key of Object.keys(props.selected)) {
		next[key] = false;
	}

	emit('update:selected', next);
};
</script>

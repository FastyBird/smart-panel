<template>
	<div class="flex flex-col gap-3 h-full overflow-hidden">
		<el-table
			:data="selectedDevices"
			class="h-full w-full flex-grow"
			table-layout="fixed"
		>
			<el-table-column
				:label="t('devicesZigbee2mqttPlugin.wizard.columns.name')"
				min-width="220"
				sortable
				:sort-method="sortByName"
			>
				<template #default="{ row }: { row: IZ2mWizardDevice }">
					<el-input
						:model-value="nameByIeee[row.ieeeAddress] ?? ''"
						@update:model-value="(value: string) => onUpdateName(row.ieeeAddress, value)"
					/>
				</template>
			</el-table-column>

			<el-table-column
				prop="friendlyName"
				:label="t('devicesZigbee2mqttPlugin.wizard.columns.friendlyName')"
				min-width="180"
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
				width="160"
				sortable
				:sort-method="sortByStatus"
			>
				<template #default="{ row }: { row: IZ2mWizardDevice }">
					<el-tag
						v-if="row.status === 'already_registered'"
						size="small"
						type="info"
					>
						{{ t('devicesZigbee2mqttPlugin.wizard.steps.categorize.willUpdate') }}
					</el-tag>
					<el-tag
						v-else
						size="small"
						type="success"
					>
						{{ t('devicesZigbee2mqttPlugin.wizard.steps.categorize.willCreate') }}
					</el-tag>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesZigbee2mqttPlugin.wizard.columns.category')"
				min-width="240"
				sortable
				:sort-method="sortByCategory"
			>
				<template #default="{ row }: { row: IZ2mWizardDevice }">
					<el-select
						:model-value="categoryByIeee[row.ieeeAddress] ?? null"
						filterable
						@update:model-value="(value: DevicesModuleDeviceCategory | null) => onUpdateCategory(row.ieeeAddress, value)"
					>
						<el-option
							v-for="opt in categoryOptions(row)"
							:key="opt.value"
							:label="opt.label"
							:value="opt.value"
						/>
					</el-select>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesZigbee2mqttPlugin.wizard.columns.channels')"
				width="120"
				sortable
				:sort-method="sortByChannels"
			>
				<template #default="{ row }: { row: IZ2mWizardDevice }">
					<el-tooltip
						v-if="row.previewChannelIdentifiers.length > 0"
						:content="row.previewChannelIdentifiers.join(', ')"
						placement="top"
					>
						<el-tag
							size="small"
							type="info"
							effect="plain"
						>
							{{ t('devicesZigbee2mqttPlugin.wizard.steps.categorize.channels', { count: row.previewChannelCount }) }}
						</el-tag>
					</el-tooltip>
					<el-tag
						v-else
						size="small"
						type="info"
						effect="plain"
					>
						{{ t('devicesZigbee2mqttPlugin.wizard.steps.categorize.channels', { count: row.previewChannelCount }) }}
					</el-tag>
				</template>
			</el-table-column>
		</el-table>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElInput, ElOption, ElSelect, ElTable, ElTableColumn, ElTag, ElTooltip } from 'element-plus';

import { orderBy } from 'natural-orderby';

import { type DevicesModuleDeviceCategory } from '../../../openapi.constants';
import type { IZ2mWizardDevice } from '../schemas/wizard.types';
import { compareLocale } from '../utils/wizard.sort';

defineOptions({
	name: 'Zigbee2mqttWizardCategorizeStep',
});

interface IProps {
	devices: IZ2mWizardDevice[];
	selected: Record<string, boolean>;
	nameByIeee: Record<string, string>;
	categoryByIeee: Record<string, DevicesModuleDeviceCategory | null>;
	categoryOptions: (device: IZ2mWizardDevice) => { value: DevicesModuleDeviceCategory; label: string }[];
}

const props = defineProps<IProps>();

const emit = defineEmits<{
	(e: 'update:nameByIeee', value: Record<string, string>): void;
	(e: 'update:categoryByIeee', value: Record<string, DevicesModuleDeviceCategory | null>): void;
}>();

const { t } = useI18n();

// Only show devices the user actively selected on the discovery step. Devices that became
// `unsupported` or `failed` after selection are also dropped — the wizard composable already
// strips them from the adoption payload, so showing them here would mislead the user.
const selectedDevices = computed<IZ2mWizardDevice[]>(() =>
	orderBy(
		props.devices.filter((device) => props.selected[device.ieeeAddress] === true),
		[(device) => device.ieeeAddress],
		['asc']
	)
);

const sortByName = (a: IZ2mWizardDevice, b: IZ2mWizardDevice): number => {
	const aName = props.nameByIeee[a.ieeeAddress] ?? a.friendlyName;
	const bName = props.nameByIeee[b.ieeeAddress] ?? b.friendlyName;
	return compareLocale(aName, bName);
};

const sortByFriendlyName = (a: IZ2mWizardDevice, b: IZ2mWizardDevice): number => compareLocale(a.friendlyName, b.friendlyName);

const sortByManufacturer = (a: IZ2mWizardDevice, b: IZ2mWizardDevice): number => {
	const aLabel = [a.manufacturer, a.model].filter(Boolean).join(' ');
	const bLabel = [b.manufacturer, b.model].filter(Boolean).join(' ');
	return compareLocale(aLabel, bLabel);
};

// Group "will create" devices ahead of "will update" ones, then by friendlyName inside each
// bucket so the user can scan the new pairings first.
const sortByStatus = (a: IZ2mWizardDevice, b: IZ2mWizardDevice): number => {
	const order = (device: IZ2mWizardDevice): number => (device.status === 'already_registered' ? 1 : 0);
	const diff = order(a) - order(b);
	return diff !== 0 ? diff : compareLocale(a.friendlyName, b.friendlyName);
};

const sortByCategory = (a: IZ2mWizardDevice, b: IZ2mWizardDevice): number => {
	const aCategory = props.categoryByIeee[a.ieeeAddress];
	const bCategory = props.categoryByIeee[b.ieeeAddress];
	const aLabel = aCategory ? t(`devicesModule.categories.devices.${aCategory}`) : '';
	const bLabel = bCategory ? t(`devicesModule.categories.devices.${bCategory}`) : '';
	return compareLocale(aLabel, bLabel);
};

const sortByChannels = (a: IZ2mWizardDevice, b: IZ2mWizardDevice): number => a.previewChannelCount - b.previewChannelCount;

const onUpdateName = (ieeeAddress: string, value: string): void => {
	const next: Record<string, string> = { ...props.nameByIeee, [ieeeAddress]: value };

	emit('update:nameByIeee', next);
};

const onUpdateCategory = (ieeeAddress: string, value: DevicesModuleDeviceCategory | null): void => {
	const next: Record<string, DevicesModuleDeviceCategory | null> = { ...props.categoryByIeee, [ieeeAddress]: value };

	emit('update:categoryByIeee', next);
};
</script>

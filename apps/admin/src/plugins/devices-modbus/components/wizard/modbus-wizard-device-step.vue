<template>
	<el-form
		label-position="top"
		@submit.prevent
	>
		<el-form-item :label="t('devicesModbusPlugin.wizard.device.name.title')">
			<el-input
				v-model="wizard.state.device.name"
				:placeholder="t('devicesModbusPlugin.wizard.device.name.placeholder')"
				name="deviceName"
			/>
		</el-form-item>

		<el-form-item :label="t('devicesModbusPlugin.wizard.device.category.title')">
			<el-select
				v-model="wizard.state.device.category"
				:placeholder="t('devicesModbusPlugin.wizard.device.category.placeholder')"
				name="deviceCategory"
				class="w-full"
			>
				<el-option
					v-for="item in categoryOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('devicesModbusPlugin.wizard.device.category.hint') }}
			</div>
		</el-form-item>

		<el-form-item :label="t('devicesModule.fields.devices.room.title')">
			<el-select
				v-model="wizard.state.device.roomId"
				:placeholder="t('devicesModule.fields.devices.room.placeholder')"
				name="deviceRoom"
				filterable
				clearable
				class="w-full"
			>
				<el-option
					v-for="item in roomOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('devicesModule.fields.devices.room.hint') }}
			</div>
		</el-form-item>

		<el-form-item :label="t('devicesModbusPlugin.wizard.device.pollInterval.title')">
			<el-input-number
				v-model="wizard.state.device.pollIntervalMs"
				:min="MODBUS_MIN_POLL_INTERVAL_MS"
				:step="100"
				:step-strictly="false"
				name="devicePollInterval"
			/>
			<div class="text-xs text-gray-500 mt-1 w-full">
				{{ t('devicesModbusPlugin.wizard.device.pollInterval.hint') }}
			</div>
			<el-alert
				v-if="hasButtonPoints"
				type="info"
				:title="t('devicesModbusPlugin.wizard.device.pollInterval.buttonHint')"
				:closable="false"
				show-icon
				class="mt-2"
			/>
		</el-form-item>

		<div class="grid gap-x-4 sm:grid-cols-2">
			<el-form-item :label="t('devicesModbusPlugin.wizard.device.byteOrder.title')">
				<el-select
					v-model="wizard.state.device.byteOrder"
					name="deviceByteOrder"
					class="w-full"
				>
					<el-option
						v-for="order in ORDERS"
						:key="order"
						:label="t(`devicesModbusPlugin.wizard.device.order.${order}`)"
						:value="order"
					/>
				</el-select>
			</el-form-item>

			<el-form-item :label="t('devicesModbusPlugin.wizard.device.wordOrder.title')">
				<el-select
					v-model="wizard.state.device.wordOrder"
					name="deviceWordOrder"
					class="w-full"
				>
					<el-option
						v-for="order in ORDERS"
						:key="order"
						:label="t(`devicesModbusPlugin.wizard.device.order.${order}`)"
						:value="order"
					/>
				</el-select>
			</el-form-item>
		</div>
	</el-form>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect } from 'element-plus';
import { orderBy } from 'natural-orderby';

import { injectStoresManager, useLogger } from '../../../../common';
import { SpaceType } from '../../../../modules/spaces/spaces.constants';
import { spacesStoreKey } from '../../../../modules/spaces/store/keys';
import type { ISpace } from '../../../../modules/spaces/store/spaces.store.types';
import { DevicesModbusPluginByteOrder } from '../../../../openapi.constants';
import { MODBUS_MIN_POLL_INTERVAL_MS } from '../../devices-modbus.constants';
import { suggestCategory } from '../../lib/points';

import type { IModbusWizardDeviceStepProps } from './modbus-wizard-device-step.types';

defineOptions({
	name: 'ModbusWizardDeviceStep',
});

const props = defineProps<IModbusWizardDeviceStepProps>();

const ORDERS = [DevicesModbusPluginByteOrder.big, DevicesModbusPluginByteOrder.little];
const BASE_CATEGORIES = ['switcher', 'input_controller'];

const { t } = useI18n();
const logger = useLogger();
const spacesStore = injectStoresManager().getStore(spacesStoreKey);

const wizard = props.wizard;

const categoryLabel = (category: string): string => {
	const key = `devicesModule.categories.devices.${category}`;
	const label = t(key);

	return label === key ? category : label;
};

const categoryOptions = computed<{ value: string; label: string }[]>(() => {
	const values = [...BASE_CATEGORIES];

	for (const extra of [wizard.state.templateDevice?.category, wizard.state.device.category]) {
		if (extra && !values.includes(extra)) {
			values.push(extra);
		}
	}

	return values.map((value) => ({ value, label: categoryLabel(value) }));
});

const roomOptions = computed<{ value: string; label: string }[]>(() =>
	orderBy<ISpace>(
		spacesStore.findAll().filter((space: ISpace): boolean => space.type === SpaceType.ROOM),
		[(space: ISpace): string => space.name],
		['asc']
	).map((space: ISpace): { value: string; label: string } => ({ value: space.id, label: space.name }))
);

// No point in this plan has a button capability; the hint stays keyed for the plan that adds them.
const hasButtonPoints = computed<boolean>(() => wizard.state.points.some((point) => point.channelCategory === 'button'));

onBeforeMount((): void => {
	if (wizard.state.device.category === null) {
		wizard.state.device.category = suggestCategory(wizard.state.points);
	}

	spacesStore.fetch().catch((error: unknown): void => logger.error('Failed to load rooms', error));
});
</script>

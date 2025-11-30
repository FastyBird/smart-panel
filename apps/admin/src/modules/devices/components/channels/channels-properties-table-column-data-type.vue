<template>
	<div class="flex flex-row items-center gap-1">
		<el-link
			v-if="props.withFilters"
			:type="props.filters.dataTypes.includes(property.dataType) ? 'danger' : undefined"
			underline="never"
			class="font-400!"
			@click.stop="emit('filter-by', property.dataType, !props.filters.dataTypes.includes(property.dataType))"
		>
			<el-icon class="el-icon--left">
				<icon
					v-if="props.filters.dataTypes.includes(property.dataType)"
					icon="mdi:filter-minus"
				/>
				<icon
					v-else
					icon="mdi:filter-plus"
				/>
			</el-icon>

			{{ t(`devicesModule.dataTypes.${props.property.dataType}`) }}
		</el-link>
		<el-text
			v-else
			class="font-400!"
		>
			{{ t(`devicesModule.dataTypes.${props.property.dataType}`) }}
		</el-text>

		<el-popover
			v-if="isEnum"
			:title="t('devicesModule.table.channelsProperties.columns.dataType.type.enum')"
			:width="200"
			placement="left"
			trigger="click"
		>
			<template #reference>
				<el-button link>
					<icon
						icon="mdi:information-outline"
						class="font-size-base"
					/>
				</el-button>
			</template>

			<template #default>
				<el-text class="block">
					<strong>{{ t('devicesModule.fields.channelsProperties.format.title.enum') }}:</strong>
					{{ enumValues.join(', ') || t('devicesModule.texts.misc.noValuesProvided') }}
				</el-text>
				<el-text
					v-if="invalidValue !== null"
					class="block"
				>
					<strong>{{ t('devicesModule.fields.channelsProperties.invalid.title') }}:</strong>
					{{ invalidValue }}
				</el-text>
			</template>
		</el-popover>

		<el-popover
			v-else-if="isNumeric"
			:title="t('devicesModule.table.channelsProperties.columns.dataType.type.numeric')"
			:width="200"
			trigger="click"
			placement="left"
		>
			<template #reference>
				<el-button link>
					<icon
						icon="mdi:information-outline"
						class="font-size-base"
					/>
				</el-button>
			</template>

			<template #default>
				<el-text class="block">
					<strong>{{ t('devicesModule.fields.channelsProperties.format.title.min') }}:</strong>
					{{ minValue ?? t('devicesModule.texts.misc.notSet') }}
				</el-text>
				<el-text class="block">
					<strong>{{ t('devicesModule.fields.channelsProperties.format.title.max') }}:</strong>
					{{ maxValue ?? t('devicesModule.texts.misc.notSet') }}
				</el-text>
				<el-text class="block">
					<strong>{{ t('devicesModule.fields.channelsProperties.step.title') }}:</strong>
					{{ stepValue ?? t('devicesModule.texts.misc.notSet') }}
				</el-text>
				<el-text
					v-if="invalidValue !== null"
					class="block"
				>
					<strong>{{ t('devicesModule.fields.channelsProperties.invalid.title') }}:</strong>
					{{ invalidValue }}
				</el-text>
			</template>
		</el-popover>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElIcon, ElLink, ElPopover, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { DevicesModuleChannelPropertyData_type } from '../../../../openapi.constants';

import type { IChannelsPropertiesTableColumnDataTypeProps } from './channels-properties-table-column-data-type.types';

defineOptions({
	name: 'ChannelsPropertiesTableColumnDataType',
});

const props = withDefaults(defineProps<IChannelsPropertiesTableColumnDataTypeProps>(), {
	withFilters: true,
});

const emit = defineEmits<{
	(e: 'filter-by', value: DevicesModuleChannelPropertyData_type, add: boolean): void;
}>();

const { t } = useI18n();

const isEnum = computed<boolean>((): boolean => {
	return props.property.dataType === DevicesModuleChannelPropertyData_type.enum;
});

const isNumeric = computed<boolean>((): boolean => {
	return (
		props.property.dataType === DevicesModuleChannelPropertyData_type.char ||
		props.property.dataType === DevicesModuleChannelPropertyData_type.uchar ||
		props.property.dataType === DevicesModuleChannelPropertyData_type.short ||
		props.property.dataType === DevicesModuleChannelPropertyData_type.ushort ||
		props.property.dataType === DevicesModuleChannelPropertyData_type.int ||
		props.property.dataType === DevicesModuleChannelPropertyData_type.uint ||
		props.property.dataType === DevicesModuleChannelPropertyData_type.float
	);
});

const enumValues = computed<string[]>((): string[] => {
	if (isEnum.value && Array.isArray(props.property.format)) {
		return props.property.format.filter((value: string | number | null) => value !== null).map((value: string | number) => value.toString());
	}

	return [];
});

const minValue = computed<number | null>((): number | null => {
	if (isNumeric.value && Array.isArray(props.property.format) && props.property.format.length === 2) {
		return Number(props.property.format[0]);
	}

	return null;
});

const maxValue = computed<number | null>((): number | null => {
	if (isNumeric.value && Array.isArray(props.property.format) && props.property.format.length === 2) {
		return Number(props.property.format[1]);
	}

	return null;
});

const stepValue = computed<number | null>((): number | null => {
	if (isNumeric.value && props.property.step) {
		return props.property.step;
	}

	return null;
});

const invalidValue = computed<string | number | boolean | null>((): string | number | boolean | null => {
	if (props.property.invalid) {
		return props.property.invalid;
	}

	return null;
});
</script>

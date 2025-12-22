<template>
	<el-scrollbar class="grow-1 p-2 md:px-4">
		<el-space
			v-if="controllableChannels.length > 0"
			direction="vertical"
			size="large"
			class="w-full"
			fill
		>
			<el-card
				v-for="channel in controllableChannels"
				:key="channel.id"
				body-class="p-0!"
				style="--el-card-padding: 0.5rem"
			>
				<template #header>
					<div class="flex flex-row items-center">
						<div>
							<el-avatar :size="32">
								<icon
									:icon="getChannelIcon(channel)"
									class="w[20px] h[20px]"
								/>
							</el-avatar>
						</div>
						<div class="ml-3">
							<strong>{{ channel.name }}</strong>
							<el-text class="block">
								{{ t(`devicesModule.categories.channels.${channel.category}`) }}
							</el-text>
						</div>
					</div>
				</template>

				<div class="p-4">
					<el-form
						label-position="top"
						size="default"
					>
						<template
							v-for="property in getWritableProperties(channel.id)"
							:key="property.id"
						>
							<el-form-item
								:label="property.name ?? t(`devicesModule.categories.channelsProperties.${property.category}`)"
								class="mb-4"
							>
								<!-- Boolean: Switch -->
								<template v-if="property.dataType === DevicesModuleChannelPropertyDataType.bool">
									<el-switch
										:model-value="isTruthyValue(getPropertyValue(property.id))"
										:loading="isPropertyLoading(property.id)"
										@change="(val: string | number | boolean) => onPropertyChange(channel.id, property.id, Boolean(val))"
									/>
								</template>

								<!-- Enum: Select -->
								<template v-else-if="property.dataType === DevicesModuleChannelPropertyDataType.enum">
									<el-select
										:model-value="String(getPropertyValue(property.id) ?? '')"
										:loading="isPropertyLoading(property.id)"
										class="w-full"
										@change="(val: string) => onPropertyChange(channel.id, property.id, val)"
									>
										<el-option
											v-for="option in getEnumOptions(property)"
											:key="option"
											:label="option"
											:value="option"
										/>
									</el-select>
								</template>

								<!-- Number with min/max: Slider -->
								<template v-else-if="isNumericType(property.dataType) && hasMinMax(property)">
									<div class="w-full flex items-center gap-4">
										<el-slider
											:model-value="Number(getPropertyValue(property.id) ?? getMinValue(property))"
											:min="getMinValue(property)"
											:max="getMaxValue(property)"
											:step="property.step ?? 1"
											:disabled="isPropertyLoading(property.id)"
											class="flex-grow touch-action-none"
											@input="(val: number | number[]) => onPropertyChange(channel.id, property.id, Array.isArray(val) ? val[0] : val)"
										/>
										<el-text class="min-w-[60px] text-right">
											{{ getPropertyValue(property.id) ?? '-' }}{{ property.unit ? ` ${property.unit}` : '' }}
										</el-text>
									</div>
								</template>

								<!-- Number without min/max: Input Number -->
								<template v-else-if="isNumericType(property.dataType)">
									<el-input-number
										:model-value="Number(getPropertyValue(property.id) ?? 0)"
										:step="property.step ?? 1"
										:disabled="isPropertyLoading(property.id)"
										controls-position="right"
										@change="(val: number | undefined) => onPropertyChange(channel.id, property.id, val ?? 0)"
									/>
									<el-text
										v-if="property.unit"
										class="ml-2"
									>
										{{ property.unit }}
									</el-text>
								</template>

								<!-- String: Text Input -->
								<template v-else>
									<el-input
										:model-value="String(getPropertyValue(property.id) ?? '')"
										:disabled="isPropertyLoading(property.id)"
										@change="(val: string) => onPropertyChange(channel.id, property.id, val)"
									/>
								</template>
							</el-form-item>
						</template>
					</el-form>
				</div>
			</el-card>
		</el-space>

		<el-result
			v-else
			class="h-full"
		>
			<template #icon>
				<icon-with-child :size="80">
					<template #primary>
						<icon icon="mdi:tune-variant" />
					</template>
					<template #secondary>
						<icon icon="mdi:information" />
					</template>
				</icon-with-child>
			</template>

			<template #title>
				<el-text class="block">
					{{ t('devicesModule.texts.devices.noControllableProperties') }}
				</el-text>
			</template>
		</el-result>
	</el-scrollbar>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElAvatar, ElCard, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElResult, ElScrollbar, ElSelect, ElSlider, ElSpace, ElSwitch, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { IconWithChild } from '../../../../common';
import { DevicesModuleChannelPropertyDataType } from '../../../../openapi.constants';
import type { IChannelProperty } from '../../store/channels.properties.store.types';
import type { IChannel } from '../../store/channels.store.types';

import type { IDeviceControlFormProps } from './device-control-form.types';

defineOptions({
	name: 'DeviceControlForm',
});

const props = defineProps<IDeviceControlFormProps>();

const { t } = useI18n();

const {
	controllableChannels,
	getPropertiesForChannel,
	isPropertyWritable,
	getPropertyValue: getPropertyValueFromComposable,
	isPropertyLoading,
	setPropertyValue,
} = props.deviceControl;

const getWritableProperties = (channelId: IChannel['id']): IChannelProperty[] => {
	return getPropertiesForChannel(channelId).filter((property) => isPropertyWritable(property));
};

const getPropertyValue = (propertyId: IChannelProperty['id']): string | number | boolean | null => {
	return getPropertyValueFromComposable(propertyId);
};

const getChannelIcon = (channel: IChannel): string => {
	// Map channel categories to icons
	const iconMap: Record<string, string> = {
		light: 'mdi:lightbulb',
		switcher: 'mdi:toggle-switch',
		temperature: 'mdi:thermometer',
		humidity: 'mdi:water-percent',
		thermostat: 'mdi:thermostat',
		fan: 'mdi:fan',
		heater: 'mdi:radiator',
		cooler: 'mdi:snowflake',
		lock: 'mdi:lock',
		door: 'mdi:door',
		valve: 'mdi:pipe-valve',
		speaker: 'mdi:volume-high',
		media_playback: 'mdi:play-circle',
		outlet: 'mdi:power-socket',
		window_covering: 'mdi:blinds',
	};

	return iconMap[channel.category] ?? 'mdi:chip';
};

const isTruthyValue = (value: string | number | boolean | null): boolean => {
	// Handle various truthy representations from IoT devices
	if (value === null) {
		return false;
	}

	if (typeof value === 'boolean') {
		return value;
	}

	if (typeof value === 'number') {
		return value !== 0;
	}

	// String comparisons (case-insensitive)
	const strValue = value.toLowerCase();

	return strValue === 'true' || strValue === '1' || strValue === 'on' || strValue === 'yes';
};

const isNumericType = (dataType: DevicesModuleChannelPropertyDataType): boolean => {
	return [
		DevicesModuleChannelPropertyDataType.char,
		DevicesModuleChannelPropertyDataType.uchar,
		DevicesModuleChannelPropertyDataType.short,
		DevicesModuleChannelPropertyDataType.ushort,
		DevicesModuleChannelPropertyDataType.int,
		DevicesModuleChannelPropertyDataType.uint,
		DevicesModuleChannelPropertyDataType.float,
	].includes(dataType);
};

const hasMinMax = (property: IChannelProperty): boolean => {
	if (!property.format || !Array.isArray(property.format)) {
		return false;
	}

	// Format for numeric types: [min, max] or [min, max, null, null]
	return property.format.length >= 2 && typeof property.format[0] === 'number' && typeof property.format[1] === 'number';
};

const getMinValue = (property: IChannelProperty): number => {
	if (property.format && Array.isArray(property.format) && typeof property.format[0] === 'number') {
		return property.format[0];
	}

	return 0;
};

const getMaxValue = (property: IChannelProperty): number => {
	if (property.format && Array.isArray(property.format) && typeof property.format[1] === 'number') {
		return property.format[1];
	}

	return 100;
};

const getEnumOptions = (property: IChannelProperty): string[] => {
	if (!property.format || !Array.isArray(property.format)) {
		return [];
	}

	return property.format.filter((item): item is string => typeof item === 'string');
};

const onPropertyChange = (channelId: IChannel['id'], propertyId: IChannelProperty['id'], value: string | number | boolean): void => {
	setPropertyValue(channelId, propertyId, value);
};
</script>

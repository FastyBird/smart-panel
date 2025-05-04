<template>
	<el-select
		v-model="selectedEntity"
		:placeholder="t('devicesHomeAssistantPlugin.fields.channels.haEntityId.placeholder')"
		:loading="areLoading"
		:disabled="props.disabled"
		name="haEntityId"
		filterable
	>
		<el-option
			v-for="item in entitiesOptions"
			:key="item.value"
			:label="item.label"
			:value="item.value"
		/>
	</el-select>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElOption, ElSelect } from 'element-plus';

import { useEntitiesOptions } from '../composables/useEntitiesOptions';
import type { IHomeAssistantState } from '../store/home-assistant-states.store.types';

import type { ISelectDiscoveredDeviceEntityProps } from './select-discovered-device-entity.types';

defineOptions({
	name: 'SelectDiscoveredDeviceEntity',
});

const props = withDefaults(defineProps<ISelectDiscoveredDeviceEntityProps>(), {
	disabled: false,
});

const emit = defineEmits<{
	(e: 'update:modelValue', type: IHomeAssistantState['entityId'] | undefined): void;
}>();

const { t } = useI18n();

const selectedEntity = ref<IHomeAssistantState['entityId'] | undefined>(props.modelValue);

const { entitiesOptions, areLoading } = useEntitiesOptions({ deviceId: props.deviceId });

watch(
	(): IHomeAssistantState['entityId'] | undefined => selectedEntity.value,
	(val: IHomeAssistantState['entityId'] | undefined) => {
		emit('update:modelValue', val);
	}
);
</script>

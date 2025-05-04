<template>
	<el-select
		v-model="selectedAttribute as string"
		:placeholder="t('devicesHomeAssistantPlugin.fields.channelsProperties.haAttribute.placeholder')"
		:loading="isLoading"
		:disabled="props.disabled"
		name="haAttribute"
		filterable
	>
		<el-option
			v-for="item in attributesOptions"
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

import { useAttributesOptions } from '../composables/useAttributesOptions';
import type { IHomeAssistantState } from '../store/home-assistant-states.store.types';

import type { ISelectEntityAttributeProps } from './select-entity-attribute.types';

defineOptions({
	name: 'SelectEntityAttribute',
});

const props = withDefaults(defineProps<ISelectEntityAttributeProps>(), {
	disabled: false,
});

const emit = defineEmits<{
	(e: 'update:modelValue', type: string | null | undefined): void;
}>();

const { t } = useI18n();

const selectedAttribute = ref<IHomeAssistantState['entityId'] | null | undefined>(props.modelValue);

const { attributesOptions, isLoading } = useAttributesOptions({ entityId: props.entityId });

watch(
	(): string | null | undefined => selectedAttribute.value,
	(val: string | null | undefined) => {
		emit('update:modelValue', val);
	}
);
</script>

<template>
	<el-form-item
		v-if="options.length > 1"
		:label="t('systemModule.fields.displaysProfiles.display.title')"
		:prop="['display']"
		:rules="rules"
	>
		<el-select
			v-model="selectedDisplay"
			:loading="areLoading"
			:placeholder="props.placeholder ?? t('systemModule.fields.displaysProfiles.display.placeholder')"
			name="display"
			filterable
		>
			<el-option
				v-for="item in options"
				:key="item.key"
				:label="item.label"
				:value="item.value"
			/>
		</el-select>
	</el-form-item>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElFormItem, ElOption, ElSelect, type FormItemRule } from 'element-plus';

import { useDisplaysProfiles } from '../../composables/useDisplaysProfiles';
import type { IDisplayProfile } from '../../store/displays-profiles.store.types';
import { SystemException } from '../../system.exceptions';

import type { IDisplayProfileSelectProps } from './display-profile-select';

defineOptions({
	name: 'DisplayProfileSelect',
});

const props = withDefaults(defineProps<IDisplayProfileSelectProps>(), {
	placeholder: undefined,
	required: true,
});

const emit = defineEmits<{
	(e: 'update:modelValue', selected: string | null): void;
}>();

const { t } = useI18n();

const { displays, fetchDisplays, areLoading } = useDisplaysProfiles();

const selectedDisplay = ref<string | undefined>(props.modelValue ?? 'all');

const options = computed<{ value: string; label: string; key: string }[]>((): { value: string; label: string; key: string }[] => {
	const optionsItems: { value: string; label: string; key: string }[] = [];

	if (!props.required) {
		optionsItems.push({
			value: 'all',
			label: t('systemModule.fields.displaysProfiles.display.notSet'),
			key: 'n/a',
		});
	}

	if (displays.value.length === 0) {
		return optionsItems;
	}

	return [
		...optionsItems,
		...displays.value.map((display) => ({
			value: display.id,
			label: `${display.screenWidth}x${display.screenHeight}${display.primary ? ' (Primary)' : ''} [${display.uid.slice(0, 8)}]`,
			key: display.id,
		})),
	];
});

const rules = reactive<FormItemRule>({
	required: props.required,
	message: t('systemModule.fields.displaysProfiles.display.validation.required'),
	trigger: 'change',
});

onBeforeMount(() => {
	if (!areLoading.value) {
		fetchDisplays().catch((error: unknown): void => {
			const err = error as Error;

			throw new SystemException('Something went wrong', err);
		});
	}
});

watch(
	(): string | undefined => selectedDisplay.value,
	(val: string | undefined) => {
		emit('update:modelValue', typeof val === 'undefined' || val === 'all' ? null : val);
	}
);

watch(
	(): IDisplayProfile[] => displays.value,
	(val: IDisplayProfile[]) => {
		if (val.length === 1 && !props.required) {
			//selectedDisplay.value = val[0].id;
		}
	}
);
</script>

<template>
	<el-dialog
		:model-value="dialogVisible"
		:title="props.title ?? t('application.typePicker.title')"
		width="min(640px, calc(100vw - 32px))"
		append-to-body
		data-test-id="type-picker"
		@update:model-value="onVisibleChange"
	>
		<!-- Choosing a type is an action that closes the dialog, so the options are buttons (one Tab stop each, Enter
		     or Space to choose) and the current choice is marked as pressed -->
		<div
			role="group"
			:aria-label="props.title ?? t('application.typePicker.title')"
			class="grid gap-3 grid-cols-1 tp:grid-cols-2"
		>
			<button
				v-for="option in props.options"
				:key="option.id"
				:disabled="option.disabled"
				:aria-pressed="option.id === props.modelValue ? 'true' : 'false'"
				:class="[
					'flex items-start gap-3 p-3 text-left rounded-[8px] border border-solid bg-[var(--el-bg-color)] font-inherit',
					option.id === props.modelValue ? 'border-primary-soft bg-primary-soft' : 'border-light',
					option.disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-default',
				]"
				:data-option-id="option.id"
				type="button"
				data-test-id="type-picker-option"
				@click="onSelect(option)"
			>
				<span
					class="flex items-center justify-center shrink-0 w-10 h-10 rounded-[8px] bg-fill-light text-regular"
					aria-hidden="true"
				>
					<icon
						:icon="option.icon"
						width="24"
						height="24"
					/>
				</span>
				<span class="flex flex-col gap-0.5 min-w-0">
					<span class="flex items-center gap-2">
						<span class="text-card-title">{{ option.name }}</span>
						<span
							v-if="option.badge"
							class="px-1.5 rounded-[4px] bg-fill text-[12px] leading-[16px] text-secondary"
							data-test-id="type-picker-badge"
						>
							{{ option.badge }}
						</span>
					</span>
					<span
						v-if="option.description"
						class="text-help"
					>
						{{ option.description }}
					</span>
				</span>
			</button>
		</div>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElDialog } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { TypePickerOption, TypePickerProps } from './type-picker.types';

defineOptions({
	name: 'TypePicker',
});

const props = withDefaults(defineProps<TypePickerProps>(), {
	modelValue: undefined,
	visible: false,
	title: undefined,
});

const emit = defineEmits<{
	(e: 'update:modelValue', id: string): void;
	(e: 'update:visible', visible: boolean): void;
}>();

const { t } = useI18n();

// With a single enabled option there is nothing to choose: it is selected and the dialog never opens
const singleOption = computed<TypePickerOption | null>((): TypePickerOption | null => {
	const enabled = props.options.filter((option) => option.disabled !== true);

	return enabled.length === 1 ? enabled[0] : null;
});

const dialogVisible = computed<boolean>((): boolean => props.visible && singleOption.value === null);

watch(
	[(): TypePickerOption | null => singleOption.value, (): boolean => props.visible],
	([option, visible]): void => {
		if (option === null) {
			return;
		}

		if (props.modelValue !== option.id) {
			emit('update:modelValue', option.id);
		}

		if (visible) {
			emit('update:visible', false);
		}
	},
	{ immediate: true }
);

const onVisibleChange = (visible: boolean): void => {
	emit('update:visible', visible);
};

const onSelect = (option: TypePickerOption): void => {
	if (option.disabled) {
		return;
	}

	emit('update:modelValue', option.id);
	emit('update:visible', false);
};
</script>

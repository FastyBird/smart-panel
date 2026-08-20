<template>
	<div class="w-full">
		<el-input
			v-if="!markedForRemoval"
			:model-value="modelValue ?? ''"
			:placeholder="placeholder"
			:name="name"
			:type="type"
			:rows="type === 'textarea' ? rows : undefined"
			:show-password="type === 'password'"
			:disabled="disabled"
			@update:model-value="handleInput"
		/>

		<div
			v-if="configured || markedForRemoval"
			class="flex items-center justify-between gap-2 mt-1"
		>
			<span
				v-if="markedForRemoval"
				class="text-xs text-danger"
			>
				{{ t('configModule.texts.secret.willBeRemoved') }}
			</span>
			<span
				v-else
				class="text-xs text-gray-500"
			>
				{{ t('configModule.texts.secret.stored') }}
			</span>

			<el-button
				v-if="markedForRemoval"
				link
				type="primary"
				size="small"
				:name="name ? `${name}-keep` : undefined"
				@click="handleKeep"
			>
				{{ t('configModule.buttons.keepSecret.title') }}
			</el-button>
			<el-button
				v-else
				link
				type="danger"
				size="small"
				:disabled="disabled"
				:name="name ? `${name}-remove` : undefined"
				@click="handleRemove"
			>
				{{ t('configModule.buttons.removeSecret.title') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElInput } from 'element-plus';

import type { IConfigSecretInputProps } from './config-secret-input.types';

defineOptions({
	name: 'ConfigSecretInput',
});

const props = withDefaults(defineProps<IConfigSecretInputProps>(), {
	modelValue: undefined,
	configured: false,
	type: 'password',
	rows: 3,
	placeholder: undefined,
	name: undefined,
	disabled: false,
});

const emit = defineEmits<{
	(e: 'update:modelValue', value: string | null | undefined): void;
}>();

const { t } = useI18n();

// The backend answers a redacted secret with nothing at all, so the field always starts blank
// and blank has to keep meaning "leave what is stored alone". Removing therefore needs a gesture
// of its own, and `null` is the value the update carries for it.
const markedForRemoval = computed<boolean>((): boolean => props.modelValue === null);

const handleInput = (value: string): void => {
	// Typed and then cleared again is untouched, not removed: it submits nothing.
	emit('update:modelValue', value === '' ? undefined : value);
};

const handleRemove = (): void => {
	emit('update:modelValue', null);
};

const handleKeep = (): void => {
	emit('update:modelValue', undefined);
};
</script>

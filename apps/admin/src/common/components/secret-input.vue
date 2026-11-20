<template>
	<div
		class="w-full"
		data-test-id="secret-input"
	>
		<div
			v-if="showSaved"
			class="flex items-center gap-2 min-h-8 pl-3 pr-1 rounded-[6px] border border-solid border-default bg-fill-light"
			data-test-id="secret-input-saved"
		>
			<icon
				icon="mdi:lock-outline"
				class="text-secondary shrink-0"
				aria-hidden="true"
			/>
			<span class="flex-1 min-w-0 truncate text-body">
				{{ t('application.secretInput.saved') }}
				<span
					v-if="props.savedHint"
					class="text-secondary"
				>
					· {{ props.savedHint }}
				</span>
			</span>
			<el-button
				:disabled="props.disabled"
				link
				type="primary"
				data-test-id="secret-input-replace"
				@click="onReplace"
			>
				{{ t('application.secretInput.replace') }}
			</el-button>
		</div>

		<div
			v-else
			class="flex items-center gap-2"
		>
			<el-input
				ref="inputRef"
				:model-value="props.modelValue ?? ''"
				:placeholder="props.placeholder ?? t('application.secretInput.placeholder')"
				:name="props.name"
				:disabled="props.disabled"
				type="password"
				show-password
				autocomplete="new-password"
				data-test-id="secret-input-field"
				@update:model-value="onInput"
			/>
			<el-button
				v-if="replacing"
				:disabled="props.disabled"
				data-test-id="secret-input-cancel"
				@click="onCancel"
			>
				{{ t('application.secretInput.cancel') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElInput } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { SecretInputProps } from './secret-input.types';

defineOptions({
	name: 'SecretInput',
});

const props = withDefaults(defineProps<SecretInputProps>(), {
	modelValue: undefined,
	savedHint: undefined,
	placeholder: undefined,
	name: undefined,
	disabled: false,
});

const emit = defineEmits<{
	(e: 'update:modelValue', value: string | undefined): void;
}>();

const { t } = useI18n();

const inputRef = ref<InstanceType<typeof ElInput> | null>(null);

const replacing = ref<boolean>(false);

// A stored secret is never sent to the admin, so it is never shown: only its hint, until the user replaces it
const isStored = computed<boolean>((): boolean => props.savedHint !== undefined && props.savedHint !== null);

const showSaved = computed<boolean>((): boolean => isStored.value && !replacing.value);

watch(
	(): string | null | undefined => props.savedHint,
	(hint: string | null | undefined): void => {
		// After a save the new secret is stored with a new hint: show the hint again
		if (hint !== undefined && hint !== null) {
			replacing.value = false;
		}
	}
);

const onReplace = async (): Promise<void> => {
	replacing.value = true;

	emit('update:modelValue', '');

	await nextTick();

	inputRef.value?.focus();
};

const onCancel = (): void => {
	replacing.value = false;

	// No new value: the stored secret stays as it is
	emit('update:modelValue', undefined);
};

const onInput = (value: string): void => {
	emit('update:modelValue', value);
};
</script>

<template>
	<div
		class="flex flex-col gap-1 min-w-0"
		data-test-id="copy-field"
	>
		<span
			v-if="props.label"
			class="text-label"
		>
			{{ props.label }}
		</span>

		<div class="flex items-center gap-2 min-h-8 pl-3 pr-1 rounded-[6px] border border-solid border-default bg-fill-light">
			<span
				:class="['flex-1 min-w-0 truncate', props.mono ? 'text-mono text-default' : 'text-body']"
				:title="props.value"
				data-test-id="copy-field-value"
			>
				{{ props.value }}
			</span>

			<el-tooltip
				:content="t('application.copyField.copy')"
				placement="top"
			>
				<el-button
					:aria-label="buttonLabel"
					text
					circle
					size="small"
					data-test-id="copy-field-button"
					@click="onCopy"
				>
					<template #icon>
						<icon icon="mdi:content-copy" />
					</template>
				</el-button>
			</el-tooltip>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useClipboard } from '../composables/useClipboard';
import { useFlashMessage } from '../composables/useFlashMessage';

import type { CopyFieldProps } from './copy-field.types';

defineOptions({
	name: 'CopyField',
});

const props = withDefaults(defineProps<CopyFieldProps>(), {
	mono: true,
	label: undefined,
});

const emit = defineEmits<{
	(e: 'copied', value: string): void;
}>();

const { t } = useI18n();

const { copy } = useClipboard();

const flashMessage = useFlashMessage();

const buttonLabel = computed<string>((): string =>
	props.label ? t('application.copyField.copyNamed', { name: props.label }) : t('application.copyField.copy')
);

const onCopy = async (): Promise<void> => {
	// The value may change while the copy is pending; report the one that reached the clipboard
	const value = props.value;

	if (await copy(value)) {
		flashMessage.success(t('application.copyField.copied'));

		emit('copied', value);
	} else {
		flashMessage.error(t('application.copyField.copyFailed'));
	}
};
</script>

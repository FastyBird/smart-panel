<template>
	<div
		:style="keyboardOffset > 0 ? { transform: `translateY(-${keyboardOffset}px)` } : undefined"
		class="sticky bottom-0 z-10 flex items-center justify-end gap-2 h-14 px-4 shrink-0 border-t border-t-solid border-light shadow-top bg-[var(--el-bg-color)]"
		data-test-id="form-footer"
	>
		<slot name="start" />

		<el-button
			v-if="props.dirty"
			:disabled="props.saving"
			data-test-id="form-footer-discard"
			@click="emit('discard')"
		>
			{{ t('application.formFooter.discard') }}
		</el-button>
		<el-button
			v-else
			:disabled="props.saving"
			data-test-id="form-footer-close"
			@click="emit('close')"
		>
			{{ t('application.formFooter.close') }}
		</el-button>

		<!-- A multi-step plugin form may put its own primary button (Next) here in place of Save -->
		<slot
			name="primary"
			:save="() => emit('save')"
		>
			<el-button
				:loading="props.saving"
				:disabled="!props.canSave"
				type="primary"
				data-test-id="form-footer-save"
				@click="emit('save')"
			>
				{{ props.saveLabel ?? t('application.formFooter.save') }}
			</el-button>
		</slot>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

import { useKeyboardOffset } from '../composables/useKeyboardOffset';

import type { FormFooterProps } from './form-footer.types';

defineOptions({
	name: 'FormFooter',
});

const props = withDefaults(defineProps<FormFooterProps>(), {
	dirty: false,
	saving: false,
	canSave: true,
	saveLabel: undefined,
});

const emit = defineEmits<{
	(e: 'save'): void;
	(e: 'discard'): void;
	(e: 'close'): void;
}>();

const { t } = useI18n();

// Rides above the on-screen keyboard (spec section 6). A transform, not a sticky `bottom` offset, so it also works
// where the footer's containing block is only as tall as the footer (an `ElDrawer` `#footer` slot)
const { offset: keyboardOffset } = useKeyboardOffset();
</script>

<template>
	<span
		:class="[
			'inline-flex items-center gap-1.5 h-6 px-2 rounded-[4px] border border-solid text-[12px] leading-[16px] font-500 whitespace-nowrap',
			TONES[props.status],
		]"
		:data-status="props.status"
		data-test-id="status-tag"
	>
		<span
			:class="['w-1.5 h-1.5 rounded-full shrink-0', DOTS[props.status]]"
			aria-hidden="true"
		/>
		<slot>{{ props.label }}</slot>
	</span>
</template>

<script setup lang="ts">
import type { StatusTagProps, StatusTagStatus } from './status-tag.types';

defineOptions({
	name: 'StatusTag',
});

const props = defineProps<StatusTagProps>();

// Soft tags use the readable text shade on a soft fill; critical is the only filled tag (spec section 2)
const TONES: Record<StatusTagStatus, string> = {
	ok: 'text-[var(--fb-status-ok-text)] bg-[var(--fb-status-ok-soft)] border-[var(--fb-status-ok-border)]',
	warn: 'text-[var(--fb-status-warn-text)] bg-[var(--fb-status-warn-soft)] border-[var(--fb-status-warn-border)]',
	danger: 'text-[var(--fb-status-danger-text)] bg-[var(--fb-status-danger-soft)] border-[var(--fb-status-danger-border)]',
	info: 'text-[var(--fb-status-info-text)] bg-[var(--fb-status-info-soft)] border-[var(--fb-status-info-border)]',
	primary: 'text-[var(--fb-status-primary-text)] bg-[var(--fb-status-primary-soft)] border-[var(--fb-status-primary-border)]',
	critical: 'text-white bg-[var(--el-color-danger)] border-[var(--el-color-danger)]',
};

const DOTS: Record<StatusTagStatus, string> = {
	ok: 'bg-[var(--el-color-success)]',
	warn: 'bg-[var(--el-color-warning)]',
	danger: 'bg-[var(--el-color-danger)]',
	info: 'bg-[var(--el-color-info)]',
	primary: 'bg-[var(--el-color-primary)]',
	critical: 'bg-white',
};
</script>

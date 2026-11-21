<template>
	<div
		class="flex flex-wrap items-center gap-2.5"
		data-test-id="test-connection"
	>
		<el-button
			:loading="running"
			:disabled="props.disabled || running"
			data-test-id="test-connection-button"
			@click="onRun"
		>
			<template
				v-if="!running"
				#icon
			>
				<icon
					icon="mdi:link-variant"
					aria-hidden="true"
				/>
			</template>
			{{ props.label ?? t('application.testConnection.button') }}
		</el-button>

		<!-- The result stays next to the button in the status colour, never as a toast (spec section 7) -->
		<span
			role="status"
			aria-live="polite"
			class="text-[13px] leading-[20px]"
			data-test-id="test-connection-result"
		>
			<span
				v-if="running"
				class="text-secondary"
			>
				{{ t('application.testConnection.running') }}
			</span>
			<span
				v-else-if="result"
				:class="['inline-flex items-start gap-1.5', result.ok ? 'text-success' : 'text-danger']"
				:data-ok="result.ok ? 'true' : 'false'"
			>
				<icon
					:icon="result.ok ? 'mdi:check-circle' : 'mdi:alert-circle'"
					width="16"
					height="16"
					class="shrink-0 mt-0.5"
					aria-hidden="true"
				/>
				{{ result.message }}
			</span>
		</span>
	</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { TestConnectionProps, TestConnectionResult } from './test-connection.types';

defineOptions({
	name: 'TestConnection',
});

const props = withDefaults(defineProps<TestConnectionProps>(), {
	label: undefined,
	disabled: false,
});

const emit = defineEmits<{
	(e: 'result', result: TestConnectionResult): void;
}>();

const { t } = useI18n();

const running = ref<boolean>(false);

const result = ref<TestConnectionResult | null>(null);

let unmounted = false;

onBeforeUnmount((): void => {
	unmounted = true;
});

const onRun = async (): Promise<void> => {
	if (running.value || props.disabled) {
		return;
	}

	running.value = true;
	result.value = null;

	let outcome: TestConnectionResult;

	try {
		outcome = await props.run();
	} catch (error: unknown) {
		const message = error instanceof Error && error.message !== '' ? error.message : t('application.testConnection.failed');

		outcome = { ok: false, message };
	}

	// A form left while its test was running has nobody to show the result to
	if (unmounted) {
		return;
	}

	running.value = false;
	result.value = outcome;

	emit('result', outcome);
};
</script>

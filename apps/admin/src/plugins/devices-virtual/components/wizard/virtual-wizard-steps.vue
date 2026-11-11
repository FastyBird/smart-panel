<template>
	<el-steps
		v-if="enabled"
		:active="modelValue"
		finish-status="success"
		align-center
		class="mb-4"
		data-test-id="virtual-wizard-steps"
	>
		<el-step
			v-for="label in steps"
			:key="label"
			:title="label"
		/>
	</el-steps>

	<slot />

	<!--
		Inside the wizard shell the navigation lives in the page header (or the bottom bar on small
		screens), exactly where the projection wizard has it, so it is teleported there. Without a shell
		— an editor mounted on its own — it stays inline below the form.
	-->
	<teleport
		v-if="enabled"
		:key="actionsTarget ?? 'inline'"
		defer
		:to="actionsTarget ?? 'body'"
		:disabled="actionsTarget === null"
	>
		<div
			class="flex justify-end items-center gap-2"
			:class="{ 'mt-4': actionsTarget === null }"
		>
			<el-button
				v-if="modelValue > 0"
				:disabled="disabled"
				data-test-id="wizard-back"
				@click="emit('update:modelValue', modelValue - 1)"
			>
				{{ t('devicesModule.wizard.actions.back') }}
			</el-button>
			<el-button
				v-if="!isLast"
				type="primary"
				:disabled="disabled || !canAdvance"
				data-test-id="wizard-next"
				@click="emit('update:modelValue', modelValue + 1)"
			>
				{{ t('devicesModule.wizard.actions.next') }}
			</el-button>
			<slot
				v-if="isLast"
				name="final"
			/>
		</div>
	</teleport>
	<slot
		v-else
		name="final"
	/>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElStep, ElSteps } from 'element-plus';

import { virtualWizardActionsKey } from './virtual-wizard.types';

defineOptions({
	name: 'VirtualWizardSteps',
});

// The step frame shared by every virtual device kind that is authored by one editor: the same step
// bar, Back/Next and final-action row as the projection wizard. The editors keep a single component
// and a single piece of state — they are also what edits an existing device on one page — and only
// show the section that belongs to the active step. With `enabled` off the frame disappears and the
// editor renders as that one page.
const props = withDefaults(
	defineProps<{
		modelValue: number;
		steps: string[];
		canAdvance: boolean;
		enabled?: boolean;
		disabled?: boolean;
	}>(),
	{ enabled: true, disabled: false }
);

const emit = defineEmits<{ 'update:modelValue': [step: number] }>();

const { t } = useI18n();

// The shell swaps its target element when the viewport crosses `md`. The teleport is keyed by the
// selector so that it is mounted afresh then — `defer` resolves a fresh mount after the shell has
// rendered the new element, whereas an in-place update would look for it before it exists.
const actionsSelector = inject(virtualWizardActionsKey, null);
const actionsTarget = computed<string | null>(() => actionsSelector?.value ?? null);

const isLast = computed<boolean>((): boolean => props.modelValue >= props.steps.length - 1);
</script>

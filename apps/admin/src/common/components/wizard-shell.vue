<template>
	<div
		class="flex flex-col gap-4 min-h-full"
		data-test-id="wizard-shell"
	>
		<div
			v-if="isPhone"
			class="flex flex-col gap-2"
			data-test-id="wizard-shell-progress"
		>
			<span class="text-help">{{ progressText }}</span>
			<div
				:aria-valuenow="currentIndex + 1"
				:aria-valuemax="props.steps.length"
				:aria-valuetext="progressText"
				:aria-label="t('application.wizardShell.steps')"
				aria-valuemin="1"
				role="progressbar"
				class="h-1 rounded-full overflow-hidden bg-[var(--el-border-color-light)]"
			>
				<div
					:style="{ width: `${progressPercent}%` }"
					class="h-full rounded-full bg-primary transition-[width] duration-200"
				/>
			</div>
		</div>

		<nav
			v-else
			:aria-label="t('application.wizardShell.steps')"
			class="px-5 py-3.5 bg-surface border border-solid border-light rounded-lg"
			data-test-id="wizard-shell-stepper"
		>
			<ol
				class="flex flex-wrap items-center gap-2.5 m-0 p-0 list-none"
				@keydown="onStepperKeydown"
			>
				<li
					v-for="(step, index) in props.steps"
					:key="step.id"
					:class="['flex items-center gap-2.5 min-w-0', index < props.steps.length - 1 ? 'flex-[1_1_auto]' : '']"
				>
					<button
						:ref="(el) => setStepRef(el, index)"
						:tabindex="index === focusIndex ? 0 : -1"
						:aria-current="index === currentIndex ? 'step' : undefined"
						:aria-disabled="index > currentIndex || props.busy ? 'true' : undefined"
						:class="[
							'flex items-center gap-2 p-1 -m-1 border-0 bg-transparent rounded-[var(--el-border-radius-base)] font-inherit text-[14px] leading-[22px] whitespace-nowrap',
							index < currentIndex
								? 'text-success cursor-pointer'
								: index === currentIndex
									? 'text-default font-600 cursor-default'
									: 'text-secondary cursor-default',
						]"
						:data-step-id="step.id"
						type="button"
						data-test-id="wizard-shell-step"
						@click="onStepClick(index)"
						@focus="focusIndex = index"
					>
						<span
							:class="[
								'flex items-center justify-center shrink-0 w-6 h-6 rounded-full box-border text-[12px] font-600',
								index < currentIndex
									? 'bg-success text-white'
									: index === currentIndex
										? 'bg-primary text-white'
										: 'border border-solid border-default text-secondary',
							]"
							aria-hidden="true"
						>
							<icon
								v-if="index < currentIndex"
								icon="mdi:check"
								width="14"
								height="14"
							/>
							<template v-else>{{ index + 1 }}</template>
						</span>
						{{ step.label }}
						<span
							v-if="index < currentIndex"
							class="sr-only"
						>
							{{ t('application.wizardShell.completed') }}
						</span>
					</button>
					<span
						v-if="index < props.steps.length - 1"
						:class="['flex-1 min-w-4 h-px', index < currentIndex ? 'bg-success' : 'bg-[var(--el-border-color)]']"
						aria-hidden="true"
					/>
				</li>
			</ol>
		</nav>

		<section
			:class="[
				'w-full mx-auto bg-surface border border-solid border-light rounded-lg overflow-hidden',
				props.stepWidth === 'table' ? 'max-w-[960px]' : 'max-w-[720px]',
			]"
			:aria-label="currentStep?.label"
			data-test-id="wizard-shell-step-card"
		>
			<slot />
		</section>

		<div
			:style="keyboardOffset > 0 ? { transform: `translateY(-${keyboardOffset}px)` } : undefined"
			class="sticky bottom-0 z-10 mt-auto flex items-center gap-2 h-16 px-3 tp:px-6 shrink-0 border-t border-t-solid border-light shadow-top bg-surface"
			data-test-id="wizard-shell-footer"
		>
			<el-button
				:disabled="props.busy"
				text
				data-test-id="wizard-shell-cancel"
				@click="emit('cancel')"
			>
				{{ t('application.wizardShell.cancel') }}
			</el-button>

			<span class="flex-1" />

			<span
				v-if="props.selectedCount !== undefined"
				class="text-body mr-2"
				role="status"
				data-test-id="wizard-shell-selected"
			>
				{{ t('application.bulkActions.selected', { count: props.selectedCount }) }}
			</span>

			<el-button
				v-if="props.skippable"
				:disabled="props.busy"
				text
				data-test-id="wizard-shell-skip"
				@click="emit('skip')"
			>
				{{ t('application.wizardShell.skip') }}
			</el-button>

			<el-button
				v-if="currentIndex > 0"
				:disabled="props.busy"
				data-test-id="wizard-shell-back"
				@click="emit('back')"
			>
				{{ t('application.wizardShell.back') }}
			</el-button>

			<el-button
				:disabled="!props.canContinue"
				:loading="props.busy"
				type="primary"
				data-test-id="wizard-shell-next"
				@click="emit('next')"
			>
				{{ nextText }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { type ComponentPublicInstance, computed, onBeforeUpdate, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useKeyboardOffset } from '../composables/useKeyboardOffset';
import { useSizeClass } from '../composables/useSizeClass';

import type { WizardShellProps, WizardShellStep } from './wizard-shell.types';

defineOptions({
	name: 'WizardShell',
});

const props = withDefaults(defineProps<WizardShellProps>(), {
	canContinue: true,
	selectedCount: undefined,
	skippable: false,
	nextLabel: undefined,
	busy: false,
	stepWidth: 'form',
});

const emit = defineEmits<{
	(e: 'back'): void;
	(e: 'next'): void;
	(e: 'cancel'): void;
	(e: 'skip'): void;
	/** A completed step was chosen in the stepper */
	(e: 'step', id: string): void;
}>();

const { t } = useI18n();

const { isPhone } = useSizeClass();

// Rides above the on-screen keyboard like the form footer (spec section 6)
const { offset: keyboardOffset } = useKeyboardOffset();

const currentIndex = computed<number>(() =>
	Math.max(
		0,
		props.steps.findIndex((step) => step.id === props.current)
	)
);

const currentStep = computed<WizardShellStep | undefined>(() => props.steps[currentIndex.value]);

const isLast = computed<boolean>(() => currentIndex.value === props.steps.length - 1);

const progressText = computed<string>(() =>
	t('application.wizardShell.progress', {
		current: currentIndex.value + 1,
		total: props.steps.length,
		label: currentStep.value?.label ?? '',
	})
);

const progressPercent = computed<number>(() => (props.steps.length === 0 ? 0 : ((currentIndex.value + 1) / props.steps.length) * 100));

const nextText = computed<string>(() => props.nextLabel ?? (isLast.value ? t('application.wizardShell.finish') : t('application.wizardShell.next')));

// The stepper is one Tab stop (roving tabindex); arrow keys, Home and End move between the steps. Every step can take
// focus so a screen reader hears the whole flow, but only completed steps can be chosen
const focusIndex = ref<number>(currentIndex.value);

const stepRefs = ref<(HTMLButtonElement | null)[]>([]);

const setStepRef = (el: Element | ComponentPublicInstance | null, index: number): void => {
	stepRefs.value[index] = el instanceof HTMLButtonElement ? el : null;
};

onBeforeUpdate(() => {
	stepRefs.value = [];
});

watch(currentIndex, (index) => {
	focusIndex.value = index;
});

const moveFocus = (index: number): void => {
	const count = props.steps.length;

	if (count === 0) {
		return;
	}

	focusIndex.value = (index + count) % count;

	stepRefs.value[focusIndex.value]?.focus();
};

const onStepperKeydown = (event: KeyboardEvent): void => {
	switch (event.key) {
		case 'ArrowRight':
		case 'ArrowDown':
			moveFocus(focusIndex.value + 1);
			break;
		case 'ArrowLeft':
		case 'ArrowUp':
			moveFocus(focusIndex.value - 1);
			break;
		case 'Home':
			moveFocus(0);
			break;
		case 'End':
			moveFocus(props.steps.length - 1);
			break;
		default:
			return;
	}

	event.preventDefault();
};

const onStepClick = (index: number): void => {
	if (index >= currentIndex.value || props.busy) {
		return;
	}

	emit('step', props.steps[index].id);
};
</script>

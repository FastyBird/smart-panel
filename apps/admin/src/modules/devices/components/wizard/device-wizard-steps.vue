<template>
	<template v-if="!context || !enabled">
		<el-steps
			v-if="enabled"
			:active="modelValue"
			finish-status="success"
			align-center
			class="mb-4"
		>
			<el-step
				v-for="(label, index) in steps"
				:key="index"
				:title="label"
			/>
		</el-steps>
	</template>
	<slot />
	<div
		v-if="!context && enabled"
		class="flex justify-end gap-2 mt-4"
	>
		<el-button
			v-for="action in actions"
			:key="action.id"
			:data-test-id="`wizard-action-${action.id}`"
			:disabled="disabled || advancing || action.disabled"
			:loading="action.loading"
			:type="action.variant === 'primary' ? 'primary' : undefined"
			@click="action.handler"
		>
			{{ action.label }}
		</el-button>
	</div>
	<slot
		v-if="!enabled"
		name="final"
	/>
</template>
<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElStep, ElSteps } from 'element-plus';

import { RouteNames } from '../../devices.constants';

import { deviceWizardContextKey, useDeviceWizardFlow } from './device-wizard-flow';
import type { IWizardAction } from './device-wizard.types';

const props = withDefaults(
	defineProps<{
		modelValue: number;
		steps: string[];
		canAdvance: boolean;
		enabled?: boolean;
		disabled?: boolean;
		dirty?: boolean;
		finalActions?: IWizardAction[];
		beforeNext?: () => boolean | void | Promise<boolean | void>;
		returnRoute?: import('vue-router').RouteLocationRaw;
	}>(),
	{ enabled: true, disabled: false, dirty: false, finalActions: () => [], beforeNext: undefined, returnRoute: undefined }
);
const emit = defineEmits<{ 'update:modelValue': [step: number] }>();
const { t } = useI18n();
const router = useRouter();
const context = inject(deviceWizardContextKey, null);
const advancing = ref(false);
const actions = computed<IWizardAction[]>(() => [
	...(props.modelValue > 0
		? [
				{
					id: 'back',
					label: t('devicesModule.wizard.actions.back'),
					variant: 'default' as const,
					handler: () => emit('update:modelValue', props.modelValue - 1),
				},
			]
		: []),
	{
		id: 'cancel',
		label: t('devicesModule.wizard.actions.cancel'),
		variant: 'link',
		handler: async () => {
			await router.push(props.returnRoute ?? { name: RouteNames.DEVICES });
		},
	},
	...(props.modelValue < props.steps.length - 1
		? [
				{
					id: 'next',
					label: t('devicesModule.wizard.actions.next'),
					variant: 'primary' as const,
					disabled: !props.canAdvance || advancing.value,
					loading: advancing.value,
					handler: async () => {
						if (advancing.value || props.disabled || !props.canAdvance) return;
						advancing.value = true;
						try {
							const previous = props.modelValue;
							if ((await props.beforeNext?.()) === false) return;
							if (props.modelValue === previous) emit('update:modelValue', previous + 1);
						} finally {
							advancing.value = false;
						}
					},
				},
			]
		: props.finalActions),
]);
if (props.enabled)
	useDeviceWizardFlow(
		computed(() => ({
			steps: props.steps,
			activeStep: props.modelValue,
			busy: props.disabled || advancing.value,
			dirty: props.dirty,
			actions: actions.value,
		}))
	);
</script>

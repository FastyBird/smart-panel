<template>
	<define-action v-slot="{ action }">
		<el-button
			class="ml-0!"
			:data-test-id="`wizard-action-${action.id}`"
			:link="action.variant === 'link'"
			:type="action.variant === 'primary' || action.variant === 'warning' ? action.variant : undefined"
			:disabled="pending || flow?.busy || action.disabled"
			:loading="action.loading"
			@click="run(action)"
		>
			<template
				v-if="action.icon"
				#icon
			>
				<icon :icon="action.icon" />
			</template>
			{{ action.label }}
		</el-button>
	</define-action>
	<app-breadcrumbs :items="breadcrumbs" />
	<view-header
		:heading="title"
		:sub-heading="subtitle"
		:icon="icon"
	/>
	<header
		v-if="!isMDDevice"
		class="flex flex-col gap-2 mx-2 my-2"
	>
		<h1 class="text-lg font-semibold m-0">{{ title }}</h1>
	</header>
	<div class="flex-1 min-h-0 flex flex-col lt-sm:mx-1 sm:mx-2 my-2">
		<el-card
			shadow="never"
			class="flex-1 min-h-0 flex flex-col"
			body-class="flex-1 min-h-0 flex flex-col p-0!"
		>
			<template
				v-if="steps.length"
				#header
			>
				<div class="md:hidden text-sm">{{ activeStep + 1 }} / {{ steps.length }} · {{ steps[activeStep] }}</div>
				<el-steps
					class="lt-md:hidden"
					:active="activeStep"
					finish-status="success"
					align-center
				>
					<el-step
						v-for="(label, index) in steps"
						:key="index"
						:title="label"
					/>
				</el-steps>
			</template>
			<el-scrollbar class="flex-1 min-h-0">
				<div class="p-4"><slot /></div>
			</el-scrollbar>
			<template
				v-if="actions.length"
				#footer
			>
				<footer data-test-id="wizard-footer">
					<div
						class="flex items-center gap-3"
						data-test-id="wizard-actions"
					>
						<reuse-action
							v-if="cancelAction"
							:action="cancelAction"
						/>
						<div
							class="flex flex-1 min-w-0 flex-wrap items-center justify-end gap-2"
							data-test-id="wizard-navigation-actions"
						>
							<reuse-action
								v-for="action in navigationActions"
								:key="action.id"
								:action="action"
							/>
						</div>
					</div>
				</footer>
			</template>
		</el-card>
	</div>
</template>
<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router';

import { ElButton, ElCard, ElMessageBox, ElScrollbar, ElStep, ElSteps } from 'element-plus';

import { Icon } from '@iconify/vue';
import { createReusableTemplate, useEventListener } from '@vueuse/core';

import { AppBreadcrumbs, ViewHeader, useBreakpoints, useLogger } from '../../../../common';
import { RouteNames } from '../../devices.constants';

import { createDeviceWizardContext, deviceWizardContextKey } from './device-wizard-flow';
import type { IWizardAction } from './device-wizard.types';

const props = withDefaults(
	defineProps<{
		title: string;
		subtitle?: string;
		icon?: string;
		returnRoute?: import('vue-router').RouteLocationRaw;
		backRoute?: import('vue-router').RouteLocationRaw;
		prefixSteps?: string[];
	}>(),
	{ subtitle: '', icon: 'mdi:wizard-hat', returnRoute: undefined, backRoute: undefined, prefixSteps: () => [] }
);
const { t } = useI18n();
const { isMDDevice } = useBreakpoints();
const [DefineAction, ReuseAction] = createReusableTemplate<{ action: IWizardAction }>();
const router = useRouter();
const logger = useLogger();
const context = createDeviceWizardContext();
provide(deviceWizardContextKey, context);
const flow = computed(() => context.flow.value?.value);
const steps = computed(() => [...props.prefixSteps, ...(flow.value?.steps ?? [])]);
const activeStep = computed(() => (flow.value ? props.prefixSteps.length + flow.value.activeStep : Math.max(0, props.prefixSteps.length - 1)));
const pending = ref(false);
const leaving = ref(false);
const { meta } = useMeta({ title: props.title });
watch(
	() => props.title,
	(title) => {
		meta.title = title;
	}
);
const breadcrumbs = computed(() => [{ label: t('devicesModule.breadcrumbs.devices.list'), route: router.resolve({ name: RouteNames.DEVICES }) }]);
const cancel = async (): Promise<void> => {
	await router.push(props.returnRoute ?? { name: RouteNames.DEVICES });
};
const actions = computed<IWizardAction[]>(() => [
	...(props.backRoute && (!flow.value || flow.value.activeStep === 0) && !context.completed.value
		? [
				{
					id: 'choose',
					label: t('devicesModule.wizard.actions.back'),
					variant: 'default' as const,
					handler: async () => {
						await router.push(props.backRoute!);
					},
				},
			]
		: []),
	...(flow.value?.actions ?? [{ id: 'cancel', label: t('devicesModule.wizard.actions.cancel'), variant: 'link', handler: cancel }]),
]);
const cancelAction = computed(() => actions.value.find((action) => action.id === 'cancel'));
const navigationActions = computed(() => actions.value.filter((action) => action.id !== 'cancel'));
const run = async (action: IWizardAction): Promise<void> => {
	if (pending.value || flow.value?.busy || action.disabled) return;
	pending.value = true;
	try {
		await action.handler();
	} catch (error) {
		logger.error('Device wizard action failed', error);
	} finally {
		pending.value = false;
	}
};
const confirmLeave = async (): Promise<boolean> => {
	if (context.completed.value) return true;
	if (flow.value?.busy) return false;
	if (leaving.value) return false;
	if (!flow.value?.dirty) return true;
	leaving.value = true;
	try {
		await ElMessageBox.confirm(t('devicesModule.wizard.discardChanges'), t('devicesModule.buttons.discard.title'), {
			type: 'warning',
			confirmButtonText: t('devicesModule.buttons.discard.title'),
			cancelButtonText: t('devicesModule.wizard.actions.cancel'),
		});
		return true;
	} catch {
		return false;
	} finally {
		leaving.value = false;
	}
};
onBeforeRouteLeave(confirmLeave);
onBeforeRouteUpdate((to, from) =>
	to.params.type === from.params.type && to.params.id === from.params.id && to.query.variant === from.query.variant ? true : confirmLeave()
);
useEventListener(window, 'beforeunload', (event: BeforeUnloadEvent) => {
	if (!context.completed.value && (flow.value?.busy || flow.value?.dirty)) {
		event.preventDefault();
		event.returnValue = '';
	}
});
</script>

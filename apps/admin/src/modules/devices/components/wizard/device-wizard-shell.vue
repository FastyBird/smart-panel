<template>
	<app-breadcrumbs :items="breadcrumbs" />
	<view-header
		:title="title"
		:subtitle="subtitle"
		:icon="icon"
		:on-back="cancel"
		left="close"
	/>
	<!-- Template 9: stepper card, centred step card and the sticky footer, scrolling as one page. The phone page scrolls
	     in the main area, so there the column only fills it; the footer sits at the bottom either way -->
	<div
		:class="['flex flex-col', isPhone ? 'min-h-full' : 'flex-1 min-h-0 overflow-y-auto']"
		data-test-id="wizard-scroll"
	>
		<div class="page-pad pb-0! flex-1 box-border flex flex-col">
			<wizard-shell
				:steps="shellSteps"
				:current="`step-${activeStep}`"
				:can-continue="!!primaryAction && !primaryAction.disabled && !pending"
				:busy="pending || !!flow?.busy || !!primaryAction?.loading"
				:selected-count="flow?.selectedCount"
				:step-width="flow?.stepWidth ?? 'form'"
				:cancellable="!!cancelAction"
				:backable="!!backAction"
				:next-visible="!!primaryAction"
				:next-label="primaryAction?.label"
				class="flex-1"
				@cancel="cancelAction && run(cancelAction)"
				@back="backAction && run(backAction)"
				@next="primaryAction && run(primaryAction)"
			>
				<div class="p-4">
					<slot />
				</div>
				<template #actions>
					<el-button
						v-for="action in otherActions"
						:key="action.id"
						:data-test-id="`wizard-action-${action.id}`"
						:link="action.variant === 'link'"
						:type="action.variant === 'warning' ? 'warning' : undefined"
						:disabled="pending || flow?.busy || action.disabled"
						:loading="action.loading"
						class="ml-0!"
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
				</template>
			</wizard-shell>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router';

import { ElButton, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useEventListener } from '@vueuse/core';

import { AppBreadcrumbs, ViewHeader, WizardShell, type WizardShellStep, useLogger, useSizeClass } from '../../../../common';
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
const { isPhone } = useSizeClass();
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
const shellSteps = computed<WizardShellStep[]>(() => steps.value.map((label, index) => ({ id: `step-${index}`, label })));
// The flow's actions land on the shell's own buttons: Cancel, Back (or back to the wizard picker) and the step's one
// primary action as Next. Anything else, such as "Scan again" or "Add more", sits beside them
const cancelAction = computed(() => actions.value.find((action) => action.id === 'cancel'));
const backAction = computed(() => actions.value.find((action) => action.id === 'back') ?? actions.value.find((action) => action.id === 'choose'));
const primaryAction = computed(() => actions.value.filter((action) => action.variant === 'primary').at(-1));
const otherActions = computed(() =>
	actions.value.filter((action) => action !== cancelAction.value && action !== backAction.value && action !== primaryAction.value)
);
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

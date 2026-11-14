<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:plus"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('automations.headings.add') }}
		</template>

		<template #subtitle>
			{{ t('automations.subHeadings.add') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		:disabled="saving"
		teleport
		small
		@click="formChanged ? onDiscard() : onClose()"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.RIGHT"
		:loading="remoteFormResult === FormResult.WORKING"
		:disabled="remoteFormResult === FormResult.WORKING"
		teleport
		small
		@click="remoteFormSubmit = true"
	>
		<span class="uppercase">{{ t('automations.buttons.save.title') }}</span>
	</app-bar-button>

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar class="grow-1 p-2 md:px-4">
			<automation-add-form
				:id="automationId"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-changed="formChanged"
				:initial="draft"
			/>
		</el-scrollbar>

		<div
			v-if="isMDDevice"
			class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 w-full h-[3rem]"
			style="background-color: var(--el-drawer-bg-color)"
		>
			<div class="p-2">
				<el-button
					:disabled="saving"
					link
					class="mr-2"
					@click="formChanged ? onDiscard() : onClose()"
				>
					{{ t('automations.buttons.cancel.title') }}
				</el-button>

				<el-button
					:loading="remoteFormResult === FormResult.WORKING"
					:disabled="remoteFormResult === FormResult.WORKING"
					type="primary"
					@click="remoteFormSubmit = true"
				>
					{{ t('automations.buttons.save.title') }}
				</el-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { ElButton, ElIcon, ElMessageBox, ElScrollbar } from 'element-plus';
import { v4 as uuid } from 'uuid';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, useBreakpoints } from '../../../common';
import { AUTOMATION_TEMPLATE_DRAFT_QUERY, FormResult, type FormResultType, RouteNames } from '../automations.constants';
import { type IAutomationDraft, discardAutomationDraft, peekAutomationDraft } from '../automations.drafts';
import { AutomationAddForm } from '../components/components';

import type { IViewAutomationAddProps } from './view-automation-add.types';

defineOptions({
	name: 'ViewAutomationAdd',
});

const props = withDefaults(defineProps<IViewAutomationAddProps>(), {
	remoteFormChanged: false,
});

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
	(e: 'update:remote-form-saving', saving: boolean): void;
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const { isMDDevice, isLGDevice } = useBreakpoints();

// Created from a template, the automation gets the id its generated flow waits under. After a reload the draft
// is gone, and the form is the blank one.
const draftId = route.query[AUTOMATION_TEMPLATE_DRAFT_QUERY];
const templateDraft: IAutomationDraft | null = typeof draftId === 'string' ? peekAutomationDraft(draftId) : null;

const draft = templateDraft ? { name: templateDraft.name, mode: templateDraft.mode } : null;

const automationId = ref<string>(templateDraft !== null && typeof draftId === 'string' ? draftId : uuid());

let created = false;
const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
// The flow generated from a template is lost with the form, so leaving it asks first from the start
const formChanged = ref<boolean>(props.remoteFormChanged || templateDraft !== null);

const saving = computed<boolean>((): boolean => remoteFormResult.value === FormResult.WORKING);

// A save on its way cannot be taken back: leaving now would look like discarding what is then saved anyway
const onClose = (): void => {
	if (saving.value) {
		return;
	}

	if (isLGDevice.value) {
		router.replace({ name: RouteNames.AUTOMATIONS });
	} else {
		router.push({ name: RouteNames.AUTOMATIONS });
	}
};

// The same question the edit view asks: what was typed is lost with the form
const onDiscard = (): void => {
	if (saving.value) {
		return;
	}

	ElMessageBox.confirm(t('automations.texts.confirmDiscard'), t('automations.headings.discard'), {
		confirmButtonText: t('automations.buttons.yes.title'),
		cancelButtonText: t('automations.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			onClose();
		})
		.catch((): void => {
			// Just ignore it
		});
};

watch(
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			created = true;

			// A new automation has an empty flow: drawing it is the next thing to do. The flow takes the place of
			// the form, so going back leads to the list and not to a form for yet another automation.
			router.replace({ name: RouteNames.AUTOMATIONS_FLOW, params: { id: automationId.value } });
		}
	}
);

// A flow of a form left without saving is not kept for later
onBeforeUnmount((): void => {
	if (!created && templateDraft !== null) {
		discardAutomationDraft(automationId.value);
	}
});

watch(
	(): boolean => saving.value,
	(val: boolean): void => {
		emit('update:remote-form-saving', val);
	}
);

watch(
	(): boolean => props.remoteFormChanged,
	(val: boolean): void => {
		formChanged.value = val;
	}
);

// Immediate, so the drawer around the view knows of a form that starts changed
watch(
	(): boolean => formChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	},
	{ immediate: true }
);
</script>

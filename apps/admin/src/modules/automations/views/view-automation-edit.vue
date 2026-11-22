<template>
	<view-header
		:title="t('automations.headings.edit')"
		:subtitle="automation?.name ?? t('automations.subHeadings.list')"
		icon="mdi:pencil"
		left="close"
		:primary="
			automationReady && automation
				? {
						label: t('automations.buttons.save.title'),
						handler: () => (remoteFormSubmit = true),
						loading: remoteFormResult === FormResult.WORKING,
						disabled: remoteFormResult === FormResult.WORKING,
					}
				: undefined
		"
		:back-disabled="saving"
		@back="formChanged ? onDiscard() : onClose()"
	/>

	<div class="flex flex-col overflow-hidden h-full">
		<!-- Only the first read replaces the form. A later one (the store reads the automation again after
		     a refused save) must leave it mounted, or the outcome of the submit would never get here. -->
		<state-view
			v-if="!automationReady || (!automation && isLoading)"
			kind="loading"
			:title="t('automations.texts.loadingAutomations')"
			icon="mdi:pencil"
		/>

		<state-view
			v-else-if="!automation && loadFailed"
			kind="error"
			:title="t('automations.messages.loadFailed')"
			icon="mdi:alert-circle-outline"
		>
			<template #action>
				<el-button @click="onClose">
					{{ t('automations.buttons.backToList.title') }}
				</el-button>
				<el-button
					type="primary"
					@click="load"
				>
					{{ t('automations.buttons.retry.title') }}
				</el-button>
			</template>
		</state-view>

		<state-view
			v-else-if="!automation"
			kind="not-found"
			:title="t('automations.messages.notFound')"
			icon="mdi:robot-off-outline"
		>
			<template #action>
				<el-button
					type="primary"
					@click="onClose"
				>
					{{ t('automations.buttons.backToList.title') }}
				</el-button>
			</template>
		</state-view>

		<template v-else>
			<el-scrollbar class="grow-1 p-2 tp:px-4">
				<automation-edit-form
					:key="automation.id"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-changed="formChanged"
					:automation="automation"
				/>
			</el-scrollbar>

			<!-- Wherever the phone app bar is not there to carry Save: in a drawer, and on a page kept open past 720 px -->
			<form-footer
				v-show="inDrawer || !isPhone"
				:dirty="formChanged"
				:saving="saving"
				:can-save="formChanged && !saving"
				@save="remoteFormSubmit = true"
				@discard="onDiscard"
				@close="onClose"
			/>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElMessageBox, ElScrollbar } from 'element-plus';

import { FormFooter, StateView, ViewHeader, useEditDrawer, useSizeClass } from '../../../common';
import { FormResult, type FormResultType, RouteNames } from '../automations.constants';
import { AutomationsApiException } from '../automations.exceptions';
import { AutomationEditForm } from '../components/components';
import { useAutomation } from '../composables/composables';

import type { IViewAutomationEditProps } from './view-automation-edit.types';

defineOptions({
	name: 'ViewAutomationEdit',
});

const props = withDefaults(defineProps<IViewAutomationEditProps>(), {
	remoteFormChanged: false,
});

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
	(e: 'update:remote-form-saving', saving: boolean): void;
}>();

const { t } = useI18n();
const router = useRouter();

// Template 4: in the drawer from tablet portrait up, its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

const { automation, isLoading, fetchAutomation } = useAutomation({ id: props.id });

// The list may not be loaded when the view is opened by its address, e.g. from a notification
const automationReady = ref<boolean>(false);

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const formChanged = ref<boolean>(props.remoteFormChanged);

const saving = computed<boolean>((): boolean => remoteFormResult.value === FormResult.WORKING);

// A save on its way cannot be taken back: leaving now would look like discarding what is then saved anyway
const onClose = (): void => {
	if (saving.value) {
		return;
	}

	if (inDrawer.value) {
		router.replace({ name: RouteNames.AUTOMATIONS });
	} else {
		router.push({ name: RouteNames.AUTOMATIONS });
	}
};

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
			onClose();
		}
	}
);

// The automation is gone (removed elsewhere, or the save itself was answered with 404), and the form
// went with it before it could report how its save ended. Nothing can be saved into it any more, so the
// view stops waiting, or it could never be left again.
watch(
	(): boolean => automation.value === null,
	(gone: boolean): void => {
		if (gone && saving.value) {
			remoteFormResult.value = FormResult.NONE;
		}
	}
);

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

watch(
	(): boolean => formChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);

// A read that failed for any reason other than the automation being gone is offered again
const loadFailed = ref<boolean>(false);

const load = async (): Promise<void> => {
	loadFailed.value = false;

	try {
		await fetchAutomation();
	} catch (error: unknown) {
		loadFailed.value = !(error instanceof AutomationsApiException && error.code === 404);
	} finally {
		automationReady.value = true;
	}
};

onBeforeMount(load);
</script>

<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:pencil"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('automations.headings.edit') }}
		</template>

		<template #subtitle>
			{{ automation?.name ?? t('automations.subHeadings.list') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
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
		v-if="!isMDDevice && automation"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="remoteFormSubmit = true"
	>
		<span class="uppercase">{{ t('automations.buttons.save.title') }}</span>
	</app-bar-button>

	<div class="flex flex-col overflow-hidden h-full">
		<div
			v-if="isLoading || !automationReady"
			class="flex items-center justify-center h-full"
		>
			<el-icon
				class="is-loading"
				:size="32"
			>
				<icon icon="mdi:loading" />
			</el-icon>
		</div>

		<div
			v-else-if="!automation"
			class="flex flex-col items-center justify-center h-full gap-4 p-4"
		>
			<el-icon
				:size="48"
				class="text-gray-300"
			>
				<icon icon="mdi:robot-off-outline" />
			</el-icon>
			<div class="text-gray-500">{{ t('automations.messages.notFound') }}</div>
			<el-button
				type="primary"
				@click="onClose"
			>
				{{ t('automations.buttons.backToList.title') }}
			</el-button>
		</div>

		<template v-else>
			<el-scrollbar class="grow-1 p-2 md:px-4">
				<automation-edit-form
					:key="automation.id"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-changed="formChanged"
					:automation="automation"
				/>
			</el-scrollbar>

			<div
				v-if="isMDDevice"
				class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 w-full h-[3rem]"
				style="background-color: var(--el-drawer-bg-color)"
			>
				<div class="p-2">
					<el-button
						v-if="formChanged"
						link
						class="mr-2"
						@click="onDiscard"
					>
						{{ t('automations.buttons.discard.title') }}
					</el-button>
					<el-button
						v-if="!formChanged"
						link
						class="mr-2"
						@click="onClose"
					>
						{{ t('automations.buttons.close.title') }}
					</el-button>

					<el-button
						:loading="remoteFormResult === FormResult.WORKING"
						:disabled="remoteFormResult === FormResult.WORKING || !formChanged"
						type="primary"
						@click="remoteFormSubmit = true"
					>
						{{ t('automations.buttons.save.title') }}
					</el-button>
				</div>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElIcon, ElMessageBox, ElScrollbar } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, useBreakpoints } from '../../../common';
import { FormResult, type FormResultType, RouteNames } from '../automations.constants';
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
}>();

const { t } = useI18n();
const router = useRouter();

const { isMDDevice, isLGDevice } = useBreakpoints();

const { automation, isLoading, fetchAutomation } = useAutomation({ id: props.id });

// The list may not be loaded when the view is opened by its address, e.g. from a notification
const automationReady = ref<boolean>(false);

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const formChanged = ref<boolean>(props.remoteFormChanged);

const onClose = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.AUTOMATIONS });
	} else {
		router.push({ name: RouteNames.AUTOMATIONS });
	}
};

const onDiscard = (): void => {
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

onBeforeMount(async (): Promise<void> => {
	try {
		await fetchAutomation();
	} catch {
		// Not found or not reachable: the view says so instead of the form
	} finally {
		automationReady.value = true;
	}
});
</script>

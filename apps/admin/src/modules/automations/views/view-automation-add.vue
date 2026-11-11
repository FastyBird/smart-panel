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
		teleport
		small
		@click="onClose"
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
			/>
		</el-scrollbar>

		<div
			v-if="isMDDevice"
			class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 w-full h-[3rem]"
			style="background-color: var(--el-drawer-bg-color)"
		>
			<div class="p-2">
				<el-button
					link
					class="mr-2"
					@click="onClose"
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
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElIcon, ElScrollbar } from 'element-plus';
import { v4 as uuid } from 'uuid';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, useBreakpoints } from '../../../common';
import { FormResult, type FormResultType, RouteNames } from '../automations.constants';
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
}>();

const { t } = useI18n();
const router = useRouter();

const { isMDDevice, isLGDevice } = useBreakpoints();

const automationId = ref<string>(uuid());
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
</script>

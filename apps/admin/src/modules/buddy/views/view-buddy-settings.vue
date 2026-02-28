<template>
	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:robot-happy"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('buddyModule.headings.settings') }}
		</template>

		<template #subtitle>
			{{ t('buddyModule.subHeadings.settings') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="router.push('/')"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>

		<span class="uppercase">{{ t('buddyModule.buttons.back.title') }}</span>
	</app-bar-button>

	<app-bar-button
		v-if="!isMDDevice && remoteFormChanged"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onSave"
	>
		<span class="uppercase">{{ t('buddyModule.buttons.save.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('buddyModule.headings.settings')"
		:sub-heading="t('buddyModule.subHeadings.settings')"
		:icon="'mdi:robot-happy'"
	/>

	<div
		v-loading="isLoading || (!configModule && !loadError)"
		:element-loading-text="t('buddyModule.texts.loadingConfig')"
		class="flex flex-col overflow-hidden h-full"
	>
		<div
			v-if="loadError"
			class="flex flex-col items-center justify-center h-full p-4"
		>
			<el-result
				icon="error"
				:title="t('buddyModule.messages.loadError')"
			>
				<template #extra>
					<el-button
						type="primary"
						@click="onRetry"
					>
						{{ t('buddyModule.buttons.retry.title') }}
					</el-button>
				</template>
			</el-result>
		</div>

		<el-scrollbar
			v-else-if="configModule"
			class="grow-1 p-2 md:px-4"
		>
			<el-alert
				type="info"
				:title="t('buddyModule.headings.aboutBuddy')"
				:description="t('buddyModule.texts.aboutBuddy')"
				:closable="false"
				class="mb-4"
			/>

			<buddy-config-form
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:config="configModule"
			/>
		</el-scrollbar>

		<div
			v-if="isMDDevice && configModule && !loadError"
			class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 w-full h-[3rem]"
			style="background-color: var(--el-drawer-bg-color)"
		>
			<div class="p-2">
				<el-button
					:loading="remoteFormResult === FormResult.WORKING"
					:disabled="isLoading || remoteFormResult !== FormResult.NONE || !remoteFormChanged"
					type="primary"
					@click="onSave"
				>
					<template
						v-if="remoteFormResult === FormResult.OK || remoteFormResult === FormResult.ERROR"
						#icon
					>
						<icon
							v-if="remoteFormResult === FormResult.OK"
							icon="mdi:check-circle"
						/>
						<icon
							v-else-if="remoteFormResult === FormResult.ERROR"
							icon="mdi:cross-circle"
						/>
					</template>
					{{ t('buddyModule.buttons.save.title') }}
				</el-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { useRouter } from 'vue-router';

import { ElAlert, ElButton, ElIcon, ElResult, ElScrollbar, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, ViewHeader, useBreakpoints } from '../../../common';
import { FormResult, type FormResultType, useConfigModule } from '../../config';
import BuddyConfigForm from '../components/buddy-config-form.vue';
import { BUDDY_MODULE_NAME } from '../buddy.constants';

defineOptions({
	name: 'ViewBuddySettings',
});

const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('buddyModule.meta.settings.title'),
});

const { isMDDevice } = useBreakpoints();

const { configModule, isLoading, fetchConfigModule } = useConfigModule({ type: BUDDY_MODULE_NAME });

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);
const loadError = ref<boolean>(false);

const onSave = (): void => {
	remoteFormSubmit.value = true;
};

const onRetry = async (): Promise<void> => {
	loadError.value = false;
	await fetchConfigModule().catch((error: unknown): void => {
		const err = error as Error;

		loadError.value = true;
		console.error('Failed to fetch buddy config:', err);
	});
};

watch(
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			remoteFormChanged.value = false;
		}
	}
);
</script>

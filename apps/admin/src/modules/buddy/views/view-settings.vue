<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:robot-happy"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('buddyModule.headings.aboutBuddy') }}
		</template>

		<template #subtitle>
			{{ moduleName }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="() => (remoteFormChanged ? onDiscard() : onClose())"
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
		@click="onSave"
	>
		<span class="uppercase">{{ t('configModule.buttons.save.title') }}</span>
	</app-bar-button>

	<div
		v-loading="isLoading || (!configModule && !loadError)"
		:element-loading-text="t('configModule.texts.loadingModuleConfig')"
		class="flex flex-col overflow-hidden h-full"
	>
		<div
			v-if="loadError"
			class="flex flex-col items-center justify-center h-full p-4"
		>
			<el-result
				icon="error"
				:title="t('configModule.messages.loadError', 'Failed to load configuration')"
			>
				<template #extra>
					<el-button
						type="primary"
						@click="onRetry"
					>
						{{ t('configModule.buttons.retry.title', 'Retry') }}
					</el-button>
				</template>
			</el-result>
		</div>

		<el-scrollbar
			v-else-if="configModule"
			class="grow-1 p-2 md:px-4"
		>
			<buddy-config-form
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:config="configModule"
			/>
		</el-scrollbar>

		<div
			v-if="isMDDevice"
			class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 w-full h-[3rem]"
			style="background-color: var(--el-drawer-bg-color)"
		>
			<div class="p-2">
				<el-button
					v-if="remoteFormChanged"
					link
					class="mr-2"
					@click="onDiscard"
				>
					{{ t('configModule.buttons.discard.title') }}
				</el-button>
				<el-button
					v-if="!remoteFormChanged"
					link
					class="mr-2"
					@click="onClose"
				>
					{{ t('configModule.buttons.close.title') }}
				</el-button>

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
					{{ t('configModule.buttons.save.title') }}
				</el-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { useRouter } from 'vue-router';

import { ElButton, ElIcon, ElMessageBox, ElResult, ElScrollbar, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	useBreakpoints,
} from '../../../common';
import { useConfigModule } from '../../config/composables/useConfigModule';
import { FormResult } from '../../config/config.constants';
import { BuddyConfigForm } from '../components/components';
import { BUDDY_MODULE_NAME } from '../buddy.constants';

import type { IViewSettingsProps } from './view-settings.types';

defineOptions({
	name: 'ViewBuddySettings',
});

const props = withDefaults(defineProps<IViewSettingsProps>(), {
	remoteFormSubmit: false,
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
});

const router = useRouter();
const { t } = useI18n();
const { meta } = useMeta({});

const { isMDDevice } = useBreakpoints();

const { configModule, isLoading, fetchConfigModule } = useConfigModule({ type: BUDDY_MODULE_NAME });

const moduleName = computed<string>((): string => {
	return 'Buddy';
});

const remoteFormSubmit = ref<boolean>(props.remoteFormSubmit);
const remoteFormResult = ref<FormResult>(props.remoteFormResult);
const remoteFormReset = ref<boolean>(props.remoteFormReset);
const remoteFormChanged = ref<boolean>(false);
const loadError = ref<boolean>(false);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('configModule.texts.misc.confirmDiscard'), t('configModule.headings.misc.discard'), {
		confirmButtonText: t('configModule.buttons.yes.title'),
		cancelButtonText: t('configModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			remoteFormReset.value = true;
			remoteFormChanged.value = false;
		})
		.catch((): void => {
			// Just ignore it
		});
};

const onSave = (): void => {
	remoteFormSubmit.value = true;
};

const onClose = (): void => {
	router.push('/');
};

const onRetry = async (): Promise<void> => {
	loadError.value = false;
	await fetchConfigModule().catch((error: unknown): void => {
		const err = error as Error;

		loadError.value = true;
		console.error('Failed to fetch buddy config:', err);
	});
};

// Fetch config on mount
fetchConfigModule().catch((error: unknown): void => {
	const err = error as Error;

	loadError.value = true;
	console.error('Failed to fetch buddy config:', err);
});

watch(
	(): string => moduleName.value,
	(name: string): void => {
		meta.title = name;
	},
	{ immediate: true }
);

watch(
	(): FormResult => remoteFormResult.value,
	(val: FormResult): void => {
		if (val === FormResult.OK) {
			// Stay on the page after save (unlike config module edit which navigates away)
		}
	}
);
</script>

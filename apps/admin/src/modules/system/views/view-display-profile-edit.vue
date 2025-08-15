<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:monitor-edit"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>{{ display?.screenWidth }}x{{ display?.screenHeight }} {{ display?.uid.slice(0, 8) }}</template>
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
		@click="onSubmit"
	>
		<span class="uppercase">{{ t('systemModule.buttons.save.title') }}</span>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<div
		v-loading="isLoading || display === null"
		:element-loading-text="t('systemModule.texts.displaysProfiles.loadingDisplay')"
		class="flex flex-col overflow-hidden h-full"
	>
		<el-scrollbar
			v-if="display !== null"
			class="grow-1 p-2 md:px-4"
		>
			<display-profile-edit-form
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:display="display"
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
					{{ t('systemModule.buttons.discard.title') }}
				</el-button>
				<el-button
					v-if="!remoteFormChanged"
					link
					class="mr-2"
					@click="onClose"
				>
					{{ t('systemModule.buttons.close.title') }}
				</el-button>

				<el-button
					:loading="remoteFormResult === FormResult.WORKING"
					:disabled="isLoading || remoteFormResult !== FormResult.NONE"
					type="primary"
					class="order-2"
					@click="onSubmit"
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
					{{ t('systemModule.buttons.save.title') }}
				</el-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElButton, ElIcon, ElMessageBox, ElScrollbar, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, useBreakpoints, useUuid } from '../../../common';
import { DisplayProfileEditForm } from '../components/components';
import { useDisplayProfile } from '../composables/composables';
import type { IDisplayProfile } from '../store/displays-profiles.store.types';
import { FormResult, type FormResultType, RouteNames } from '../system.constants';
import { SystemApiException, SystemException } from '../system.exceptions';

import type { IViewDisplayProfileEditProps } from './view-display-profile-edit.types';

defineOptions({
	name: 'ViewDisplayProfileEdit',
});

const props = defineProps<IViewDisplayProfileEditProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const router = useRouter();
const { t } = useI18n();
const { meta } = useMeta({});

const { validate: validateUuid } = useUuid();

const { isMDDevice, isLGDevice } = useBreakpoints();

const { display, isLoading, fetchDisplay } = useDisplayProfile({ id: props.display });

if (!validateUuid(props.display)) {
	throw new Error('Display identifier is not valid');
}

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		const items = [
			{
				label: t('systemModule.breadcrumbs.system.system'),
				route: router.resolve({ name: RouteNames.SYSTEM }),
			},
			{
				label: t('systemModule.breadcrumbs.system.systemInfo'),
				route: router.resolve({ name: RouteNames.SYSTEM_INFO }),
			},
		];

		items.push({
			label: t('systemModule.breadcrumbs.displaysProfiles.edit', { display: display.value?.uid.slice(0, 8) }),
			route: router.resolve({ name: RouteNames.DISPLAY_EDIT, params: { display: props.display } }),
		});

		return items;
	}
);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('systemModule.texts.misc.confirmDiscard'), t('systemModule.headings.misc.discard'), {
		confirmButtonText: t('systemModule.buttons.yes.title'),
		cancelButtonText: t('systemModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.SYSTEM_INFO });
			} else {
				router.push({ name: RouteNames.SYSTEM_INFO });
			}
		})
		.catch((): void => {
			// Just ignore it
		});
};

const onSubmit = (): void => {
	remoteFormSubmit.value = true;
};

const onClose = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SYSTEM_INFO });
	} else {
		router.push({ name: RouteNames.SYSTEM_INFO });
	}
};

onBeforeMount(async (): Promise<void> => {
	fetchDisplay()
		.then((): void => {
			if (!isLoading.value && display.value === null) {
				throw new SystemException('Display not found');
			}
		})
		.catch((error: unknown): void => {
			const err = error as Error;

			if (err instanceof SystemApiException && err.code === 404) {
				throw new SystemException('Display not found');
			} else {
				throw new SystemException('Something went wrong', err);
			}
		});
});

onMounted((): void => {
	emit('update:remote-form-changed', remoteFormChanged.value);
});

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		if (!val && display.value === null) {
			throw new SystemException('Display not found');
		}
	}
);

watch(
	(): IDisplayProfile | null => display.value,
	(val: IDisplayProfile | null): void => {
		if (val !== null) {
			meta.title = t('systemModule.meta.displaysProfiles.edit.title', { display: val?.uid.slice(0, 8) });
		}

		if (!isLoading.value && val === null) {
			throw new SystemException('Display not found');
		}
	}
);

watch(
	(): boolean => remoteFormChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);
</script>

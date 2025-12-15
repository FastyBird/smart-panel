<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:monitor"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ display?.name || display?.macAddress }}
		</template>

		<template #subtitle>
			{{ t('displaysModule.breadcrumbs.displays.edit') }}
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
		@click="onSubmit"
	>
		<span class="uppercase">{{ t('displaysModule.buttons.save.title') }}</span>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<div
		v-loading="isLoading || display === null"
		:element-loading-text="t('displaysModule.texts.loadingDisplay')"
		class="flex flex-col overflow-hidden h-full"
	>
		<el-scrollbar
			v-if="display !== null"
			class="grow-1 p-2 md:px-4"
		>
			<display-edit-form
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
					{{ t('displaysModule.buttons.discard.title') }}
				</el-button>
				<el-button
					v-if="!remoteFormChanged"
					link
					class="mr-2"
					@click="onClose"
				>
					{{ t('displaysModule.buttons.close.title') }}
				</el-button>

				<div
					:id="SUBMIT_FORM_SM"
					class="order-2 inline-block [&>*:first-child:not(:only-child)]:hidden"
				>
					<el-button
						:loading="remoteFormResult === FormResult.WORKING"
						:disabled="isLoading || remoteFormResult !== FormResult.NONE"
						type="primary"
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
						{{ t('displaysModule.buttons.save.title') }}
					</el-button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElIcon, ElMessageBox, ElScrollbar, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, SUBMIT_FORM_SM, useBreakpoints, useFlashMessage, useUuid } from '../../../common';
import { DisplayEditForm } from '../components/components';
import { useDisplay } from '../composables/composables';
import { FormResult, type FormResultType, RouteNames } from '../displays.constants';
import { DisplaysApiException, DisplaysException } from '../displays.exceptions';
import type { IDisplay } from '../store/displays.store.types';

import type { IViewDisplayEditProps } from './view-display-edit.types';

defineOptions({
	name: 'ViewDisplayEdit',
	inheritAttrs: false,
});

const props = defineProps<IViewDisplayEditProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { meta } = useMeta({});
const flashMessage = useFlashMessage();

const { validate: validateUuid } = useUuid();

const { isMDDevice, isLGDevice } = useBreakpoints();

// Track if display was previously loaded to detect deletion
const wasDisplayLoaded = ref<boolean>(false);

const displayId = computed(() => props.id);
const { display, isLoading, fetchDisplay } = useDisplay(displayId);

if (!validateUuid(props.id)) {
	throw new Error('Display identifier is not valid');
}

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const isDetailRoute = computed<boolean>(
	(): boolean =>
		route.matched.find((matched) => {
			return matched.name === RouteNames.DISPLAY;
		}) !== undefined
);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		const items = [
			{
				label: t('displaysModule.breadcrumbs.displays.list'),
				route: router.resolve({ name: RouteNames.DISPLAYS }),
			},
		];

		if (isDetailRoute.value) {
			items.push({
				label: t('displaysModule.breadcrumbs.displays.detail', { display: display.value?.name || display.value?.macAddress }),
				route: router.resolve({ name: RouteNames.DISPLAY, params: { id: props.id } }),
			});
			items.push({
				label: t('displaysModule.breadcrumbs.displays.edit'),
				route: router.resolve({ name: RouteNames.DISPLAY_EDIT, params: { id: props.id } }),
			});
		} else {
			items.push({
				label: t('displaysModule.breadcrumbs.displays.edit'),
				route: router.resolve({ name: RouteNames.DISPLAYS_EDIT, params: { id: props.id } }),
			});
		}

		return items;
	}
);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('displaysModule.texts.confirmDiscard'), t('displaysModule.headings.discard'), {
		confirmButtonText: t('displaysModule.buttons.yes.title'),
		cancelButtonText: t('displaysModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			if (isDetailRoute.value) {
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.DISPLAY, params: { id: props.id } });
				} else {
					router.push({ name: RouteNames.DISPLAY, params: { id: props.id } });
				}
			} else {
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.DISPLAYS });
				} else {
					router.push({ name: RouteNames.DISPLAYS });
				}
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
	if (isDetailRoute.value) {
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.DISPLAY, params: { id: props.id } });
		} else {
			router.push({ name: RouteNames.DISPLAY, params: { id: props.id } });
		}
	} else {
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.DISPLAYS });
		} else {
			router.push({ name: RouteNames.DISPLAYS });
		}
	}
};

onBeforeMount(async (): Promise<void> => {
	fetchDisplay()
		.then((): void => {
			if (!isLoading.value && display.value === null && !wasDisplayLoaded.value) {
				throw new DisplaysException('Display not found');
			}
			// Mark as loaded if display was successfully fetched
			if (display.value !== null) {
				wasDisplayLoaded.value = true;
			}
		})
		.catch((error: unknown): void => {
			const err = error as Error;

			if (err instanceof DisplaysApiException && err.code === 404) {
				throw new DisplaysException('Display not found');
			} else {
				throw new DisplaysException('Something went wrong', err);
			}
		});
});

onMounted((): void => {
	emit('update:remote-form-changed', remoteFormChanged.value);
});

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		// Only throw error if display was never loaded (initial load failed)
		if (!val && display.value === null && !wasDisplayLoaded.value) {
			throw new DisplaysException('Display not found');
		}
	}
);

watch(
	(): IDisplay | null => display.value,
	(val: IDisplay | null): void => {
		if (val !== null) {
			wasDisplayLoaded.value = true;
			meta.title = t('displaysModule.meta.displays.edit.title', { display: display.value?.name || display.value?.macAddress });
		} else if (wasDisplayLoaded.value && !isLoading.value) {
			// Display was previously loaded but is now null - it was deleted
			flashMessage.warning(t('displaysModule.messages.deletedWhileEditing'), { duration: 0 });
			// Redirect to displays list
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.DISPLAYS });
			} else {
				router.push({ name: RouteNames.DISPLAYS });
			}
		} else if (!isLoading.value && val === null && !wasDisplayLoaded.value) {
			// Display was never loaded - initial load failed
			throw new DisplaysException('Display not found');
		}
	},
	{ immediate: true },
);

watch(
	(): boolean => remoteFormChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);
</script>

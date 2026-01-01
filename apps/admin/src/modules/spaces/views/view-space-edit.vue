<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				:icon="spaceIcon"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ space?.name }}
		</template>

		<template
			v-if="space?.description !== null"
			#subtitle
		>
			{{ space?.description }}
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
		<span class="uppercase">{{ t('spacesModule.buttons.save.title') }}</span>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<div
		v-loading="isLoading || space === null"
		:element-loading-text="t('spacesModule.texts.loadingSpace')"
		class="flex flex-col overflow-hidden h-full"
	>
		<el-scrollbar
			v-if="space !== null"
			class="grow-1 p-2 md:px-4"
		>
			<space-edit-form
				ref="formRef"
				v-model:remote-form-changed="remoteFormChanged"
				:hide-actions="isMDDevice"
				:space="space"
				@saved="onSaved"
				@cancel="onCancel"
				@manage-devices="onManageDevices"
				@manage-displays="onManageDisplays"
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
					{{ t('spacesModule.buttons.discard.title') }}
				</el-button>
				<el-button
					v-if="!remoteFormChanged"
					link
					class="mr-2"
					@click="onClose"
				>
					{{ t('spacesModule.buttons.close.title') }}
				</el-button>

				<el-button
					type="primary"
					@click="onSubmit"
				>
					{{ t('spacesModule.buttons.save.title') }}
				</el-button>
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

import {
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	useBreakpoints,
	useFlashMessage,
} from '../../../common';
import { SpaceEditForm } from '../components/components';
import { useSpace } from '../composables';
import { RouteNames, SpaceType } from '../spaces.constants';
import type { ISpace } from '../store';

defineOptions({
	inheritAttrs: false,
});

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { meta } = useMeta({});
const flashMessage = useFlashMessage();

const { isMDDevice, isLGDevice } = useBreakpoints();

const spaceId = computed(() => route.params.id as string | undefined);

const { space, fetching, fetchSpace } = useSpace(spaceId);

const isLoading = computed<boolean>(() => fetching.value);

const formRef = ref<InstanceType<typeof SpaceEditForm> | null>(null);
const remoteFormChanged = ref(false);

// Track if space was previously loaded to detect deletion
const wasSpaceLoaded = ref<boolean>(false);

const isDetailRoute = computed<boolean>(
	(): boolean =>
		route.matched.find((matched) => matched.name === RouteNames.SPACE) !== undefined
);

const spaceIcon = computed<string>((): string => {
	if (space.value?.icon) {
		return space.value.icon;
	}
	return space.value?.type === SpaceType.ROOM ? 'mdi:door' : 'mdi:home-floor-1';
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		const items = [
			{
				label: t('spacesModule.breadcrumbs.spaces.list'),
				route: router.resolve({ name: RouteNames.SPACES }),
			},
		];

		if (isDetailRoute.value) {
			items.push({
				label: t('spacesModule.breadcrumbs.spaces.detail', { space: space.value?.name }),
				route: router.resolve({ name: RouteNames.SPACE, params: { id: spaceId.value } }),
			});
			items.push({
				label: t('spacesModule.breadcrumbs.spaces.edit', { space: space.value?.name }),
				route: router.resolve({ name: RouteNames.SPACE_EDIT, params: { id: spaceId.value } }),
			});
		} else {
			items.push({
				label: t('spacesModule.breadcrumbs.spaces.edit', { space: space.value?.name }),
				route: router.resolve({ name: RouteNames.SPACES_EDIT, params: { id: spaceId.value } }),
			});
		}

		return items;
	}
);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('spacesModule.texts.confirmDiscard'), t('spacesModule.headings.discard'), {
		confirmButtonText: t('spacesModule.buttons.yes.title'),
		cancelButtonText: t('spacesModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			if (isDetailRoute.value) {
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.SPACE, params: { id: spaceId.value } });
				} else {
					router.push({ name: RouteNames.SPACE, params: { id: spaceId.value } });
				}
			} else {
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.SPACES });
				} else {
					router.push({ name: RouteNames.SPACES });
				}
			}
		})
		.catch((): void => {
			// Just ignore it
		});
};

const onSubmit = (): void => {
	if (formRef.value) {
		formRef.value.submit();
	}
};

const onClose = (): void => {
	if (isDetailRoute.value) {
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.SPACE, params: { id: spaceId.value } });
		} else {
			router.push({ name: RouteNames.SPACE, params: { id: spaceId.value } });
		}
	} else {
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.SPACES });
		} else {
			router.push({ name: RouteNames.SPACES });
		}
	}
};

const onSaved = (savedSpace: ISpace): void => {
	flashMessage.success(t('spacesModule.messages.edited', { space: savedSpace.name }));

	if (isDetailRoute.value) {
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.SPACE, params: { id: savedSpace.id } });
		} else {
			router.push({ name: RouteNames.SPACE, params: { id: savedSpace.id } });
		}
	} else {
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.SPACES });
		} else {
			router.push({ name: RouteNames.SPACES });
		}
	}
};

const onCancel = (): void => {
	if (isDetailRoute.value) {
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.SPACE, params: { id: spaceId.value } });
		} else {
			router.push({ name: RouteNames.SPACE, params: { id: spaceId.value } });
		}
	} else {
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.SPACES });
		} else {
			router.push({ name: RouteNames.SPACES });
		}
	}
};

const onManageDevices = (): void => {
	router.push({
		name: RouteNames.SPACE,
		params: { id: spaceId.value },
		state: { activeTab: 'devices' },
	});
};

const onManageDisplays = (): void => {
	router.push({
		name: RouteNames.SPACE,
		params: { id: spaceId.value },
		state: { activeTab: 'displays' },
	});
};

onBeforeMount(async (): Promise<void> => {
	await fetchSpace();
	if (!isLoading.value && space.value === null && !wasSpaceLoaded.value) {
		// Space not found
	}
	// Mark as loaded if space was successfully fetched
	if (space.value !== null) {
		wasSpaceLoaded.value = true;
	}
});

onMounted((): void => {
	emit('update:remote-form-changed', remoteFormChanged.value);
});

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		// Only throw error if space was never loaded (initial load failed)
		if (!val && space.value === null && !wasSpaceLoaded.value) {
			// Space not found
		}
	}
);

watch(
	(): ISpace | null => space.value,
	(val: ISpace | null): void => {
		if (val !== null) {
			wasSpaceLoaded.value = true;
			meta.title = t('spacesModule.meta.spaces.edit.title', { space: space.value?.name });
		} else if (wasSpaceLoaded.value && !isLoading.value) {
			// Space was previously loaded but is now null - it was deleted
			flashMessage.warning(t('spacesModule.messages.deletedWhileEditing'));
			// Redirect to spaces list
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.SPACES });
			} else {
				router.push({ name: RouteNames.SPACES });
			}
		} else if (!isLoading.value && val === null && !wasSpaceLoaded.value) {
			// Space was never loaded - initial load failed
			// Space not found
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

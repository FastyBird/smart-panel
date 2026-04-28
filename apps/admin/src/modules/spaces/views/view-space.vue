<template>
	<template v-if="!notFound">
		<app-breadcrumbs :items="breadcrumbs" />

		<app-bar-heading
			v-if="!isMDDevice && isSpaceRoute"
			teleport
		>
			<template #icon>
				<icon
					:icon="spaceIcon"
					class="w[20px] h[20px]"
				/>
			</template>

			<template #title>
				{{ t('spacesModule.headings.detail', { space: space?.name }) }}
			</template>

			<template #subtitle>
				{{ t('spacesModule.subHeadings.detail', { space: space?.name }) }}
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

		<view-header
			:heading="t('spacesModule.headings.detail', { space: space?.name })"
			:sub-heading="t('spacesModule.subHeadings.detail', { space: space?.name })"
			:icon="spaceIcon"
		>
			<template #extra>
				<div class="flex items-center">
					<el-button
						plain
						class="px-4! ml-2!"
						@click="onSpaceEdit"
					>
						<template #icon>
							<icon icon="mdi:pencil" />
						</template>
					</el-button>
				</div>
			</template>
		</view-header>
	</template>

	<entity-not-found
		v-if="notFound"
		icon="mdi:home-group"
		:message="t('spacesModule.messages.notFound')"
		:button-label="t('spacesModule.buttons.back.title')"
		@back="onClose"
	/>

	<div
		v-else-if="isSpaceRoute || isLGDevice"
		v-loading="isLoading || space === null"
		:element-loading-text="t('spacesModule.texts.loadingSpace')"
		class="flex flex-col flex-1 min-h-0 lt-sm:mx-1 sm:mx-2 mb-2"
		:class="[ns.b()]"
	>
		<space-detail
			v-if="space"
			:space="space"
		/>
	</div>

	<router-view
		v-else
		:key="props.id"
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>

	<el-drawer
		v-if="isLGDevice"
		v-model="showDrawer"
		:show-close="false"
		:size="'40%'"
		:with-header="false"
		:before-close="onCloseDrawer"
	>
		<div class="flex flex-col h-full">
			<app-bar menu-button-hidden>
				<template #button-right>
					<app-bar-button
						:align="AppBarButtonAlign.RIGHT"
						class="mr-2"
						@click="() => onCloseDrawer()"
					>
						<template #icon>
							<el-icon>
								<icon icon="mdi:close" />
							</el-icon>
						</template>
					</app-bar-button>
				</template>
			</app-bar>

			<template v-if="showDrawer">
				<view-error>
					<template #icon>
						<icon icon="mdi:home-group" />
					</template>
					<template #message>
						{{ t('spacesModule.messages.loadError') }}
					</template>

					<suspense>
						<router-view
							:key="props.id"
							v-slot="{ Component }"
						>
							<component
								:is="Component"
								v-model:remote-form-changed="remoteFormChanged"
							/>
						</router-view>
					</suspense>
				</view-error>
			</template>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElDrawer, ElIcon, ElMessageBox, useNamespace, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBar,
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	EntityNotFound,
	ViewError,
	ViewHeader,
	useBreakpoints,
	useFlashMessage,
} from '../../../common';
import { SpaceDetail } from '../components/components';
import { useSpace } from '../composables';
import { RouteNames, SpaceRoomCategory, SpaceZoneCategory, getSpaceIcon } from '../spaces.constants';
import { SpacesApiException } from '../spaces.exceptions';
import { type ISpace } from '../store';

import type { IViewSpaceProps } from './view-space.types';

defineOptions({
	name: 'ViewSpace',
});

const props = withDefaults(defineProps<IViewSpaceProps>(), {
	id: undefined,
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { meta } = useMeta({});
const flashMessage = useFlashMessage();

const { isMDDevice, isLGDevice } = useBreakpoints();

const ns = useNamespace('view-space');

const spaceId = computed(() => (props.id || route.params.id) as string | undefined);

const { space, fetching, fetchSpace } = useSpace(spaceId);

const isLoading = computed<boolean>(() => fetching.value);

const wasSpaceLoaded = ref<boolean>(false);
const notFound = ref<boolean>(false);

const showDrawer = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const isSpaceRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.SPACE;
});

const spaceIcon = computed<string>((): string =>
	space.value
		? getSpaceIcon({
				icon: space.value.icon ?? null,
				category: (space.value.category ?? null) as SpaceRoomCategory | SpaceZoneCategory | null,
				type: space.value.type,
			})
		: 'mdi:shape-outline'
);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('spacesModule.breadcrumbs.spaces.list'),
				route: router.resolve({ name: RouteNames.SPACES }),
			},
			{
				label: t('spacesModule.breadcrumbs.spaces.detail', { space: space.value?.name }),
				route: router.resolve({ name: RouteNames.SPACE, params: { id: spaceId.value } }),
			},
		];
	}
);

const onCloseDrawer = (done?: () => void): void => {
	if (remoteFormChanged.value) {
		ElMessageBox.confirm(t('spacesModule.texts.confirmDiscard'), t('spacesModule.headings.discard'), {
			confirmButtonText: t('spacesModule.buttons.yes.title'),
			cancelButtonText: t('spacesModule.buttons.no.title'),
			type: 'warning',
		})
			.then((): void => {
				if (isLGDevice.value) {
					router.replace({
						name: RouteNames.SPACE,
						params: { id: spaceId.value },
					});
				} else {
					router.push({
						name: RouteNames.SPACE,
						params: { id: spaceId.value },
					});
				}

				done?.();
			})
			.catch((): void => {
				// Just ignore it
			});
	} else {
		if (isLGDevice.value) {
			router.replace({
				name: RouteNames.SPACE,
				params: { id: spaceId.value },
			});
		} else {
			router.push({
				name: RouteNames.SPACE,
				params: { id: spaceId.value },
			});
		}

		done?.();
	}
};

const onClose = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SPACES });
	} else {
		router.push({ name: RouteNames.SPACES });
	}
};

const onSpaceEdit = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SPACE_EDIT, params: { id: spaceId.value } });
	} else {
		router.push({ name: RouteNames.SPACE_EDIT, params: { id: spaceId.value } });
	}
};

onBeforeMount(async (): Promise<void> => {
	try {
		await fetchSpace();
	} catch (error: unknown) {
		if (error instanceof SpacesApiException && error.code === 404) {
			notFound.value = true;
		} else {
			flashMessage.error(t('spacesModule.messages.notLoaded'));
			notFound.value = true;
		}

		return;
	}

	if (!isLoading.value && space.value === null && !wasSpaceLoaded.value) {
		notFound.value = true;
	}

	if (space.value !== null) {
		wasSpaceLoaded.value = true;
	}

	showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.SPACE_EDIT) !== undefined;
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.SPACE_EDIT) !== undefined;
	}
);

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		if (!val && space.value === null && !wasSpaceLoaded.value) {
			notFound.value = true;
		}
	}
);

watch(
	(): ISpace | null => space.value,
	(val: ISpace | null): void => {
		if (val !== null) {
			wasSpaceLoaded.value = true;
			meta.title = t('spacesModule.meta.spaces.detail.title', { space: space.value?.name });
		} else if (wasSpaceLoaded.value && !isLoading.value) {
			flashMessage.warning(t('spacesModule.messages.deletedWhileEditing'), { duration: 0 });

			if (isLGDevice.value) {
				router.replace({ name: RouteNames.SPACES });
			} else {
				router.push({ name: RouteNames.SPACES });
			}
		} else if (!isLoading.value && val === null && !wasSpaceLoaded.value) {
			notFound.value = true;
		}
	}
);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'view-space.scss';
</style>

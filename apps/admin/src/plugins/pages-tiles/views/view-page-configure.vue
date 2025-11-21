<template>
	<teleport
		v-if="mounted"
		to="#page-manage-actions"
	>
		<el-dropdown trigger="click">
			<el-button
				plain
				class="px-4! ml-2!"
			>
				<template #icon>
					<icon icon="mdi:package-variant-closed" />
				</template>
				{{ t('pagesTilesPlugin.buttons.manageElements.title') }}
			</el-button>

			<template #dropdown>
				<el-dropdown-menu>
					<el-dropdown-item @click="onTileAdd">
						<template #icon>
							<icon icon="mdi:plus" />
						</template>
						{{ t('pagesTilesPlugin.buttons.addPageTile.title') }}
					</el-dropdown-item>

					<el-dropdown-item @click="onPageDataSourceAdd">
						<template #icon>
							<icon icon="mdi:plus" />
						</template>
						{{ t('pagesTilesPlugin.buttons.addPageDataSource.title') }}
					</el-dropdown-item>
				</el-dropdown-menu>
			</template>
		</el-dropdown>

		<el-button
			v-if="remotePageChanged"
			plain
			class="px-4! ml-2!"
			@click="onDiscard"
		>
			<template #icon>
				<icon icon="mdi:close" />
			</template>
			{{ t('pagesTilesPlugin.buttons.discard.title') }}
		</el-button>

		<el-button
			v-if="!remotePageChanged"
			plain
			class="px-4! ml-2!"
			@click="onClose"
		>
			<template #icon>
				<icon icon="mdi:close" />
			</template>
			{{ t('pagesTilesPlugin.buttons.close.title') }}
		</el-button>

		<el-button
			type="primary"
			plain
			:disabled="remotePageChanged === false"
			class="px-4! ml-2!"
			@click="onSave"
		>
			<template #icon>
				<icon icon="mdi:content-save" />
			</template>
			{{ t('pagesTilesPlugin.buttons.save.title') }}
		</el-button>
	</teleport>

	<page-configure
		v-if="page"
		v-model:remote-page-submit="remotePageSubmit"
		v-model:remote-page-changed="remotePageChanged"
		:page="page"
		@add-tile="onTileAdd"
		@edit-tile="onTileEdit"
		@tile-detail="onTileDetail"
	/>

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
						<icon icon="mdi:power-plug" />
					</template>
					<template #message>
						{{ t('pagesTilesPlugin.messages.misc.requestError') }}
					</template>

					<suspense>
						<router-view
							:key="`${props.page.id}-${page?.id}`"
							v-slot="{ Component }"
						>
							<component
								:is="Component"
								v-model:remote-form-changed="remoteFormChanged"
								:page="page"
							/>
						</router-view>
					</suspense>
				</view-error>
			</template>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import { onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { ElButton, ElDrawer, ElDropdown, ElDropdownItem, ElDropdownMenu, ElIcon, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, ViewError, useBreakpoints } from '../../../common';
import { RouteNames as DashboardRouteNames, type ITile } from '../../../modules/dashboard';
import PageConfigure from '../components/page-configure.vue';
import { RouteNames } from '../pages-tiles.constants';

import type { IViewPageConfigureProps } from './view-page-configure.types';

defineOptions({
	name: 'ViewPageConfigure',
});

const props = defineProps<IViewPageConfigureProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
	(e: 'update:remote-page-changed', pageChanged: boolean): void;
}>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const { isLGDevice } = useBreakpoints();

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);
const remotePageSubmit = ref<boolean>(false);
const remotePageChanged = ref<boolean>(false);

const onClose = (): void => {
	router.push({
		name: DashboardRouteNames.PAGES,
	});
};

const onDiscard = (): void => {
	ElMessageBox.confirm(t('pagesTilesPlugin.texts.misc.confirmDiscard'), t('pagesTilesPlugin.headings.misc.discard'), {
		confirmButtonText: t('pagesTilesPlugin.buttons.yes.title'),
		cancelButtonText: t('pagesTilesPlugin.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			router.push({
				name: DashboardRouteNames.PAGES,
			});
		})
		.catch((): void => {
			// Just ignore it
		});
};

const onSave = (): void => {
	remotePageSubmit.value = true;
};

const onTileAdd = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.PAGE_ADD_TILE,
			params: {
				id: props.page.id,
			},
		});
	} else {
		router.push({
			name: RouteNames.PAGE_ADD_TILE,
			params: {
				id: props.page.id,
			},
		});
	}
};

const onTileEdit = (id: ITile['id']): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.PAGE_EDIT_TILE,
			params: {
				id: props.page.id,
				tileId: id,
			},
		});
	} else {
		router.push({
			name: RouteNames.PAGE_EDIT_TILE,
			params: {
				id: props.page.id,
				tileId: id,
			},
		});
	}
};

const onTileDetail = (id: ITile['id']): void => {
	router.push({
		name: DashboardRouteNames.TILE,
		params: {
			id,
		},
	});
};

const onPageDataSourceAdd = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.PAGE_ADD_DATA_SOURCE,
			params: {
				id: props.page.id,
			},
		});
	} else {
		router.push({
			name: RouteNames.PAGE_ADD_DATA_SOURCE,
			params: {
				id: props.page.id,
			},
		});
	}
};

const onCloseDrawer = (done?: () => void): void => {
	if (remoteFormChanged.value) {
		ElMessageBox.confirm(t('pagesTilesPlugin.texts.misc.confirmDiscard'), t('pagesTilesPlugin.headings.misc.discard'), {
			confirmButtonText: t('pagesTilesPlugin.buttons.yes.title'),
			cancelButtonText: t('pagesTilesPlugin.buttons.no.title'),
			type: 'warning',
		})
			.then((): void => {
				if (isLGDevice.value) {
					router.replace({
						name: RouteNames.PAGE,
						params: {
							id: props.page.id,
						},
					});
				} else {
					router.push({
						name: RouteNames.PAGE,
						params: {
							id: props.page.id,
						},
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
				name: RouteNames.PAGE,
				params: {
					id: props.page.id,
				},
			});
		} else {
			router.push({
				name: RouteNames.PAGE,
				params: {
					id: props.page.id,
				},
			});
		}

		done?.();
	}
};

onBeforeMount((): void => {
	showDrawer.value =
		route.matched.find(
			(matched) =>
				matched.name === RouteNames.PAGE_ADD_TILE ||
				matched.name === RouteNames.PAGE_EDIT_TILE ||
				matched.name === RouteNames.PAGE_ADD_DATA_SOURCE ||
				matched.name === RouteNames.PAGE_EDIT_DATA_SOURCE
		) !== undefined;
});

onMounted((): void => {
	mounted.value = true;

	emit('update:remote-form-changed', remoteFormChanged.value);
	emit('update:remote-page-changed', remotePageChanged.value);
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value =
			route.matched.find(
				(matched) =>
					matched.name === RouteNames.PAGE_ADD_TILE ||
					matched.name === RouteNames.PAGE_EDIT_TILE ||
					matched.name === RouteNames.PAGE_ADD_DATA_SOURCE ||
					matched.name === RouteNames.PAGE_EDIT_DATA_SOURCE
			) !== undefined;
	}
);

watch(
	(): boolean => remoteFormChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);

watch(
	(): boolean => remotePageChanged.value,
	(val: boolean): void => {
		emit('update:remote-page-changed', val);
	}
);
</script>

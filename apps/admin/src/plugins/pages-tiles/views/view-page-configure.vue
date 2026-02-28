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
					<el-dropdown-item @click="() => onTileAdd()">
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
		:grid-layout="gridLayout"
		:grid-card-style="gridCardStyle"
		:displays="applicableDisplays"
		:selected-display="selectedDisplay"
		@select-display="onDisplaySelect"
		@add-tile-of-type="onTileAdd"
		@add-page-data-source="onPageDataSourceAdd"
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
						<icon icon="mdi:devices" />
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
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { ElButton, ElDrawer, ElDropdown, ElDropdownItem, ElDropdownMenu, ElIcon, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, ViewError, useBreakpoints } from '../../../common';
import { RouteNames as DashboardRouteNames, type ITile } from '../../../modules/dashboard';
import { type IDisplay, useDisplays } from '../../../modules/displays';
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

const { displays, fetchDisplays, isLoading: loadingDisplays } = useDisplays();

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);
const remotePageSubmit = ref<boolean>(false);
const remotePageChanged = ref<boolean>(false);

const selectedDisplayId = ref<string | null>(null);

const applicableDisplays = computed<IDisplay[]>((): IDisplay[] => {
	if (props.page.displays !== null && props.page.displays.length > 0) {
		return displays.value.filter((d) => props.page.displays!.includes(d.id));
	}

	return displays.value;
});

const selectedDisplay = computed<IDisplay | null>((): IDisplay | null => {
	if (selectedDisplayId.value) {
		return applicableDisplays.value.find((d) => d.id === selectedDisplayId.value) ?? applicableDisplays.value[0] ?? null;
	}

	return applicableDisplays.value[0] ?? null;
});

const gridLayout = computed<{ rows: number; cols: number } | null>((): { rows: number; cols: number } | null => {
	if (selectedDisplay.value === null) {
		return null;
	}

	const rows = props.page.rows ?? selectedDisplay.value.rows ?? 12;
	const cols = props.page.cols ?? selectedDisplay.value.cols ?? 24;

	return { rows, cols };
});

const gridCardStyle = computed<Record<string, string>>((): Record<string, string> => {
	const display = selectedDisplay.value;

	if (!display || !display.screenWidth) {
		return { maxWidth: '540px' };
	}

	return {
		maxWidth: `${Math.min(display.screenWidth, 600)}px`,
	};
});

const onDisplaySelect = (displayId: string): void => {
	selectedDisplayId.value = displayId;
};

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

const onTileAdd = (tileType?: string): void => {
	const location = {
		name: RouteNames.PAGE_ADD_TILE,
		params: {
			id: props.page.id,
		},
		...(tileType ? { query: { tileType } } : {}),
	};

	if (isLGDevice.value) {
		router.replace(location);
	} else {
		router.push(location);
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

	if (!loadingDisplays.value) {
		fetchDisplays().catch((): void => {
			// Silently ignore display fetch errors
		});
	}
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

watch(
	(): IDisplay[] => applicableDisplays.value,
	(val: IDisplay[]): void => {
		const first = val[0];

		if (!first) {
			selectedDisplayId.value = null;

			return;
		}

		if (!selectedDisplayId.value || !val.some((d) => d.id === selectedDisplayId.value)) {
			selectedDisplayId.value = first.id;
		}
	},
	{ immediate: true }
);
</script>

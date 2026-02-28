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
				{{ t('pagesCardsPlugin.buttons.manageElements.title') }}
			</el-button>

			<template #dropdown>
				<el-dropdown-menu>
					<el-dropdown-item @click="onCardAdd">
						<template #icon>
							<icon icon="mdi:plus" />
						</template>
						{{ t('pagesCardsPlugin.buttons.addCard.title') }}
					</el-dropdown-item>

					<el-dropdown-item @click="onPageDataSourceAdd">
						<template #icon>
							<icon icon="mdi:plus" />
						</template>
						{{ t('pagesCardsPlugin.buttons.addPageDataSource.title') }}
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
			{{ t('pagesCardsPlugin.buttons.discard.title') }}
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
			{{ t('pagesCardsPlugin.buttons.close.title') }}
		</el-button>

		<el-button
			type="primary"
			plain
			:loading="remotePageResult === FormResult.WORKING"
			:disabled="remotePageChanged === false || remotePageResult === FormResult.WORKING"
			class="px-4! ml-2!"
			@click="onSave"
		>
			<template #icon>
				<icon icon="mdi:content-save" />
			</template>
			{{ t('pagesCardsPlugin.buttons.save.title') }}
		</el-button>
	</teleport>

	<page-configure
		v-if="page"
		v-model:remote-page-submit="remotePageSubmit"
		v-model:remote-page-result="remotePageResult"
		v-model:remote-page-changed="remotePageChanged"
		:page="page"
		:cards="cards"
		:grid-layout="gridLayout"
		:grid-card-style="gridCardStyle"
		:displays="applicableDisplays"
		:selected-display="selectedDisplay"
		@select-display="onDisplaySelect"
		@add-card="onCardAdd"
		@edit-card="onCardEdit"
		@remove-card="onCardRemove"
		@add-tile="onTileAdd"
		@edit-tile="onTileEdit"
		@tile-detail="onTileDetail"
		@add-page-data-source="onPageDataSourceAdd"
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
						{{ t('pagesCardsPlugin.messages.misc.requestError') }}
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

	<el-dialog
		v-if="!isLGDevice"
		v-model="showDrawer"
		:show-close="false"
		:close-on-click-modal="false"
		:close-on-press-escape="false"
		fullscreen
	>
		<template #header>
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
		</template>

		<view-error>
			<template #icon>
				<icon icon="mdi:devices" />
			</template>
			<template #message>
				{{ t('pagesCardsPlugin.messages.misc.requestError') }}
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
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { ElButton, ElDialog, ElDrawer, ElDropdown, ElDropdownItem, ElDropdownMenu, ElIcon, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, ViewError, useBreakpoints } from '../../../common';
import { FormResult, type FormResultType, RouteNames as DashboardRouteNames, type ITile } from '../../../modules/dashboard';
import { type IDisplay, useDisplays } from '../../../modules/displays';
import PageConfigure from '../components/page-configure.vue';
import { useCards } from '../composables/useCards';
import { useCardsActions } from '../composables/useCardsActions';
import { RouteNames } from '../pages-cards.contants';
import type { ICard } from '../store/cards.store.types';

import type { IViewPageConfigureProps } from './view-page-configure.types';

defineOptions({
	name: 'ViewCardsPageConfigure',
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

const { cards, fetchCards, areLoading: loadingCards } = useCards({ pageId: props.page.id });
const { remove: removeCard } = useCardsActions();

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);
const remotePageSubmit = ref<boolean>(false);
const remotePageResult = ref<FormResultType>(FormResult.NONE);
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

	const rows = selectedDisplay.value.rows ?? 12;
	const cols = selectedDisplay.value.cols ?? 24;

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
	ElMessageBox.confirm(t('pagesCardsPlugin.texts.misc.confirmDiscard'), t('pagesCardsPlugin.headings.misc.discard'), {
		confirmButtonText: t('pagesCardsPlugin.buttons.yes.title'),
		cancelButtonText: t('pagesCardsPlugin.buttons.no.title'),
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

const onCardAdd = (): void => {
	const location = {
		name: RouteNames.PAGE_ADD_CARD,
		params: {
			id: props.page.id,
		},
	};

	if (isLGDevice.value) {
		router.replace(location);
	} else {
		router.push(location);
	}
};

const onCardEdit = (id: ICard['id']): void => {
	const location = {
		name: RouteNames.PAGE_EDIT_CARD,
		params: {
			id: props.page.id,
			cardId: id,
		},
	};

	if (isLGDevice.value) {
		router.replace(location);
	} else {
		router.push(location);
	}
};

const onCardRemove = (id: ICard['id']): void => {
	removeCard(id);
};

const onTileAdd = (cardId: ICard['id']): void => {
	const location = {
		name: RouteNames.PAGE_CARD_ADD_TILE,
		params: {
			id: props.page.id,
			cardId,
		},
	};

	if (isLGDevice.value) {
		router.replace(location);
	} else {
		router.push(location);
	}
};

const onTileEdit = (tileId: ITile['id'], cardId: ICard['id']): void => {
	const location = {
		name: RouteNames.PAGE_CARD_EDIT_TILE,
		params: {
			id: props.page.id,
			cardId,
			tileId,
		},
	};

	if (isLGDevice.value) {
		router.replace(location);
	} else {
		router.push(location);
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
	const location = {
		name: RouteNames.PAGE_ADD_DATA_SOURCE,
		params: {
			id: props.page.id,
		},
	};

	if (isLGDevice.value) {
		router.replace(location);
	} else {
		router.push(location);
	}
};

const onCloseDrawer = (done?: () => void): void => {
	if (remoteFormChanged.value) {
		ElMessageBox.confirm(t('pagesCardsPlugin.texts.misc.confirmDiscard'), t('pagesCardsPlugin.headings.misc.discard'), {
			confirmButtonText: t('pagesCardsPlugin.buttons.yes.title'),
			cancelButtonText: t('pagesCardsPlugin.buttons.no.title'),
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
				matched.name === RouteNames.PAGE_ADD_CARD ||
				matched.name === RouteNames.PAGE_EDIT_CARD ||
				matched.name === RouteNames.PAGE_CARD_ADD_TILE ||
				matched.name === RouteNames.PAGE_CARD_EDIT_TILE ||
				matched.name === RouteNames.PAGE_ADD_DATA_SOURCE ||
				matched.name === RouteNames.PAGE_EDIT_DATA_SOURCE
		) !== undefined;

	if (!loadingDisplays.value) {
		fetchDisplays().catch((): void => {
			// Silently ignore display fetch errors
		});
	}

	if (!loadingCards.value) {
		fetchCards().catch((): void => {
			// Silently ignore card fetch errors
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
					matched.name === RouteNames.PAGE_ADD_CARD ||
					matched.name === RouteNames.PAGE_EDIT_CARD ||
					matched.name === RouteNames.PAGE_CARD_ADD_TILE ||
					matched.name === RouteNames.PAGE_CARD_EDIT_TILE ||
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

<template>
	<!-- Phone: a card, tile or data source form is its own page -->
	<router-view
		v-if="isFormRoute && !inDrawer"
		:key="formKey"
		v-slot="{ Component }"
	>
		<component
			:is="Component"
			v-model:remote-form-changed="remoteFormChanged"
			:page="props.page"
		/>
	</router-view>

	<!-- Template 4: the card, tile and data source forms open next to the editor from tablet portrait up -->
	<edit-drawer-layout
		v-else
		:open="isFormRoute"
		:before-close="onCloseDrawer"
		class="h-full"
		@close="onCloseDrawer()"
	>
		<div
			class="cards-editor flex flex-col flex-1 min-h-0 overflow-hidden"
			data-test-id="cards-editor"
		>
			<div class="cards-editor__bar flex flex-row flex-wrap items-center gap-2 px-3 py-2">
				<el-button
					type="primary"
					plain
					class="ml-0!"
					data-test-id="cards-editor-add-card"
					@click="onCardAdd"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>
					{{ t('pagesCardsPlugin.buttons.addCard.title') }}
				</el-button>

				<el-button
					class="ml-0!"
					data-test-id="cards-editor-add-data-source"
					@click="onPageDataSourceAdd"
				>
					<template #icon>
						<icon icon="mdi:database-plus-outline" />
					</template>
					{{ t('pagesCardsPlugin.buttons.addPageDataSource.title') }}
				</el-button>

				<el-tag
					v-if="remotePageChanged"
					type="warning"
					disable-transitions
					data-test-id="cards-editor-unsaved"
				>
					{{ t('pagesCardsPlugin.editor.texts.unsaved') }}
				</el-tag>

				<div class="grow-1" />

				<el-button
					v-if="remotePageChanged"
					class="ml-0!"
					:disabled="saving"
					data-test-id="cards-editor-discard"
					@click="onDiscard"
				>
					{{ t('pagesCardsPlugin.buttons.discard.title') }}
				</el-button>

				<el-button
					v-else
					class="ml-0!"
					data-test-id="cards-editor-close"
					@click="onClose"
				>
					{{ t('pagesCardsPlugin.buttons.close.title') }}
				</el-button>

				<el-button
					type="primary"
					class="ml-0!"
					:loading="saving"
					:disabled="!remotePageChanged || saving"
					data-test-id="cards-editor-save"
					@click="onSave"
				>
					{{ t('pagesCardsPlugin.buttons.save.title') }}
				</el-button>
			</div>

			<page-configure
				:key="configureKey"
				v-model:remote-page-submit="remotePageSubmit"
				v-model:remote-page-result="remotePageResult"
				v-model:remote-page-changed="remotePageChanged"
				:page="props.page"
				:cards="cards"
				:grid-layout="gridLayout"
				:grid-card-style="gridCardStyle"
				:displays="applicableDisplays"
				:selected-display="selectedDisplay"
				class="flex-1 min-h-0"
				@select-display="onDisplaySelect"
				@add-card="onCardAdd"
				@edit-card="onCardEdit"
				@remove-card="onCardRemove"
				@add-tile="onTileAdd"
				@edit-tile="onTileEdit"
				@tile-detail="onTileDetail"
				@add-page-data-source="onPageDataSourceAdd"
				@edit-page-data-source="onPageDataSourceEdit"
			/>
		</div>

		<template #form>
			<!-- Keyed like the form: an error caught in one form does not stay over the next one -->
			<view-error :key="formKey">
				<template #icon>
					<icon icon="mdi:card-text-outline" />
				</template>
				<template #message>
					{{ t('pagesCardsPlugin.messages.misc.requestError') }}
				</template>

				<suspense>
					<router-view
						:key="formKey"
						v-slot="{ Component }"
					>
						<component
							:is="Component"
							v-model:remote-form-changed="remoteFormChanged"
							:page="props.page"
						/>
					</router-view>
				</suspense>
			</view-error>
		</template>
	</edit-drawer-layout>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { type RouteLocationNormalized, onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';

import { ElButton, ElMessageBox, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { EditDrawerLayout, ViewError, provideEditDrawer, useFlashMessage } from '../../../common';
import { RouteNames as DashboardRouteNames, FormResult, type FormResultType, type IDataSource, type ITile } from '../../../modules/dashboard';
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

const FORM_ROUTES: string[] = [
	RouteNames.PAGE_ADD_CARD,
	RouteNames.PAGE_EDIT_CARD,
	RouteNames.PAGE_CARD_ADD_TILE,
	RouteNames.PAGE_CARD_EDIT_TILE,
	RouteNames.PAGE_ADD_DATA_SOURCE,
	RouteNames.PAGE_EDIT_DATA_SOURCE,
];

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const flashMessage = useFlashMessage();

const { displays, fetchDisplays, isLoading: loadingDisplays } = useDisplays();

const { cards, fetchCards, areLoading: loadingCards } = useCards({ pageId: props.page.id });
const { remove: removeCard } = useCardsActions();

const remoteFormChanged = ref<boolean>(false);
const remotePageSubmit = ref<boolean>(false);
const remotePageResult = ref<FormResultType>(FormResult.NONE);
const remotePageChanged = ref<boolean>(false);

const selectedDisplayId = ref<string | null>(null);

// A new key remounts the canvas from the saved layout: a confirmed discard drops every pending move and removal
const configureKey = ref<number>(0);

// Leaving the editor asks first while the layout has changes; Discard and a save let it go
let allowLeave = false;

const isFormRoute = computed<boolean>((): boolean => route.matched.some((matched) => FORM_ROUTES.includes(String(matched.name))));

// Template 4: the forms open next to the editor from tablet portrait up, as their own page on phone
const { inDrawer } = provideEditDrawer((): boolean => isFormRoute.value);

// One form per card, tile and data source (and one for each Add): a new key remounts the routed form
const formKeyOf = (location: RouteLocationNormalized): string => {
	const param = (name: string): string => (typeof location.params?.[name] === 'string' ? (location.params[name] as string) : '');
	const tileType = typeof location.query?.tileType === 'string' ? location.query.tileType : '';

	return `${String(location.name)}:${param('cardId')}:${param('tileId')}:${param('dataSourceId')}:${tileType}`;
};

const formKey = computed<string>((): string => formKeyOf(route));

const saving = computed<boolean>((): boolean => remotePageResult.value === FormResult.WORKING);

const applicableDisplays = computed<IDisplay[]>((): IDisplay[] => {
	if (props.page.displays !== null && props.page.displays.length > 0) {
		return displays.value.filter((d) => props.page.displays!.includes(d.id));
	}

	return displays.value;
});

const selectedDisplay = computed<IDisplay | null>((): IDisplay | null => {
	return applicableDisplays.value.find((d) => d.id === selectedDisplayId.value) ?? applicableDisplays.value[0] ?? null;
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

const confirmDiscard = async (): Promise<boolean> => {
	try {
		await ElMessageBox.confirm(t('pagesCardsPlugin.texts.misc.confirmDiscard'), t('pagesCardsPlugin.headings.misc.discard'), {
			confirmButtonText: t('dashboardModule.buttons.discard.title'),
			cancelButtonText: t('dashboardModule.buttons.keepEditing.title'),
			type: 'warning',
		});

		return true;
	} catch {
		return false;
	}
};

const navigate = (to: { name: string; params: Record<string, string>; query?: Record<string, string> }): void => {
	if (inDrawer.value) {
		router.replace(to);
	} else {
		router.push(to);
	}
};

// Next to an open form the editor stays usable: replacing a changed form asks first, as closing it does
// A confirmed discard lets the form go here, so the route guard below does not ask a second time
const discardForm = async (): Promise<boolean> => {
	if (!(await confirmDiscard())) {
		return false;
	}

	remoteFormChanged.value = false;

	return true;
};

const canReplaceOpenForm = async (): Promise<boolean> => !isFormRoute.value || !remoteFormChanged.value || discardForm();

// On phone a form is its own page and replaces the editor, whose grids hold the only copy of unsaved layout changes
const canOpenForm = async (): Promise<boolean> => {
	if (!inDrawer.value && remotePageChanged.value) {
		if (!(await confirmDiscard())) {
			return false;
		}

		// The editor goes away with its changes; it comes back with the saved layout
		remotePageChanged.value = false;

		return true;
	}

	return canReplaceOpenForm();
};

const gridOf = (display: IDisplay | null): string => (display ? `${display.rows ?? 12}x${display.cols ?? 24}` : '');

// A display with another grid rebuilds the cards from the saved layout, so unsaved changes are asked about first; a
// display with the same grid only changes the theme and keeps them
const onDisplaySelect = async (displayId: string): Promise<void> => {
	const next = applicableDisplays.value.find((display) => display.id === displayId) ?? null;

	if (remotePageChanged.value && gridOf(next) !== gridOf(selectedDisplay.value)) {
		if (!(await confirmDiscard())) {
			return;
		}

		remotePageChanged.value = false;
		configureKey.value++;
	}

	selectedDisplayId.value = displayId;
};

const onClose = (): void => {
	router.push({ name: DashboardRouteNames.PAGES });
};

const onDiscard = async (): Promise<void> => {
	if (!(await confirmDiscard())) {
		return;
	}

	allowLeave = true;

	router.push({ name: DashboardRouteNames.PAGES });
};

const onSave = (): void => {
	remotePageSubmit.value = true;
};

const onCardAdd = async (): Promise<void> => {
	if (route.name === RouteNames.PAGE_ADD_CARD || !(await canOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE_ADD_CARD, params: { id: props.page.id } });
};

const onCardEdit = async (id: ICard['id']): Promise<void> => {
	if ((route.name === RouteNames.PAGE_EDIT_CARD && route.params.cardId === id) || !(await canOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE_EDIT_CARD, params: { id: props.page.id, cardId: id } });
};

const onCardRemove = (id: ICard['id']): void => {
	removeCard(id);
};

const onTileAdd = async (cardId: ICard['id']): Promise<void> => {
	if ((route.name === RouteNames.PAGE_CARD_ADD_TILE && route.params.cardId === cardId) || !(await canOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE_CARD_ADD_TILE, params: { id: props.page.id, cardId } });
};

const onTileEdit = async (tileId: ITile['id'], cardId: ICard['id']): Promise<void> => {
	if ((route.name === RouteNames.PAGE_CARD_EDIT_TILE && route.params.tileId === tileId) || !(await canOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE_CARD_EDIT_TILE, params: { id: props.page.id, cardId, tileId } });
};

const onTileDetail = (id: ITile['id']): void => {
	router.push({ name: DashboardRouteNames.TILE, params: { id } });
};

const onPageDataSourceAdd = async (): Promise<void> => {
	if (route.name === RouteNames.PAGE_ADD_DATA_SOURCE || !(await canOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE_ADD_DATA_SOURCE, params: { id: props.page.id } });
};

const onPageDataSourceEdit = async (dataSourceId: IDataSource['id']): Promise<void> => {
	if ((route.name === RouteNames.PAGE_EDIT_DATA_SOURCE && route.params.dataSourceId === dataSourceId) || !(await canOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE_EDIT_DATA_SOURCE, params: { id: props.page.id, dataSourceId } });
};

const onCloseDrawer = async (done?: () => void): Promise<void> => {
	if (remoteFormChanged.value && !(await discardForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE, params: { id: props.page.id } });

	done?.();
};

// Back, a breadcrumb or a link that closes or replaces a changed form while staying in the editor asks first; the
// editor's own buttons and the form's Discard and Save have already let the form go
onBeforeRouteUpdate(async (to: RouteLocationNormalized): Promise<boolean> => {
	// On phone a form replaces the editor, whose grids hold the only copy of unsaved layout changes. The editor's own
	// buttons have asked already (and cleared the flag); Back, Forward or a link have not
	const toForm = to.matched.some((matched) => FORM_ROUTES.includes(String(matched.name)));

	if (toForm && !inDrawer.value && !isFormRoute.value && remotePageChanged.value) {
		if (!(await confirmDiscard())) {
			return false;
		}

		remotePageChanged.value = false;

		return true;
	}

	if (!remoteFormChanged.value || formKeyOf(to) === formKey.value) {
		return true;
	}

	return discardForm();
});

onBeforeRouteLeave(async (): Promise<boolean> => {
	// An open form with changes counts too: leaving the editor closes it
	if (allowLeave || (!remotePageChanged.value && !remoteFormChanged.value)) {
		return true;
	}

	return confirmDiscard();
});

onBeforeMount((): void => {
	if (!loadingDisplays.value) {
		fetchDisplays().catch((): void => {
			// Silently ignore display fetch errors
		});
	}

	if (!loadingCards.value) {
		fetchCards().catch((): void => {
			flashMessage.error(t('pagesCardsPlugin.messages.misc.requestError'));
		});
	}
});

// The changed flag belongs to the form that is open. Any route change that replaces or closes it clears the flag
// before the next form mounts, so that one starts clean. A declined discard leaves the route, and the flag, as it was
watch(formKey, (): void => {
	remoteFormChanged.value = false;
});

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
	(): FormResultType => remotePageResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			flashMessage.success(t('pagesCardsPlugin.editor.messages.saved'));
		} else if (val === FormResult.ERROR) {
			flashMessage.error(t('pagesCardsPlugin.editor.messages.saveFailed'));
		} else {
			return;
		}

		remotePageResult.value = FormResult.NONE;
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

<style scoped lang="scss">
.cards-editor {
	border: 1px solid var(--el-border-color);
	border-radius: var(--el-border-radius-base);
	background-color: var(--el-bg-color);

	&__bar {
		flex: none;
		border-bottom: 1px solid var(--el-border-color);
	}
}
</style>

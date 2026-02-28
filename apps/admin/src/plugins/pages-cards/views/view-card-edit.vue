<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:card-text-outline"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('pagesCardsPlugin.headings.pages.editCard') }}
		</template>

		<template #subtitle>
			{{ t('pagesCardsPlugin.subHeadings.pages.editCard') }}
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
		<span class="uppercase">{{ t('pagesCardsPlugin.buttons.update.title') }}</span>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<div
		v-loading="isLoading || card === null"
		:element-loading-text="t('pagesCardsPlugin.texts.cards.loadingCard')"
		class="flex flex-col overflow-hidden h-full"
	>
		<el-scrollbar
			v-if="card !== null"
			class="grow-1 p-2 md:px-4"
		>
			<card-edit-form
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:card="card"
				:page="props.page"
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
					{{ t('pagesCardsPlugin.buttons.discard.title') }}
				</el-button>
				<el-button
					v-if="!remoteFormChanged"
					link
					class="mr-2"
					@click="onClose"
				>
					{{ t('pagesCardsPlugin.buttons.close.title') }}
				</el-button>

				<el-button
					:loading="remoteFormResult === FormResult.WORKING"
					:disabled="remoteFormResult !== FormResult.NONE || !remoteFormChanged"
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
					{{ t('pagesCardsPlugin.buttons.update.title') }}
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

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, useBreakpoints, useFlashMessage, useUuid } from '../../../common';
import {
	DashboardApiException,
	DashboardException,
	RouteNames as DashboardRouteNames,
	FormResult,
	type FormResultType,
} from '../../../modules/dashboard';
import CardEditForm from '../components/card-edit-form.vue';
import { useCard } from '../composables/useCard';
import { RouteNames } from '../pages-cards.contants';
import type { ICard } from '../store/cards.store.types';

import type { IViewCardEditProps } from './view-card-edit.types';

defineOptions({
	name: 'ViewPageCardEdit',
});

const props = defineProps<IViewCardEditProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const router = useRouter();
const { t } = useI18n();
const flashMessage = useFlashMessage();

useMeta({
	title: t('pagesCardsPlugin.meta.pages.editCard.title'),
});

const { validate: validateUuid } = useUuid();

const { isMDDevice, isLGDevice } = useBreakpoints();

const { card, isLoading, fetchCard } = useCard({ id: props.id, pageId: props.page.id });

const wasCardLoaded = ref<boolean>(false);

if (!validateUuid(props.id)) {
	throw new Error('Element identifier is not valid');
}

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		const items = [];

		items.push({
			label: t('dashboardModule.breadcrumbs.pages.list'),
			route: router.resolve({ name: DashboardRouteNames.PAGES }),
		});
		items.push({
			label: t('dashboardModule.breadcrumbs.pages.detail', { page: props.page?.title }),
			route: router.resolve({ name: DashboardRouteNames.PAGE, params: { id: props.page?.id } }),
		});
		items.push({
			label: t('pagesCardsPlugin.breadcrumbs.pages.configure', { page: props.page?.title }),
			route: router.resolve({ name: RouteNames.PAGE, params: { id: props.page?.id } }),
		});
		items.push({
			label: t('pagesCardsPlugin.breadcrumbs.pages.editCard', { page: props.page?.title }),
			route: router.resolve({ name: RouteNames.PAGE_EDIT_CARD, params: { id: props.page?.id, cardId: card.value?.id } }),
		});

		return items;
	}
);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('pagesCardsPlugin.texts.misc.confirmDiscard'), t('pagesCardsPlugin.headings.misc.discard'), {
		confirmButtonText: t('pagesCardsPlugin.buttons.yes.title'),
		cancelButtonText: t('pagesCardsPlugin.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.PAGE, params: { id: props.page?.id } });
			} else {
				router.push({ name: RouteNames.PAGE, params: { id: props.page?.id } });
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
		router.replace({ name: RouteNames.PAGE, params: { id: props.page?.id } });
	} else {
		router.push({ name: RouteNames.PAGE, params: { id: props.page?.id } });
	}
};

onBeforeMount(async (): Promise<void> => {
	fetchCard()
		.then((): void => {
			if (card.value !== null) {
				wasCardLoaded.value = true;
			}
			if (!isLoading.value && card.value === null && !wasCardLoaded.value) {
				throw new DashboardException('Card not found');
			}
		})
		.catch((error: unknown): void => {
			const err = error as Error;

			if (err instanceof DashboardApiException && err.code === 404) {
				throw new DashboardException('Card not found');
			} else {
				throw new DashboardException('Something went wrong', err);
			}
		});
});

onMounted((): void => {
	emit('update:remote-form-changed', remoteFormChanged.value);
});

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		if (!val && card.value === null && !wasCardLoaded.value) {
			throw new DashboardException('Card not found');
		}
	}
);

watch(
	(): ICard | null => card.value,
	(val: ICard | null): void => {
		if (val !== null) {
			wasCardLoaded.value = true;
		} else if (wasCardLoaded.value && !isLoading.value) {
			flashMessage.warning(t('pagesCardsPlugin.messages.cards.deletedWhileEditing'), { duration: 0 });
			if (props.page?.id) {
				if (isLGDevice.value) {
					router.replace({ name: RouteNames.PAGE, params: { id: props.page.id } });
				} else {
					router.push({ name: RouteNames.PAGE, params: { id: props.page.id } });
				}
			} else {
				if (isLGDevice.value) {
					router.replace({ name: DashboardRouteNames.PAGES });
				} else {
					router.push({ name: DashboardRouteNames.PAGES });
				}
			}
		} else if (!isLoading.value && val === null && !wasCardLoaded.value) {
			throw new DashboardException('Card not found');
		}
	}
);

watch(
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.PAGE, params: { id: props.page?.id } });
			} else {
				router.push({ name: RouteNames.PAGE, params: { id: props.page?.id } });
			}
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

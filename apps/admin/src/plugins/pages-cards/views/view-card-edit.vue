<template>
	<view-header
		:title="t('pagesCardsPlugin.headings.pages.editCard')"
		:subtitle="t('pagesCardsPlugin.subHeadings.pages.editCard')"
		icon="mdi:card-text-outline"
		left="close"
		:primary="{ label: t('pagesCardsPlugin.buttons.update.title'), handler: onSubmit }"
		@back="() => (remoteFormChanged ? onDiscard() : onClose())"
	/>

	<app-breadcrumbs :items="breadcrumbs" />

	<div
		v-loading="isLoading || card === null"
		:element-loading-text="t('pagesCardsPlugin.texts.cards.loadingCard')"
		class="flex flex-col overflow-hidden h-full"
	>
		<el-scrollbar
			v-if="card !== null"
			class="grow-1 p-2 tp:px-4"
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

		<!-- Wherever the phone app bar is not there to carry Save: in the drawer, and on a page kept open past 720 px -->
		<form-footer
			v-if="card !== null"
			v-show="inDrawer || !isPhone"
			:dirty="remoteFormChanged"
			:saving="remoteFormResult === FormResult.WORKING"
			:can-save="remoteFormChanged && remoteFormResult === FormResult.NONE"
			@save="onSubmit"
			@discard="onDiscard"
			@close="onClose"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElMessageBox, ElScrollbar, vLoading } from 'element-plus';

import { AppBreadcrumbs, FormFooter, ViewHeader, useEditDrawer, useFlashMessage, useSizeClass, useUuid } from '../../../common';
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

// Template 4: in the drawer from tablet portrait up, its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

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

// The editor asks before a changed form is left; a confirmed discard, a save or a deleted record lets it go
const releaseForm = (): void => {
	remoteFormChanged.value = false;

	emit('update:remote-form-changed', false);
};

const onDiscard = (): void => {
	ElMessageBox.confirm(t('pagesCardsPlugin.texts.misc.confirmDiscard'), t('pagesCardsPlugin.headings.misc.discard'), {
		confirmButtonText: t('dashboardModule.buttons.discard.title'),
		cancelButtonText: t('dashboardModule.buttons.keepEditing.title'),
		type: 'warning',
	})
		.then((): void => {
			releaseForm();

			if (inDrawer.value) {
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
	if (inDrawer.value) {
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
			if (error instanceof DashboardException) {
				throw error;
			}

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
			releaseForm();

			flashMessage.warning(t('pagesCardsPlugin.messages.cards.deletedWhileEditing'), { duration: 0 });
			if (props.page?.id) {
				if (inDrawer.value) {
					router.replace({ name: RouteNames.PAGE, params: { id: props.page.id } });
				} else {
					router.push({ name: RouteNames.PAGE, params: { id: props.page.id } });
				}
			} else {
				if (inDrawer.value) {
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
			releaseForm();

			if (inDrawer.value) {
				router.replace({ name: RouteNames.PAGE, params: { id: props.page?.id } });
			} else {
				router.push({ name: RouteNames.PAGE, params: { id: props.page?.id } });
			}
		} else if (val === FormResult.ERROR) {
			// The form stays open with what was typed, so the save can be tried again
			flashMessage.error(t('pagesCardsPlugin.messages.cards.notSaved'));
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

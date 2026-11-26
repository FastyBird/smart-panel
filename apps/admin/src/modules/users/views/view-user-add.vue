<template>
	<view-header
		:title="t('usersModule.headings.addUser')"
		:subtitle="t('usersModule.subHeadings.addUser')"
		icon="mdi:user-multiple-add"
		left="close"
		:primary="{ label: t('usersModule.buttons.save.title'), handler: onSubmit }"
		@back="() => (remoteFormChanged ? onDiscard() : onClose())"
	/>

	<app-breadcrumbs :items="breadcrumbs" />

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar class="grow-1 p-2 tp:px-4">
			<user-add-form
				:id="newUserId"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
			/>
		</el-scrollbar>

		<!-- Wherever the phone app bar is not there to carry Save: in the drawer, and on a page kept open past 720 px -->
		<form-footer
			v-show="inDrawer || !isPhone"
			:dirty="remoteFormChanged"
			:saving="remoteFormResult === FormResult.WORKING"
			:can-save="remoteFormResult === FormResult.NONE"
			@save="onSubmit"
			@discard="onDiscard"
			@close="onClose"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElMessageBox, ElScrollbar } from 'element-plus';

import { AppBreadcrumbs, FormFooter, ViewHeader, useEditDrawer, useSizeClass, useUuid } from '../../../common';
import { UserAddForm } from '../components/components';
import { FormResult, type FormResultType, RouteNames } from '../users.constants';

import type { IViewUserAddProps } from './view-user-add.types';

defineOptions({
	name: 'ViewUserAdd',
});

defineProps<IViewUserAddProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('usersModule.meta.users.add.title'),
});

const { generate: uuidGenerate } = useUuid();

// Template 4: in the drawer from tablet portrait up, its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

const newUserId = uuidGenerate();

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('usersModule.breadcrumbs.users'),
				route: router.resolve({ name: RouteNames.USERS }),
			},
			{
				label: t('usersModule.breadcrumbs.addUser'),
				route: router.resolve({ name: RouteNames.USER_ADD }),
			},
		];
	}
);

const backToList = (): void => {
	if (inDrawer.value) {
		router.replace({ name: RouteNames.USERS });
	} else {
		router.push({ name: RouteNames.USERS });
	}
};

// The editor asks before a changed form is left; a confirmed discard or a save lets it go
const releaseForm = (): void => {
	remoteFormChanged.value = false;
	emit('update:remote-form-changed', false);
};

const onDiscard = (): void => {
	ElMessageBox.confirm(t('usersModule.texts.misc.confirmDiscard'), t('usersModule.headings.discard'), {
		confirmButtonText: t('usersModule.buttons.discard.title'),
		cancelButtonText: t('usersModule.buttons.keepEditing.title'),
		type: 'warning',
	})
		.then((): void => {
			releaseForm();
			backToList();
		})
		.catch((): void => {
			// Just ignore it
		});
};

const onSubmit = (): void => {
	remoteFormSubmit.value = true;
};

const onClose = (): void => {
	backToList();
};

onMounted((): void => {
	emit('update:remote-form-changed', remoteFormChanged.value);
});

watch(
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			releaseForm();
			backToList();
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

<template>
	<view-header
		:title="user?.username ?? ''"
		:subtitle="user?.email !== null ? user?.email : undefined"
		left="close"
		:primary="{ label: t('usersModule.buttons.save.title'), handler: onSubmit }"
		@back="() => (remoteFormChanged ? onDiscard() : onClose())"
	>
		<template #icon>
			<user-avatar
				:size="32"
				:email="user?.email"
			/>
		</template>
	</view-header>

	<app-breadcrumbs :items="breadcrumbs" />

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar
			v-if="user !== null"
			class="grow-1 p-2 tp:px-4"
		>
			<user-edit-form
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:user="user"
			/>
		</el-scrollbar>

		<state-view
			v-else
			kind="loading"
			icon="mdi:account"
			:title="t('usersModule.texts.misc.loadingUser')"
		/>

		<!-- Wherever the phone app bar is not there to carry Save: in the drawer, and on a page kept open past 720 px -->
		<form-footer
			v-if="user !== null"
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

import { ElMessageBox, ElScrollbar } from 'element-plus';

import {
	AppBreadcrumbs,
	FormFooter,
	StateView,
	UserAvatar,
	ViewHeader,
	useEditDrawer,
	useFlashMessage,
	useSizeClass,
	useUuid,
} from '../../../common';
import { UserEditForm } from '../components/components';
import { useUser } from '../composables/composables';
import type { IUser } from '../store/users.store.types';
import { FormResult, type FormResultType, RouteNames } from '../users.constants';
import { UsersApiException, UsersException } from '../users.exceptions';

import type { IViewUserEditProps } from './view-user-edit.types';

defineOptions({
	name: 'ViewUserEdit',
});

const props = defineProps<IViewUserEditProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const router = useRouter();
const { t } = useI18n();
const { meta } = useMeta({});
const flashMessage = useFlashMessage();

const { validate: validateUuid } = useUuid();

// Template 4: in the drawer from tablet portrait up, its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

// Track if user was previously loaded to detect deletion
const wasUserLoaded = ref<boolean>(false);

const { user, isLoading, fetchUser } = useUser({ id: props.id });

if (!validateUuid(props.id)) {
	throw new Error('User identifier is not valid');
}

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
				label: t('usersModule.breadcrumbs.editUser'),
				route: router.resolve({ name: RouteNames.USER_EDIT, params: { id: props.id } }),
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

// The editor asks before a changed form is left; a confirmed discard, a save or a deleted record lets it go
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

onBeforeMount(async (): Promise<void> => {
	fetchUser()
		.then((): void => {
			if (!isLoading.value && user.value === null && !wasUserLoaded.value) {
				throw new UsersException('User not found');
			}
			// Mark as loaded if user was successfully fetched
			if (user.value !== null) {
				wasUserLoaded.value = true;
			}
		})
		.catch((error: unknown): void => {
			const err = error as Error;

			if (err instanceof UsersApiException && err.code === 404) {
				throw new UsersException('User not found');
			} else {
				throw new UsersException('Something went wrong', err);
			}
		});
});

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
	(): boolean => isLoading.value,
	(val: boolean): void => {
		// Only throw error if user was never loaded (initial load failed)
		if (!val && user.value === null && !wasUserLoaded.value) {
			throw new UsersException('User not found');
		}
	}
);

watch(
	(): IUser | null => user.value,
	(val: IUser | null): void => {
		if (val !== null) {
			wasUserLoaded.value = true;
			meta.title = t('usersModule.meta.users.edit.title', { user: user.value?.username });
		} else if (wasUserLoaded.value && !isLoading.value) {
			// User was previously loaded but is now null - it was deleted
			flashMessage.warning(t('usersModule.messages.deletedWhileEditing'), { duration: 0 });

			releaseForm();
			backToList();
		} else if (!isLoading.value && val === null && !wasUserLoaded.value) {
			// User was never loaded - initial load failed
			throw new UsersException('User not found');
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

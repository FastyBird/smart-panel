<template>
	<app-bar-heading teleport>
		<template #icon>
			<user-avatar
				:size="32"
				:email="user?.email"
			/>
		</template>

		<template #title>
			{{ user?.username }}
		</template>

		<template
			v-if="user?.email !== null"
			#subtitle
		>
			{{ user?.email }}
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
		<span class="uppercase">{{ t('usersModule.buttons.save.title') }}</span>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<div
		v-loading="isLoading || user === null"
		:element-loading-text="t('usersModule.texts.misc.loadingUser')"
		class="flex flex-col overflow-hidden h-full"
	>
		<el-scrollbar
			v-if="user !== null"
			class="grow-1 p-2 md:px-4"
		>
			<user-edit-form
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:user="user"
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
					{{ t('usersModule.buttons.discard.title') }}
				</el-button>
				<el-button
					v-if="!remoteFormChanged"
					link
					class="mr-2"
					@click="onClose"
				>
					{{ t('usersModule.buttons.close.title') }}
				</el-button>

				<el-button
					:loading="remoteFormResult === FormResult.WORKING"
					:disabled="isLoading || remoteFormResult !== FormResult.NONE"
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
					{{ t('usersModule.buttons.save.title') }}
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

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, UserAvatar, useBreakpoints, useFlashMessage, useUuid } from '../../../common';
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

const { isMDDevice, isLGDevice } = useBreakpoints();

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

const onDiscard = (): void => {
	ElMessageBox.confirm(t('usersModule.messages.confirmDiscard'), t('usersModule.headings.discard'), {
		confirmButtonText: t('usersModule.buttons.yes.title'),
		cancelButtonText: t('usersModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.USERS });
			} else {
				router.push({ name: RouteNames.USERS });
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
		router.replace({ name: RouteNames.USERS });
	} else {
		router.push({ name: RouteNames.USERS });
	}
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
			// Redirect to users list
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.USERS });
			} else {
				router.push({ name: RouteNames.USERS });
			}
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

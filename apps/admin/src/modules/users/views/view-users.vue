<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice && isUsersListRoute"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:users-group"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('usersModule.headings.users') }}
		</template>

		<template #subtitle>
			{{ t('usersModule.subHeadings.users') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice && isUsersListRoute"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="router.push('/')"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>

		<span class="uppercase">{{ t('application.buttons.home.title') }}</span>
	</app-bar-button>

	<app-bar-button
		v-if="!isMDDevice && isUsersListRoute"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onUserCreate"
	>
		<span class="uppercase">{{ t('usersModule.buttons.add.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('usersModule.headings.users')"
		:sub-heading="t('usersModule.subHeadings.users')"
		:icon="'mdi:users-group'"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					type="primary"
					plain
					class="px-4! ml-2!"
					@click="onUserCreate"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>

					{{ t('usersModule.buttons.add.title') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div
		v-if="isUsersListRoute || isLGDevice"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden"
	>
		<list-users
			v-model:filters="filters"
			v-model:sort-by="sortBy"
			v-model:sort-dir="sortDir"
			v-model:paginate-size="paginateSize"
			v-model:paginate-page="paginatePage"
			:items="usersPaginated"
			:all-items="users"
			:total-rows="totalRows"
			:loading="areLoading"
			:filters-active="filtersActive"
			@edit="onUserEdit"
			@remove="onUserRemove"
			@reset-filters="onResetFilters"
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
						@click="() => onCloseDrawer()"
						class="mr-2"
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
						<icon icon="mdi:user-edit" />
					</template>
					<template #message>
						{{ t('usersModule.messages.requestError') }}
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
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElDrawer, ElIcon, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewError, ViewHeader, useBreakpoints } from '../../../common';
import ListUsers from '../components/list-users.vue';
import { useUsersActions, useUsersDataSource } from '../composables/composables';
import type { IUser } from '../store/users.store.types';
import { RouteNames } from '../users.constants';
import { UsersException } from '../users.exceptions';

import type { IViewUsersProps } from './view-users.types';

defineOptions({
	name: 'ViewUsers',
});

const props = defineProps<IViewUsersProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('usersModule.meta.users.list.title'),
});

const { isMDDevice, isLGDevice } = useBreakpoints();

const { fetchUsers, users, usersPaginated, totalRows, filters, filtersActive, sortBy, sortDir, paginateSize, paginatePage, areLoading, resetFilter } =
	useUsersDataSource();
const userActions = useUsersActions();

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

const isUsersListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.USERS;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('usersModule.breadcrumbs.users'),
				route: router.resolve({ name: RouteNames.USERS }),
			},
		];
	}
);

const onCloseDrawer = (done?: () => void): void => {
	if (remoteFormChanged.value) {
		ElMessageBox.confirm(t('usersModule.messages.confirmDiscard'), t('usersModule.headings.discard'), {
			confirmButtonText: t('usersModule.buttons.yes.title'),
			cancelButtonText: t('usersModule.buttons.no.title'),
			type: 'warning',
		})
			.then((): void => {
				if (isLGDevice.value) {
					router.replace({
						name: RouteNames.USERS,
					});
				} else {
					router.push({
						name: RouteNames.USERS,
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
				name: RouteNames.USERS,
			});
		} else {
			router.push({
				name: RouteNames.USERS,
			});
		}

		done?.();
	}
};

const onUserEdit = (id: IUser['id']): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.USER_EDIT,
			params: {
				id,
			},
		});
	} else {
		router.push({
			name: RouteNames.USER_EDIT,
			params: {
				id,
			},
		});
	}
};

const onUserCreate = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.USER_ADD,
		});
	} else {
		router.push({
			name: RouteNames.USER_ADD,
		});
	}
};

const onUserRemove = (id: IUser['id']): void => {
	userActions.remove(id);
};

const onResetFilters = (): void => {
	resetFilter();
};

onBeforeMount((): void => {
	fetchUsers().catch((error: unknown): void => {
		const err = error as Error;

		throw new UsersException('Something went wrong', err);
	});

	showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.USER_ADD || matched.name === RouteNames.USER_EDIT) !== undefined;
});

onMounted((): void => {
	mounted.value = true;
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.USER_ADD || matched.name === RouteNames.USER_EDIT) !== undefined;
	}
);
</script>

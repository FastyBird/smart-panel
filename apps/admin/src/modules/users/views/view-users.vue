<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		v-if="isUsersListRoute || inDrawer"
		:title="t('usersModule.headings.users')"
		:subtitle="t('usersModule.subHeadings.users')"
		icon="mdi:users-group"
		:actions="phoneActions"
	>
		<template #actions>
			<el-button
				type="primary"
				data-test-id="add-user"
				@click="onUserCreate"
			>
				<template #icon>
					<icon icon="mdi:plus" />
				</template>

				{{ t('usersModule.buttons.add.title') }}
			</el-button>
		</template>
	</view-header>

	<div
		v-if="isUsersListRoute || inDrawer"
		class="page-pad flex flex-col flex-1 min-h-0 box-border"
	>
		<!-- Template 4: add and edit open next to the list from tablet portrait up, as their own page on phone -->
		<edit-drawer-layout
			:open="showDrawer"
			:before-close="onCloseDrawer"
			@close="onCloseDrawer()"
		>
			<list-users
				ref="list"
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
				:current-user-id="profile?.id ?? null"
				@edit="onUserEdit"
				@remove="onUserRemove"
				@reset-filters="onResetFilters"
				@bulk-action="onBulkAction"
			/>

			<template #form>
				<view-error :key="formKey">
					<template #icon>
						<icon icon="mdi:user-edit" />
					</template>
					<template #message>
						{{ t('usersModule.messages.requestError') }}
					</template>

					<!-- Keyed by the user: switching to another user remounts the editor, so its save goes to the user now
					     shown and not to the one opened first -->
					<suspense>
						<router-view
							:key="formKey"
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
		</edit-drawer-layout>
	</div>

	<router-view
		v-else
		:key="formKey"
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { type AppBarAction, AppBreadcrumbs, EditDrawerLayout, ViewError, ViewHeader, provideEditDrawer } from '../../../common';
import { useSession } from '../../auth/composables/composables';
import ListUsers from '../components/list-users.vue';
import { useUsersActions, useUsersDataSource } from '../composables/composables';
import type { IUser } from '../store/users.store.types';
import { RouteNames } from '../users.constants';
import { UsersException } from '../users.exceptions';

import type { IViewUsersProps } from './view-users.types';

defineOptions({
	name: 'ViewUsers',
});

defineProps<IViewUsersProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const { profile } = useSession();

useMeta({
	title: t('usersModule.meta.users.list.title'),
});

const { fetchUsers, users, usersPaginated, totalRows, filters, filtersActive, sortBy, sortDir, paginateSize, paginatePage, areLoading, resetFilter } =
	useUsersDataSource();
const userActions = useUsersActions();

const list = ref<InstanceType<typeof ListUsers> | null>(null);

const remoteFormChanged = ref<boolean>(false);

const isUsersListRoute = computed<boolean>((): boolean => route.name === RouteNames.USERS);

const isFormRoute = (): boolean => route.matched.some((matched) => matched.name === RouteNames.USER_ADD || matched.name === RouteNames.USER_EDIT);

const showDrawer = ref<boolean>(isFormRoute());

// Template 4: add and edit open next to this page from tablet portrait up, as their own page on phone
const { inDrawer } = provideEditDrawer((): boolean => !isUsersListRoute.value);

// One form per user (and one for Add): a new key remounts the routed form
const formKey = computed<string>((): string => {
	const id = typeof route.params?.id === 'string' ? route.params.id : '';

	return `${String(route.name)}:${id}`;
});

// The changed flag belongs to the form that is open. Any route change that replaces or closes it clears the flag
// before the next form mounts, so that one starts clean. A declined discard leaves the route, and the flag, as it was
watch(formKey, (): void => {
	remoteFormChanged.value = false;
});

// The phone app bar: Search and Add
const phoneActions = computed<AppBarAction[]>((): AppBarAction[] => [
	{ icon: 'mdi:magnify', label: t('usersModule.fields.search.placeholder'), handler: onSearch },
	{ icon: 'mdi:plus', label: t('usersModule.buttons.add.title'), handler: onUserCreate },
]);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => [
		{
			label: t('usersModule.breadcrumbs.users'),
			route: router.resolve({ name: RouteNames.USERS }),
		},
	]
);

const navigate = (to: { name: string; params?: Record<string, string> }): void => {
	if (inDrawer.value) {
		router.replace(to);
	} else {
		router.push(to);
	}
};

const confirmDiscard = async (): Promise<boolean> => {
	try {
		await ElMessageBox.confirm(t('usersModule.texts.misc.confirmDiscard'), t('usersModule.headings.discard'), {
			confirmButtonText: t('usersModule.buttons.discard.title'),
			cancelButtonText: t('usersModule.buttons.keepEditing.title'),
			type: 'warning',
		});

		return true;
	} catch {
		return false;
	}
};

const onCloseDrawer = async (done?: () => void): Promise<void> => {
	if (remoteFormChanged.value && !(await confirmDiscard())) {
		return;
	}

	navigate({ name: RouteNames.USERS });

	done?.();
};

// Next to a docked form the page stays usable: replacing a changed form asks first, as closing it does
const canReplaceOpenForm = async (): Promise<boolean> => !showDrawer.value || !remoteFormChanged.value || confirmDiscard();

const onUserEdit = async (id: IUser['id']): Promise<void> => {
	if ((route.name === RouteNames.USER_EDIT && route.params.id === id) || !(await canReplaceOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.USER_EDIT, params: { id } });
};

const onUserCreate = async (): Promise<void> => {
	if (route.name === RouteNames.USER_ADD || !(await canReplaceOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.USER_ADD });
};

const onUserRemove = (id: IUser['id']): void => {
	userActions.remove(id);
};

const onBulkAction = (action: string, items: IUser[]): void => {
	switch (action) {
		case 'delete':
			userActions.bulkRemove(items);
			break;
	}
};

const onResetFilters = (): void => {
	resetFilter();
};

// The phone app bar's Search action
const onSearch = (): void => {
	list.value?.focusSearch();
};

onBeforeMount((): void => {
	fetchUsers().catch((error: unknown): void => {
		const err = error as Error;

		throw new UsersException('Something went wrong', err);
	});
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value = isFormRoute();
	}
);
</script>

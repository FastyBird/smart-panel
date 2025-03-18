<template>
	<app-breadcrumbs
		:items="[
			{
				label: t('usersModule.breadcrumbs.users'),
				route: { name: RouteNames.USERS },
			},
		]"
	/>

	<div class="lt-sm:p-1 sm:p-2">
		<view-header
			:heading="t('usersModule.headings.users')"
			:sub-heading="t('usersModule.subHeadings.users')"
			:icon="'mdi:users-group'"
		>
			<template #extra>
				<div class="flex items-center">
					<el-button
						type="primary"
						@click="onUserCreate"
					>
						{{ t('usersModule.buttons.add.title') }}
					</el-button>
				</div>
			</template>
		</view-header>

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
			@click="onUserCreate"
		>
			<span class="uppercase">{{ t('usersModule.buttons.add.title') }}</span>
		</app-bar-button>

		<div class="h-full w-full">
			<list-users
				v-if="isUsersListRoute || isLGDevice"
				v-model:filters="filters"
				v-model:sort-by="sortBy"
				v-model:sort-dir="sortDir"
				v-model:paginate-size="paginateSize"
				v-model:paginate-page="paginatePage"
				:items="usersPaginated"
				:all-items="users"
				:total-rows="totalRows"
				:loading="areLoading"
				@edit="onUserEdit"
				@remove="onUserRemove"
				@reset-filters="onResetFilters"
			/>

			<router-view v-else />
		</div>

		<el-drawer
			v-if="isLGDevice"
			v-model="showDrawer"
			:show-close="false"
			:size="'40%'"
			:with-header="false"
			@closed="onCloseDrawer"
		>
			<div class="flex flex-col h-full">
				<app-bar menu-button-hidden>
					<template #button-right>
						<app-bar-button
							:align="AppBarButtonAlign.RIGHT"
							@click="onCloseDrawer"
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
								<component :is="Component" />
							</router-view>
						</suspense>
					</view-error>
				</template>
			</div>
		</el-drawer>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { ElButton, ElDrawer, ElIcon } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewError, ViewHeader, useBreakpoints } from '../../../common';
import ListUsers from '../components/list-users.vue';
import { useUsers, useUsersActions } from '../composables';
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

const { isMDDevice, isLGDevice } = useBreakpoints();

const { fetchUsers, users, usersPaginated, totalRows, filters, sortBy, sortDir, paginateSize, paginatePage, areLoading, resetFilter } = useUsers();
const userActions = useUsersActions();

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);

const isUsersListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.USERS;
});

const onCloseDrawer = (): void => {
	router.push({
		name: RouteNames.USERS,
	});
};

const onUserEdit = (id: string): void => {
	router.push({
		name: RouteNames.USER_EDIT,
		params: {
			id,
		},
	});
};

const onUserCreate = (): void => {
	router.push({
		name: RouteNames.USER_ADD,
	});
};

const onUserRemove = (id: string): void => {
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

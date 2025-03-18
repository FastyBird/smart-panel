<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:user-multiple-add"
				class="w[32px] h[32px]"
			/>
		</template>

		<template #title>
			{{ t('usersModule.headings.addUser') }}
		</template>

		<template #subtitle>
			{{ t('usersModule.subHeadings.addUser') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="onClose"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-breadcrumbs
		:items="[
			{
				label: t('usersModule.breadcrumbs.users'),
				route: { name: RouteNames.USERS },
			},
			{
				label: t('usersModule.breadcrumbs.addUser'),
				route: { name: RouteNames.USER_ADD },
			},
		]"
	/>

	<div
		:class="[ns.b()]"
		class="flex flex-col overflow-hidden h-full pt-2"
	>
		<user-add-form
			v-if="isMDDevice"
			:id="newUserId"
			v-model:remote-form-submit="remoteFormSubmit"
			v-model:remote-form-result="remoteFormResult"
			v-model:remote-form-reset="remoteFormReset"
			v-model:remote-form-changed="remoteFormChanged"
		/>

		<el-card
			v-else
			:class="[ns.e('form-box')]"
			class="py-3"
		>
			<user-add-form
				:id="newUserId"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
			/>
		</el-card>

		<div
			v-if="isMDDevice"
			class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 absolute bottom-0 left-0 w-full h-[3rem]"
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
					{{ t('usersModule.buttons.cancel.title') }}
				</el-button>

				<el-button
					:loading="remoteFormResult === FormResult.WORKING"
					:disabled="remoteFormResult !== FormResult.NONE"
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
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { useRouter } from 'vue-router';

import { ElButton, ElCard, ElIcon, ElMessageBox, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, useBreakpoints, useUuid } from '../../../common';
import { UserAddForm } from '../components';
import { FormResult, type FormResultType, RouteNames } from '../users.constants';

defineOptions({
	name: 'ViewUserAdd',
});

const ns = useNamespace('view-user-add');
const { t } = useI18n();
const router = useRouter();
const { meta } = useMeta({});

const { generate: uuidGenerate } = useUuid();

meta.title = t('usersModule.meta.users.add.title');

const { isMDDevice } = useBreakpoints();

const newUserId = uuidGenerate();

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('usersModule.messages.confirmDiscard'), t('usersModule.headings.discard'), {
		confirmButtonText: t('usersModule.buttons.yes.title'),
		cancelButtonText: t('usersModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			router.push({ name: RouteNames.USERS });
		})
		.catch((): void => {
			// Just ignore it
		});
};

const onSubmit = (): void => {
	remoteFormSubmit.value = true;
};

const onClose = (): void => {
	router.push({ name: RouteNames.USERS });
};

watch(
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			router.push({ name: RouteNames.USER_EDIT, params: { id: newUserId } });
		}
	}
);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'view-user-add.scss';
</style>

<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:home-group"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('spacesModule.headings.add') }}
		</template>

		<template #subtitle>
			{{ t('spacesModule.subHeadings.add') }}
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
		<span class="uppercase">{{ t('spacesModule.buttons.save.title') }}</span>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar class="grow-1 p-2 md:px-4">
			<space-add-form
				ref="formRef"
				v-model:remote-form-changed="remoteFormChanged"
				:hide-actions="isMDDevice"
				@saved="onSaved"
				@cancel="onCancel"
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
					{{ t('spacesModule.buttons.discard.title') }}
				</el-button>
				<el-button
					v-if="!remoteFormChanged"
					link
					class="mr-2"
					@click="onClose"
				>
					{{ t('spacesModule.buttons.close.title') }}
				</el-button>

				<el-button
					type="primary"
					@click="onSubmit"
				>
					{{ t('spacesModule.buttons.save.title') }}
				</el-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElButton, ElIcon, ElMessageBox, ElScrollbar } from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	useBreakpoints,
	useFlashMessage,
} from '../../../common';
import { SpaceAddForm } from '../components/components';
import { RouteNames } from '../spaces.constants';
import type { ISpace } from '../store';

defineOptions({
	inheritAttrs: false,
});

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const router = useRouter();
const { t } = useI18n();
const flashMessage = useFlashMessage();

useMeta({
	title: t('spacesModule.meta.spaces.add.title'),
});

const { isMDDevice, isLGDevice } = useBreakpoints();

const formRef = ref<InstanceType<typeof SpaceAddForm> | null>(null);
const remoteFormChanged = ref(false);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('spacesModule.breadcrumbs.spaces.list'),
				route: router.resolve({ name: RouteNames.SPACES }),
			},
			{
				label: t('spacesModule.breadcrumbs.spaces.add'),
				route: router.resolve({ name: RouteNames.SPACES_EDIT }),
			},
		];
	}
);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('spacesModule.texts.confirmDiscard'), t('spacesModule.headings.discard'), {
		confirmButtonText: t('spacesModule.buttons.yes.title'),
		cancelButtonText: t('spacesModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.SPACES });
			} else {
				router.push({ name: RouteNames.SPACES });
			}
		})
		.catch((): void => {
			// Just ignore it
		});
};

const onSubmit = (): void => {
	if (formRef.value) {
		formRef.value.submit();
	}
};

const onClose = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SPACES });
	} else {
		router.push({ name: RouteNames.SPACES });
	}
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const onSaved = (_savedSpace: ISpace): void => {
	flashMessage.success(t('spacesModule.messages.created'));

	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SPACES });
	} else {
		router.push({ name: RouteNames.SPACES });
	}
};

const onCancel = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SPACES });
	} else {
		router.push({ name: RouteNames.SPACES });
	}
};

onMounted((): void => {
	emit('update:remote-form-changed', remoteFormChanged.value);
});

watch(
	(): boolean => remoteFormChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);
</script>

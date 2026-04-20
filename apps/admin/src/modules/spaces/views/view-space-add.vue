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
		v-if="!isMDDevice && selectedType"
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
			<!--
				Plugin-picker flow mirrors the dashboard's page-add experience:
				the user picks a space type first, and the plugin registered for
				that type contributes the add form via `element.components.spaceAddForm`.
				Singleton types (master/entry) and types without a registered
				add form are hidden by the picker itself.
			-->
			<select-space-plugin v-model="selectedType" />

			<el-divider v-if="selectedType" />

			<template v-if="selectedType">
				<component
					:is="element?.components?.spaceAddForm"
					v-if="element?.components?.spaceAddForm"
					ref="formRef"
					v-model:remote-form-changed="remoteFormChanged"
					:type="addFormType"
					:hide-actions="isMDDevice"
					@saved="onSaved"
					@cancel="onCancel"
				/>

				<el-alert
					v-else
					type="info"
					:closable="false"
					:title="t('spacesModule.texts.noAddFormForSpaceType', { type: selectedType })"
					show-icon
				/>
			</template>

			<el-alert
				v-else
				:title="t('spacesModule.headings.selectPlugin')"
				:description="t('spacesModule.texts.selectPlugin')"
				:closable="false"
				show-icon
				type="info"
				class="mt-2"
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
					v-if="selectedType"
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

import { ElAlert, ElButton, ElDivider, ElIcon, ElMessageBox, ElScrollbar } from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	type IPluginElement,
	useBreakpoints,
} from '../../../common';
import SelectSpacePlugin from '../components/select-space-plugin.vue';
import { useSpacesPlugins } from '../composables';
import { RouteNames, SpaceType } from '../spaces.constants';
import type { ISpace } from '../store';

const props = withDefaults(
	defineProps<{
		remoteFormChanged?: boolean;
	}>(),
	{
		remoteFormChanged: false,
	}
);

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('spacesModule.meta.spaces.add.title'),
});

const { isMDDevice, isLGDevice } = useBreakpoints();

const { getElement } = useSpacesPlugins();

const selectedType = ref<IPluginElement['type'] | undefined>(undefined);

const element = computed(() => (selectedType.value ? getElement(selectedType.value) : undefined));

// The generic Room/Zone add form (home-control's `spaceAddForm`) declares
// its `type` prop narrowed to `SpaceType.ROOM | SpaceType.ZONE`. Cast the
// picker's dynamically-selected plugin type to that union at the dispatch
// boundary — the picker itself only surfaces types whose plugin registers
// a `spaceAddForm`, so at runtime this stays within the contributing
// plugin's accepted values.
const addFormType = computed<SpaceType.ROOM | SpaceType.ZONE | undefined>(
	() => selectedType.value as SpaceType.ROOM | SpaceType.ZONE | undefined,
);

// The dispatched add form exposes a `submit()` method — mirrors the edit-view
// contract (see view-space-edit.vue). All plugin-contributed add forms must
// implement this or the Save button is a silent no-op.
interface ISpaceAddFormHandle {
	submit: () => void | Promise<unknown>;
}
const formRef = ref<ISpaceAddFormHandle | null>(null);

const remoteFormChanged = ref(props.remoteFormChanged);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('spacesModule.breadcrumbs.spaces.list'),
				route: router.resolve({ name: RouteNames.SPACES }),
			},
			{
				label: t('spacesModule.breadcrumbs.spaces.add'),
				route: router.resolve({ name: RouteNames.SPACES_ADD }),
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
	// Flash message is already shown by the composable, just handle navigation
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

watch(
	(): boolean => props.remoteFormChanged,
	(val: boolean): void => {
		remoteFormChanged.value = val;
	},
	{ immediate: true }
);

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

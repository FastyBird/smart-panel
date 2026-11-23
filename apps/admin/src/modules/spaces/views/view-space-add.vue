<template>
	<view-header
		:title="t('spacesModule.headings.add')"
		:subtitle="t('spacesModule.subHeadings.add')"
		icon="mdi:home-group"
		left="close"
		:primary="hasAddForm ? { label: t('spacesModule.buttons.save.title'), handler: onSubmit } : undefined"
		@back="() => (remoteFormChanged ? onDiscard() : onClose())"
	/>

	<app-breadcrumbs :items="breadcrumbs" />

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar class="grow-1 p-2 tp:px-4">
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
				<!--
					`:key` forces the form to unmount + remount whenever the
					picker switches types. Without it, two types that register
					the *same* component reference (home-control uses one
					`SpaceAddForm` for both ROOM and ZONE) would reuse the
					instance, carrying stale `model.type`, category, parent,
					and other subtype-specific fields across the switch.
				-->
				<component
					:is="element?.components?.spaceAddForm"
					v-if="element?.components?.spaceAddForm"
					:key="selectedType"
					ref="formRef"
					v-model:remote-form-changed="remoteFormChanged"
					:type="addFormType"
					:hide-actions="true"
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

		<!-- Wherever the phone app bar is not there to carry Save: in the drawer, and on a page kept open past 720 px -->
		<form-footer
			v-show="inDrawer || !isPhone"
			:dirty="remoteFormChanged"
			:can-save="hasAddForm"
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

import { ElAlert, ElDivider, ElMessageBox, ElScrollbar } from 'element-plus';

import { AppBreadcrumbs, FormFooter, type IPluginElement, ViewHeader, useEditDrawer, useSizeClass } from '../../../common';
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

// Template 4: in the drawer from tablet portrait up, its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

const { getElement } = useSpacesPlugins();

const selectedType = ref<IPluginElement['type'] | undefined>(undefined);

const element = computed(() => (selectedType.value ? getElement(selectedType.value) : undefined));

// The Save button should only surface when the selected type's plugin
// actually contributes an add form — otherwise clicking it calls
// `formRef.value?.submit()` on a null ref and silently no-ops. Mirrors
// `hasEditForm` on `view-space-edit.vue`.
const hasAddForm = computed<boolean>(() => !!element.value?.components?.spaceAddForm);

// Pass the picker's raw value through to the dispatched component.
// Each plugin's `spaceAddForm` declares its own narrower prop shape
// (home-control: ROOM | ZONE; signage / future plugins: their own
// types). The `<component :is>` dispatch is dynamic at runtime, but
// vue-tsc static-checks against whichever component type it can infer
// — cast the value up to what home-control's form accepts so the
// binding type-checks. Runtime safety: the picker only surfaces types
// whose plugin actually registered a `spaceAddForm`, so home-control's
// form is only ever mounted with ROOM / ZONE here.
const addFormType = computed<SpaceType.ROOM | SpaceType.ZONE | undefined>(() => selectedType.value as SpaceType.ROOM | SpaceType.ZONE | undefined);

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
			if (inDrawer.value) {
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
	if (inDrawer.value) {
		router.replace({ name: RouteNames.SPACES });
	} else {
		router.push({ name: RouteNames.SPACES });
	}
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const onSaved = (_savedSpace: ISpace): void => {
	// Flash message is already shown by the composable, just handle navigation
	if (inDrawer.value) {
		router.replace({ name: RouteNames.SPACES });
	} else {
		router.push({ name: RouteNames.SPACES });
	}
};

const onCancel = (): void => {
	if (inDrawer.value) {
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

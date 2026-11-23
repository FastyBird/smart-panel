<template>
	<view-header
		:title="t('scenes.headings.add')"
		:subtitle="t('scenes.subHeadings.list')"
		icon="mdi:plus"
		left="close"
		:primary="{ label: t('scenes.buttons.save.title'), handler: () => (remoteFormSubmit = true) }"
		@back="onClose"
	/>

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar class="grow-1 p-2 tp:px-4">
			<scene-add-form
				:id="sceneId"
				:remote-form-submit="remoteFormSubmit"
				:remote-form-result="remoteFormResult"
				@update:remote-form-submit="remoteFormSubmit = $event"
				@update:remote-form-result="onFormResult"
				@update:remote-form-changed="remoteFormChanged = $event"
			/>
		</el-scrollbar>

		<!-- Wherever the phone app bar is not there to carry Save: in the drawer, and on a page kept open past 720 px -->
		<form-footer
			v-show="inDrawer || !isPhone"
			:dirty="remoteFormChanged"
			:saving="saving"
			:can-save="!saving"
			@save="remoteFormSubmit = true"
			@discard="onClose"
			@close="onClose"
		/>
	</div>
</template>

<script setup lang="ts">
import { onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElScrollbar } from 'element-plus';
import { v4 as uuid } from 'uuid';

import { FormFooter, ViewHeader, useEditDrawer, useSizeClass } from '../../../common';
import { useSpaces } from '../../spaces/composables';
import SceneAddForm from '../components/scenes/scene-add-form.vue';
import { FormResult, type FormResultType, RouteNames } from '../scenes.constants';

defineOptions({
	name: 'ViewSceneAdd',
});

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

const { t } = useI18n();
const router = useRouter();

// Template 4: in the drawer from tablet portrait up, its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

const { fetchSpaces, firstLoadFinished: spacesLoaded } = useSpaces();

const sceneId = ref<string>(uuid());
const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormChanged = ref<boolean>(props.remoteFormChanged);
const saving = ref<boolean>(false);

const onFormResult = (result: FormResultType): void => {
	remoteFormResult.value = result;

	if (result === FormResult.WORKING) {
		saving.value = true;
	} else if (result === FormResult.OK) {
		saving.value = false;
		onClose();
	} else if (result === FormResult.ERROR) {
		saving.value = false;
	}
};

const onClose = (): void => {
	if (inDrawer.value) {
		router.replace({ name: RouteNames.SCENES });
	} else {
		router.push({ name: RouteNames.SCENES });
	}
};

onBeforeMount(() => {
	if (!spacesLoaded.value) {
		fetchSpaces();
	}
});

watch(
	(): boolean => props.remoteFormChanged,
	(val: boolean): void => {
		remoteFormChanged.value = val;
	},
	{ immediate: true }
);

watch(
	(): boolean => remoteFormChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);
</script>

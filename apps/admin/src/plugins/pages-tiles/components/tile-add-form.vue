<template>
	<select-tile-plugin v-model="selectedPlugin" />

	<el-divider />

	<tile-add-form
		v-if="selectedPlugin"
		:id="props.id"
		v-model:remote-form-submit="formSubmit"
		v-model:remote-form-result="formResult"
		v-model:remote-form-reset="formReset"
		v-model:remote-form-changed="formChanged"
		:type="selectedPlugin"
		parent="page"
		:parent-id="props.page.id"
		only-draft
	/>

	<el-alert
		v-else
		:title="t('dashboardModule.headings.tiles.selectPlugin')"
		:description="t('dashboardModule.texts.tiles.selectPlugin')"
		:closable="false"
		show-icon
		type="info"
	/>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElDivider } from 'element-plus';

import { FormResult, type FormResultType, SelectTilePlugin, TileAddForm } from '../../../modules/dashboard';

import type { IAddTileProps } from './tile-add-form.types';

defineOptions({
	name: 'TileAddForm',
});

const props = withDefaults(defineProps<IAddTileProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();

const selectedPlugin = ref<string | undefined>(undefined);

const formSubmit = ref<boolean>(props.remoteFormSubmit);
const formResult = ref<FormResultType>(props.remoteFormResult);
const formReset = ref<boolean>(props.remoteFormReset);
const formChanged = ref<boolean>(props.remoteFormChanged);

watch(
	(): boolean => props.remoteFormSubmit,
	async (val: boolean): Promise<void> => {
		if (val) {
			emit('update:remote-form-submit', false);

			formSubmit.value = true;
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remote-form-reset', false);

		if (val) {
			formReset.value = true;
		}
	}
);

watch(
	(): FormResultType => formResult.value,
	async (val: FormResultType): Promise<void> => {
		emit('update:remote-form-result', val);
	}
);

watch(
	(): boolean => formChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);
</script>

<template>
	<tile-edit-form
		v-if="tile"
		v-model:remote-form-submit="formSubmit"
		v-model:remote-form-result="formResult"
		v-model:remote-form-reset="formReset"
		v-model:remote-form-changed="formChanged"
		:tile="tile"
		only-draft
	/>
</template>

<script setup lang="ts">
import { onBeforeMount, ref, watch } from 'vue';

import { DashboardApiException, DashboardException, FormResult, type FormResultType, TileEditForm, useTile } from '../../../modules/dashboard';

import type { IEditTileProps } from './tile-edit-form.types';

defineOptions({
	name: 'TileEditForm',
});

const props = withDefaults(defineProps<IEditTileProps>(), {
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

const { tile, fetchTile } = useTile({
	id: props.id,
	parent: 'page',
	parentId: props.page.id,
});

const formSubmit = ref<boolean>(props.remoteFormSubmit);
const formResult = ref<FormResultType>(props.remoteFormResult);
const formReset = ref<boolean>(props.remoteFormReset);
const formChanged = ref<boolean>(props.remoteFormChanged);

onBeforeMount(async (): Promise<void> => {
	fetchTile().catch((error: unknown): void => {
		const err = error as Error;

		if (err instanceof DashboardApiException && err.code === 404) {
			throw new DashboardException('Tile not found');
		} else {
			throw new DashboardException('Something went wrong', err);
		}
	});
});

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

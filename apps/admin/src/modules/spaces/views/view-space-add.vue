<template>
	<!-- On large devices, content is rendered inside parent's drawer -->
	<template v-if="isLGDevice">
		<div class="p-4">
			<h3 class="text-lg font-semibold mb-4">{{ t('spacesModule.headings.add') }}</h3>
			<space-edit-form
				v-model:remote-form-changed="remoteFormChanged"
				@saved="onSaved"
				@cancel="onCancel"
			/>
		</div>
	</template>

	<!-- On small/medium devices, render own drawer -->
	<el-drawer
		v-else
		v-model="isOpen"
		:title="t('spacesModule.headings.add')"
		direction="rtl"
		size="500px"
		@closed="onDrawerClosed"
	>
		<space-edit-form
			v-model:remote-form-changed="remoteFormChanged"
			@saved="onSaved"
			@cancel="onCancel"
		/>
	</el-drawer>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import { ElDrawer, ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { useBreakpoints } from '../../../common';
import { SpaceEditForm } from '../components/components';
import { RouteNames } from '../spaces.constants';
import type { ISpace } from '../store';

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();
const router = useRouter();

const { isLGDevice } = useBreakpoints();

const isOpen = ref(true);
const remoteFormChanged = ref(false);

onMounted((): void => {
	emit('update:remote-form-changed', remoteFormChanged.value);
});

watch(
	(): boolean => remoteFormChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);

const onDrawerClosed = (): void => {
	router.push({ name: RouteNames.SPACES });
};

const onSaved = (space: ISpace): void => {
	ElMessage.success(t('spacesModule.messages.saved'));

	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SPACE, params: { id: space.id } });
	} else {
		router.push({ name: RouteNames.SPACE, params: { id: space.id } });
	}
};

const onCancel = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SPACES });
	} else {
		router.push({ name: RouteNames.SPACES });
	}
};
</script>

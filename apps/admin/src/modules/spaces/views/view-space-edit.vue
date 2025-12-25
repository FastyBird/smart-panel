<template>
	<!-- On large devices, content is rendered inside parent's drawer -->
	<template v-if="isLGDevice">
		<div class="p-4">
			<h3 class="text-lg font-semibold mb-4">{{ t('spacesModule.headings.edit') }}</h3>
			<space-edit-form
				v-if="space"
				v-model:remote-form-changed="remoteFormChanged"
				:space="space"
				@saved="onSaved"
				@cancel="onCancel"
			/>
			<el-empty v-else :description="t('spacesModule.messages.notFound')" />
		</div>
	</template>

	<!-- On small/medium devices, render own drawer -->
	<el-drawer
		v-else
		v-model="isOpen"
		:title="t('spacesModule.headings.edit')"
		direction="rtl"
		size="500px"
		@closed="onDrawerClosed"
	>
		<space-edit-form
			v-if="space"
			v-model:remote-form-changed="remoteFormChanged"
			:space="space"
			@saved="onSaved"
			@cancel="onCancel"
		/>
		<el-empty v-else :description="t('spacesModule.messages.notFound')" />
	</el-drawer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { ElDrawer, ElEmpty, ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { useBreakpoints } from '../../../common';
import { SpaceEditForm } from '../components/components';
import { useSpace } from '../composables';
import { RouteNames } from '../spaces.constants';
import type { ISpace } from '../store';

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const { isLGDevice } = useBreakpoints();

const spaceId = computed(() => route.params.id as string | undefined);

const { space, fetchSpace } = useSpace(spaceId);

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

watch(
	spaceId,
	async (newId) => {
		if (newId) {
			await fetchSpace();
		}
	},
	{ immediate: true }
);

const onDrawerClosed = (): void => {
	router.push({ name: RouteNames.SPACE, params: { id: spaceId.value } });
};

const onSaved = (savedSpace: ISpace): void => {
	ElMessage.success(t('spacesModule.messages.saved'));

	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SPACE, params: { id: savedSpace.id } });
	} else {
		router.push({ name: RouteNames.SPACE, params: { id: savedSpace.id } });
	}
};

const onCancel = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SPACE, params: { id: spaceId.value } });
	} else {
		router.push({ name: RouteNames.SPACE, params: { id: spaceId.value } });
	}
};
</script>

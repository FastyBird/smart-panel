<template>
	<el-drawer
		v-model="isOpen"
		:title="t('spacesModule.headings.edit')"
		direction="rtl"
		size="500px"
		@closed="onDrawerClosed"
	>
		<space-edit-form v-if="space" :space="space" @saved="onSaved" @cancel="onCancel" />
		<el-empty v-else :description="t('spacesModule.messages.notFound')" />
	</el-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { ElDrawer, ElEmpty, ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { SpaceEditForm } from '../components/components';
import { useSpace } from '../composables';
import { RouteNames } from '../spaces.constants';
import type { ISpace } from '../store';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const spaceId = computed(() => route.params.id as string | undefined);

const { space, fetchSpace } = useSpace(spaceId);

const isOpen = ref(true);

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
	router.push({ name: RouteNames.SPACE, params: { id: savedSpace.id } });
};

const onCancel = (): void => {
	router.push({ name: RouteNames.SPACE, params: { id: spaceId.value } });
};
</script>

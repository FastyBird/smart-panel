<template>
	<el-drawer
		v-model="isOpen"
		:title="t('spacesModule.headings.add')"
		direction="rtl"
		size="500px"
		@closed="onDrawerClosed"
	>
		<space-edit-form @saved="onSaved" @cancel="onCancel" />
	</el-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { ElDrawer, ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { SpaceEditForm } from '../components/components';
import { RouteNames } from '../spaces.constants';
import type { ISpace } from '../store';

const { t } = useI18n();
const router = useRouter();

const isOpen = ref(true);

const onDrawerClosed = (): void => {
	router.push({ name: RouteNames.SPACES });
};

const onSaved = (space: ISpace): void => {
	ElMessage.success(t('spacesModule.messages.saved'));
	router.push({ name: RouteNames.SPACE, params: { id: space.id } });
};

const onCancel = (): void => {
	router.push({ name: RouteNames.SPACES });
};
</script>

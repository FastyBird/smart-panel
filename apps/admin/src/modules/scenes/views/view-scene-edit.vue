<template>
	<el-drawer v-model="isOpen" :title="t('scenes.headings.edit')" direction="rtl" size="500px" @closed="onClose">
		<div class="edit-scene-form">
			<p>{{ t('scenes.messages.editFormPlaceholder') }}</p>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElDrawer } from 'element-plus';

import { RouteNames } from '../scenes.constants';

const { t } = useI18n();
const router = useRouter();

const isOpen = ref(false);

const onClose = (): void => {
	router.push({ name: RouteNames.SCENES });
};

onMounted(() => {
	isOpen.value = true;
});
</script>

<style scoped>
.edit-scene-form {
	padding: 20px;
}
</style>

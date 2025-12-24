<template>
	<div class="view-spaces">
		<el-page-header @back="goBack">
			<template #content>
				<span class="text-lg font-600">{{ t('spacesModule.headings.list') }}</span>
			</template>
			<template #extra>
				<el-button type="primary" @click="onAddSpace">
					<el-icon class="mr-2">
						<icon icon="mdi:plus" />
					</el-icon>
					{{ t('spacesModule.buttons.add') }}
				</el-button>
			</template>
		</el-page-header>

		<div class="mt-4">
			<spaces-list />
		</div>

		<router-view />
	</div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

import { Icon } from '@iconify/vue';
import { ElButton, ElIcon, ElPageHeader } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { SpacesList } from '../components/components';
import { useSpaces } from '../composables';
import { RouteNames } from '../spaces.constants';

const { t } = useI18n();
const router = useRouter();

const { fetchSpaces } = useSpaces();

const goBack = (): void => {
	router.back();
};

const onAddSpace = (): void => {
	router.push({ name: RouteNames.SPACES_EDIT });
};

onMounted(async () => {
	await fetchSpaces();
});
</script>

<style scoped>
.view-spaces {
	padding: 1rem;
}
</style>

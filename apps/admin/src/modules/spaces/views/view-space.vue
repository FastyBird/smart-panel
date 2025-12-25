<template>
	<div class="view-space">
		<!-- On large devices, content is rendered inside parent's drawer -->
		<template v-if="isLGDevice">
			<div class="p-4">
				<h3 class="text-lg font-semibold mb-4">{{ space?.name ?? t('spacesModule.headings.detail') }}</h3>
				<template v-if="space">
					<el-descriptions :column="1" border>
						<el-descriptions-item :label="t('spacesModule.fields.spaces.name.title')">
							{{ space.name }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('spacesModule.fields.spaces.type.title')">
							{{ t(`spacesModule.misc.types.${space.type}`) }}
						</el-descriptions-item>
						<el-descriptions-item v-if="space.description" :label="t('spacesModule.fields.spaces.description.title')">
							{{ space.description }}
						</el-descriptions-item>
						<el-descriptions-item v-if="space.icon" :label="t('spacesModule.fields.spaces.icon.title')">
							<el-icon>
								<icon :icon="space.icon" />
							</el-icon>
							{{ space.icon }}
						</el-descriptions-item>
					</el-descriptions>

					<div class="mt-4 flex gap-2">
						<el-button type="primary" @click="onEdit">
							{{ t('spacesModule.buttons.edit.title') }}
						</el-button>
						<el-button type="danger" @click="onDelete">
							{{ t('spacesModule.buttons.delete.title') }}
						</el-button>
					</div>
				</template>
				<template v-else>
					<el-empty :description="t('spacesModule.messages.notFound')" />
				</template>
			</div>
		</template>

		<!-- On small/medium devices, render own drawer -->
		<el-drawer
			v-else
			v-model="isOpen"
			:title="space?.name ?? t('spacesModule.headings.detail')"
			direction="rtl"
			size="500px"
			@closed="onDrawerClosed"
		>
			<template v-if="space">
				<el-descriptions :column="1" border>
					<el-descriptions-item :label="t('spacesModule.fields.spaces.name.title')">
						{{ space.name }}
					</el-descriptions-item>
					<el-descriptions-item :label="t('spacesModule.fields.spaces.type.title')">
						{{ t(`spacesModule.misc.types.${space.type}`) }}
					</el-descriptions-item>
					<el-descriptions-item v-if="space.description" :label="t('spacesModule.fields.spaces.description.title')">
						{{ space.description }}
					</el-descriptions-item>
					<el-descriptions-item v-if="space.icon" :label="t('spacesModule.fields.spaces.icon.title')">
						<el-icon>
							<icon :icon="space.icon" />
						</el-icon>
						{{ space.icon }}
					</el-descriptions-item>
				</el-descriptions>

				<div class="mt-4 flex gap-2">
					<el-button type="primary" @click="onEdit">
						{{ t('spacesModule.buttons.edit.title') }}
					</el-button>
					<el-button type="danger" @click="onDelete">
						{{ t('spacesModule.buttons.delete.title') }}
					</el-button>
				</div>
			</template>
			<template v-else>
				<el-empty :description="t('spacesModule.messages.notFound')" />
			</template>
		</el-drawer>

		<router-view />
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { Icon } from '@iconify/vue';
import { ElButton, ElDescriptions, ElDescriptionsItem, ElDrawer, ElEmpty, ElIcon, ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { useBreakpoints } from '../../../common';
import { useSpace } from '../composables';
import { RouteNames } from '../spaces.constants';
import { SpacesApiException } from '../spaces.exceptions';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const { isLGDevice } = useBreakpoints();

const spaceId = computed(() => route.params.id as string | undefined);

const { space, fetchSpace, removeSpace } = useSpace(spaceId);

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
	router.push({ name: RouteNames.SPACES });
};

const onEdit = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SPACE_EDIT, params: { id: spaceId.value } });
	} else {
		router.push({ name: RouteNames.SPACE_EDIT, params: { id: spaceId.value } });
	}
};

const onDelete = async (): Promise<void> => {
	try {
		await ElMessageBox.confirm(t('spacesModule.messages.confirmDelete'), {
			type: 'warning',
		});

		await removeSpace();
		ElMessage.success(t('spacesModule.messages.deleted'));

		if (isLGDevice.value) {
			router.replace({ name: RouteNames.SPACES });
		} else {
			router.push({ name: RouteNames.SPACES });
		}
	} catch (error: unknown) {
		if (error instanceof SpacesApiException) {
			ElMessage.error(error.message);
		}
		// Otherwise user cancelled - ignore
	}
};
</script>

<style scoped>
.view-space {
}
</style>

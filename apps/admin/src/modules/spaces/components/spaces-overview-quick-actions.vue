<template>
	<el-card
		shadow="never"
		header-class="px-3! py-3! font-bold"
	>
		<template #header>
			<div class="flex items-center gap-2">
				<el-icon :size="18">
					<icon icon="mdi:lightning-bolt" />
				</el-icon>
				{{ t('spacesModule.overview.quickActions.title') }}
			</div>
		</template>

		<div class="flex flex-col gap-2">
			<el-button
				class="w-full justify-start!"
				@click="onAddSpace"
			>
				<el-icon class="mr-2"><icon icon="mdi:plus" /></el-icon>
				{{ t('spacesModule.overview.quickActions.addSpace') }}
			</el-button>

			<el-button
				class="w-full justify-start!"
				@click="onOnboarding"
			>
				<el-icon class="mr-2"><icon icon="mdi:wizard-hat" /></el-icon>
				{{ t('spacesModule.overview.quickActions.onboarding') }}
			</el-button>

			<el-button
				class="w-full justify-start!"
				@click="onViewAll"
			>
				<el-icon class="mr-2"><icon icon="mdi:format-list-bulleted" /></el-icon>
				{{ t('spacesModule.overview.quickActions.viewAll') }}
			</el-button>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElCard, ElIcon } from 'element-plus';

import { Icon } from '@iconify/vue';

import { RouteNames } from '../spaces.constants';

defineOptions({
	name: 'SpacesOverviewQuickActions',
});

const router = useRouter();
const { t } = useI18n();

const onAddSpace = (): void => {
	router.push({ name: RouteNames.SPACES_ADD });
};

const onOnboarding = (): void => {
	router.push({ name: RouteNames.SPACES_ONBOARDING });
};

const onViewAll = (): void => {
	router.push({ name: RouteNames.SPACES });
};
</script>

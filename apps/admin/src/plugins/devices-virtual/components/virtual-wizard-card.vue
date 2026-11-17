<template>
	<el-card
		v-if="!plain"
		v-bind="$attrs"
		shadow="never"
		header-class="px-3! py-3! font-bold"
		:body-style="flush ? { padding: '0' } : undefined"
		:class="{ 'virtual-wizard-card--flush': flush }"
	>
		<template
			v-if="title || $slots.header"
			#header
		>
			<div
				class="virtual-wizard-card__header flex items-center gap-2 min-w-0"
				:class="{ 'virtual-wizard-card__header--featured': featured }"
			>
				<el-icon
					:size="featured ? 24 : 18"
					class="virtual-wizard-card__icon shrink-0"
				>
					<icon :icon="icon" />
				</el-icon>
				<div class="min-w-0 grow">
					<slot name="header">
						<h3 class="virtual-wizard-card__title">{{ title }}</h3>
						<div
							v-if="subtitle"
							class="virtual-wizard-card__subtitle"
						>
							{{ subtitle }}
						</div>
					</slot>
				</div>
			</div>
		</template>
		<slot />
	</el-card>
	<slot v-else />
</template>

<script setup lang="ts">
import { ElCard, ElIcon } from 'element-plus';

import { Icon } from '@iconify/vue';

defineOptions({ inheritAttrs: false });
withDefaults(defineProps<{ title?: string; subtitle?: string; icon?: string; plain?: boolean; flush?: boolean; featured?: boolean }>(), {
	title: undefined,
	subtitle: undefined,
	icon: 'mdi:card-text-outline',
});
</script>

<style scoped>
.virtual-wizard-card__header {
	line-height: 20px;
}
.virtual-wizard-card__header :deep(.el-button) {
	margin-block: -4px;
}
.virtual-wizard-card__header--featured {
	align-items: flex-start;
	gap: 12px;
}
.virtual-wizard-card__header--featured .virtual-wizard-card__icon {
	margin-top: 2px;
	color: var(--el-color-primary);
}
.virtual-wizard-card__title {
	margin: 0;
	font-size: 14px;
	font-weight: 600;
	line-height: 20px;
	overflow-wrap: anywhere;
}
.virtual-wizard-card__header--featured .virtual-wizard-card__title {
	font-size: 16px;
}
.virtual-wizard-card__subtitle {
	margin-top: 8px;
	font-size: 12px;
	font-weight: 400;
	line-height: 18px;
	color: var(--el-text-color-regular);
}
.virtual-wizard-card--flush :deep(.el-table__inner-wrapper::before) {
	display: none;
}
.virtual-wizard-card--flush :deep(.el-table__body tr:last-child > td) {
	border-bottom: 0;
}
</style>

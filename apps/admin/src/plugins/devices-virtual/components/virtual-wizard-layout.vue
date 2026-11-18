<template>
	<div
		v-if="enabled"
		v-loading="loading"
		:element-loading-text="loadingText"
		:aria-busy="loading"
		class="virtual-wizard-layout"
	>
		<div
			class="virtual-wizard-layout__columns"
			:class="{ 'virtual-wizard-layout__columns--wide': wide }"
		>
			<div class="virtual-wizard-layout__main">
				<div
					v-if="title"
					class="mb-5"
				>
					<h3 class="m-0 mb-2 text-base font-semibold">{{ title }}</h3>
					<el-text v-if="description">{{ description }}</el-text>
				</div>
				<div :class="{ 'virtual-wizard-layout__intro-fields': compact && !review, 'virtual-wizard-layout__review': review }">
					<slot />
				</div>
			</div>
			<aside
				v-if="!wide"
				class="virtual-wizard-layout__aside"
				:aria-label="t('devicesVirtualPlugin.wizard.layout.summary')"
			>
				<slot name="aside" />
			</aside>
		</div>
	</div>
	<template v-else>
		<slot />
		<slot name="aside" />
	</template>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElText, vLoading } from 'element-plus';

defineProps<{
	enabled: boolean;
	review?: boolean;
	compact?: boolean;
	wide?: boolean;
	loading?: boolean;
	loadingText?: string;
	title?: string;
	description?: string;
}>();
const { t } = useI18n();
</script>
<style scoped>
.virtual-wizard-layout {
	container-type: inline-size;
}
.virtual-wizard-layout__columns {
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	gap: 24px;
	align-items: start;
}
.virtual-wizard-layout__main,
.virtual-wizard-layout__aside {
	min-width: 0;
}
.virtual-wizard-layout__main {
	--virtual-wizard-description-label-width: 230px;
}
.virtual-wizard-layout__aside {
	--virtual-wizard-description-label-width: 180px;
	display: flex;
	flex-direction: column;
	gap: 16px;
}
.virtual-wizard-layout__review {
	display: flex;
	flex-direction: column;
	gap: 16px;
}
.virtual-wizard-layout__intro-fields {
	max-width: 600px;
}
.virtual-wizard-layout__main :deep(.el-form-item__label) {
	font-weight: 600;
}
:deep(.virtual-wizard-field-help) {
	display: block;
	width: 100%;
	margin: 6px 0 0;
	font-size: 12px;
	line-height: 1.5;
	color: var(--el-text-color-regular);
}
:deep(.el-form-item) {
	margin-bottom: 24px;
}
@container (min-width: 1120px) {
	.virtual-wizard-layout__columns:not(.virtual-wizard-layout__columns--wide) {
		grid-template-columns: minmax(0, 1fr) 400px;
	}
}
</style>

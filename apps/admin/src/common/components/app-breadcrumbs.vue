<template>
	<teleport
		v-if="isMDDevice && mounted"
		:to="`#${BREADCRUMBS_TARGET}`"
	>
		<el-breadcrumb separator="/">
			<el-breadcrumb-item :to="{ path: '/' }">
				{{ t('application.breadcrumbs.homepage') }}
			</el-breadcrumb-item>

			<el-breadcrumb-item
				v-for="(item, index) of props.items"
				:key="index"
				:to="item.route"
			>
				{{ item.label }}
			</el-breadcrumb-item>
		</el-breadcrumb>
	</teleport>
</template>

<script setup lang="ts">
import { getCurrentInstance, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElBreadcrumb, ElBreadcrumbItem } from 'element-plus';

import { useBreakpoints } from '../composables/useBreakpoints';

import type { IAppBreadcrumbsProps } from './app-breadcrumbs.types';
import { BREADCRUMBS_TARGET } from './app-top-bar.types';

defineOptions({
	name: 'AppBreadcrumbs',
});

const props = defineProps<IAppBreadcrumbsProps>();

const { isMDDevice } = useBreakpoints();

const { t } = useI18n();

const mounted = ref<boolean>(false);

const instance = getCurrentInstance();

onMounted((): void => {
	const target: HTMLElement | null = document.getElementById(BREADCRUMBS_TARGET);

	if (target !== null) {
		target.childNodes.forEach((node) => {
			if (node instanceof HTMLElement && node.style.display !== 'none') {
				node.style.display = 'none';
				node.dataset.componentKey = String(instance?.uid);
			}
		});
	}

	mounted.value = true;
});

onBeforeUnmount((): void => {
	const target: HTMLElement | null = document.getElementById(BREADCRUMBS_TARGET);

	if (target !== null) {
		target.childNodes.forEach((node) => {
			if (node instanceof HTMLElement && node.style.display === 'none' && node.dataset.componentKey === String(instance?.uid)) {
				node.style.display = '';
			}
		});
	}
});
</script>

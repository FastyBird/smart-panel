<template>
	<teleport
		v-if="isMDDevice && mounted && isTop"
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

<script lang="ts">
import { shallowRef } from 'vue';

// Shared by every instance: the screens currently showing breadcrumbs, outermost first
const breadcrumbsStack = shallowRef<number[]>([]);

let nextBreadcrumbsId = 0;
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
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

// Only the innermost screen's breadcrumbs show. Screens register as they are set up, which is parent before child,
// so a child's trail covers its parent's whatever order their teleports reach the top bar in (a docked form mounts
// together with its list, a drawer later)
const id = nextBreadcrumbsId++;

breadcrumbsStack.value = [...breadcrumbsStack.value, id];

const isTop = computed<boolean>((): boolean => breadcrumbsStack.value.at(-1) === id);

onMounted((): void => {
	mounted.value = true;
});

onBeforeUnmount((): void => {
	breadcrumbsStack.value = breadcrumbsStack.value.filter((entry) => entry !== id);
});
</script>

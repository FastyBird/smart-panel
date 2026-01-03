<template>
	<div class="flex flex-row items-center">
		<span class="color-[var(--el-text-color-secondary)]">
			{{ t('statsModule.headings.spaces') }}
		</span>
	</div>

	<div class="text-3xl mt-1 flex flex-row items-center">
		{{ totalCount }}
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';

import { useSpaces } from '../../spaces';

import type { IStatsSpacesProps } from './stats-spaces.types';

defineOptions({
	name: 'StatsSpaces',
});

withDefaults(defineProps<IStatsSpacesProps>(), {
	loading: false,
});

const { t } = useI18n();

const { spaces, fetchSpaces } = useSpaces();

const nonDraftSpaces = computed(() => spaces.value.filter((space) => !space.draft));

const totalCount = computed<number>(() => nonDraftSpaces.value.length);

onBeforeMount(() => {
	fetchSpaces();
});
</script>

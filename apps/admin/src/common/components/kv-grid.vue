<template>
	<dl
		:class="['grid gap-x-6 gap-y-4 m-0', COLUMNS[props.cols]]"
		data-test-id="kv-grid"
	>
		<div
			v-for="(item, index) in props.items"
			:key="`${index}-${item.label}`"
			class="flex flex-col gap-0.5 min-w-0"
		>
			<dt class="text-caption">{{ item.label }}</dt>
			<dd
				:class="['m-0 break-words', item.mono ? 'text-mono text-default' : 'text-body']"
				data-test-id="kv-grid-value"
			>
				<template v-if="isEmpty(item.value)">
					<span class="text-muted">{{ t('application.value.notAvailable') }}</span>
				</template>
				<a
					v-else-if="item.href"
					:href="item.href"
					:target="isExternal(item.href) ? '_blank' : undefined"
					:rel="isExternal(item.href) ? 'noopener noreferrer' : undefined"
					class="text-link no-underline hover:underline"
				>
					{{ item.value }}
				</a>
				<template v-else>{{ item.value }}</template>
			</dd>
		</div>
	</dl>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import type { KvGridItem, KvGridProps } from './kv-grid.types';

defineOptions({
	name: 'KvGrid',
});

const props = withDefaults(defineProps<KvGridProps>(), {
	cols: 2,
});

const { t } = useI18n();

// One column on phones; the requested count from tablet landscape up (spec section 6)
const COLUMNS: Record<NonNullable<KvGridProps['cols']>, string> = {
	2: 'grid-cols-1 tp:grid-cols-2',
	3: 'grid-cols-1 tp:grid-cols-2 tl:grid-cols-3',
	4: 'grid-cols-1 tp:grid-cols-2 tl:grid-cols-4',
};

const isEmpty = (value: KvGridItem['value']): boolean => value === null || value === undefined || value === '';

const isExternal = (href: string): boolean => /^https?:\/\//i.test(href);
</script>

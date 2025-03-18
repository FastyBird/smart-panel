<template>
	<span
		v-bind="$attrs"
		:class="[ns.b(), ns.m('type-' + props.type)]"
	>
		<el-icon
			:class="ns.e('icon')"
			:size="props.size"
		>
			<slot name="primary" />
		</el-icon>

		<el-icon
			:class="ns.e('child-icon')"
			:size="childSize"
		>
			<slot name="secondary" />
		</el-icon>
	</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ElIcon, useNamespace } from 'element-plus';

import type { IIconWithChildProps } from './icon-with-child.types';

defineOptions({
	name: 'IconWithChild',
});

const props = withDefaults(defineProps<IIconWithChildProps>(), {
	type: 'primary',
	size: 20,
});

const ns = useNamespace('icon-with-child');

const childSize = computed<number>((): number => {
	if (Number.isInteger(props.size)) {
		const size = (props.size as number) * 0.3;

		return size > 20 ? 20 : size;
	}

	return 20;
});
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'icon-with-child.scss';
</style>

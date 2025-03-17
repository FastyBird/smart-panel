<template>
	<el-avatar
		:src="src"
		:size="size"
		:alt="props.alt"
		@error="onError"
	>
		<el-icon :size="size * 0.7">
			<icon icon="mdi:user-tie" />
		</el-icon>
	</el-avatar>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ElAvatar, ElIcon } from 'element-plus';
import md5 from 'md5';

import { Icon } from '@iconify/vue';

import type { UserAvatarProps } from './user-avatar.types';

defineOptions({
	name: 'UserAvatar',
});

const props = withDefaults(defineProps<UserAvatarProps>(), {
	hash: null,
	size: 80,
	defaultImg: 'retro',
	rating: 'g',
	alt: 'Avatar',
	protocol: null,
	hostname: 'www.gravatar.com',
});

const emit = defineEmits<{
	(e: 'error', event: Event): void;
}>();

const src = computed<string | undefined>((): string | undefined => {
	if (!props.email) {
		return undefined;
	}

	const img = [
		`${props.protocol ? props.protocol : ''}//${props.hostname}/avatar/`,
		md5(props.email.trim().toLowerCase()),
		`?s=${props.size}`,
		`&d=${props.defaultImg}`,
		`&r=${props.rating}`,
	];

	return img.join('');
});

const onError = (event: Event) => {
	emit('error', event);
};
</script>

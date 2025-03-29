<template>
	<el-page-header
		v-if="isMDDevice"
		class="lt-sm:p-1 sm:p-2 b-b b-b-solid"
		@back="onBack"
	>
		<template #content>
			<div class="flex items-center">
				<div
					v-if="'icon' in $slots"
					class="mr-3 h[32px] w[32px] overflow-hidden"
				>
					<slot name="icon" />
				</div>
				<el-avatar
					v-else-if="props.icon"
					:size="32"
					class="mr-3"
				>
					<icon
						:icon="props.icon"
						class="w[20px] h[20px]"
					/>
				</el-avatar>

				<span class="text-large font-600 mr-3">{{ props.heading }}</span>
				<span
					v-if="props.subHeading"
					class="text-sm mr-2"
				>
					{{ props.subHeading }}
				</span>
			</div>
		</template>

		<template
			v-if="'extra' in $slots"
			#extra
		>
			<slot name="extra" />
		</template>
	</el-page-header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

import { ElAvatar, ElPageHeader } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useBreakpoints } from '../composables';

import type { IViewHeaderProps } from './view-header.types';

defineOptions({
	name: 'ViewHeader',
});

const props = defineProps<IViewHeaderProps>();

const router = useRouter();

const { isMDDevice } = useBreakpoints();

const onBack = (): void => {
	router.back();
};
</script>

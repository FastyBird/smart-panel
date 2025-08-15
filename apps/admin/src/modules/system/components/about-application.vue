<template>
	<div class="flex flex-col items-center">
		<icon
			icon="mdi:cog-outline"
			class="w[200px] h[200px]"
		/>
		<el-text
			size="large"
			class="block text-4xl! mt-4!"
		>
			FastyBird! Smart Panel
		</el-text>
		<el-text class="block text-lg! my-2!">Version 1.0.0</el-text>

		<el-divider />

		<el-text
			size="large"
			class="block text-justify max-w-[500px]"
			data-test-id="about-info"
		>
			{{ t('systemModule.texts.system.about') }}
		</el-text>

		<el-divider />

		<div class="flex flex-row justify-center items-center my-4">
			<el-link
				underline="never"
				href="http://www.github.com/fastybird"
				target="_blank"
				class="mx-5"
			>
				<template #icon>
					<el-icon :size="20">
						<icon icon="mdi:github" />
					</el-icon>
				</template>
			</el-link>

			<el-divider direction="vertical" />

			<el-link
				underline="never"
				href="http://www.x.com/fastybird"
				target="_blank"
				class="mx-5"
			>
				<template #icon>
					<el-icon :size="20">
						<icon icon="mdi:twitter" />
					</el-icon>
				</template>
			</el-link>

			<el-divider direction="vertical" />

			<el-link
				underline="never"
				href="http://www.facebook.com/fastybird"
				target="_blank"
				class="mx-5"
			>
				<template #icon>
					<el-icon :size="20">
						<icon icon="mdi:discord" />
					</el-icon>
				</template>
			</el-link>

			<el-divider direction="vertical" />

			<el-link
				underline="never"
				href="http://www.facebook.com/fastybird"
				target="_blank"
				class="mx-5"
			>
				<template #icon>
					<el-icon :size="20">
						<icon icon="mdi:facebook" />
					</el-icon>
				</template>
			</el-link>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElDivider, ElIcon, ElLink, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

defineOptions({
	name: 'AboutApplication',
});

const { t } = useI18n();
</script>

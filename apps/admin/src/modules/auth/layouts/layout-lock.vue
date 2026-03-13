<template>
	<div class="flex flex-row items-center align-center w-full h-full">
		<div class="mx-a w-[25rem]">
			<el-card
				v-if="isMDDevice"
				class="mb-5"
			>
				<div class="block w-[8rem] my-0 mx-a">
					<logo class="fill-brand-primary" />
				</div>

				<div class="flex flex-col items-center my-6">
					<user-avatar
						:size="80"
						:email="accountManager?.details.value?.email"
						class="mb-3"
					/>

					<span
						v-if="accountManager?.details.value?.name"
						class="text-lg font-500"
					>
						{{ accountManager.details.value.name }}
					</span>

					<span
						v-if="accountManager?.details.value?.email"
						class="text-sm text-gray-500"
					>
						{{ accountManager.details.value.email }}
					</span>
				</div>

				<h1
					class="text-center capitalize mx-0 mb-6 mt-0 font-300 font-size-[1.4rem]"
					data-test-id="lock-heading"
				>
					{{ t('authModule.headings.lockScreen') }}
				</h1>

				<router-view />
			</el-card>

			<div
				v-else
				class="mb-5"
			>
				<div class="block w-[8rem] my-0 mx-a">
					<logo class="fill-brand-primary" />
				</div>

				<div class="flex flex-col items-center my-6">
					<user-avatar
						:size="80"
						:email="accountManager?.details.value?.email"
						class="mb-3"
					/>

					<span
						v-if="accountManager?.details.value?.name"
						class="text-lg font-500"
					>
						{{ accountManager.details.value.name }}
					</span>

					<span
						v-if="accountManager?.details.value?.email"
						class="text-sm text-gray-500"
					>
						{{ accountManager.details.value.email }}
					</span>
				</div>

				<h1 class="text-center capitalize mx-0 mb-6 mt-0 font-300 font-size-[1.4rem]">
					{{ t('authModule.headings.lockScreen') }}
				</h1>

				<router-view />
			</div>

			<div class="text-center">
				<div
					class="flex flex-row justify-center items-center mb-5"
					data-test-id="social-links"
				>
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
						href="http://www.discord.com/invite/fastybird"
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

				<div class="flex flex-row justify-center items-baseline gap-[0.5rem]">
					&copy;
					<el-link
						href="https://www.fastybird.com"
						target="_blank"
						data-test-id="author-link"
					>
						FastyBird Team
					</el-link>
					2024
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElCard, ElDivider, ElIcon, ElLink } from 'element-plus';

import { Icon } from '@iconify/vue';

import Logo from '../../../assets/images/fb_bird.svg?component';
import { useBreakpoints } from '../../../common';
import { injectAccountManager } from '../../../common/services/account-manager';
import UserAvatar from '../../../common/components/user-avatar.vue';

defineOptions({
	name: 'LayoutLock',
});

const { t } = useI18n();

const { isMDDevice } = useBreakpoints();
const accountManager = injectAccountManager();
</script>

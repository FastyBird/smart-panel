<template>
	<div class="flex flex-row items-center align-center w-full h-full">
		<div class="mx-a w-[25rem]">
			<el-card
				v-if="isMDDevice"
				class="mb-5"
			>
				<router-link
					:to="{ name: RouteNames.SIGN_IN }"
					class="block w-[8rem] my-0 mx-a"
				>
					<logo class="fill-brand-primary" />
				</router-link>

				<h1
					v-if="route.name === RouteNames.SIGN_IN"
					class="text-center capitalize mx-0 my-8 font-300 font-size-[1.8rem]"
					data-test-id="sign-heading"
				>
					{{ t('authModule.headings.signIn') }}
				</h1>

				<h1
					v-if="route.name === RouteNames.SIGN_UP"
					class="text-center capitalize mx-0 my-8 font-300 font-size-[1.8rem]"
					data-test-id="sign-heading"
				>
					{{ t('authModule.headings.signUp') }}
				</h1>

				<router-view />
			</el-card>

			<div
				v-else
				class="mb-5"
			>
				<router-link
					:to="{ name: RouteNames.SIGN_IN }"
					class="block w-[8rem] my-0 mx-a"
				>
					<logo class="fill-brand-primary" />
				</router-link>

				<h1
					v-if="route.name === RouteNames.SIGN_IN"
					class="text-center capitalize mx-0 my-8 font-300 font-size-[1.8rem]"
				>
					{{ t('authModule.headings.signIn') }}
				</h1>

				<h1
					v-if="route.name === RouteNames.SIGN_UP"
					class="text-center capitalize mx-0 my-8 font-300 font-size-[1.8rem]"
				>
					{{ t('authModule.headings.signUp') }}
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
import { useRoute } from 'vue-router';

import { ElCard, ElDivider, ElIcon, ElLink } from 'element-plus';

import { Icon } from '@iconify/vue';

// @ts-expect-error imported SVG files are without TS
import Logo from '../../../assets/images/fb_bird.svg?component';
import { useBreakpoints } from '../../../common';
import { RouteNames } from '../auth.constants';

defineOptions({
	name: 'LayoutSign',
});

const { t } = useI18n();

const route = useRoute();
const { isMDDevice } = useBreakpoints();
</script>

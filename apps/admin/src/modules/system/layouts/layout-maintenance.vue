<template>
	<div class="flex flex-row items-center align-center w-full h-full">
		<div class="mx-a w-[28rem]">
			<el-card
				v-if="isMDDevice"
				class="mb-5"
			>
				<div class="block w-[8rem] my-0 mx-a">
					<el-icon :size="130">
						<icon
							:icon="pageIcon"
							class="color-brand-primary"
						/>
					</el-icon>
				</div>

				<h1
					class="text-center capitalize mx-0 my-8 font-300 font-size-[1.8rem]"
					data-test-id="maintenance-heading"
				>
					{{ pageHeading }}
				</h1>

				<router-view />
			</el-card>

			<div
				v-else
				class="mb-5"
			>
				<div class="block w-[8rem] my-0 mx-a">
					<el-icon :size="130">
						<icon
							:icon="pageIcon"
							class="color-brand-primary"
						/>
					</el-icon>
				</div>

				<h1 class="text-center capitalize mx-0 my-8 font-300 font-size-[1.8rem]">
					{{ pageHeading }}
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
						href="https://github.com/fastybird"
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
						href="https://x.com/fastybird"
						target="_blank"
						class="mx-5"
					>
						<template #icon>
							<el-icon :size="20">
								<icon icon="fa6-brands:x-twitter" />
							</el-icon>
						</template>
					</el-link>

					<el-divider direction="vertical" />

					<el-link
						underline="never"
						href="https://discord.gg/HPRJ2GzK"
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
						href="https://www.facebook.com/fastybird"
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
						href="https://smart-panel.fastybird.com"
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
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import { ElCard, ElDivider, ElIcon, ElLink } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useBreakpoints } from '../../../common';
import { RouteNames } from '../system.constants';

defineOptions({
	name: 'LayoutMaintenance',
});

const { t } = useI18n();
const route = useRoute();

const { isMDDevice } = useBreakpoints();

const pageIcon = computed(() => {
	switch (route.name) {
		case RouteNames.FACTORY_RESET:
			return 'mdi:backup-restore';
		case RouteNames.REBOOTING:
		case RouteNames.SERVICE_RESTARTING:
			return 'mdi:restart';
		default:
			return 'mdi:power';
	}
});

const pageHeading = computed(() => {
	switch (route.name) {
		case RouteNames.FACTORY_RESET:
			return t('systemModule.headings.manage.factoryReset');
		case RouteNames.REBOOTING:
			return t('systemModule.headings.manage.rebooting');
		case RouteNames.SERVICE_RESTARTING:
			return t('systemModule.headings.manage.serviceRestart');
		default:
			return t('systemModule.headings.manage.poweredOff');
	}
});
</script>

<template>
	<el-card
		shadow="never"
		header-class="px-3! py-3! font-bold"
		body-class="p-0!"
	>
		<template #header>
			{{ t('statsModule.headings.systemInformation') }}
		</template>

		<el-descriptions
			v-loading="loading"
			:column="1"
			size="small"
			border
		>
			<el-descriptions-item
				:label-width="150"
				class-name="border-l-none! border-t-none!"
				label-class-name="border-l-none! border-t-none!"
			>
				<template #label>
					{{ t('statsModule.fields.systemInformation.timezone.title') }}
				</template>

				{{ systemInfo?.os.timezone }}
			</el-descriptions-item>

			<el-descriptions-item
				:label-width="150"
				class-name="border-l-none! border-t-none!"
				label-class-name="border-l-none! border-t-none!"
			>
				<template #label>
					{{ t('statsModule.fields.systemInformation.operatingSystem.title') }}
				</template>

				{{ systemInfo?.os.distro }} {{ systemInfo?.os.platform }} {{ systemInfo?.os.release }}
			</el-descriptions-item>

			<el-descriptions-item
				:label-width="150"
				class-name="border-l-none! border-t-none!"
				label-class-name="border-l-none! border-t-none!"
			>
				<template #label>
					{{ t('statsModule.fields.systemInformation.hostname.title') }}
				</template>

				{{ systemInfo?.defaultNetwork.hostname }}
			</el-descriptions-item>

			<el-descriptions-item
				:label-width="150"
				class-name="border-l-none! border-t-none!"
				label-class-name="border-l-none! border-t-none!"
			>
				<template #label>{{ t('statsModule.fields.systemInformation.ipv4.title') }} ({{ systemInfo?.defaultNetwork.interface }})</template>

				{{ systemInfo?.defaultNetwork.ip4 }}
			</el-descriptions-item>

			<el-descriptions-item
				:label-width="150"
				class-name="border-l-none! border-t-none!"
				label-class-name="border-l-none! border-t-none!"
			>
				<template #label>{{ t('statsModule.fields.systemInformation.ipv6.title') }} ({{ systemInfo?.defaultNetwork.interface }})</template>

				{{ systemInfo?.defaultNetwork.ip6 }}
			</el-descriptions-item>

			<el-descriptions-item
				:label-width="150"
				class-name="border-l-none! border-t-none! border-b-none! config-path-cell"
				label-class-name="border-l-none! border-t-none! border-b-none! whitespace-nowrap!"
			>
				<template #label>
					{{ t('statsModule.fields.systemInformation.configPath.title') }}
				</template>

				<el-tooltip placement="top-start">
					<template #content>
						<div class="flex flex-col gap-2">
							<div class="font-bold">{{ t('statsModule.fields.systemInformation.configPath.tooltip') }}</div>
							<span class="font-mono text-xs">{{ configApp?.path }}</span>
							<el-button
								size="small"
								type="primary"
								@click.stop="copyPath"
							>
								{{ t('statsModule.buttons.copy.title') }}
							</el-button>
						</div>
					</template>

					<span class="block overflow-hidden text-ellipsis whitespace-nowrap pr-4">
						{{ configApp?.path }}
					</span>
				</el-tooltip>
			</el-descriptions-item>
		</el-descriptions>
	</el-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard, ElDescriptions, ElDescriptionsItem, ElTooltip, vLoading } from 'element-plus';

import { useFlashMessage } from '../../../common';

import type { ISystemInformationProps } from './system-information.types';

defineOptions({
	name: 'SystemInformation',
});

const props = withDefaults(defineProps<ISystemInformationProps>(), {
	loading: false,
});

const { t } = useI18n();
const { success } = useFlashMessage();

const copyPath = (): void => {
	navigator.clipboard.writeText(props.configApp?.path || '');

	success('Config path copied to clipboard!');
};
</script>

<style>
.config-path-cell {
	max-width: 0;
	overflow: hidden;
}
</style>

<template>
	<!-- Template 6: the System information panel -->
	<el-card
		v-loading="props.loading"
		shadow="never"
		body-class="flex flex-col gap-3 p-4!"
		data-test-id="system-information"
	>
		<span class="text-card-title">{{ t('statsModule.headings.systemInformation') }}</span>

		<kv-grid
			:items="items"
			:cols="2"
		/>

		<copy-field
			v-if="props.configApp?.path"
			:value="props.configApp.path"
			:label="t('statsModule.fields.systemInformation.configPath.title')"
		/>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard, vLoading } from 'element-plus';

import { CopyField, KvGrid, type KvGridItem } from '../../../common';

import type { ISystemInformationProps } from './system-information.types';

defineOptions({
	name: 'SystemInformation',
});

const props = withDefaults(defineProps<ISystemInformationProps>(), {
	loading: false,
});

const { t } = useI18n();

const network = computed<string>((): string => props.systemInfo?.defaultNetwork.interface ?? '');

const items = computed<KvGridItem[]>((): KvGridItem[] => [
	{ label: t('statsModule.fields.systemInformation.timezone.title'), value: props.systemInfo?.os.timezone },
	{
		label: t('statsModule.fields.systemInformation.operatingSystem.title'),
		value: [props.systemInfo?.os.distro, props.systemInfo?.os.platform, props.systemInfo?.os.release].filter((part) => part).join(' '),
	},
	{ label: t('statsModule.fields.systemInformation.hostname.title'), value: props.systemInfo?.defaultNetwork.hostname, mono: true },
	{
		label: network.value
			? `${t('statsModule.fields.systemInformation.ipv4.title')} (${network.value})`
			: t('statsModule.fields.systemInformation.ipv4.title'),
		value: props.systemInfo?.defaultNetwork.ip4,
		mono: true,
	},
	{
		label: network.value
			? `${t('statsModule.fields.systemInformation.ipv6.title')} (${network.value})`
			: t('statsModule.fields.systemInformation.ipv6.title'),
		value: props.systemInfo?.defaultNetwork.ip6,
		mono: true,
	},
]);
</script>

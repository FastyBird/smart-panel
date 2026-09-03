<template>
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<template
			v-for="provider in providers"
			:key="provider.type"
		>
			<component
				:is="getElement(provider.type)?.components?.providerCard"
				v-if="getElement(provider.type)?.components?.providerCard"
				:provider="provider"
			/>

			<el-card
				v-else
				shadow="never"
			>
				<template #header>
					<div class="flex items-center justify-between gap-2">
						<span class="font-medium">{{ provider.type }}</span>
						<el-tag :type="stateTagType(provider.state)">
							{{ t(`remoteAccessModule.status.${provider.state}`) }}
						</el-tag>
					</div>
				</template>

				<p
					v-if="provider.message"
					class="text-sm text-gray-500"
				>
					{{ provider.message }}
				</p>

				<ul
					v-if="provider.endpoints.length > 0"
					class="mt-2 flex flex-col gap-1"
				>
					<li
						v-for="endpoint in provider.endpoints"
						:key="endpoint.url"
						class="text-sm font-mono break-all"
					>
						{{ endpoint.label }} &mdash; {{ endpoint.url }}
					</li>
				</ul>

				<p
					v-else-if="!provider.message"
					class="text-sm text-gray-400"
				>
					{{ t('remoteAccessModule.texts.noEndpoints') }}
				</p>
			</el-card>
		</template>

		<el-empty
			v-if="providers.length === 0"
			:description="t('remoteAccessModule.texts.noProviders')"
		/>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElCard, ElEmpty, ElTag } from 'element-plus';

import { useRemoteAccessProviders } from '../composables';
import type { IRemoteAccessProvider } from '../store/remote-access-status.store.types';

defineOptions({
	name: 'ProviderCards',
});

const { t } = useI18n();

const { providers, getElement } = useRemoteAccessProviders();

const stateTagType = (state: IRemoteAccessProvider['state']): 'success' | 'warning' | 'danger' | 'info' => {
	switch (state) {
		case 'connected':
			return 'success';
		case 'error':
			return 'danger';
		case 'connecting':
		case 'pending-auth':
		case 'pending-approval':
		case 'setup-required':
			return 'warning';
		default:
			return 'info';
	}
};
</script>

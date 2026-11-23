<template>
	<state-view
		v-if="providers.length === 0"
		icon="mdi:lan-disconnect"
		:title="t('remoteAccessModule.texts.noProviders')"
		data-test-id="provider-catalogue-empty"
	/>

	<!-- Template 2, catalogue: the host owns each card's frame, so the cards of every plugin share equal heights and
		the active provider's 2 px primary border -->
	<ul
		v-else
		class="card-grid auto-rows-fr m-0 p-0 list-none"
		data-test-id="provider-catalogue"
	>
		<li
			v-for="provider in providers"
			:key="provider.type"
			:class="[
				'min-w-0 rounded-lg border border-solid bg-surface',
				isActive(provider) ? 'border-[var(--el-color-primary)] shadow-[0_0_0_1px_var(--el-color-primary)]' : 'border-light',
			]"
			:data-provider-type="provider.type"
			:data-active="isActive(provider) ? 'true' : undefined"
			data-test-id="provider-catalogue-item"
		>
			<component
				:is="getElement(provider.type)?.components?.providerCard"
				v-if="getElement(provider.type)?.components?.providerCard"
				:provider="provider"
			/>

			<!-- A provider without a plugin card: what the status says about it -->
			<provider-card
				v-else
				icon="mdi:lan-connect"
				:title="provider.type"
				:status="providerStateStatus(provider.state)"
				:status-label="t(`remoteAccessModule.status.${provider.state}`)"
				:line="{ text: provider.message || (provider.endpoints.length === 0 ? t('remoteAccessModule.texts.noEndpoints') : '') }"
				:endpoints="provider.endpoints.map((endpoint) => endpoint.url)"
			/>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { StateView } from '../../../common';
import { useRemoteAccessProviders } from '../composables';
import { providerStateStatus } from '../remote-access.constants';
import type { IRemoteAccessProvider } from '../store/remote-access-status.store.types';

import ProviderCard from './provider-card.vue';

defineOptions({
	name: 'ProviderCards',
});

const { t } = useI18n();

const { providers, getElement } = useRemoteAccessProviders();

// The provider carrying traffic right now
const isActive = (provider: IRemoteAccessProvider): boolean => provider.state === 'connected';
</script>

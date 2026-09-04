<template>
	<el-result
		v-if="providers.length === 0"
		icon="info"
		:title="t('remoteAccessModule.texts.noProviders')"
	/>

	<div
		v-else
		class="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] max-sm:grid-cols-1 gap-3"
	>
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
				class="provider-card"
				shadow="hover"
				header-class="py-2!"
				body-class="py-3!"
			>
				<template #header>
					<div class="provider-card__header">
						<div class="provider-card__heading">
							<icon
								icon="mdi:lan-connect"
								class="provider-card__icon"
							/>
							<h3 class="provider-card__title">{{ provider.type }}</h3>
						</div>
						<div class="provider-card__tags">
							<el-tag
								:type="stateTagType(provider.state)"
								size="small"
							>
								{{ t(`remoteAccessModule.status.${provider.state}`) }}
							</el-tag>
						</div>
					</div>
				</template>

				<div class="provider-card__content">
					<p
						v-if="provider.message"
						class="provider-card__description"
					>
						{{ provider.message }}
					</p>
					<p
						v-else-if="provider.endpoints.length === 0"
						class="provider-card__description provider-card__description--empty"
					>
						{{ t('remoteAccessModule.texts.noEndpoints') }}
					</p>

					<ul
						v-if="provider.endpoints.length > 0"
						class="flex flex-col gap-1"
					>
						<li
							v-for="endpoint in provider.endpoints"
							:key="endpoint.url"
							class="text-sm font-mono break-all"
						>
							{{ endpoint.label }} &mdash; {{ endpoint.url }}
						</li>
					</ul>
				</div>
			</el-card>
		</template>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElCard, ElResult, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

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

<style scoped>
.provider-card {
	transition: opacity 0.2s ease;
}

.provider-card__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem;
}

.provider-card__heading {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	min-width: 0;
	flex: 1;
}

.provider-card__icon {
	font-size: 1.5rem;
	flex-shrink: 0;
	color: var(--el-color-primary);
}

.provider-card__title {
	margin: 0;
	font-size: 1rem;
	font-weight: 600;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	line-height: 1.25;
}

.provider-card__tags {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	flex-shrink: 0;
	gap: 0.375rem;
}

.provider-card__content {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.provider-card__description {
	margin: 0;
	color: var(--el-text-color-regular);
	line-height: 1.5;
}

.provider-card__description--empty {
	font-style: italic;
	color: var(--el-text-color-secondary);
}
</style>

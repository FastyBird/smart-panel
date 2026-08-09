<template>
	<view-header
		:heading="t('mcpModule.oauthConsent.title')"
		:sub-heading="t('mcpModule.oauthConsent.subtitle')"
		icon="mdi:shield-account-outline"
	/>

	<div class="mcp-oauth-consent">
		<el-card
			v-loading="loading || working"
			shadow="never"
		>
			<el-alert
				v-if="error || invalidInteraction"
				type="error"
				:title="t('mcpModule.oauthConsent.invalid')"
				:closable="false"
				show-icon
			/>

			<template v-else-if="interaction?.action === 'consent'">
				<dl class="consent-details">
					<div>
						<dt>{{ t('mcpModule.oauthConsent.installation') }}</dt>
						<dd>
							<div class="font-600">{{ interaction.installationName }}</div>
							<code>{{ interaction.installationId }}</code>
						</dd>
					</div>
					<div>
						<dt>{{ t('mcpModule.oauthConsent.client') }}</dt>
						<dd>
							<div class="font-600">{{ interaction.clientName }}</div>
							<code>{{ interaction.clientIdentifier }}</code>
						</dd>
					</div>
					<div>
						<dt>{{ t('mcpModule.oauthConsent.redirect') }}</dt>
						<dd>
							<code class="break-all">{{ interaction.redirectUri }}</code>
						</dd>
					</div>
				</dl>

				<el-alert
					v-if="interaction.physicalDeviceWarning"
					type="warning"
					:title="t('mcpModule.oauthConsent.physicalWarningTitle')"
					:description="t('mcpModule.oauthConsent.physicalWarning')"
					:closable="false"
					show-icon
					class="mb-5"
				/>

				<el-form label-position="top">
					<el-form-item :label="t('mcpModule.oauthConsent.scopes')">
						<el-checkbox-group v-model="selectedScopes">
							<div
								v-for="scope in interaction.requestedScopes"
								:key="scope"
								class="scope-option"
							>
								<el-checkbox :value="scope">
									{{ t(`mcpModule.oauthConsent.scope.${scope}`) }}
								</el-checkbox>
							</div>
						</el-checkbox-group>
						<div
							v-if="scopeError"
							class="el-form-item__error static"
						>
							{{ t('mcpModule.oauthConsent.scopeRequired') }}
						</div>
					</el-form-item>

					<el-form-item :label="t('mcpModule.oauthConsent.grantExpiry')">
						<el-input-number
							v-model="expiresInDays"
							:min="1"
							:max="interaction.maximumGrantExpiresInDays"
							name="oauthGrantExpiresInDays"
						/>
						<div class="text-sm text-gray-500 mt-1">
							{{ t('mcpModule.oauthConsent.accessExpiry', { minutes: accessExpiryMinutes }) }}
						</div>
					</el-form-item>
				</el-form>

				<div class="consent-actions">
					<el-button
						:disabled="working"
						@click="denyInteraction"
					>
						{{ t('mcpModule.oauthConsent.deny') }}
					</el-button>
					<el-button
						type="primary"
						:loading="working"
						@click="approveInteraction"
					>
						{{ t('mcpModule.oauthConsent.approve') }}
					</el-button>
				</div>
			</template>

			<div
				v-else
				class="py-12 text-center text-gray-500"
			>
				{{ t('mcpModule.oauthConsent.loading') }}
			</div>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { useRoute } from 'vue-router';

import { ViewHeader } from '../../../common';
import { useMcpOAuthInteraction } from '../composables/useMcpOAuthInteraction';
import { McpOAuthScope } from '../mcp.constants';

defineOptions({ name: 'ViewMcpOAuthConsent' });

const { t } = useI18n();
const route = useRoute();
const { interaction, loading, working, error, load, approve, deny } = useMcpOAuthInteraction();
const selectedScopes = ref<McpOAuthScope[]>([]);
const expiresInDays = ref(90);
const scopeError = ref(false);
const uid = computed(() => (typeof route.query.interaction === 'string' ? route.query.interaction : null));
const invalidInteraction = computed(() => uid.value === null);
const accessExpiryMinutes = computed(() => Math.floor((interaction.value?.accessExpiresInSeconds ?? 0) / 60));

const navigate = (target: string): void => {
	window.location.assign(target);
};

const approveInteraction = async (): Promise<void> => {
	if (!uid.value) return;

	const hasCapability = selectedScopes.value.some((scope) => scope !== McpOAuthScope.OFFLINE_ACCESS);
	scopeError.value = !hasCapability;
	if (!hasCapability) return;

	try {
		const completion = await approve(uid.value, selectedScopes.value, expiresInDays.value);
		navigate(completion.redirectTo);
	} catch {
		// The composable exposes the request error for the in-page alert.
	}
};

const denyInteraction = async (): Promise<void> => {
	if (!uid.value) return;

	try {
		const completion = await deny(uid.value);
		navigate(completion.redirectTo);
	} catch {
		// The composable exposes the request error for the in-page alert.
	}
};

onMounted(async () => {
	if (!uid.value) return;

	let loaded;

	try {
		loaded = await load(uid.value);
	} catch {
		return;
	}

	if (loaded.action === 'redirect' && loaded.redirectTo) {
		navigate(loaded.redirectTo);
		return;
	}

	selectedScopes.value = [...(loaded.requestedScopes ?? [])];
	expiresInDays.value = loaded.maximumGrantExpiresInDays ?? 90;
});

useMeta({ title: t('mcpModule.oauthConsent.title') });
</script>

<style scoped>
.mcp-oauth-consent {
	max-width: 760px;
	margin: 0 auto;
}

.consent-details {
	display: grid;
	gap: 1rem;
	margin: 0 0 1.5rem;
}

.consent-details > div {
	display: grid;
	grid-template-columns: minmax(140px, 0.32fr) 1fr;
	gap: 1rem;
	padding-bottom: 1rem;
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.consent-details dt {
	font-weight: 600;
}

.consent-details dd {
	margin: 0;
	min-width: 0;
}

.scope-option {
	margin-bottom: 0.75rem;
}

.consent-actions {
	display: flex;
	justify-content: flex-end;
	gap: 0.75rem;
	margin-top: 1.5rem;
}

@media (max-width: 640px) {
	.consent-details > div {
		grid-template-columns: 1fr;
		gap: 0.35rem;
	}
}
</style>

<template>
	<div
		class="flex justify-center items-start tp:items-center w-full min-h-full box-border p-4 tp:p-6 overflow-y-auto"
		data-test-id="mcp-oauth-consent"
	>
		<!-- Template 10, standalone: a centred card with the brand mark and large buttons. Seen by someone coming from
		     another app, so it carries no sidebar or header that would make it look like a different page -->
		<section
			class="flex flex-col gap-5 w-full max-w-[480px] box-border p-5 tp:p-8 bg-surface border border-solid border-light rounded-lg"
			aria-labelledby="mcp-oauth-consent-title"
		>
			<div class="flex flex-col items-center gap-3 text-center">
				<logo
					class="w-16 fill-brand"
					aria-hidden="true"
				/>
				<h1
					id="mcp-oauth-consent-title"
					class="m-0 text-[22px] leading-[30px] font-600 text-default"
				>
					{{ t('mcpModule.oauthConsent.title') }}
				</h1>
				<p class="m-0 text-help">{{ t('mcpModule.oauthConsent.subtitle') }}</p>
			</div>

			<state-view
				v-if="error || invalidInteraction"
				kind="error"
				icon="mdi:shield-alert-outline"
				:title="t('mcpModule.oauthConsent.invalid')"
				data-test-id="mcp-oauth-consent-invalid"
			/>

			<template v-else-if="interaction?.action === 'consent'">
				<dl class="flex flex-col gap-3 m-0">
					<div class="flex flex-col gap-0.5 min-w-0">
						<dt class="text-label">{{ t('mcpModule.oauthConsent.client') }}</dt>
						<dd class="flex flex-col m-0 min-w-0">
							<span class="text-card-title">{{ interaction.clientName }}</span>
							<span class="text-mono text-secondary break-all">{{ interaction.clientIdentifier }}</span>
						</dd>
					</div>
					<div class="flex flex-col gap-0.5 min-w-0">
						<dt class="text-label">{{ t('mcpModule.oauthConsent.installation') }}</dt>
						<dd class="flex flex-col m-0 min-w-0">
							<span class="text-card-title">{{ interaction.installationName }}</span>
							<span class="text-mono text-secondary break-all">{{ interaction.installationId }}</span>
						</dd>
					</div>
					<div class="flex flex-col gap-0.5 min-w-0">
						<dt class="text-label">{{ t('mcpModule.oauthConsent.redirect') }}</dt>
						<dd class="m-0 min-w-0">
							<span class="text-mono break-all">{{ interaction.redirectUri }}</span>
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
				/>

				<el-form
					label-position="top"
					class="flex flex-col"
				>
					<el-form-item :label="t('mcpModule.oauthConsent.scopes')">
						<el-checkbox-group
							v-model="selectedScopes"
							class="flex flex-col items-start gap-2"
						>
							<el-checkbox
								v-for="scope in interaction.requestedScopes"
								:key="scope"
								:value="scope"
								class="h-auto! mr-0! whitespace-normal!"
							>
								{{ t(`mcpModule.oauthConsent.scope.${scope}`) }}
							</el-checkbox>
						</el-checkbox-group>
						<span
							v-if="scopeError"
							class="w-full mt-1 text-danger text-help"
							role="alert"
							data-test-id="mcp-oauth-consent-scope-error"
						>
							{{ t('mcpModule.oauthConsent.scopeRequired') }}
						</span>
					</el-form-item>

					<el-form-item
						:label="t('mcpModule.oauthConsent.grantExpiry')"
						class="mb-0!"
					>
						<div class="flex flex-col gap-1 w-full">
							<el-input-number
								v-model="expiresInDays"
								:min="1"
								:max="interaction.maximumGrantExpiresInDays"
								name="oauthGrantExpiresInDays"
							/>
							<span class="text-help">
								{{ t('mcpModule.oauthConsent.accessExpiry', { minutes: accessExpiryMinutes }) }}
							</span>
							<span
								v-if="interaction.requestedScopes?.includes(McpOAuthScope.OFFLINE_ACCESS)"
								class="text-help"
							>
								{{ t('mcpModule.oauthConsent.offlineAccess') }}
							</span>
						</div>
					</el-form-item>
				</el-form>

				<!-- Large buttons, the primary one first on phone and rightmost from tablet up -->
				<div class="flex flex-col-reverse tp:flex-row gap-3">
					<el-button
						:disabled="working"
						size="large"
						class="flex-1 ml-0!"
						data-test-id="mcp-oauth-consent-deny"
						@click="denyInteraction"
					>
						{{ t('mcpModule.oauthConsent.deny') }}
					</el-button>
					<el-button
						type="primary"
						:loading="working"
						size="large"
						class="flex-1 ml-0!"
						data-test-id="mcp-oauth-consent-approve"
						@click="approveInteraction"
					>
						{{ t('mcpModule.oauthConsent.approve') }}
					</el-button>
				</div>
			</template>

			<state-view
				v-else
				kind="loading"
				icon="mdi:shield-account-outline"
				:title="t('mcpModule.oauthConsent.loading')"
			/>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { useRoute } from 'vue-router';

import { ElAlert, ElButton, ElCheckbox, ElCheckboxGroup, ElForm, ElFormItem, ElInputNumber } from 'element-plus';

import Logo from '../../../assets/images/fb_bird.svg?component';
import { StateView } from '../../../common';
import { useMcpOAuthInteraction } from '../composables/useMcpOAuthInteraction';
import { McpOAuthScope } from '../mcp.constants';

defineOptions({ name: 'ViewMcpOAuthConsent' });

const { t } = useI18n();
const route = useRoute();
const { interaction, working, error, load, approve, deny } = useMcpOAuthInteraction();
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

	selectedScopes.value = (loaded.requestedScopes ?? []).filter((scope) => scope === McpOAuthScope.READ || scope === McpOAuthScope.OFFLINE_ACCESS);
	expiresInDays.value = loaded.maximumGrantExpiresInDays ?? 90;
});

useMeta({ title: t('mcpModule.oauthConsent.title') });
</script>

<template>
	<view-header
		:heading="t('mcpModule.oauthManagement.title')"
		:sub-heading="t('mcpModule.oauthManagement.subtitle')"
		icon="mdi:shield-key-outline"
	>
		<template #extra>
			<el-button
				type="danger"
				plain
				@click="confirmGlobalRevoke"
			>
				<icon icon="mdi:shield-remove-outline" />
				{{ t('mcpModule.oauthManagement.revokeAll') }}
			</el-button>
			<el-button
				type="primary"
				@click="openCreate"
			>
				<icon icon="mdi:plus" />
				{{ t('mcpModule.oauthManagement.createClient') }}
			</el-button>
		</template>
	</view-header>

	<div class="mcp-oauth-page">
		<el-alert
			type="info"
			:title="t('mcpModule.oauthManagement.securityTitle')"
			:description="t('mcpModule.oauthManagement.securityDescription')"
			:closable="false"
			show-icon
		/>

		<el-alert
			v-if="error"
			type="error"
			:title="t('mcpModule.oauthManagement.messages.loadFailed')"
			:closable="false"
			show-icon
		/>

		<el-card
			v-loading="loading"
			shadow="never"
		>
			<el-tabs v-model="activeTab">
				<el-tab-pane
					name="clients"
					:label="t('mcpModule.oauthManagement.tabs.clients')"
				>
					<el-table
						:data="clients"
						row-key="id"
					>
						<el-table-column type="expand">
							<template #default="scope">
								<div class="mcp-oauth-details">
									<div>
										<strong>{{ t('mcpModule.oauthManagement.clientId') }}:</strong>
										{{ scope.row.clientIdentifier }}
									</div>
									<div>
										<strong>{{ t('mcpModule.oauthManagement.redirectUris') }}:</strong>
									</div>
									<ul>
										<li
											v-for="redirectUri in scope.row.redirectUris"
											:key="redirectUri"
										>
											{{ redirectUri }}
										</li>
									</ul>
								</div>
							</template>
						</el-table-column>
						<el-table-column
							prop="name"
							:label="t('mcpModule.oauthManagement.columns.client')"
							min-width="180"
						/>
						<el-table-column
							:label="t('mcpModule.oauthManagement.columns.status')"
							width="120"
						>
							<template #default="scope">
								<el-tag :type="scope.row.enabled ? 'success' : 'warning'">
									{{ t(`mcpModule.oauthManagement.status.${scope.row.enabled ? 'active' : 'disabled'}`) }}
								</el-tag>
							</template>
						</el-table-column>
						<el-table-column
							:label="t('mcpModule.oauthManagement.columns.scopes')"
							min-width="250"
						>
							<template #default="scope"><scope-tags :scopes="scope.row.maximumScopes" /></template>
						</el-table-column>
						<el-table-column
							fixed="right"
							:label="t('mcpModule.oauthManagement.columns.actions')"
							width="190"
						>
							<template #default="scope">
								<el-button
									size="small"
									@click="openEdit(scope.row)"
								>
									{{ t('mcpModule.actions.edit') }}
								</el-button>
								<el-button
									size="small"
									type="danger"
									plain
									:disabled="!scope.row.enabled"
									@click="confirmClientRevoke(scope.row)"
								>
									{{ t('mcpModule.actions.revoke') }}
								</el-button>
							</template>
						</el-table-column>
						<template #empty>{{ t('mcpModule.oauthManagement.empty.clients') }}</template>
					</el-table>
				</el-tab-pane>

				<el-tab-pane
					name="grants"
					:label="t('mcpModule.oauthManagement.tabs.grants')"
				>
					<el-table
						:data="grants"
						row-key="id"
					>
						<el-table-column
							prop="clientName"
							:label="t('mcpModule.oauthManagement.columns.client')"
							min-width="170"
						/>
						<el-table-column
							:label="t('mcpModule.oauthManagement.columns.status')"
							width="120"
						>
							<template #default="scope">
								<el-tag :type="grantStatus(scope.row).type">{{ t(`mcpModule.oauthManagement.status.${grantStatus(scope.row).key}`) }}</el-tag>
							</template>
						</el-table-column>
						<el-table-column
							:label="t('mcpModule.oauthManagement.columns.scopes')"
							min-width="250"
						>
							<template #default="scope"><scope-tags :scopes="scope.row.approvedScopes" /></template>
						</el-table-column>
						<el-table-column
							:label="t('mcpModule.oauthManagement.columns.expires')"
							width="190"
						>
							<template #default="scope">{{ formatDate(scope.row.expiresAt) }}</template>
						</el-table-column>
						<el-table-column
							fixed="right"
							:label="t('mcpModule.oauthManagement.columns.actions')"
							width="190"
						>
							<template #default="scope">
								<el-button
									size="small"
									:disabled="!canEditGrant(scope.row)"
									@click="openGrantEdit(scope.row)"
								>
									{{ t('mcpModule.actions.edit') }}
								</el-button>
								<el-button
									size="small"
									type="danger"
									plain
									:disabled="!canRevokeGrant(scope.row)"
									@click="confirmGrantRevoke(scope.row)"
								>
									{{ t('mcpModule.actions.revoke') }}
								</el-button>
							</template>
						</el-table-column>
						<template #empty>{{ t('mcpModule.oauthManagement.empty.grants') }}</template>
					</el-table>
				</el-tab-pane>

				<el-tab-pane
					name="accessTokens"
					:label="t('mcpModule.oauthManagement.tabs.accessTokens')"
				>
					<el-table
						:data="accessTokens"
						row-key="id"
					>
						<el-table-column
							prop="clientName"
							:label="t('mcpModule.oauthManagement.columns.client')"
							min-width="170"
						/>
						<el-table-column
							:label="t('mcpModule.oauthManagement.columns.scopes')"
							min-width="250"
						>
							<template #default="scope"><scope-tags :scopes="scope.row.scopes" /></template>
						</el-table-column>
						<el-table-column
							:label="t('mcpModule.oauthManagement.columns.expires')"
							width="190"
						>
							<template #default="scope">{{ formatDate(scope.row.expiresAt) }}</template>
						</el-table-column>
						<el-table-column
							fixed="right"
							:label="t('mcpModule.oauthManagement.columns.actions')"
							width="120"
						>
							<template #default="scope">
								<el-button
									size="small"
									type="danger"
									plain
									@click="confirmAccessTokenRevoke(scope.row)"
								>
									{{ t('mcpModule.actions.revoke') }}
								</el-button>
							</template>
						</el-table-column>
						<template #empty>{{ t('mcpModule.oauthManagement.empty.accessTokens') }}</template>
					</el-table>
				</el-tab-pane>

				<el-tab-pane
					name="refreshFamilies"
					:label="t('mcpModule.oauthManagement.tabs.refreshFamilies')"
				>
					<el-table
						:data="refreshFamilies"
						row-key="id"
					>
						<el-table-column
							prop="clientName"
							:label="t('mcpModule.oauthManagement.columns.client')"
							min-width="180"
						/>
						<el-table-column
							prop="activeTokenCount"
							:label="t('mcpModule.oauthManagement.columns.activeTokens')"
							width="140"
						/>
						<el-table-column
							:label="t('mcpModule.oauthManagement.columns.expires')"
							width="190"
						>
							<template #default="scope">{{ formatDate(scope.row.expiresAt) }}</template>
						</el-table-column>
						<el-table-column
							fixed="right"
							:label="t('mcpModule.oauthManagement.columns.actions')"
							width="120"
						>
							<template #default="scope">
								<el-button
									size="small"
									type="danger"
									plain
									@click="confirmRefreshFamilyRevoke(scope.row)"
								>
									{{ t('mcpModule.actions.revoke') }}
								</el-button>
							</template>
						</el-table-column>
						<template #empty>{{ t('mcpModule.oauthManagement.empty.refreshFamilies') }}</template>
					</el-table>
				</el-tab-pane>
			</el-tabs>
		</el-card>
	</div>

	<el-drawer
		v-model="showClientDialog"
		:title="editingClient ? t('mcpModule.oauthManagement.editClient') : t('mcpModule.oauthManagement.createClient')"
		:size="isLGDevice ? '40%' : '100%'"
		data-test-id="mcp-oauth-client-form-drawer"
		@closed="resetClientForm"
	>
		<el-form
			ref="clientFormEl"
			:model="clientForm"
			:rules="clientRules"
			label-position="top"
		>
			<el-form-item
				:label="t('mcpModule.oauthManagement.name')"
				prop="name"
			>
				<el-input
					v-model="clientForm.name"
					maxlength="100"
				/>
			</el-form-item>
			<el-form-item
				:label="t('mcpModule.oauthManagement.redirectUris')"
				prop="redirectUris"
			>
				<div class="redirect-list">
					<div
						v-for="(_redirectUri, index) in clientForm.redirectUris"
						:key="index"
						class="redirect-row"
					>
						<el-input v-model="clientForm.redirectUris[index]" />
						<el-button
							:aria-label="t('mcpModule.actions.removeOrigin')"
							:disabled="clientForm.redirectUris.length === 1"
							@click="clientForm.redirectUris.splice(index, 1)"
						>
							<icon icon="mdi:delete-outline" />
						</el-button>
					</div>
					<el-button @click="clientForm.redirectUris.push('')">
						<icon icon="mdi:plus" />
						{{ t('mcpModule.oauthManagement.addRedirect') }}
					</el-button>
				</div>
			</el-form-item>
			<el-form-item
				:label="t('mcpModule.oauthManagement.columns.scopes')"
				prop="maximumScopes"
			>
				<el-checkbox-group v-model="clientForm.maximumScopes">
					<el-checkbox
						v-for="scope in scopeOptions"
						:key="scope"
						:value="scope"
					>
						{{ t(`mcpModule.oauthManagement.scope.${scope}`) }}
					</el-checkbox>
				</el-checkbox-group>
			</el-form-item>
			<el-alert
				v-if="clientHasPhysicalScope"
				type="warning"
				:description="t('mcpModule.oauthManagement.physicalWarning')"
				:closable="false"
				show-icon
			/>
		</el-form>
		<template #footer>
			<el-button @click="showClientDialog = false">{{ t('mcpModule.actions.cancel') }}</el-button>
			<el-button
				type="primary"
				:loading="saving"
				@click="saveClient"
			>
				{{ editingClient ? t('mcpModule.actions.save') : t('mcpModule.actions.create') }}
			</el-button>
		</template>
	</el-drawer>

	<el-drawer
		v-model="showGrantDialog"
		:title="t('mcpModule.oauthManagement.editGrant')"
		:size="isLGDevice ? '40%' : '100%'"
		data-test-id="mcp-oauth-grant-form-drawer"
		@closed="resetGrantForm"
	>
		<el-form
			ref="grantFormEl"
			:model="grantForm"
			:rules="grantRules"
			label-position="top"
		>
			<el-form-item
				:label="t('mcpModule.oauthManagement.columns.scopes')"
				prop="approvedScopes"
			>
				<el-checkbox-group v-model="grantForm.approvedScopes">
					<el-checkbox
						v-for="scope in grantScopeOptions"
						:key="scope"
						:value="scope"
						:disabled="scope === McpOAuthScope.OFFLINE_ACCESS"
					>
						{{ t(`mcpModule.oauthManagement.scope.${scope}`) }}
					</el-checkbox>
				</el-checkbox-group>
			</el-form-item>
			<el-alert
				v-if="grantHasPhysicalScope"
				type="warning"
				:description="t('mcpModule.oauthManagement.physicalWarning')"
				:closable="false"
				show-icon
			/>
			<el-alert
				type="info"
				:description="t('mcpModule.oauthManagement.grantReductionNotice')"
				:closable="false"
				show-icon
			/>
		</el-form>
		<template #footer>
			<el-button @click="showGrantDialog = false">{{ t('mcpModule.actions.cancel') }}</el-button>
			<el-button
				type="primary"
				:loading="saving"
				@click="saveGrant"
			>
				{{ t('mcpModule.actions.save') }}
			</el-button>
		</template>
	</el-drawer>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElCheckbox,
	ElCheckboxGroup,
	ElDrawer,
	ElForm,
	ElFormItem,
	ElInput,
	ElMessageBox,
	ElTabPane,
	ElTable,
	ElTableColumn,
	ElTabs,
	ElTag,
	type FormInstance,
	type FormRules,
	vLoading,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import { ViewHeader, useBreakpoints, useFlashMessage } from '../../../common';
import { useMcpOAuthManagement } from '../composables/useMcpOAuthManagement';
import { McpOAuthScope } from '../mcp.constants';
import type { IMcpOAuthAccessToken, IMcpOAuthClient, IMcpOAuthGrant, IMcpOAuthRefreshFamily } from '../schemas/oauth-management.types';

defineOptions({ name: 'ViewMcpOAuthManagement' });

const { t } = useI18n();
const flashMessage = useFlashMessage();
const { isLGDevice } = useBreakpoints();
const {
	clients,
	grants,
	accessTokens,
	refreshFamilies,
	loading,
	error,
	fetchAll,
	createClient,
	updateClient,
	updateGrant,
	revokeClient,
	revokeGrant,
	revokeAccessToken,
	revokeRefreshFamily,
	revokeAll,
} = useMcpOAuthManagement();

const activeTab = ref('clients');
const showClientDialog = ref(false);
const showGrantDialog = ref(false);
const saving = ref(false);
const editingClient = ref<IMcpOAuthClient | null>(null);
const editingGrant = ref<IMcpOAuthGrant | null>(null);
const clientFormEl = ref<FormInstance>();
const grantFormEl = ref<FormInstance>();
const scopeOptions = Object.values(McpOAuthScope);
const grantScopeOptions = ref<McpOAuthScope[]>([]);
const clientForm = reactive({ name: '', redirectUris: [''], maximumScopes: [McpOAuthScope.READ] as McpOAuthScope[] });
const grantForm = reactive({ approvedScopes: [McpOAuthScope.READ] as McpOAuthScope[] });
const clientHasPhysicalScope = computed(
	() => clientForm.maximumScopes.includes(McpOAuthScope.WRITE) || clientForm.maximumScopes.includes(McpOAuthScope.TRIGGER)
);
const grantHasPhysicalScope = computed(
	() => grantForm.approvedScopes.includes(McpOAuthScope.WRITE) || grantForm.approvedScopes.includes(McpOAuthScope.TRIGGER)
);
const clientRules = reactive<FormRules>({
	name: [{ required: true, message: t('mcpModule.oauthManagement.nameRequired'), trigger: 'change' }],
	redirectUris: [
		{
			validator: (_rule, value: string[], callback) =>
				value.length > 0 && value.every((item) => item.trim().length > 0)
					? callback()
					: callback(new Error(t('mcpModule.oauthManagement.redirectRequired'))),
			trigger: 'change',
		},
	],
	maximumScopes: [{ type: 'array', min: 1, required: true, message: t('mcpModule.oauthManagement.scopesRequired'), trigger: 'change' }],
});
const grantRules = reactive<FormRules>({
	approvedScopes: [{ type: 'array', min: 1, required: true, message: t('mcpModule.oauthManagement.grantScopesRequired'), trigger: 'change' }],
});

const ScopeTags = defineComponent({
	name: 'ScopeTags',
	props: { scopes: { type: Array as () => McpOAuthScope[], required: true } },
	setup: (props) => () =>
		h(
			'div',
			{ class: 'scope-tags' },
			props.scopes.map((scope) => h(ElTag, { key: scope, type: 'info', size: 'small' }, () => t(`mcpModule.oauthManagement.scope.${scope}`)))
		),
});

const resetClientForm = (): void => {
	editingClient.value = null;
	clientForm.name = '';
	clientForm.redirectUris = [''];
	clientForm.maximumScopes = [McpOAuthScope.READ];
	clientFormEl.value?.clearValidate();
};

const openCreate = (): void => {
	resetClientForm();
	showClientDialog.value = true;
};

const openEdit = (client: IMcpOAuthClient): void => {
	editingClient.value = client;
	clientForm.name = client.name;
	clientForm.redirectUris = [...client.redirectUris];
	clientForm.maximumScopes = [...client.maximumScopes];
	showClientDialog.value = true;
};

const resetGrantForm = (): void => {
	editingGrant.value = null;
	grantScopeOptions.value = [];
	grantForm.approvedScopes = [McpOAuthScope.READ];
	grantFormEl.value?.clearValidate();
};

const openGrantEdit = (grant: IMcpOAuthGrant): void => {
	editingGrant.value = grant;
	grantScopeOptions.value = [...grant.approvedScopes];
	grantForm.approvedScopes = [...grant.approvedScopes];
	showGrantDialog.value = true;
};

const saveClient = async (): Promise<void> => {
	if (!(await clientFormEl.value?.validate())) return;
	saving.value = true;

	try {
		const payload = {
			name: clientForm.name,
			redirectUris: clientForm.redirectUris.map((value) => value.trim()),
			maximumScopes: [...clientForm.maximumScopes],
		};

		if (editingClient.value) {
			await updateClient(editingClient.value.id, payload);
			flashMessage.success(t('mcpModule.oauthManagement.messages.updated'));
		} else {
			await createClient(payload);
			flashMessage.success(t('mcpModule.oauthManagement.messages.created'));
		}
		showClientDialog.value = false;
	} catch {
		flashMessage.error(
			t(editingClient.value ? 'mcpModule.oauthManagement.messages.updateFailed' : 'mcpModule.oauthManagement.messages.createFailed')
		);
	} finally {
		saving.value = false;
	}
};

const saveGrant = async (): Promise<void> => {
	if (!editingGrant.value || !(await grantFormEl.value?.validate())) return;
	saving.value = true;

	try {
		await updateGrant(editingGrant.value.id, { approvedScopes: [...grantForm.approvedScopes] });
		flashMessage.success(t('mcpModule.oauthManagement.messages.grantUpdated'));
		showGrantDialog.value = false;
	} catch {
		flashMessage.error(t('mcpModule.oauthManagement.messages.grantUpdateFailed'));
	} finally {
		saving.value = false;
	}
};

const confirmRevoke = async (message: string, action: () => Promise<unknown>, successMessage: string): Promise<void> => {
	try {
		await ElMessageBox.confirm(message, t('mcpModule.actions.revoke'), {
			type: 'warning',
			confirmButtonText: t('mcpModule.actions.revoke'),
			cancelButtonText: t('mcpModule.actions.cancel'),
		});
		await action();
		flashMessage.success(t(successMessage));
	} catch (caught) {
		if (caught !== 'cancel' && caught !== 'close') {
			flashMessage.error(t('mcpModule.oauthManagement.messages.revokeFailed'));
		}
	}
};

const confirmClientRevoke = (client: IMcpOAuthClient): Promise<void> =>
	confirmRevoke(
		t('mcpModule.oauthManagement.confirm.client', { name: client.name }),
		() => revokeClient(client.id),
		'mcpModule.oauthManagement.messages.clientRevoked'
	);
const confirmGrantRevoke = (grant: IMcpOAuthGrant): Promise<void> =>
	confirmRevoke(
		t('mcpModule.oauthManagement.confirm.grant', { name: grant.clientName }),
		() => revokeGrant(grant.id),
		'mcpModule.oauthManagement.messages.grantRevoked'
	);
const confirmAccessTokenRevoke = (token: IMcpOAuthAccessToken): Promise<void> =>
	confirmRevoke(
		t('mcpModule.oauthManagement.confirm.accessToken', { name: token.clientName }),
		() => revokeAccessToken(token.id),
		'mcpModule.oauthManagement.messages.accessTokenRevoked'
	);
const confirmRefreshFamilyRevoke = (family: IMcpOAuthRefreshFamily): Promise<void> =>
	confirmRevoke(
		t('mcpModule.oauthManagement.confirm.refreshFamily', { name: family.clientName }),
		() => revokeRefreshFamily(family.id),
		'mcpModule.oauthManagement.messages.refreshFamilyRevoked'
	);
const confirmGlobalRevoke = (): Promise<void> =>
	confirmRevoke(t('mcpModule.oauthManagement.confirm.all'), () => revokeAll(), 'mcpModule.oauthManagement.messages.allRevoked');

const grantStatus = (grant: IMcpOAuthGrant): { key: 'active' | 'expired' | 'inactive' | 'revoked'; type: 'success' | 'danger' | 'warning' } => {
	if (grant.revokedAt) return { key: 'revoked', type: 'danger' };
	if (new Date(grant.expiresAt).getTime() <= Date.now()) return { key: 'expired', type: 'danger' };
	if (!grant.active) return { key: 'inactive', type: 'warning' };

	return { key: 'active', type: 'success' };
};

const canRevokeGrant = (grant: IMcpOAuthGrant): boolean => grant.revokedAt === null && new Date(grant.expiresAt).getTime() > Date.now();
const canEditGrant = (grant: IMcpOAuthGrant): boolean => grant.active;

const formatDate = (value: string): string => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

onMounted(() => void fetchAll().catch(() => undefined));
</script>

<style scoped>
.mcp-oauth-page {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: 16px;
	margin: 16px;
	min-width: 0;
}

.mcp-oauth-details {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 8px 32px;
	word-break: break-all;
}

.redirect-list {
	display: flex;
	width: 100%;
	flex-direction: column;
	gap: 8px;
}

.redirect-row {
	display: flex;
	gap: 8px;
}

:deep(.scope-tags) {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
}

@media (max-width: 767px) {
	.mcp-oauth-page {
		margin: 8px;
	}
}
</style>

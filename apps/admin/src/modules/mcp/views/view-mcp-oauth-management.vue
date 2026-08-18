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
				class="px-4!"
				data-test-id="revoke-all-mcp-oauth"
				@click="confirmGlobalRevoke"
			>
				<template #icon>
					<icon icon="mdi:shield-remove-outline" />
				</template>

				{{ t('mcpModule.oauthManagement.revokeAll') }}
			</el-button>
			<el-button
				type="primary"
				plain
				class="px-4! ml-2!"
				data-test-id="create-mcp-oauth-client"
				@click="openCreate"
			>
				<template #icon>
					<icon icon="mdi:plus" />
				</template>

				{{ t('mcpModule.actions.add') }}
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

		<el-tabs
			v-model="activeTab"
			class="grow-1 overflow-hidden flex-1"
		>
			<el-tab-pane
				name="clients"
				:label="t('mcpModule.oauthManagement.tabs.clients')"
				class="h-full overflow-hidden flex flex-col gap-2"
			>
				<el-card
					shadow="never"
					class="px-1 py-2 shrink-0"
					body-class="p-0!"
				>
					<McpOAuthTabFilter
						v-model:filters="clientsQuery.filters.value"
						:filters-active="clientsQuery.filtersActive.value"
						:search-placeholder="t('mcpModule.oauthManagement.searchPlaceholder')"
						:status-options="clientStatusOptions"
						test-id="mcp-oauth-clients"
						@reset-filters="clientsQuery.resetFilter"
					/>
				</el-card>

				<el-card
					shadow="never"
					body-class="p-0!"
				>
					<el-table
						v-loading="loading"
						:data="clientsQuery.items.value"
						:default-sort="sortDescriptor(clientsQuery)"
						row-key="id"
						@sort-change="(change: { prop: string; order: string | null }) => onSortChange(clientsQuery, change)"
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
							sortable="custom"
							:sort-orders="['ascending', 'descending']"
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
						<template #empty>
							<mcp-table-empty
								icon="mdi:application-cog"
								:loading="loading"
								:failed="error !== null"
								:filters-active="clientsQuery.filtersActive.value"
								empty-label="mcpModule.oauthManagement.empty.clients"
								@retry="fetchAll"
								@reset-filters="clientsQuery.resetFilter"
							/>
						</template>
					</el-table>
				</el-card>
			</el-tab-pane>

			<el-tab-pane
				name="grants"
				:label="t('mcpModule.oauthManagement.tabs.grants')"
				class="h-full overflow-hidden flex flex-col gap-2"
			>
				<el-card
					shadow="never"
					class="px-1 py-2 shrink-0"
					body-class="p-0!"
				>
					<McpOAuthTabFilter
						v-model:filters="grantsQuery.filters.value"
						:filters-active="grantsQuery.filtersActive.value"
						:search-placeholder="t('mcpModule.oauthManagement.searchPlaceholder')"
						:status-options="grantStatusOptions"
						test-id="mcp-oauth-grants"
						@reset-filters="grantsQuery.resetFilter"
					/>
				</el-card>

				<el-card
					shadow="never"
					body-class="p-0!"
				>
					<el-table
						v-loading="loading"
						:data="grantsQuery.items.value"
						:default-sort="sortDescriptor(grantsQuery)"
						row-key="id"
						@sort-change="(change: { prop: string; order: string | null }) => onSortChange(grantsQuery, change)"
					>
						<el-table-column
							prop="clientName"
							sortable="custom"
							:sort-orders="['ascending', 'descending']"
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
						<template #empty>
							<mcp-table-empty
								icon="mdi:key-chain"
								:loading="loading"
								:failed="error !== null"
								:filters-active="grantsQuery.filtersActive.value"
								empty-label="mcpModule.oauthManagement.empty.grants"
								@retry="fetchAll"
								@reset-filters="grantsQuery.resetFilter"
							/>
						</template>
					</el-table>
				</el-card>
			</el-tab-pane>

			<el-tab-pane
				name="accessTokens"
				:label="t('mcpModule.oauthManagement.tabs.accessTokens')"
				class="h-full overflow-hidden flex flex-col gap-2"
			>
				<el-card
					shadow="never"
					class="px-1 py-2 shrink-0"
					body-class="p-0!"
				>
					<McpOAuthTabFilter
						v-model:filters="accessTokensQuery.filters.value"
						:filters-active="accessTokensQuery.filtersActive.value"
						:search-placeholder="t('mcpModule.oauthManagement.searchPlaceholder')"
						:status-options="tokenStatusOptions"
						test-id="mcp-oauth-accessTokens"
						@reset-filters="accessTokensQuery.resetFilter"
					/>
				</el-card>

				<el-card
					shadow="never"
					body-class="p-0!"
				>
					<el-table
						v-loading="loading"
						:data="accessTokensQuery.items.value"
						:default-sort="sortDescriptor(accessTokensQuery)"
						row-key="id"
						@sort-change="(change: { prop: string; order: string | null }) => onSortChange(accessTokensQuery, change)"
					>
						<el-table-column
							prop="clientName"
							sortable="custom"
							:sort-orders="['ascending', 'descending']"
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
						<template #empty>
							<mcp-table-empty
								icon="mdi:key"
								:loading="loading"
								:failed="error !== null"
								:filters-active="accessTokensQuery.filtersActive.value"
								empty-label="mcpModule.oauthManagement.empty.accessTokens"
								@retry="fetchAll"
								@reset-filters="accessTokensQuery.resetFilter"
							/>
						</template>
					</el-table>
				</el-card>
			</el-tab-pane>

			<el-tab-pane
				name="refreshFamilies"
				:label="t('mcpModule.oauthManagement.tabs.refreshFamilies')"
				class="h-full overflow-hidden flex flex-col gap-2"
			>
				<el-card
					shadow="never"
					class="px-1 py-2 shrink-0"
					body-class="p-0!"
				>
					<McpOAuthTabFilter
						v-model:filters="refreshFamiliesQuery.filters.value"
						:filters-active="refreshFamiliesQuery.filtersActive.value"
						:search-placeholder="t('mcpModule.oauthManagement.searchPlaceholder')"
						:status-options="[]"
						test-id="mcp-oauth-refreshFamilies"
						@reset-filters="refreshFamiliesQuery.resetFilter"
					/>
				</el-card>

				<el-card
					shadow="never"
					body-class="p-0!"
				>
					<el-table
						v-loading="loading"
						:data="refreshFamiliesQuery.items.value"
						:default-sort="sortDescriptor(refreshFamiliesQuery)"
						row-key="id"
						@sort-change="(change: { prop: string; order: string | null }) => onSortChange(refreshFamiliesQuery, change)"
					>
						<el-table-column
							prop="clientName"
							sortable="custom"
							:sort-orders="['ascending', 'descending']"
							:label="t('mcpModule.oauthManagement.columns.client')"
							min-width="180"
						/>
						<el-table-column
							prop="activeTokenCount"
							sortable="custom"
							:sort-orders="['ascending', 'descending']"
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
						<template #empty>
							<mcp-table-empty
								icon="mdi:key-link"
								:loading="loading"
								:failed="error !== null"
								:filters-active="refreshFamiliesQuery.filtersActive.value"
								empty-label="mcpModule.oauthManagement.empty.refreshFamilies"
								@retry="fetchAll"
								@reset-filters="refreshFamiliesQuery.resetFilter"
							/>
						</template>
					</el-table>
				</el-card>
			</el-tab-pane>
		</el-tabs>
	</div>

	<el-drawer
		v-model="showClientDialog"
		:show-close="false"
		:with-header="false"
		:size="isLGDevice ? '40%' : '100%'"
		:before-close="onCloseClientForm"
		data-test-id="mcp-oauth-client-form-drawer"
		@closed="resetClientForm"
	>
		<div class="flex flex-col h-full">
			<app-bar menu-button-hidden>
				<template #heading>
					<app-bar-heading>
						<template #icon>
							<icon icon="mdi:shield-key-outline" />
						</template>

						<template #title>
							<span data-test-id="drawer-heading-title">
								{{ editingClient ? t('mcpModule.oauthManagement.editClient') : t('mcpModule.oauthManagement.createClient') }}
							</span>
						</template>

						<template #subtitle>
							<span data-test-id="drawer-heading-subtitle">{{ t('mcpModule.oauthManagement.clientFormSubtitle') }}</span>
						</template>
					</app-bar-heading>
				</template>

				<template #button-right>
					<app-bar-button
						:align="AppBarButtonAlign.RIGHT"
						class="mr-2"
						@click="() => onCloseClientForm()"
					>
						<template #icon>
							<el-icon>
								<icon icon="mdi:close" />
							</el-icon>
						</template>
					</app-bar-button>
				</template>
			</app-bar>

			<el-scrollbar class="grow-1 p-2 md:px-4">
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
			</el-scrollbar>

			<div
				class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 w-full h-[3rem]"
				style="background-color: var(--el-drawer-bg-color)"
			>
				<div class="p-2">
					<el-button
						link
						class="mr-2"
						data-test-id="cancel-mcp-oauth-client-form"
						@click="() => onCloseClientForm()"
					>
						{{ clientFormChanged ? t('mcpModule.actions.discard') : t('mcpModule.actions.close') }}
					</el-button>

					<el-button
						type="primary"
						:loading="saving"
						:disabled="saving || !clientFormChanged"
						data-test-id="save-mcp-oauth-client-form"
						@click="saveClient"
					>
						{{ t('mcpModule.actions.save') }}
					</el-button>
				</div>
			</div>
		</div>
	</el-drawer>

	<el-drawer
		v-model="showGrantDialog"
		:show-close="false"
		:with-header="false"
		:size="isLGDevice ? '40%' : '100%'"
		:before-close="onCloseGrantForm"
		data-test-id="mcp-oauth-grant-form-drawer"
		@closed="resetGrantForm"
	>
		<div class="flex flex-col h-full">
			<app-bar menu-button-hidden>
				<template #heading>
					<app-bar-heading>
						<template #icon>
							<icon icon="mdi:shield-key-outline" />
						</template>

						<template #title>
							<span data-test-id="drawer-heading-title">{{ t('mcpModule.oauthManagement.editGrant') }}</span>
						</template>

						<template #subtitle>
							<span data-test-id="drawer-heading-subtitle">{{ t('mcpModule.oauthManagement.grantFormSubtitle') }}</span>
						</template>
					</app-bar-heading>
				</template>

				<template #button-right>
					<app-bar-button
						:align="AppBarButtonAlign.RIGHT"
						class="mr-2"
						@click="() => onCloseGrantForm()"
					>
						<template #icon>
							<el-icon>
								<icon icon="mdi:close" />
							</el-icon>
						</template>
					</app-bar-button>
				</template>
			</app-bar>

			<el-scrollbar class="grow-1 p-2 md:px-4">
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
			</el-scrollbar>

			<div
				class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 w-full h-[3rem]"
				style="background-color: var(--el-drawer-bg-color)"
			>
				<div class="p-2">
					<el-button
						link
						class="mr-2"
						data-test-id="cancel-mcp-oauth-grant-form"
						@click="() => onCloseGrantForm()"
					>
						{{ grantFormChanged ? t('mcpModule.actions.discard') : t('mcpModule.actions.close') }}
					</el-button>

					<el-button
						type="primary"
						:loading="saving"
						:disabled="saving || !grantFormChanged"
						data-test-id="save-mcp-oauth-grant-form"
						@click="saveGrant"
					>
						{{ t('mcpModule.actions.save') }}
					</el-button>
				</div>
			</div>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import { type Ref, computed, defineComponent, h, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElCheckbox,
	ElCheckboxGroup,
	ElDrawer,
	ElForm,
	ElFormItem,
	ElIcon,
	ElInput,
	ElMessageBox,
	ElScrollbar,
	ElTabPane,
	ElTable,
	ElTableColumn,
	ElTabs,
	ElTag,
	type FormInstance,
	type FormRules,
	vLoading,
} from 'element-plus';
import { isEqual } from 'lodash';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, ViewHeader, useBreakpoints, useFlashMessage } from '../../../common';
import McpOAuthTabFilter from '../components/mcp-oauth-tab-filter.vue';
import McpTableEmpty from '../components/mcp-table-empty.vue';
import { useMcpOAuthManagement } from '../composables/useMcpOAuthManagement';
import { useMcpOAuthTabQuery } from '../composables/useMcpOAuthTabQuery';
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

const route = useRoute();
const router = useRouter();

const tabNames = ['clients', 'grants', 'accessTokens', 'refreshFamilies'];

const activeTab = ref<string>(typeof route.query.tab === 'string' && tabNames.includes(route.query.tab) ? route.query.tab : 'clients');

watch(activeTab, (val: string): void => {
	// `replace`, not `push`: flipping between tabs should not fill the back stack.
	router.replace({ query: { ...route.query, tab: val } });
});
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

type ClientSnapshot = { name: string; redirectUris: string[]; maximumScopes: McpOAuthScope[] };

const snapshotClientForm = (): ClientSnapshot => ({
	name: clientForm.name,
	redirectUris: [...clientForm.redirectUris],
	maximumScopes: [...clientForm.maximumScopes],
});

// Captured when the drawer opens, so "changed" means edited since opening
// rather than simply populated.
const initialClientForm = ref<ClientSnapshot>(snapshotClientForm());

const clientFormChanged = computed<boolean>((): boolean => !isEqual(snapshotClientForm(), initialClientForm.value));

const resetClientForm = (): void => {
	editingClient.value = null;
	clientForm.name = '';
	clientForm.redirectUris = [''];
	clientForm.maximumScopes = [McpOAuthScope.READ];
	clientFormEl.value?.clearValidate();
	initialClientForm.value = snapshotClientForm();
};

/**
 * Shared by the footer action, the close button in the drawer's bar and the
 * drawer's own `before-close`, so no route out of the form skips the check.
 * `done` arrives only from `before-close`; withholding it keeps the drawer open.
 */
const onCloseClientForm = async (done?: () => void): Promise<void> => {
	if (clientFormChanged.value) {
		try {
			await ElMessageBox.confirm(t('mcpModule.confirm.discard'), t('mcpModule.headings.discard'), {
				confirmButtonText: t('mcpModule.actions.yes'),
				cancelButtonText: t('mcpModule.actions.no'),
				type: 'warning',
			});
		} catch {
			return;
		}
	}

	showClientDialog.value = false;

	done?.();
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
	initialClientForm.value = snapshotClientForm();
	showClientDialog.value = true;
};

const initialGrantForm = ref<McpOAuthScope[]>([...grantForm.approvedScopes]);

const grantFormChanged = computed<boolean>((): boolean => !isEqual([...grantForm.approvedScopes], initialGrantForm.value));

const resetGrantForm = (): void => {
	editingGrant.value = null;
	grantScopeOptions.value = [];
	grantForm.approvedScopes = [McpOAuthScope.READ];
	grantFormEl.value?.clearValidate();
	initialGrantForm.value = [...grantForm.approvedScopes];
};

const onCloseGrantForm = async (done?: () => void): Promise<void> => {
	if (grantFormChanged.value) {
		try {
			await ElMessageBox.confirm(t('mcpModule.confirm.discard'), t('mcpModule.headings.discard'), {
				confirmButtonText: t('mcpModule.actions.yes'),
				cancelButtonText: t('mcpModule.actions.no'),
				type: 'warning',
			});
		} catch {
			return;
		}
	}

	showGrantDialog.value = false;

	done?.();
};

const openGrantEdit = (grant: IMcpOAuthGrant): void => {
	editingGrant.value = grant;
	grantScopeOptions.value = [...grant.approvedScopes];
	grantForm.approvedScopes = [...grant.approvedScopes];
	initialGrantForm.value = [...grantForm.approvedScopes];
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

// El-table only draws the active sort arrow when it is told what the sort is;
// without this the tabs looked unsorted while being sorted by client name.
const sortDescriptor = (query: {
	sortBy: Ref<string | undefined>;
	sortDir: Ref<'asc' | 'desc' | null>;
}): { prop: string; order: 'ascending' | 'descending' } | undefined => {
	if (typeof query.sortBy.value === 'undefined' || query.sortDir.value === null) {
		return undefined;
	}

	return { prop: query.sortBy.value, order: query.sortDir.value === 'desc' ? 'descending' : 'ascending' };
};

// El-table reports its own sort state; the tab query owns it, so the two are
// joined here rather than in each table's markup.
const onSortChange = (
	query: { sortBy: Ref<string | undefined>; sortDir: Ref<'asc' | 'desc' | null> },
	{ prop, order }: { prop: string; order: string | null }
): void => {
	query.sortBy.value = order === null ? undefined : prop;
	query.sortDir.value = order === null ? null : order === 'descending' ? 'desc' : 'asc';
};

const formatDate = (value: string): string => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const clientsQuery = useMcpOAuthTabQuery<IMcpOAuthClient>({
	key: 'clients',
	items: clients,
	searchable: (client) => [client.name, client.clientIdentifier],
	sortable: {
		name: (client) => client.name,
		createdAt: (client) => new Date(client.createdAt).getTime(),
	},
	defaultSortBy: 'name',
	statusOf: (client) => (client.enabled ? 'enabled' : 'disabled'),
});

const grantsQuery = useMcpOAuthTabQuery<IMcpOAuthGrant>({
	key: 'grants',
	items: grants,
	searchable: (grant) => [grant.clientName],
	sortable: {
		clientName: (grant) => grant.clientName,
		expiresAt: (grant) => new Date(grant.expiresAt).getTime(),
		createdAt: (grant) => new Date(grant.createdAt).getTime(),
	},
	defaultSortBy: 'clientName',
	// Reuses the same helper the status column renders, so a row can never be
	// labelled one thing and matched by another.
	statusOf: (grant) => grantStatus(grant).key,
});

const accessTokensQuery = useMcpOAuthTabQuery<IMcpOAuthAccessToken>({
	key: 'accessTokens',
	items: accessTokens,
	searchable: (token) => [token.clientName],
	sortable: {
		clientName: (token) => token.clientName,
		expiresAt: (token) => new Date(token.expiresAt).getTime(),
	},
	defaultSortBy: 'clientName',
	statusOf: (token) => (new Date(token.expiresAt).getTime() <= Date.now() ? 'expired' : 'active'),
});

// Refresh families carry no status of their own — a family is described by the
// tokens counted against it — so this tab filters on search alone.
const refreshFamiliesQuery = useMcpOAuthTabQuery<IMcpOAuthRefreshFamily>({
	key: 'refreshFamilies',
	items: refreshFamilies,
	searchable: (family) => [family.clientName],
	sortable: {
		clientName: (family) => family.clientName,
		expiresAt: (family) => new Date(family.expiresAt).getTime(),
		activeTokenCount: (family) => family.activeTokenCount,
	},
	defaultSortBy: 'clientName',
});

const grantStatusOptions = [
	{ value: 'active', label: 'mcpModule.oauthManagement.status.active' },
	{ value: 'inactive', label: 'mcpModule.oauthManagement.status.inactive' },
	{ value: 'expired', label: 'mcpModule.oauthManagement.status.expired' },
	{ value: 'revoked', label: 'mcpModule.oauthManagement.status.revoked' },
];

const tokenStatusOptions = [
	{ value: 'active', label: 'mcpModule.oauthManagement.status.active' },
	{ value: 'expired', label: 'mcpModule.oauthManagement.status.expired' },
];

const clientStatusOptions = [
	{ value: 'enabled', label: 'mcpModule.oauthManagement.status.enabled' },
	{ value: 'disabled', label: 'mcpModule.oauthManagement.status.disabled' },
];

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

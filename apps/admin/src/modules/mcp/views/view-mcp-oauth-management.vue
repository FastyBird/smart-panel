<template>
	<view-header
		:title="t('mcpModule.oauthManagement.title')"
		:subtitle="t('mcpModule.oauthManagement.subtitle')"
		icon="mdi:shield-key-outline"
		:actions="[
			{ icon: 'mdi:plus', label: t('mcpModule.actions.add'), handler: openCreate },
			{ icon: 'mdi:shield-remove-outline', label: t('mcpModule.oauthManagement.revokeAll'), handler: confirmGlobalRevoke },
		]"
	>
		<template #actions>
			<div class="flex items-center gap-2">
				<!-- Revoking everything is destructive, so it sits in the menu; Add is the one primary, rightmost -->
				<el-tooltip
					:content="t('mcpModule.actions.more')"
					placement="top"
				>
					<el-dropdown
						trigger="click"
						placement="bottom-end"
						@command="confirmGlobalRevoke"
					>
						<el-button
							:aria-label="t('mcpModule.actions.more')"
							plain
							data-test-id="mcp-oauth-more"
						>
							<template #icon>
								<icon icon="mdi:dots-horizontal" />
							</template>
						</el-button>

						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item
									command="revokeAll"
									class="text-danger!"
									data-test-id="revoke-all-mcp-oauth"
								>
									{{ t('mcpModule.oauthManagement.revokeAll') }}
								</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>
				</el-tooltip>

				<el-button
					type="primary"
					plain
					data-test-id="create-mcp-oauth-client"
					@click="openCreate"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>

					{{ t('mcpModule.actions.add') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div class="page-pad flex flex-col flex-1 min-h-0 box-border">
		<!-- Template 4: the client and grant forms open next to the list. They have no route of their own, so on phone
		     they take a full-width drawer -->
		<edit-drawer-layout
			:open="formOpen"
			:before-close="onCloseForm"
			routeless
			@close="onCloseForm()"
		>
			<div class="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
				<p class="flex items-start gap-2 m-0 text-help">
					<icon
						icon="mdi:shield-lock-outline"
						width="16"
						height="16"
						class="shrink-0 mt-[3px]"
						aria-hidden="true"
					/>
					<span>
						<span class="text-label">{{ t('mcpModule.oauthManagement.securityTitle') }}.</span>
						{{ t('mcpModule.oauthManagement.securityDescription') }}
					</span>
				</p>

				<el-tabs v-model="activeTab">
					<el-tab-pane name="clients">
						<template #label>
							<span class="inline-flex items-center gap-2">
								<icon icon="mdi:application-cog-outline" />
								{{ t('mcpModule.oauthManagement.tabs.clients') }}
							</span>
						</template>

						<mcp-oauth-tab
							v-model:filters="clientsQuery.filters.value"
							:status-options="clientStatusOptions"
							test-id="mcp-oauth-clients"
							@reset-filters="clientsQuery.resetFilter"
						>
							<mcp-oauth-row-list
								v-if="isPhone"
								:rows="clientRows"
								icon="mdi:application-cog-outline"
								:loading="loading"
								:failed="error !== null"
								:filters-active="clientsQuery.filtersActive.value"
								empty-label="mcpModule.oauthManagement.empty.clients"
								@retry="onRetry"
								@reset-filters="clientsQuery.resetFilter"
							>
								<template #actions="{ index }">
									<mcp-oauth-row-actions
										:name="clientsQuery.items.value[index].name"
										:revoke-disabled="!clientsQuery.items.value[index].enabled"
										editable
										@edit="openEdit(clientsQuery.items.value[index])"
										@revoke="confirmClientRevoke(clientsQuery.items.value[index])"
									/>
								</template>
							</mcp-oauth-row-list>

							<el-table
								v-else
								v-loading="loading && clientsQuery.items.value.length > 0"
								:data="clientsQuery.items.value"
								:default-sort="sortDescriptor(clientsQuery)"
								row-key="id"
								@sort-change="(change: { prop: string; order: string | null }) => onSortChange(clientsQuery, change)"
							>
								<el-table-column type="expand">
									<template #default="scope">
										<div class="flex flex-col gap-3 py-2 px-8">
											<copy-field
												:value="scope.row.clientIdentifier"
												:label="t('mcpModule.oauthManagement.clientId')"
											/>
											<div class="flex flex-col gap-1">
												<span class="text-label">{{ t('mcpModule.oauthManagement.redirectUris') }}</span>
												<span
													v-for="redirectUri in scope.row.redirectUris"
													:key="redirectUri"
													class="text-mono break-all"
												>
													{{ redirectUri }}
												</span>
											</div>
										</div>
									</template>
								</el-table-column>
								<el-table-column
									prop="name"
									sortable="custom"
									:sort-orders="['ascending', 'descending']"
									:label="t('mcpModule.oauthManagement.columns.client')"
									min-width="180"
								>
									<template #default="scope">
										<span class="text-card-title">{{ scope.row.name }}</span>
									</template>
								</el-table-column>
								<el-table-column
									:label="t('mcpModule.oauthManagement.columns.status')"
									width="130"
								>
									<template #default="scope">
										<status-tag
											:status="scope.row.enabled ? 'ok' : 'warn'"
											:label="t(`mcpModule.oauthManagement.status.${scope.row.enabled ? 'active' : 'disabled'}`)"
										/>
									</template>
								</el-table-column>
								<el-table-column
									:label="t('mcpModule.oauthManagement.columns.scopes')"
									min-width="220"
								>
									<template #default="scope">
										<span class="text-body">{{ scopesLabel(scope.row.maximumScopes) }}</span>
									</template>
								</el-table-column>
								<el-table-column
									fixed="right"
									width="96"
									align="right"
								>
									<template #default="scope">
										<mcp-oauth-row-actions
											:name="scope.row.name"
											:revoke-disabled="!scope.row.enabled"
											editable
											@edit="openEdit(scope.row)"
											@revoke="confirmClientRevoke(scope.row)"
										/>
									</template>
								</el-table-column>
								<template #empty>
									<mcp-table-empty
										icon="mdi:application-cog-outline"
										:loading="loading"
										:failed="error !== null"
										:filters-active="clientsQuery.filtersActive.value"
										empty-label="mcpModule.oauthManagement.empty.clients"
										@retry="onRetry"
										@reset-filters="clientsQuery.resetFilter"
									/>
								</template>
							</el-table>
						</mcp-oauth-tab>
					</el-tab-pane>

					<el-tab-pane name="grants">
						<template #label>
							<span class="inline-flex items-center gap-2">
								<icon icon="mdi:key-chain" />
								{{ t('mcpModule.oauthManagement.tabs.grants') }}
							</span>
						</template>

						<mcp-oauth-tab
							v-model:filters="grantsQuery.filters.value"
							:status-options="grantStatusOptions"
							test-id="mcp-oauth-grants"
							@reset-filters="grantsQuery.resetFilter"
						>
							<mcp-oauth-row-list
								v-if="isPhone"
								:rows="grantRows"
								icon="mdi:key-chain"
								:loading="loading"
								:failed="error !== null"
								:filters-active="grantsQuery.filtersActive.value"
								empty-label="mcpModule.oauthManagement.empty.grants"
								@retry="onRetry"
								@reset-filters="grantsQuery.resetFilter"
							>
								<template #actions="{ index }">
									<mcp-oauth-row-actions
										:name="grantsQuery.items.value[index].clientName"
										:edit-disabled="!canEditGrant(grantsQuery.items.value[index])"
										:revoke-disabled="!canRevokeGrant(grantsQuery.items.value[index])"
										editable
										@edit="openGrantEdit(grantsQuery.items.value[index])"
										@revoke="confirmGrantRevoke(grantsQuery.items.value[index])"
									/>
								</template>
							</mcp-oauth-row-list>

							<el-table
								v-else
								v-loading="loading && grantsQuery.items.value.length > 0"
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
								>
									<template #default="scope">
										<span class="text-card-title">{{ scope.row.clientName }}</span>
									</template>
								</el-table-column>
								<el-table-column
									:label="t('mcpModule.oauthManagement.columns.status')"
									width="130"
								>
									<template #default="scope">
										<status-tag
											:status="GRANT_STATUS_TAGS[grantStatus(scope.row).key]"
											:label="t(`mcpModule.oauthManagement.status.${grantStatus(scope.row).key}`)"
										/>
									</template>
								</el-table-column>
								<el-table-column
									:label="t('mcpModule.oauthManagement.columns.scopes')"
									min-width="220"
								>
									<template #default="scope">
										<span class="text-body">{{ scopesLabel(scope.row.approvedScopes) }}</span>
									</template>
								</el-table-column>
								<el-table-column
									:label="t('mcpModule.oauthManagement.columns.expires')"
									width="190"
								>
									<template #default="scope">
										<span class="text-body">{{ formatDate(scope.row.expiresAt) }}</span>
									</template>
								</el-table-column>
								<el-table-column
									fixed="right"
									width="96"
									align="right"
								>
									<template #default="scope">
										<mcp-oauth-row-actions
											:name="scope.row.clientName"
											:edit-disabled="!canEditGrant(scope.row)"
											:revoke-disabled="!canRevokeGrant(scope.row)"
											editable
											@edit="openGrantEdit(scope.row)"
											@revoke="confirmGrantRevoke(scope.row)"
										/>
									</template>
								</el-table-column>
								<template #empty>
									<mcp-table-empty
										icon="mdi:key-chain"
										:loading="loading"
										:failed="error !== null"
										:filters-active="grantsQuery.filtersActive.value"
										empty-label="mcpModule.oauthManagement.empty.grants"
										@retry="onRetry"
										@reset-filters="grantsQuery.resetFilter"
									/>
								</template>
							</el-table>
						</mcp-oauth-tab>
					</el-tab-pane>

					<el-tab-pane name="accessTokens">
						<template #label>
							<span class="inline-flex items-center gap-2">
								<icon icon="mdi:key-outline" />
								{{ t('mcpModule.oauthManagement.tabs.accessTokens') }}
							</span>
						</template>

						<mcp-oauth-tab
							v-model:filters="accessTokensQuery.filters.value"
							:status-options="tokenStatusOptions"
							test-id="mcp-oauth-accessTokens"
							@reset-filters="accessTokensQuery.resetFilter"
						>
							<mcp-oauth-row-list
								v-if="isPhone"
								:rows="accessTokenRows"
								icon="mdi:key-outline"
								:loading="loading"
								:failed="error !== null"
								:filters-active="accessTokensQuery.filtersActive.value"
								empty-label="mcpModule.oauthManagement.empty.accessTokens"
								@retry="onRetry"
								@reset-filters="accessTokensQuery.resetFilter"
							>
								<template #actions="{ index }">
									<mcp-oauth-row-actions
										:name="accessTokensQuery.items.value[index].clientName"
										@revoke="confirmAccessTokenRevoke(accessTokensQuery.items.value[index])"
									/>
								</template>
							</mcp-oauth-row-list>

							<el-table
								v-else
								v-loading="loading && accessTokensQuery.items.value.length > 0"
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
								>
									<template #default="scope">
										<span class="text-card-title">{{ scope.row.clientName }}</span>
									</template>
								</el-table-column>
								<el-table-column
									:label="t('mcpModule.oauthManagement.columns.scopes')"
									min-width="220"
								>
									<template #default="scope">
										<span class="text-body">{{ scopesLabel(scope.row.scopes) }}</span>
									</template>
								</el-table-column>
								<el-table-column
									:label="t('mcpModule.oauthManagement.columns.expires')"
									width="190"
								>
									<template #default="scope">
										<span class="text-body">{{ formatDate(scope.row.expiresAt) }}</span>
									</template>
								</el-table-column>
								<el-table-column
									fixed="right"
									width="64"
									align="right"
								>
									<template #default="scope">
										<mcp-oauth-row-actions
											:name="scope.row.clientName"
											@revoke="confirmAccessTokenRevoke(scope.row)"
										/>
									</template>
								</el-table-column>
								<template #empty>
									<mcp-table-empty
										icon="mdi:key-outline"
										:loading="loading"
										:failed="error !== null"
										:filters-active="accessTokensQuery.filtersActive.value"
										empty-label="mcpModule.oauthManagement.empty.accessTokens"
										@retry="onRetry"
										@reset-filters="accessTokensQuery.resetFilter"
									/>
								</template>
							</el-table>
						</mcp-oauth-tab>
					</el-tab-pane>

					<el-tab-pane name="refreshFamilies">
						<template #label>
							<span class="inline-flex items-center gap-2">
								<icon icon="mdi:key-link" />
								{{ t('mcpModule.oauthManagement.tabs.refreshFamilies') }}
							</span>
						</template>

						<mcp-oauth-tab
							v-model:filters="refreshFamiliesQuery.filters.value"
							:status-options="[]"
							test-id="mcp-oauth-refreshFamilies"
							@reset-filters="refreshFamiliesQuery.resetFilter"
						>
							<mcp-oauth-row-list
								v-if="isPhone"
								:rows="refreshFamilyRows"
								icon="mdi:key-link"
								:loading="loading"
								:failed="error !== null"
								:filters-active="refreshFamiliesQuery.filtersActive.value"
								empty-label="mcpModule.oauthManagement.empty.refreshFamilies"
								@retry="onRetry"
								@reset-filters="refreshFamiliesQuery.resetFilter"
							>
								<template #actions="{ index }">
									<mcp-oauth-row-actions
										:name="refreshFamiliesQuery.items.value[index].clientName"
										@revoke="confirmRefreshFamilyRevoke(refreshFamiliesQuery.items.value[index])"
									/>
								</template>
							</mcp-oauth-row-list>

							<el-table
								v-else
								v-loading="loading && refreshFamiliesQuery.items.value.length > 0"
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
								>
									<template #default="scope">
										<span class="text-card-title">{{ scope.row.clientName }}</span>
									</template>
								</el-table-column>
								<el-table-column
									prop="activeTokenCount"
									sortable="custom"
									:sort-orders="['ascending', 'descending']"
									:label="t('mcpModule.oauthManagement.columns.activeTokens')"
									width="150"
								>
									<template #default="scope">
										<span class="text-body">{{ scope.row.activeTokenCount }}</span>
									</template>
								</el-table-column>
								<el-table-column
									:label="t('mcpModule.oauthManagement.columns.expires')"
									width="190"
								>
									<template #default="scope">
										<span class="text-body">{{ formatDate(scope.row.expiresAt) }}</span>
									</template>
								</el-table-column>
								<el-table-column
									fixed="right"
									width="64"
									align="right"
								>
									<template #default="scope">
										<mcp-oauth-row-actions
											:name="scope.row.clientName"
											@revoke="confirmRefreshFamilyRevoke(scope.row)"
										/>
									</template>
								</el-table-column>
								<template #empty>
									<mcp-table-empty
										icon="mdi:key-link"
										:loading="loading"
										:failed="error !== null"
										:filters-active="refreshFamiliesQuery.filtersActive.value"
										empty-label="mcpModule.oauthManagement.empty.refreshFamilies"
										@retry="onRetry"
										@reset-filters="refreshFamiliesQuery.resetFilter"
									/>
								</template>
							</el-table>
						</mcp-oauth-tab>
					</el-tab-pane>
				</el-tabs>
			</div>

			<template #form>
				<template v-if="showClientDialog">
					<view-header
						:title="editingClient ? t('mcpModule.oauthManagement.editClient') : t('mcpModule.oauthManagement.createClient')"
						:subtitle="t('mcpModule.oauthManagement.clientFormSubtitle')"
						:icon="editingClient ? 'mdi:pencil' : 'mdi:plus'"
					/>

					<el-scrollbar class="grow-1 p-2 tp:px-4">
						<el-form
							ref="clientFormEl"
							:model="clientForm"
							:rules="clientRules"
							label-position="top"
							data-test-id="mcp-oauth-client-form"
						>
							<copy-field
								v-if="editingClient"
								:value="editingClient.clientIdentifier"
								:label="t('mcpModule.oauthManagement.clientId')"
								class="mb-[18px]"
								data-test-id="mcp-oauth-client-id"
							/>
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
								<div class="flex flex-col gap-2 w-full">
									<div
										v-for="(_redirectUri, index) in clientForm.redirectUris"
										:key="index"
										class="flex items-center gap-2"
									>
										<el-input v-model="clientForm.redirectUris[index]" />
										<el-tooltip
											:content="t('mcpModule.oauthManagement.removeRedirect')"
											placement="top"
										>
											<el-button
												:aria-label="t('mcpModule.oauthManagement.removeRedirect')"
												:disabled="clientForm.redirectUris.length === 1"
												text
												circle
												@click="clientForm.redirectUris.splice(index, 1)"
											>
												<template #icon>
													<icon icon="mdi:delete-outline" />
												</template>
											</el-button>
										</el-tooltip>
									</div>
									<div>
										<el-button @click="clientForm.redirectUris.push('')">
											<template #icon>
												<icon icon="mdi:plus" />
											</template>
											{{ t('mcpModule.oauthManagement.addRedirect') }}
										</el-button>
									</div>
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

					<form-footer
						:dirty="clientFormChanged"
						:saving="saving"
						:can-save="clientFormChanged && !saving"
						@save="saveClient"
						@discard="onCloseForm()"
						@close="onCloseForm()"
					/>
				</template>

				<template v-else-if="showGrantDialog">
					<view-header
						:title="t('mcpModule.oauthManagement.editGrant')"
						:subtitle="t('mcpModule.oauthManagement.grantFormSubtitle')"
						icon="mdi:pencil"
					/>

					<el-scrollbar class="grow-1 p-2 tp:px-4">
						<el-form
							ref="grantFormEl"
							:model="grantForm"
							:rules="grantRules"
							label-position="top"
							data-test-id="mcp-oauth-grant-form"
						>
							<el-form-item
								:label="t('mcpModule.oauthManagement.columns.scopes')"
								prop="approvedScopes"
							>
								<div class="flex flex-col gap-1 w-full">
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
									<span class="text-help">{{ t('mcpModule.oauthManagement.grantReductionNotice') }}</span>
								</div>
							</el-form-item>
							<el-alert
								v-if="grantHasPhysicalScope"
								type="warning"
								:description="t('mcpModule.oauthManagement.physicalWarning')"
								:closable="false"
								show-icon
							/>
						</el-form>
					</el-scrollbar>

					<form-footer
						:dirty="grantFormChanged"
						:saving="saving"
						:can-save="grantFormChanged && !saving"
						@save="saveGrant"
						@discard="onCloseForm()"
						@close="onCloseForm()"
					/>
				</template>
			</template>
		</edit-drawer-layout>
	</div>
</template>

<script setup lang="ts">
import { type Ref, computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import {
	ElAlert,
	ElButton,
	ElCheckbox,
	ElCheckboxGroup,
	ElDropdown,
	ElDropdownItem,
	ElDropdownMenu,
	ElForm,
	ElFormItem,
	ElInput,
	ElMessageBox,
	ElScrollbar,
	ElTabPane,
	ElTable,
	ElTableColumn,
	ElTabs,
	ElTooltip,
	type FormInstance,
	type FormRules,
	vLoading,
} from 'element-plus';
import { isEqual } from 'lodash';

import { Icon } from '@iconify/vue';

import {
	CopyField,
	EditDrawerLayout,
	FormFooter,
	StatusTag,
	type StatusTagStatus,
	ViewHeader,
	provideEditDrawer,
	useFlashMessage,
	useSizeClass,
} from '../../../common';
import McpOauthRowActions from '../components/mcp-oauth-row-actions.vue';
import type { McpOAuthRow } from '../components/mcp-oauth-row-list.types';
import McpOauthRowList from '../components/mcp-oauth-row-list.vue';
import McpOauthTab from '../components/mcp-oauth-tab.vue';
import McpTableEmpty from '../components/mcp-table-empty.vue';
import { useMcpOAuthManagement } from '../composables/useMcpOAuthManagement';
import { useMcpOAuthTabQuery } from '../composables/useMcpOAuthTabQuery';
import { McpOAuthScope } from '../mcp.constants';
import type { IMcpOAuthAccessToken, IMcpOAuthClient, IMcpOAuthGrant, IMcpOAuthRefreshFamily } from '../schemas/oauth-management.types';

defineOptions({ name: 'ViewMcpOAuthManagement' });

const { t, locale } = useI18n();
const flashMessage = useFlashMessage();
const { isPhone } = useSizeClass();
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

// Scopes read as one line of text, like the capabilities on the clients page
const scopesLabel = (scopes: McpOAuthScope[]): string => scopes.map((scope) => t(`mcpModule.oauthManagement.scope.${scope}`)).join(', ');

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

const formOpen = computed<boolean>((): boolean => showClientDialog.value || showGrantDialog.value);

// The forms keep the layout they opened in, so a window crossing a size class does not remount them
provideEditDrawer((): boolean => formOpen.value);

// Resolves true when the open form may be replaced or closed: nothing was edited, or the user agreed to discard
const confirmDiscard = async (): Promise<boolean> => {
	const changed = (showClientDialog.value && clientFormChanged.value) || (showGrantDialog.value && grantFormChanged.value);

	if (!changed) {
		return true;
	}

	try {
		await ElMessageBox.confirm(t('mcpModule.confirm.discard'), t('mcpModule.headings.discard'), {
			confirmButtonText: t('mcpModule.actions.yes'),
			cancelButtonText: t('mcpModule.actions.no'),
			type: 'warning',
		});

		return true;
	} catch {
		return false;
	}
};

/**
 * Shared by the footer, the close button in the form's bar and the drawer's own `before-close`, so no route out of
 * the form skips the check. `done` arrives only from `before-close`; withholding it keeps the drawer open.
 */
const onCloseForm = async (done?: () => void): Promise<void> => {
	if (!(await confirmDiscard())) {
		return;
	}

	showClientDialog.value = false;
	showGrantDialog.value = false;

	done?.();
};

// On wide screens the form docks beside the list without a scrim, so the list stays usable while a form is open.
// Opening another form replaces the open one, so it runs the same guard as closing it; and a save on its way closes the
// form when it ends, which would close the one opened in its place, so nothing opens until it is done
const mayReplaceForm = async (): Promise<boolean> => {
	if (saving.value) {
		return false;
	}

	return !formOpen.value || (await confirmDiscard());
};

const openCreate = async (): Promise<void> => {
	if (!(await mayReplaceForm())) {
		return;
	}

	showGrantDialog.value = false;
	resetClientForm();
	showClientDialog.value = true;
};

const openEdit = async (client: IMcpOAuthClient): Promise<void> => {
	if (!(await mayReplaceForm())) {
		return;
	}

	showGrantDialog.value = false;
	editingClient.value = client;
	clientForm.name = client.name;
	clientForm.redirectUris = [...client.redirectUris];
	clientForm.maximumScopes = [...client.maximumScopes];
	clientFormEl.value?.clearValidate();
	initialClientForm.value = snapshotClientForm();
	showClientDialog.value = true;
};

const initialGrantForm = ref<McpOAuthScope[]>([...grantForm.approvedScopes]);

const grantFormChanged = computed<boolean>((): boolean => !isEqual([...grantForm.approvedScopes], initialGrantForm.value));

const openGrantEdit = async (grant: IMcpOAuthGrant): Promise<void> => {
	if (!(await mayReplaceForm())) {
		return;
	}

	showClientDialog.value = false;
	editingGrant.value = grant;
	grantScopeOptions.value = [...grant.approvedScopes];
	grantForm.approvedScopes = [...grant.approvedScopes];
	grantFormEl.value?.clearValidate();
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

type GrantStatusKey = 'active' | 'expired' | 'inactive' | 'revoked';

const GRANT_STATUS_TAGS: Record<GrantStatusKey, StatusTagStatus> = {
	active: 'ok',
	inactive: 'warn',
	expired: 'danger',
	revoked: 'danger',
};

const grantStatus = (grant: IMcpOAuthGrant): { key: 'active' | 'expired' | 'inactive' | 'revoked'; type: 'success' | 'danger' | 'warning' } => {
	if (grant.revokedAt) return { key: 'revoked', type: 'danger' };
	if (new Date(grant.expiresAt).getTime() <= Date.now()) return { key: 'expired', type: 'danger' };
	if (!grant.active) return { key: 'inactive', type: 'warning' };

	return { key: 'active', type: 'success' };
};

const canRevokeGrant = (grant: IMcpOAuthGrant): boolean => grant.revokedAt === null && new Date(grant.expiresAt).getTime() > Date.now();
const canEditGrant = (grant: IMcpOAuthGrant): boolean => grant.active;

// `fetchAll` records the failure and rethrows so callers can react. As an event
// handler that rejection has nowhere to go, and Vue reports it as an unhandled
// error — the state is already on screen, so swallowing it here is the point.
const onRetry = (): void => {
	fetchAll().catch(() => {
		// Already surfaced by the table's failed state.
	});
};

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

// In the language of the application
const formatDate = (value: string): string =>
	new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
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

// The phone rows: a title, one caption line and the status, with the same actions as the tables
const clientRows = computed<McpOAuthRow[]>(() =>
	clientsQuery.items.value.map((client) => ({
		id: client.id,
		title: client.name,
		caption: scopesLabel(client.maximumScopes),
		status: {
			status: client.enabled ? 'ok' : 'warn',
			label: t(`mcpModule.oauthManagement.status.${client.enabled ? 'active' : 'disabled'}`),
		},
	}))
);

const grantRows = computed<McpOAuthRow[]>(() =>
	grantsQuery.items.value.map((grant) => ({
		id: grant.id,
		title: grant.clientName,
		caption: formatDate(grant.expiresAt),
		status: { status: GRANT_STATUS_TAGS[grantStatus(grant).key], label: t(`mcpModule.oauthManagement.status.${grantStatus(grant).key}`) },
	}))
);

const accessTokenRows = computed<McpOAuthRow[]>(() =>
	accessTokensQuery.items.value.map((token) => ({ id: token.id, title: token.clientName, caption: formatDate(token.expiresAt) }))
);

const refreshFamilyRows = computed<McpOAuthRow[]>(() =>
	refreshFamiliesQuery.items.value.map((family) => ({
		id: family.id,
		title: family.clientName,
		caption: `${t('mcpModule.oauthManagement.columns.activeTokens')}: ${family.activeTokenCount} · ${formatDate(family.expiresAt)}`,
	}))
);

onMounted(() => void fetchAll().catch(() => undefined));
</script>

<template>
	<div
		class="flex flex-col flex-1 min-h-0"
		data-test-id="view-notification"
	>
		<!-- One notification. In the inbox's right pane from tablet landscape; below it its own page, with the header
		     leading back to the list. The inbox, its parent route, owns the data and runs the actions. On phone the page
		     scrolls as a whole, so the card does not clip and the detail's footer stays in view at the bottom -->
		<view-header
			v-if="!props.inPane"
			:title="props.notification?.title ?? t('notificationsModule.headings.notifications.list')"
			:subtitle="props.notification?.source"
			:back="backRoute"
			icon="mdi:bell-outline"
		/>

		<div :class="props.inPane ? 'flex flex-col flex-1 min-h-0' : 'page-pad flex flex-col flex-1 min-h-0 box-border'">
			<div :class="['flex flex-col flex-1 min-h-0', props.inPane ? '' : 'bg-surface border border-solid border-light rounded-lg']">
				<notification-detail
					v-if="props.notification"
					:key="props.notification.id"
					:notification="props.notification"
					@mark-read="(id: INotification['id'], read: boolean) => emit('mark-read', id, read)"
					@dismiss="(id: INotification['id']) => emit('dismiss', id)"
					@remove="(id: INotification['id']) => emit('remove', id)"
				/>

				<state-view
					v-else-if="props.loading"
					kind="loading"
					icon="mdi:bell-outline"
					:title="t('notificationsModule.texts.notifications.loading')"
				/>

				<state-view
					v-else
					kind="not-found"
					icon="mdi:bell-off-outline"
					:title="t('notificationsModule.texts.notifications.notFound')"
					data-test-id="notification-not-found"
				>
					<template #action>
						<el-button
							plain
							@click="router.push(backRoute)"
						>
							{{ t('notificationsModule.buttons.backToList.title') }}
						</el-button>
					</template>
				</state-view>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { type RouteLocationRaw, useRoute, useRouter } from 'vue-router';

import { ElButton } from 'element-plus';

import { StateView, ViewHeader } from '../../../common';
import NotificationDetail from '../components/notification-detail.vue';
import { RouteNames } from '../notifications.constants';
import type { INotification } from '../store/notifications.store.schemas';

defineOptions({
	name: 'ViewNotification',
});

const props = withDefaults(
	defineProps<{
		/** The route param */
		id: string;
		/** Handed down by the inbox, which reads it from the store or the backend */
		notification?: INotification | null;
		loading?: boolean;
		/** In the right pane of the inbox rather than on a page of its own */
		inPane?: boolean;
	}>(),
	{
		notification: null,
		loading: false,
		inPane: false,
	}
);

const emit = defineEmits<{
	(e: 'mark-read', id: INotification['id'], read: boolean): void;
	(e: 'dismiss', id: INotification['id']): void;
	(e: 'remove', id: INotification['id']): void;
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

// Back to the list as it was left: the list keeps its filters in the query
const backRoute = computed<RouteLocationRaw>((): RouteLocationRaw => ({ name: RouteNames.NOTIFICATIONS, query: route.query }));
</script>

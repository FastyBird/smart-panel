<template>
	<el-card
		shadow="never"
		data-test-id="light-group-command-outcomes"
	>
		<template #header>{{ t('devicesVirtualPlugin.lightGroup.commands') }}</template>
		<el-text v-if="!commands.length">{{ t('devicesVirtualPlugin.lightGroup.none') }}</el-text>
		<div
			v-for="command in commands"
			:key="command.id"
			class="mb-3"
		>
			<el-tag :type="command.status === 'confirmed' ? 'success' : command.status === 'partial' ? 'warning' : 'danger'">
				{{ t(`devicesVirtualPlugin.lightGroup.status.${command.status}`) }}
			</el-tag>
			<ul>
				<li
					v-for="child in command.children"
					:key="`${child.memberId}:${child.propertyId ?? child.propertyIdentity}`"
					:data-test-id="`member-outcome-${child.memberId}`"
				>
					{{ names?.[child.memberIdentity ?? child.memberId] ?? child.memberIdentity ?? child.memberId }}
					— {{ t(`devicesVirtualPlugin.lightGroup.status.${child.status}`) }}
					<el-text
						v-if="child.reason"
						type="info"
					>
						{{ child.reason }}
					</el-text>
				</li>
			</ul>
		</div>
	</el-card>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElCard, ElTag, ElText } from 'element-plus';

defineProps<{
	commands: Array<{
		id: string;
		status: string;
		children: Array<{
			memberId: string;
			memberIdentity?: string;
			propertyId: string | null;
			propertyIdentity?: string | null;
			status: string;
			reason?: string;
		}>;
	}>;
	names?: Record<string, string>;
}>();
const { t } = useI18n();
</script>

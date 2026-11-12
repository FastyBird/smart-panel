import { useI18n } from 'vue-i18n';

import { AUTOMATION_NODE_KIND_ICONS, AUTOMATION_NODE_TYPE_ICONS, type AutomationNodeKind } from '../automations.constants';
import { summarizeConfig } from '../automations.graph';
import type { IAutomationGraphIssue, IAutomationGraphNode } from '../store/automations.store.types';
import type { IAutomationNodeType } from '../store/node-types.store.types';

import type { IUseAutomationNodePresentation } from './types';

const UNKNOWN_NODE_ICON = 'mdi:help-circle-outline';

/**
 * How a card is shown: its name, icon, the words for its kind and ports, and the one line that says what
 * it is set to do. Names come translated for the cards the admin knows and in the backend's English for
 * the rest. The summary is the generic one, read from the plain values of the configuration.
 *
 * Seam for AU-11: cards with an admin element bring their own summary (`automationNodeCard`); that is to
 * be resolved in `nodeSummary`, falling back to what is here.
 */
export const useAutomationNodePresentation = (): IUseAutomationNodePresentation => {
	const { t, te } = useI18n();

	const kindLabel = (kind: AutomationNodeKind | null): string =>
		kind === null ? t('automations.editor.kinds.unknown.label') : t(`automations.editor.kinds.${kind}.label`);

	const kindTitle = (kind: AutomationNodeKind): string => t(`automations.editor.kinds.${kind}.title`);

	const nodeTitle = (type: IAutomationGraphNode['type'], nodeType: IAutomationNodeType | null): string => {
		const key = `automations.editor.nodeTypes.${type}.name`;

		if (te(key)) {
			return t(key);
		}

		return nodeType?.name ?? type;
	};

	const nodeDescription = (type: IAutomationGraphNode['type'], nodeType: IAutomationNodeType | null): string => {
		const key = `automations.editor.nodeTypes.${type}.description`;

		if (te(key)) {
			return t(key);
		}

		return nodeType?.description ?? '';
	};

	const nodeIcon = (type: IAutomationGraphNode['type'], nodeType: IAutomationNodeType | null): string => {
		return AUTOMATION_NODE_TYPE_ICONS[type] ?? (nodeType ? AUTOMATION_NODE_KIND_ICONS[nodeType.kind] : UNKNOWN_NODE_ICON);
	};

	const nodeSummary = (node: Pick<IAutomationGraphNode, 'type' | 'config'>, nodeType: IAutomationNodeType | null): string => {
		if (nodeType === null) {
			return t('automations.editor.texts.unknownNodeType');
		}

		const summary = summarizeConfig(node.config);

		if (summary !== '') {
			return summary;
		}

		const properties = nodeType.configSchema.properties;
		const configurable = typeof properties === 'object' && properties !== null && Object.keys(properties).length > 0;

		return configurable ? t('automations.editor.texts.notConfigured') : nodeDescription(node.type, nodeType);
	};

	const portLabel = (port: string): string => {
		const key = `automations.editor.ports.${port}`;

		return te(key) ? t(key) : port;
	};

	// The structural problems are worded here; the reasons a configuration is refused are specific to
	// the card and come worded from the backend
	const issueText = (issue: Pick<IAutomationGraphIssue, 'code' | 'message'>): string => {
		const key = `automations.editor.issues.${issue.code}`;

		return te(key) ? t(key) : issue.message;
	};

	return {
		issueText,
		kindLabel,
		kindTitle,
		nodeTitle,
		nodeDescription,
		nodeIcon,
		nodeSummary,
		portLabel,
	};
};

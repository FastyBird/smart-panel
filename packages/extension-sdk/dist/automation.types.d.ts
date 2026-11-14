export type AutomationNodeKind = 'trigger' | 'condition' | 'action' | 'flow';
export type AutomationExtensionNodeKind = Exclude<AutomationNodeKind, 'flow'>;
export declare const AUTOMATION_EXTENSION_NODE_KINDS: readonly AutomationExtensionNodeKind[];
export interface AutomationNodePorts {
    inputs: string[];
    outputs: string[];
}
export interface AutomationNodeDefaultPorts {
    readonly inputs: readonly string[];
    readonly outputs: readonly string[];
}
export declare const AUTOMATION_NODE_DEFAULT_PORTS: Readonly<Record<AutomationExtensionNodeKind, AutomationNodeDefaultPorts>>;
export type AutomationNodeReferenceKind = 'device' | 'channel' | 'property' | 'scene' | 'space' | 'automation';
export interface AutomationNodeReference {
    kind: AutomationNodeReferenceKind;
    id: string;
}
export type AutomationNodeConfig = Record<string, unknown>;
export interface AutomationNodeTypeOwner {
    kind: 'module' | 'plugin';
    type: string;
}
export interface AutomationNodeConfigProblem {
    field?: string;
    reason: string;
}
export type AutomationNodeConfigValidator = (config: AutomationNodeConfig) => AutomationNodeConfigProblem[] | Promise<AutomationNodeConfigProblem[]>;
export interface AutomationNodeTypeBase<TConfig extends object = AutomationNodeConfig> {
    type: string;
    kind: AutomationNodeKind;
    name: string;
    description: string;
    ports?: AutomationNodePorts;
    validateConfig: AutomationNodeConfigValidator;
    configSchema?: Record<string, unknown>;
    references?(config: TConfig): AutomationNodeReference[];
    owner?: AutomationNodeTypeOwner;
    unavailableReason?(): string | undefined;
}
export interface AutomationTriggerData {
    [key: string]: unknown;
}
export interface AutomationRunTrigger {
    nodeId: string;
    data: AutomationTriggerData;
    manual: boolean;
}
export interface AutomationRunContext {
    automationId: string;
    runId: string;
    nodeId: string;
    signal: AbortSignal;
    trigger: AutomationRunTrigger;
}
export interface AutomationTriggerContext {
    automationId: string;
    nodeId: string;
}
export declare const AUTOMATION_NODE_DEFAULT_TIMEOUT_SECONDS = 30;
export declare const AUTOMATION_NODE_MAX_TIMEOUT_SECONDS = 300;
export declare const AUTOMATION_NODE_TYPE_MAX_LENGTH = 100;
export interface AutomationConditionResult {
    result: boolean;
    observed?: unknown;
    reason?: string;
}
export interface AutomationActionResult {
    success: boolean;
    reason?: string;
    refused?: boolean;
}
export type AutomationActionCommand = {
    kind: 'property_write';
    propertyId: string;
    value: unknown;
    field?: string;
} | {
    kind: 'scene_run';
    sceneId: string;
    field?: string;
};
export interface AutomationTriggerNodeType<TConfig extends object = AutomationNodeConfig> extends AutomationNodeTypeBase<TConfig> {
    kind: 'trigger';
    subscribe(config: TConfig, fire: (data: AutomationTriggerData) => void, context?: AutomationTriggerContext): () => void;
}
export interface AutomationConditionNodeType<TConfig extends object = AutomationNodeConfig> extends AutomationNodeTypeBase<TConfig> {
    kind: 'condition';
    evaluate(config: TConfig, context: AutomationRunContext): Promise<AutomationConditionResult>;
    timeoutSeconds?: number;
}
export interface AutomationActionNodeType<TConfig extends object = AutomationNodeConfig> extends AutomationNodeTypeBase<TConfig> {
    kind: 'action';
    execute(config: TConfig, context: AutomationRunContext): Promise<AutomationActionResult>;
    commands?(config: TConfig): AutomationActionCommand[];
    timeoutSeconds?: number;
}
export type AutomationExtensionNodeType<TConfig extends object = AutomationNodeConfig> = AutomationTriggerNodeType<TConfig> | AutomationConditionNodeType<TConfig> | AutomationActionNodeType<TConfig>;
export interface AutomationNodeTypeRegistrar {
    register<TConfig extends object>(nodeType: AutomationNodeTypeBase<TConfig>): void;
}
export declare const isAutomationNodeTypeId: (value: unknown) => value is string;
export declare const defineAutomationTrigger: <TConfig extends object>(nodeType: AutomationTriggerNodeType<TConfig>) => AutomationTriggerNodeType<TConfig>;
export declare const defineAutomationCondition: <TConfig extends object>(nodeType: AutomationConditionNodeType<TConfig>) => AutomationConditionNodeType<TConfig>;
export declare const defineAutomationAction: <TConfig extends object>(nodeType: AutomationActionNodeType<TConfig>) => AutomationActionNodeType<TConfig>;
export declare const AUTOMATION_CONFIG_UNKNOWN_FIELD_REASON = "This property is not allowed.";
export declare const checkAutomationConfigKeys: (config: unknown, allowed: readonly string[]) => AutomationNodeConfigProblem[];

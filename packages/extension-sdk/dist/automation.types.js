"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAutomationConfigKeys = exports.AUTOMATION_CONFIG_UNKNOWN_FIELD_REASON = exports.defineAutomationAction = exports.defineAutomationCondition = exports.defineAutomationTrigger = exports.isAutomationNodeTypeId = exports.AUTOMATION_NODE_TYPE_MAX_LENGTH = exports.AUTOMATION_NODE_MAX_TIMEOUT_SECONDS = exports.AUTOMATION_NODE_DEFAULT_TIMEOUT_SECONDS = exports.AUTOMATION_NODE_DEFAULT_PORTS = exports.AUTOMATION_EXTENSION_NODE_KINDS = void 0;
exports.AUTOMATION_EXTENSION_NODE_KINDS = Object.freeze([
    'trigger',
    'condition',
    'action',
]);
exports.AUTOMATION_NODE_DEFAULT_PORTS = Object.freeze({
    trigger: Object.freeze({ inputs: [], outputs: ['out'] }),
    condition: Object.freeze({ inputs: ['in'], outputs: ['yes', 'no'] }),
    action: Object.freeze({ inputs: ['in'], outputs: ['done', 'error'] }),
});
exports.AUTOMATION_NODE_DEFAULT_TIMEOUT_SECONDS = 30;
exports.AUTOMATION_NODE_MAX_TIMEOUT_SECONDS = 300;
exports.AUTOMATION_NODE_TYPE_MAX_LENGTH = 100;
const NODE_TYPE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const isAutomationNodeTypeId = (value) => typeof value === 'string' && value.length <= exports.AUTOMATION_NODE_TYPE_MAX_LENGTH && NODE_TYPE_PATTERN.test(value);
exports.isAutomationNodeTypeId = isAutomationNodeTypeId;
const defineAutomationTrigger = (nodeType) => nodeType;
exports.defineAutomationTrigger = defineAutomationTrigger;
const defineAutomationCondition = (nodeType) => nodeType;
exports.defineAutomationCondition = defineAutomationCondition;
const defineAutomationAction = (nodeType) => nodeType;
exports.defineAutomationAction = defineAutomationAction;
exports.AUTOMATION_CONFIG_UNKNOWN_FIELD_REASON = 'This property is not allowed.';
const checkAutomationConfigKeys = (config, allowed) => {
    if (typeof config !== 'object' || config === null || Array.isArray(config)) {
        return [{ reason: 'The configuration must be an object.' }];
    }
    return Object.keys(config)
        .filter((key) => !allowed.includes(key))
        .map((key) => ({ field: key, reason: exports.AUTOMATION_CONFIG_UNKNOWN_FIELD_REASON }));
};
exports.checkAutomationConfigKeys = checkAutomationConfigKeys;
//# sourceMappingURL=automation.types.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNumericOperatorRange = void 0;
exports.snapshotNumericOperator = snapshotNumericOperator;
exports.validateNumericOperatorParameters = validateNumericOperatorParameters;
const localName = (v) => typeof v === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(v);
const exactKeys = (v, keys) => Object.keys(v).every((key) => keys.includes(key));
const isNumericOperatorRange = (v) => !!v &&
    exactKeys(v, ['minimum', 'maximum']) &&
    Number.isFinite(v.minimum) &&
    Number.isFinite(v.maximum) &&
    v.minimum <= v.maximum;
exports.isNumericOperatorRange = isNumericOperatorRange;
const measurement = (v) => !!v &&
    exactKeys(v, ['quantity', 'unit']) &&
    ['temperature:°C', 'humidity:%', 'concentration:ppm', 'illuminance:lx', 'voltage:V', 'value:V'].includes(`${v.quantity}:${v.unit}`);
function snapshotNumericOperator(value) {
    if (!value ||
        !exactKeys(value, [
            'contractVersion',
            'name',
            'operatorVersion',
            'input',
            'output',
            'inputRange',
            'outputRange',
            'parameters',
            'evaluate',
        ]) ||
        value.contractVersion !== 1 ||
        !localName(value.name) ||
        !Number.isSafeInteger(value.operatorVersion) ||
        value.operatorVersion < 1 ||
        !measurement(value.input) ||
        !measurement(value.output) ||
        !(0, exports.isNumericOperatorRange)(value.inputRange) ||
        !(0, exports.isNumericOperatorRange)(value.outputRange) ||
        !value.parameters ||
        typeof value.parameters !== 'object' ||
        Array.isArray(value.parameters) ||
        Object.keys(value.parameters).length > 32 ||
        typeof value.evaluate !== 'function')
        throw new Error('Invalid numeric operator definition');
    const parameters = {};
    for (const [name, schema] of Object.entries(value.parameters)) {
        if (!localName(name) ||
            !schema ||
            !exactKeys(schema, ['required', 'minimum', 'maximum']) ||
            typeof schema.required !== 'boolean' ||
            !(0, exports.isNumericOperatorRange)({ minimum: schema.minimum, maximum: schema.maximum }))
            throw new Error('Invalid numeric parameter schema');
        parameters[name] = Object.freeze({ ...schema });
    }
    return Object.freeze({
        ...value,
        input: Object.freeze({ ...value.input }),
        output: Object.freeze({ ...value.output }),
        inputRange: Object.freeze({ ...value.inputRange }),
        outputRange: Object.freeze({ ...value.outputRange }),
        parameters: Object.freeze(parameters),
    });
}
function validateNumericOperatorParameters(definition, value) {
    if (!value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.keys(value).some((key) => !Object.prototype.hasOwnProperty.call(definition.parameters, key)))
        throw new Error('Unknown numeric parameter');
    const result = {};
    for (const [name, schema] of Object.entries(definition.parameters)) {
        if (!Object.prototype.hasOwnProperty.call(value, name)) {
            if (schema.required)
                throw new Error('Missing numeric parameter');
            continue;
        }
        const n = value[name];
        if (typeof n !== 'number' || !Number.isFinite(n) || n < schema.minimum || n > schema.maximum)
            throw new Error('Invalid numeric parameter');
        result[name] = n;
    }
    return Object.freeze(result);
}
//# sourceMappingURL=numeric-operator.types.js.map
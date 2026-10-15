export type NumericMeasurement = {
    readonly quantity: 'temperature';
    readonly unit: '°C';
} | {
    readonly quantity: 'humidity';
    readonly unit: '%';
} | {
    readonly quantity: 'concentration';
    readonly unit: 'ppm';
} | {
    readonly quantity: 'illuminance';
    readonly unit: 'lx';
} | {
    readonly quantity: 'voltage' | 'value';
    readonly unit: 'V';
};
export interface NumericOperatorRange {
    readonly minimum: number;
    readonly maximum: number;
}
export interface NumericOperatorParameter {
    readonly required: boolean;
    readonly minimum: number;
    readonly maximum: number;
}
export interface NumericOperatorDescriptor {
    readonly contractVersion: 1;
    readonly name: string;
    readonly operatorVersion: number;
    readonly input: NumericMeasurement;
    readonly output: NumericMeasurement;
    readonly inputRange: NumericOperatorRange;
    readonly outputRange: NumericOperatorRange;
    readonly parameters: Readonly<Record<string, NumericOperatorParameter>>;
}
export interface NumericOperatorDefinition extends NumericOperatorDescriptor {
    readonly evaluate: (input: number, parameters: Readonly<Record<string, number>>) => number;
}
export declare const isNumericOperatorRange: (v: NumericOperatorRange) => boolean;
export declare function snapshotNumericOperator(value: NumericOperatorDefinition): NumericOperatorDefinition;
export declare function validateNumericOperatorParameters(definition: NumericOperatorDescriptor, value: Readonly<Record<string, number>>): Readonly<Record<string, number>>;

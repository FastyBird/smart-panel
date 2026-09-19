export type InputEvent = 'press' | 'double_press' | 'triple_press' | 'long_press' | 'release' | 'down' | 'up' | (string & {});
export interface ReportInputOccurrencePayload {
    event: InputEvent;
    property?: string;
    sourceOccurrenceId?: string;
    sourceTimestamp?: string;
    nativeEventType?: string;
    data?: Record<string, unknown>;
}
export interface InputOccurrenceResult {
    id: string;
    timestamp: string;
    event: string;
}
export interface InputChannelCapability {
    category: 'button' | 'binary_input' | 'analog_input';
    supportedEvents?: string[];
    supportsState?: boolean;
}

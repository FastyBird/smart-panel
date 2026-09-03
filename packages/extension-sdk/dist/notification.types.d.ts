export type NotificationKind = 'event' | 'issue';
export type NotificationSeverity = 'info' | 'warning' | 'error' | 'critical';
export type NotificationActionType = 'link' | 'extension_action' | 'service';
export type NotificationServiceExtensionKind = 'module' | 'plugin';
export type NotificationServiceOperation = 'start' | 'stop' | 'restart';
export type NotificationAction = {
    type: 'link';
    label: string;
    url: string;
    primary?: boolean;
} | {
    type: 'extension_action';
    label: string;
    extension_type: string;
    action_id: string;
    params?: Record<string, string | number | boolean>;
    primary?: boolean;
} | {
    type: 'service';
    label: string;
    extension_kind: NotificationServiceExtensionKind;
    extension_type: string;
    service_id: string;
    operation: NotificationServiceOperation;
    primary?: boolean;
};
export type NotificationData = Record<string, string | number | boolean | null>;
export interface CreateNotificationInput {
    source: string;
    kind: NotificationKind;
    key?: string;
    severity: NotificationSeverity;
    title: string;
    message?: string;
    actions?: NotificationAction[];
    data?: NotificationData;
    persistent?: boolean;
}
export interface Notification {
    id: string;
    source: string;
    kind: NotificationKind;
    key: string | null;
    severity: NotificationSeverity;
    title: string;
    message: string | null;
    actions: NotificationAction[];
    data: NotificationData | null;
    persistent: boolean;
    occurrences: number;
    read_at: string | null;
    dismissed_at: string | null;
    resolved_at: string | null;
    created_at: string;
    updated_at: string;
}
export interface ChannelDeliveryError {
    message: string;
    retryable: boolean;
    status?: number;
}
export interface NotificationChannel {
    getType(): string;
    isConfigured(): Promise<boolean>;
    getMinSeverity(): Promise<NotificationSeverity>;
    send(notification: Notification, signal: AbortSignal): Promise<void>;
}

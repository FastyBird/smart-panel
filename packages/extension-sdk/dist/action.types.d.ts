export type ActionMode = 'immediate' | 'interactive';
export type ActionParameterType = 'string' | 'number' | 'boolean' | 'select' | 'multi_select';
export interface ActionParameterOption {
    label: string;
    value: string | number | boolean;
}
export interface ActionParameterValidation {
    min?: number;
    max?: number;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
}
export interface ActionParameter {
    name: string;
    label: string;
    description?: string;
    type: ActionParameterType;
    required?: boolean;
    default?: string | number | boolean;
    options?: ActionParameterOption[];
    resolveOptions?(): Promise<ActionParameterOption[]>;
    validation?: ActionParameterValidation;
}
export type ActionCategory = 'general' | 'simulation' | 'data' | 'diagnostics' | 'maintenance';
export interface ActionResult {
    success: boolean;
    message?: string;
    data?: Record<string, unknown>;
}
export interface ExtensionAction {
    id: string;
    label: string;
    description?: string;
    icon?: string;
    category?: ActionCategory;
    mode: ActionMode;
    dangerous?: boolean;
    parameters?: ActionParameter[];
    execute?(params: Record<string, unknown>): Promise<ActionResult>;
}

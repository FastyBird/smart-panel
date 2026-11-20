export type StateViewKind = 'empty' | 'loading' | 'error' | 'not-found';

export type StateViewProps = {
	kind?: StateViewKind;
	icon?: string;
	title?: string;
	description?: string;
};

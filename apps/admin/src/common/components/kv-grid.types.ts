export type KvGridItem = {
	label: string;
	value: string | number | null | undefined;
	mono?: boolean;
	href?: string;
};

export type KvGridProps = {
	items: KvGridItem[];
	cols?: 2 | 3 | 4;
};

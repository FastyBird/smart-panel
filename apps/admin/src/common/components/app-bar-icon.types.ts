export enum AppBarIconAlign {
	LEFT = 'left',
	RIGHT = 'right',
	NONE = 'none',
}

export type AppBarIconAlignType = AppBarIconAlign.LEFT | AppBarIconAlign.RIGHT | AppBarIconAlign.NONE;

export type AppBarIconProps = {
	align?: AppBarIconAlignType;
	teleport?: boolean;
};

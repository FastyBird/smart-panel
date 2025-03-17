import type { ButtonProps } from 'element-plus';

export enum AppBarButtonAlign {
	LEFT = 'left',
	RIGHT = 'right',
	BACK = 'back',
	NONE = 'none',
}

export type AppBarButtonAlignType = AppBarButtonAlign.LEFT | AppBarButtonAlign.RIGHT | AppBarButtonAlign.BACK | AppBarButtonAlign.NONE;

export type AppBarButtonProps = {
	align?: AppBarButtonAlignType;
	small?: boolean;
	teleport?: boolean;
	classes?: string[];
	size?: ButtonProps['size'];
	disabled?: ButtonProps['disabled'];
	type?: ButtonProps['type'];
	icon?: ButtonProps['icon'];
	nativeType?: ButtonProps['nativeType'];
	loading?: ButtonProps['loading'];
	loadingIcon?: ButtonProps['loadingIcon'];
	plain?: ButtonProps['plain'];
	link?: ButtonProps['link'];
	bg?: ButtonProps['bg'];
	autofocus?: ButtonProps['autofocus'];
	round?: ButtonProps['round'];
	circle?: ButtonProps['circle'];
	color?: ButtonProps['color'];
	dark?: ButtonProps['dark'];
	autoInsertSpace?: ButtonProps['autoInsertSpace'];
	tag?: ButtonProps['tag'];
};

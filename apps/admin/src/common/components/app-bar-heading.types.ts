import type { Component } from 'vue';

export enum AppBarHeadingAlign {
	LEFT = 'left',
	RIGHT = 'right',
	CENTER = 'center',
}

export type AppBarHeadingAlignType = AppBarHeadingAlign.LEFT | AppBarHeadingAlign.RIGHT | AppBarHeadingAlign.CENTER;

export type AppBarHeadingProps = {
	align?: AppBarHeadingAlignType;
	icon?: string | Component;
	teleport?: boolean;
};

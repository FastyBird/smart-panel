export type GravatarRating = 'g' | 'pg' | 'r' | 'x';

export type GravatarDefaultImg = '404' | 'mp' | 'mm' | 'identicon' | 'monsterid' | 'wavatar' | 'retro' | 'robohash' | 'blank';

export type UserAvatarProps = {
	email?: string | null;
	size?: number;
	defaultImg?: GravatarDefaultImg;
	rating?: GravatarRating;
	alt?: string;
	protocol?: string | null;
	hostname?: string;
};

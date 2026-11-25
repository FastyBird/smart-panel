import type { ITile } from '../../../modules/dashboard';
import type { ICard } from '../store/cards.store.types';

export interface ICardsPageListProps {
	cards: ICard[];
	/** The tiles of each card, keyed by the card id */
	tiles: Record<ICard['id'], ITile[]>;
}

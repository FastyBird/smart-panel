export const PAGES_CARDS_PLUGIN_PREFIX = 'pages-cards';

export const PAGES_CARDS_PLUGIN_NAME = 'pages-cards';

export const PAGES_CARDS_TYPE = 'pages-cards';

export enum EventType {
	CARD_CREATED = 'PagesCardsPlugin.Card.Created',
	CARD_UPDATED = 'PagesCardsPlugin.Card.Updated',
	CARD_DELETED = 'PagesCardsPlugin.Card.Deleted',
	CARD_RESET = 'PagesCardsPlugin.Card.Reset',
	PLUGIN_RESET = 'PagesCardsPlugin.All.Reset',
}

export const PAGES_CARDS_PLUGIN_PREFIX = 'pages-cards';

export const PAGES_CARDS_PLUGIN_NAME = 'pages-cards-plugin';

export const PAGES_CARDS_TYPE = 'pages-cards';

export const PAGES_CARDS_PLUGIN_EVENT_PREFIX = 'PagesCardsPlugin.';

export enum EventType {
	CARD_CREATED = 'PagesCardsPlugin.Card.Created',
	CARD_UPDATED = 'PagesCardsPlugin.Card.Updated',
	CARD_DELETED = 'PagesCardsPlugin.Card.Deleted',
}

export const RouteNames = {
	PAGE: 'pages_cards_plugin-settings',
	PAGE_ADD_CARD: 'pages_cards_plugin-settings_add_card',
	PAGE_EDIT_CARD: 'pages_cards_plugin-settings_edit_card',
	PAGE_CARD_ADD_TILE: 'pages_cards_plugin-settings_card_add_tile',
	PAGE_CARD_EDIT_TILE: 'pages_cards_plugin-settings_card_edit_tile',
	PAGE_ADD_DATA_SOURCE: 'pages_cards_plugin-settings_add_data_source',
	PAGE_EDIT_DATA_SOURCE: 'pages_cards_plugin-settings_edit_data_source',
};

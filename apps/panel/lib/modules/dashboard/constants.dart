class DashboardModuleConstants {
  // Socket event names
  static const String moduleWildcardEvent = 'DashboardModule.*';

  static const String pageCreatedEvent = 'DashboardModule.Page.Created';
  static const String pageUpdatedEvent = 'DashboardModule.Page.Updated';
  static const String pageDeletedEvent = 'DashboardModule.Page.Deleted';
  static const String tileCreatedEvent = 'DashboardModule.Tile.Created';
  static const String tileUpdatedEvent = 'DashboardModule.Tile.Updated';
  static const String tileDeletedEvent = 'DashboardModule.Tile.Deleted';
  static const String dataSourceCreatedEvent =
      'DashboardModule.DataSource.Created';
  static const String dataSourceUpdatedEvent =
      'DashboardModule.DataSource.Updated';
  static const String dataSourceDeletedEvent =
      'DashboardModule.DataSource.Deleted';
}

class PagesCardsPluginConstants {
  // Socket event names
  static const String pluginWildcardEvent = 'PagesCardsPlugin.*';

  static const String cardCreatedEvent = 'PagesCardsPlugin.Card.Created';
  static const String cardUpdatedEvent = 'PagesCardsPlugin.Card.Updated';
  static const String cardDeletedEvent = 'PagesCardsPlugin.Card.Deleted';
}

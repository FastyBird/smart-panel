/// Types of items that can appear in the navigation deck.
enum DeckItemType {
  /// A system-generated overview view based on display role.
  systemView,

  /// A domain-specific view (lights, climate, media, sensors).
  domainView,

  /// A user-configured dashboard page.
  dashboardPage,
}

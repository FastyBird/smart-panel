/// Event fired when navigation to a specific page is requested.
/// The DashboardScreen listens for this event and navigates to the page.
class NavigateToPageEvent {
  final String pageId;

  NavigateToPageEvent(this.pageId);
}

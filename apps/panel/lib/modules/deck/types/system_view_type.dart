/// Types of system views contributed by space-type plugins.
///
/// Each value maps 1:1 to a space type discriminator registered via
/// `spaceViewBuilders` in `system_views_builder.dart`.
enum SystemViewType {
  /// Room overview: shows room-specific devices, scenes, and controls.
  room,

  /// Master overview: shows whole-house summary, room list, and global scenes.
  master,

  /// Entry overview: shows house modes, security status, and quick actions.
  entry,

  /// Information-panel signage: read-only, full-screen surface composed of
  /// clock, weather, announcements, and optional external feed sections.
  /// Contributed by the `spaces-signage-info-panel` plugin.
  signageInfoPanel,
}

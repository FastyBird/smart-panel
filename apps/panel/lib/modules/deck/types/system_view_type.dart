import 'package:fastybird_smart_panel/modules/displays/models/display.dart';

/// Types of system views based on display role.
enum SystemViewType {
  /// Room overview: shows room-specific devices, scenes, and controls.
  room,

  /// Master overview: shows whole-house summary, room list, and global scenes.
  master,

  /// Entry overview: shows house modes, security status, and quick actions.
  entry,
}

/// Extension to convert DisplayRole to SystemViewType.
extension DisplayRoleToSystemView on DisplayRole {
  SystemViewType toSystemViewType() {
    switch (this) {
      case DisplayRole.room:
        return SystemViewType.room;
      case DisplayRole.master:
        return SystemViewType.master;
      case DisplayRole.entry:
        return SystemViewType.entry;
    }
  }
}

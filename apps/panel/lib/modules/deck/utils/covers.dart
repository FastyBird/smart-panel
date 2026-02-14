import 'package:fastybird_smart_panel/modules/deck/utils/lighting.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/covers_targets/view.dart';

/// Gets the display name for a covers target based on channel count.
///
/// - If device has 1 channel: uses device name
/// - If device has 2+ channels: uses channel name
/// - Room name is stripped from the result
///
/// [target] - The covers target to get name for
/// [allTargets] - All covers targets to count channels per device
/// [roomName] - Room name to strip from the result (optional)
String getCoverTargetDisplayName(
  CoversTargetView target,
  List<CoversTargetView> allTargets,
  String? roomName,
) {
  final channelCount = allTargets.where((t) => t.deviceId == target.deviceId).length;
  final baseName = channelCount == 1 ? target.deviceName : target.channelName;
  return stripRoomNameFromDevice(baseName, roomName);
}

import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/alarm.dart';

class AlarmChannelCapability extends ChannelCapability<AlarmChannelDataModel> {
  AlarmChannelCapability({
    required super.channel,
    required super.properties,
  });
}

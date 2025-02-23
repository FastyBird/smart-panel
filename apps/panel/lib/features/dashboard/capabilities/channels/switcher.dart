import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';

class SwitcherChannelCapability extends Capability with ChannelOnMixin {
  SwitcherChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyModel get onProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.on,
      );
}

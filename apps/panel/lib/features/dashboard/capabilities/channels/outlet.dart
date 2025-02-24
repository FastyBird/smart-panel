import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class OutletChannelCapability extends Capability with ChannelOnMixin {
  OutletChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyModel get onProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.on,
      );

  ChannelPropertyModel? get inUseProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.inUse,
      );

  bool get hasInUse => inUseProp != null;

  bool get inUse {
    final ChannelPropertyModel? prop = inUseProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is BooleanValueType) {
      return defaultValue.value;
    }

    return false;
  }
}

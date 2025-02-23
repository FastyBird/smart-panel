import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class LockChannelCapability extends Capability
    with
        ChannelOnMixin,
        ChannelActiveMixin,
        ChannelFaultMixin,
        ChannelTamperedMixin {
  LockChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyModel get onProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.on,
      );

  ChannelPropertyModel get statusProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.status,
      );

  @override
  ChannelPropertyModel? get activeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.active,
      );

  @override
  ChannelPropertyModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.fault,
      );

  @override
  ChannelPropertyModel? get tamperedProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.tampered,
      );

  LockStatusValue get status {
    final ValueType? value = statusProp.value;

    if (value is StringValueType && LockStatusValue.contains(value.value)) {
      LockStatusValue? type = LockStatusValue.fromValue(value.value);

      if (type != null) {
        return type;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${statusProp.category.value}',
    );
  }

  bool get locked => status == LockStatusValue.locked;

  bool get unlocked => status == LockStatusValue.unlocked;
}

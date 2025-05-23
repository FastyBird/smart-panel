import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/density.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/detected.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/level.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tampered.dart';

class VolatileOrganicCompoundsChannelView extends ChannelView
    with
        ChannelDetectedMixin,
        ChannelDensityMixin,
        ChannelActiveMixin,
        ChannelFaultMixin,
        ChannelTamperedMixin {
  VolatileOrganicCompoundsChannelView({
    required super.channelModel,
    required super.properties,
  });

  @override
  DetectedChannelPropertyView? get detectedProp =>
      properties.whereType<DetectedChannelPropertyView>().firstOrNull;

  @override
  DensityChannelPropertyView? get densityProp =>
      properties.whereType<DensityChannelPropertyView>().firstOrNull;

  LevelChannelPropertyView? get levelProp =>
      properties.whereType<LevelChannelPropertyView>().firstOrNull;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  @override
  TamperedChannelPropertyView? get tamperedProp =>
      properties.whereType<TamperedChannelPropertyView>().firstOrNull;

  bool get hasLevel => levelProp != null;

  VolatileOrganicCompoundsLevelValue? get level {
    final LevelChannelPropertyView? prop = levelProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        VolatileOrganicCompoundsLevelValue.contains(value.value)) {
      return VolatileOrganicCompoundsLevelValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        VolatileOrganicCompoundsLevelValue.contains(defaultValue.value)) {
      return VolatileOrganicCompoundsLevelValue.fromValue(defaultValue.value);
    }

    return null;
  }

  List<VolatileOrganicCompoundsLevelValue> get availableLevels {
    final LevelChannelPropertyView? prop = levelProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => VolatileOrganicCompoundsLevelValue.fromValue(item))
          .whereType<VolatileOrganicCompoundsLevelValue>()
          .toList();
    }

    return [];
  }
}

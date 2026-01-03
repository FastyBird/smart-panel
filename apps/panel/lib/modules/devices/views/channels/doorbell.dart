import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/brightness.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/event.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tampered.dart';

class DoorbellChannelView extends ChannelView
    with ChannelBrightnessMixin, ChannelTamperedMixin {
  DoorbellChannelView({
    required super.id,
    required super.type,
    super.category,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    super.isValid,
    super.validationIssues,
  });

  EventChannelPropertyView get eventPropProp =>
      properties.whereType<EventChannelPropertyView>().first;

  @override
  BrightnessChannelPropertyView? get brightnessProp =>
      properties.whereType<BrightnessChannelPropertyView>().firstOrNull;

  @override
  TamperedChannelPropertyView? get tamperedProp =>
      properties.whereType<TamperedChannelPropertyView>().firstOrNull;

  ButtonEventValue? get event {
    final ValueType? value = eventPropProp.value;

    if (value is StringValueType && ButtonEventValue.contains(value.value)) {
      return ButtonEventValue.fromValue(value.value);
    }

    return null;
  }

  List<ButtonEventValue> get availableEvents {
    final FormatType? format = eventPropProp.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => ButtonEventValue.fromValue(item))
          .whereType<ButtonEventValue>()
          .toList();
    }

    return [];
  }
}

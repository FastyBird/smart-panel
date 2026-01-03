import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mode.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/volume.dart';

class SpeakerChannelView extends ChannelView
    with ChannelActiveMixin, ChannelVolumeMixin {
  SpeakerChannelView({
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

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  VolumeChannelPropertyView? get volumeProp =>
      properties.whereType<VolumeChannelPropertyView>().firstOrNull;

  ModeChannelPropertyView? get modeProp =>
      properties.whereType<ModeChannelPropertyView>().firstOrNull;

  bool get hasMode => modeProp != null;

  SpeakerModeValue get mode {
    final ModeChannelPropertyView? prop = modeProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType && SpeakerModeValue.contains(value.value)) {
      SpeakerModeValue? type = SpeakerModeValue.fromValue(value.value);

      if (type != null) {
        return type;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${modeProp?.category.value}',
    );
  }

  List<SpeakerModeValue> get availableModes {
    final ModeChannelPropertyView? prop = modeProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => SpeakerModeValue.fromValue(item))
          .whereType<SpeakerModeValue>()
          .toList();
    }

    return [];
  }
}

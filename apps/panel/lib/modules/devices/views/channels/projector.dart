import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/brightness.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/remote_key.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/source.dart';

class ProjectorChannelView extends ChannelView
    with ChannelOnMixin, ChannelBrightnessMixin {
  ProjectorChannelView({
    required super.id,
    required super.type,
    super.category,
    super.name,
    super.description,
    required super.device,
    super.parent,
    required super.properties,
    super.isValid,
    super.validationIssues,
  });

  @override
  OnChannelPropertyView get onProp =>
      properties.whereType<OnChannelPropertyView>().first;

  @override
  BrightnessChannelPropertyView? get brightnessProp =>
      properties.whereType<BrightnessChannelPropertyView>().firstOrNull;

  SourceChannelPropertyView get sourceProp =>
      properties.whereType<SourceChannelPropertyView>().first;

  RemoteKeyChannelPropertyView? get remoteKeyProp =>
      properties.whereType<RemoteKeyChannelPropertyView>().firstOrNull;

  String? get source {
    final ValueType? value = sourceProp.value;

    if (value is StringValueType) {
      return value.value;
    }

    final ValueType? defaultValue = sourceProp.defaultValue;

    if (defaultValue is StringValueType) {
      return defaultValue.value;
    }

    return null;
  }

  List<String> get availableSources {
    final FormatType? format = sourceProp.format;

    if (format is StringListFormatType) {
      return format.value;
    }

    return [];
  }

  bool get hasRemoteKey => remoteKeyProp != null;

  ProjectorRemoteKeyValue? get remoteKey {
    final RemoteKeyChannelPropertyView? prop = remoteKeyProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        ProjectorRemoteKeyValue.contains(value.value)) {
      return ProjectorRemoteKeyValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        ProjectorRemoteKeyValue.contains(defaultValue.value)) {
      return ProjectorRemoteKeyValue.fromValue(defaultValue.value);
    }

    return null;
  }

  List<ProjectorRemoteKeyValue> get availableRemoteKeys {
    final RemoteKeyChannelPropertyView? prop = remoteKeyProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => ProjectorRemoteKeyValue.fromValue(item))
          .whereType<ProjectorRemoteKeyValue>()
          .toList();
    }

    return [];
  }
}

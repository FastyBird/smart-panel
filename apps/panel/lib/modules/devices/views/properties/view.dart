import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/data_types.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

abstract class ChannelPropertyView {
  final ChannelPropertyModel _channelPropertyModel;

  ChannelPropertyView({
    required ChannelPropertyModel channelPropertyModel,
  }) : _channelPropertyModel = channelPropertyModel;

  ChannelPropertyModel get channelPropertyModel => _channelPropertyModel;

  String get id => channelPropertyModel.id;

  ChannelPropertyCategory get category => channelPropertyModel.category;

  String get name =>
      channelPropertyModel.name ?? channelPropertyModel.category.value;

  DataType get dataType => channelPropertyModel.dataType;

  ValueType? get value => channelPropertyModel.value;

  ValueType? get defaultValue => channelPropertyModel.defaultValue;

  InvalidValueType? get invalid => channelPropertyModel.invalid;

  FormatType? get format => channelPropertyModel.format;

  String? get unit => channelPropertyModel.unit;
}

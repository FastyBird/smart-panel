import 'dart:convert';

import 'package:fastybird_smart_panel/core/utils/value.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/data_types.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class DevicesPropertiesDataRepository
    extends PropertiesDataRepository<DevicePropertyDataModel> {
  @override
  Future<void> initialize() async {
    _isLoading = true;

    notifyListeners();

    // Simulate fetching data from an API or repository
    await Future.delayed(const Duration(seconds: 2));

    try {
      // Load JSON file
      final String jsonString = await rootBundle.loadString(
        'assets/dummy/device_properties.json',
      );

      final List<dynamic> jsonList = jsonDecode(jsonString);

      // Parse and populate device property
      _properties.clear();
      _properties.addAll(
        jsonList.map((json) => DevicePropertyDataModel.fromJson(json)),
      );
    } catch (e) {
      // Handle errors
      debugPrint('Failed to load devices properties: $e');
    }

    _isLoading = false;

    notifyListeners();
  }

  List<DevicePropertyDataModel> getForDevice(String deviceId) {
    return _properties
        .where((property) => property.device == deviceId)
        .toList();
  }
}

class ChannelsPropertiesDataRepository
    extends PropertiesDataRepository<ChannelPropertyDataModel> {
  @override
  Future<void> initialize() async {
    _isLoading = true;

    notifyListeners();

    // Simulate fetching data from an API or repository
    await Future.delayed(const Duration(seconds: 2));

    try {
      // Load JSON file
      final String jsonString = await rootBundle.loadString(
        'assets/dummy/channel_properties.json',
      );

      final List<dynamic> jsonList = jsonDecode(jsonString);

      // Parse and populate channel property
      _properties.clear();
      _properties.addAll(
        jsonList.map((json) => ChannelPropertyDataModel.fromJson(json)),
      );
    } catch (e) {
      // Handle errors
      debugPrint('Failed to load channels properties: $e');
    }

    _isLoading = false;

    notifyListeners();
  }

  List<ChannelPropertyDataModel> getForChannel(String channelId) {
    return _properties
        .where((property) => property.channel == channelId)
        .toList();
  }
}

abstract class PropertiesDataRepository<T extends PropertyDataModel>
    extends ChangeNotifier {
  final List<T> _properties = [];

  bool _isLoading = true;

  initialize();

  bool get isLoading => _isLoading;

  T? getById(String id) {
    try {
      return _properties.firstWhere((property) => property.id == id);
    } catch (e) {
      return null;
    }
  }

  List<T> getByIds(List<String> ids) {
    return _properties.where((property) => ids.contains(property.id)).toList();
  }

  List<T> getAll() {
    return _properties;
  }

  bool toggleValue(String id) {
    T? property = getById(id);

    if (property == null) {
      return false;
    }

    if (property.value is! BooleanValueType) {
      debugPrint('Only boolean values could be toggled');
    }

    final int index = _properties.indexWhere(
      (property) => property.id == id,
    );

    _properties[index] = property.copyWith(
      value: BooleanValueType(!(property.value as BooleanValueType).value),
    );

    notifyListeners();

    return true;
  }

  bool setValue(String id, dynamic value) {
    T? property = getById(id);

    if (property == null) {
      return false;
    }

    final int index = _properties.indexWhere(
      (property) => property.id == id,
    );

    if (property.dataType == DataTypeType.boolean) {
      try {
        _properties[index] = property.copyWith(
          value: BooleanValueType(ValueUtils.toBoolean(value)),
        );
      } on ArgumentError {
        return false;
      }
    } else if (property.dataType == DataTypeType.char ||
        property.dataType == DataTypeType.uchar ||
        property.dataType == DataTypeType.short ||
        property.dataType == DataTypeType.ushort ||
        property.dataType == DataTypeType.int ||
        property.dataType == DataTypeType.uint ||
        property.dataType == DataTypeType.float) {
      try {
        _properties[index] = property.copyWith(
          value: NumberValueType(ValueUtils.toNumber(value)),
        );
      } on ArgumentError {
        return false;
      }
    } else if (property.dataType == DataTypeType.string ||
        property.dataType == DataTypeType.enumerated ||
        property.dataType == DataTypeType.date ||
        property.dataType == DataTypeType.time ||
        property.dataType == DataTypeType.datetime) {
      _properties[index] = property.copyWith(
        value: StringValueType(value.toString()),
      );
    } else if (property.dataType == DataTypeType.button) {
      ButtonPayloadType? converted = ButtonPayloadType.fromValue(
        value.toString(),
      );

      if (converted == null) {
        return false;
      }

      _properties[index] = property.copyWith(
        value: ButtonPayloadValueType(converted),
      );
    } else if (property.dataType == DataTypeType.cover) {
      CoverPayloadType? converted = CoverPayloadType.fromValue(
        value.toString(),
      );

      if (converted == null) {
        return false;
      }

      _properties[index] = property.copyWith(
        value: CoverPayloadValueType(converted),
      );
    } else if (property.dataType == DataTypeType.switcher) {
      SwitcherPayloadType? converted = SwitcherPayloadType.fromValue(
        value.toString(),
      );

      if (converted == null) {
        return false;
      }

      _properties[index] = property.copyWith(
        value: SwitcherPayloadValueType(converted),
      );
    } else {
      return false;
    }

    notifyListeners();

    return true;
  }
}

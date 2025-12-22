import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/devices_module/devices_module_client.dart';
import 'package:flutter/foundation.dart';

class DeviceValidationRepository extends ChangeNotifier {
  final DevicesModuleClient _apiClient;

  /// Validation results indexed by device ID
  Map<String, DeviceValidationResult> _data = {};

  /// Whether initial fetch has completed
  bool _firstLoadComplete = false;

  DeviceValidationRepository({
    required DevicesModuleClient apiClient,
  }) : _apiClient = apiClient;

  bool get firstLoadComplete => _firstLoadComplete;

  /// Get validation result for a specific device
  DeviceValidationResult? getForDevice(String deviceId) {
    return _data[deviceId];
  }

  /// Get all validation results
  List<DeviceValidationResult> getAll() {
    return _data.values.toList();
  }

  /// Check if a device is valid (has no errors)
  bool isDeviceValid(String deviceId) {
    final result = _data[deviceId];
    return result?.isValid ?? true; // Default to valid if no result
  }

  /// Get validation issues for a specific device
  List<ValidationIssue> getIssuesForDevice(String deviceId) {
    final result = _data[deviceId];
    return result?.issues ?? [];
  }

  /// Get validation issues for a specific channel within a device
  List<ValidationIssue> getIssuesForChannel(String deviceId, String channelId) {
    final result = _data[deviceId];
    if (result == null) return [];

    return result.issues
        .where((issue) => issue.channelId == channelId)
        .toList();
  }

  /// Check if a channel has validation errors
  bool isChannelValid(String deviceId, String channelId) {
    final issues = getIssuesForChannel(deviceId, channelId);
    return !issues.any((issue) => issue.severity == 'error');
  }

  /// Fetch validation results for all devices
  Future<void> fetchAll() async {
    try {
      final response = await _apiClient.getDevicesModuleDevicesValidation();

      final validation = response.data.data;

      final Map<String, DeviceValidationResult> newData = {};

      for (var device in validation.devices) {
        newData[device.deviceId] = DeviceValidationResult(
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          isValid: device.isValid,
          issues: device.issues
              .map(
                (issue) => ValidationIssue(
                  type: issue.type.name,
                  severity: issue.severity.name,
                  message: issue.message,
                  channelId: issue.channelId,
                  channelCategory: issue.channelCategory?.name,
                  propertyId: issue.propertyId,
                  propertyCategory: issue.propertyCategory?.name,
                  expected: issue.expected,
                  actual: issue.actual,
                ),
              )
              .toList(),
        );
      }

      if (!mapEquals(_data, newData)) {
        _data = newData;
        notifyListeners();
      }

      _firstLoadComplete = true;
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][VALIDATION] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }
      // Don't throw - validation is optional, app should still work
      _firstLoadComplete = true;
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][VALIDATION] Unexpected error: ${e.toString()}',
        );
      }
      _firstLoadComplete = true;
    }
  }

  /// Fetch validation result for a single device
  Future<void> fetchOne(String deviceId) async {
    try {
      final response = await _apiClient.getDevicesModuleDeviceValidation(
        id: deviceId,
      );

      final device = response.data.data;

      final result = DeviceValidationResult(
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        isValid: device.isValid,
        issues: device.issues
            .map(
              (issue) => ValidationIssue(
                type: issue.type.name,
                severity: issue.severity.name,
                message: issue.message,
                channelId: issue.channelId,
                channelCategory: issue.channelCategory?.name,
                propertyId: issue.propertyId,
                propertyCategory: issue.propertyCategory?.name,
                expected: issue.expected,
                actual: issue.actual,
              ),
            )
            .toList(),
      );

      if (_data[deviceId] != result) {
        _data[deviceId] = result;
        notifyListeners();
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][VALIDATION] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][VALIDATION] Unexpected error: ${e.toString()}',
        );
      }
    }
  }

  /// Clear all validation data
  void clear() {
    _data = {};
    _firstLoadComplete = false;
    notifyListeners();
  }
}

/// Simplified validation result for use in views
class DeviceValidationResult {
  final String deviceId;
  final String deviceName;
  final bool isValid;
  final List<ValidationIssue> issues;

  const DeviceValidationResult({
    required this.deviceId,
    required this.deviceName,
    required this.isValid,
    required this.issues,
  });

  bool get hasErrors => issues.any((i) => i.severity == 'error');
  bool get hasWarnings => issues.any((i) => i.severity == 'warning');

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! DeviceValidationResult) return false;

    return deviceId == other.deviceId &&
        isValid == other.isValid &&
        listEquals(issues, other.issues);
  }

  @override
  int get hashCode => Object.hash(deviceId, isValid, issues);
}

/// Simplified validation issue for use in views
class ValidationIssue {
  final String type;
  final String severity;
  final String message;
  final String? channelId;
  final String? channelCategory;
  final String? propertyId;
  final String? propertyCategory;
  final String? expected;
  final String? actual;

  const ValidationIssue({
    required this.type,
    required this.severity,
    required this.message,
    this.channelId,
    this.channelCategory,
    this.propertyId,
    this.propertyCategory,
    this.expected,
    this.actual,
  });

  bool get isError => severity == 'error';
  bool get isWarning => severity == 'warning';

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! ValidationIssue) return false;

    return type == other.type &&
        severity == other.severity &&
        message == other.message &&
        channelId == other.channelId &&
        propertyId == other.propertyId;
  }

  @override
  int get hashCode => Object.hash(type, severity, message, channelId, propertyId);
}

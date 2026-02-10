import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/modules/energy/models/energy_breakdown.dart';
import 'package:fastybird_smart_panel/modules/energy/models/energy_summary.dart';
import 'package:fastybird_smart_panel/modules/energy/models/energy_timeseries.dart';

/// Supported energy range values.
enum EnergyRange {
  today('today'),
  week('week'),
  month('month');

  final String value;
  const EnergyRange(this.value);

  /// Default chart interval for this range.
  String get defaultInterval {
    switch (this) {
      case EnergyRange.today:
        return '1h';
      case EnergyRange.week:
        return '1h';
      case EnergyRange.month:
        return '1d';
    }
  }
}

/// Service for fetching space-level energy data from the backend.
///
/// Uses Dio directly since these endpoints are not part of the generated
/// OpenAPI client. Endpoints:
/// - `GET /api/energy/spaces/:spaceId/summary?range=...`
/// - `GET /api/energy/spaces/:spaceId/timeseries?range=...&interval=...`
/// - `GET /api/energy/spaces/:spaceId/breakdown?range=...&limit=...`
class EnergyService {
  final Dio _dio;

  EnergyService({required Dio dio}) : _dio = dio;

  /// Fetches energy summary for a space.
  ///
  /// Throws on network or server errors so callers can handle error state.
  Future<EnergySummary?> fetchSummary(String spaceId, EnergyRange range) async {
    try {
      final response = await _dio.get(
        '/api/energy/spaces/$spaceId/summary',
        queryParameters: {'range': range.value},
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data['data'];
        if (data is Map<String, dynamic>) {
          return EnergySummary.fromJson(data);
        }
      }

      return null;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ENERGY] Failed to fetch summary: $e');
      }
      rethrow;
    }
  }

  /// Fetches energy timeseries for a space.
  ///
  /// Throws on network or server errors so callers can handle error state.
  Future<EnergyTimeseries?> fetchTimeseries(
    String spaceId,
    EnergyRange range, {
    String? interval,
  }) async {
    try {
      final response = await _dio.get(
        '/api/energy/spaces/$spaceId/timeseries',
        queryParameters: {
          'range': range.value,
          'interval': interval ?? range.defaultInterval,
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data['data'];
        if (data is Map<String, dynamic>) {
          return EnergyTimeseries.fromJson(data);
        }
      }

      return null;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ENERGY] Failed to fetch timeseries: $e');
      }
      rethrow;
    }
  }

  /// Fetches energy breakdown (top consumers) for a space.
  ///
  /// Throws on network or server errors so callers can handle error state.
  Future<EnergyBreakdown?> fetchBreakdown(
    String spaceId,
    EnergyRange range, {
    int limit = 10,
  }) async {
    try {
      final response = await _dio.get(
        '/api/energy/spaces/$spaceId/breakdown',
        queryParameters: {
          'range': range.value,
          'limit': limit,
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data['data'];
        if (data is Map<String, dynamic>) {
          return EnergyBreakdown.fromJson(data);
        }
      }

      return null;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ENERGY] Failed to fetch breakdown: $e');
      }
      rethrow;
    }
  }
}

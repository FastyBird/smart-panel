import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Represents a single data point in a timeseries
class TimeseriesPoint {
  final DateTime time;
  final dynamic value;

  TimeseriesPoint({
    required this.time,
    required this.value,
  });

  factory TimeseriesPoint.fromJson(Map<String, dynamic> json) {
    return TimeseriesPoint(
      time: DateTime.parse(json['time'] as String),
      value: json['value'],
    );
  }

  double get numericValue {
    if (value is num) {
      return (value as num).toDouble();
    }
    if (value is String) {
      return double.tryParse(value as String) ?? 0.0;
    }
    if (value is bool) {
      return (value as bool) ? 1.0 : 0.0;
    }
    return 0.0;
  }
}

/// Represents the result of a timeseries query
class PropertyTimeseries {
  final String property;
  final DateTime from;
  final DateTime to;
  final String? bucket;
  final List<TimeseriesPoint> points;

  PropertyTimeseries({
    required this.property,
    required this.from,
    required this.to,
    this.bucket,
    required this.points,
  });

  factory PropertyTimeseries.fromJson(Map<String, dynamic> json) {
    return PropertyTimeseries(
      property: json['property'] as String,
      from: DateTime.parse(json['from'] as String),
      to: DateTime.parse(json['to'] as String),
      bucket: json['bucket'] as String?,
      points: (json['points'] as List<dynamic>)
          .map((e) => TimeseriesPoint.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  bool get isEmpty => points.isEmpty;

  bool get isNotEmpty => points.isNotEmpty;

  double get minValue {
    if (points.isEmpty) return 0.0;
    return points.map((p) => p.numericValue).reduce((a, b) => a < b ? a : b);
  }

  double get maxValue {
    if (points.isEmpty) return 0.0;
    return points.map((p) => p.numericValue).reduce((a, b) => a > b ? a : b);
  }

  double get avgValue {
    if (points.isEmpty) return 0.0;
    final sum = points.map((p) => p.numericValue).reduce((a, b) => a + b);
    return sum / points.length;
  }
}

/// Time range options for timeseries queries
enum TimeRange {
  oneHour('1h', Duration(hours: 1)),
  sixHours('6h', Duration(hours: 6)),
  twelveHours('12h', Duration(hours: 12)),
  oneDay('24h', Duration(days: 1)),
  sevenDays('7d', Duration(days: 7));

  final String label;
  final Duration duration;

  const TimeRange(this.label, this.duration);

  /// Get the recommended bucket size for this time range
  String? get recommendedBucket {
    switch (this) {
      case TimeRange.oneHour:
        return null; // Raw data
      case TimeRange.sixHours:
        return '1m';
      case TimeRange.twelveHours:
        return '5m';
      case TimeRange.oneDay:
        return '5m';
      case TimeRange.sevenDays:
        return '1h';
    }
  }
}

/// Service for fetching property timeseries data
class PropertyTimeseriesService {
  final Dio _dio;

  PropertyTimeseriesService({required Dio dio}) : _dio = dio;

  /// Fetch timeseries data for a property
  Future<PropertyTimeseries?> getTimeseries({
    required String channelId,
    required String propertyId,
    required TimeRange timeRange,
  }) async {
    final now = DateTime.now().toUtc();
    final from = now.subtract(timeRange.duration);

    try {
      final queryParams = <String, dynamic>{
        'from': from.toIso8601String(),
        'to': now.toIso8601String(),
      };

      if (timeRange.recommendedBucket != null) {
        queryParams['bucket'] = timeRange.recommendedBucket;
      }

      final response = await _dio.get(
        '/channels/$channelId/properties/$propertyId/timeseries',
        queryParameters: queryParams,
      );

      if (response.statusCode == 200) {
        final data = response.data['data'] as Map<String, dynamic>;
        return PropertyTimeseries.fromJson(data);
      }

      return null;
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[PROPERTY TIMESERIES] Error fetching timeseries: ${e.message}',
        );
      }
      return null;
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[PROPERTY TIMESERIES] Unexpected error: $e',
        );
      }
      return null;
    }
  }

  /// Fetch timeseries data for a property with custom time range
  Future<PropertyTimeseries?> getTimeseriesCustom({
    required String channelId,
    required String propertyId,
    required DateTime from,
    required DateTime to,
    String? bucket,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'from': from.toUtc().toIso8601String(),
        'to': to.toUtc().toIso8601String(),
      };

      if (bucket != null) {
        queryParams['bucket'] = bucket;
      }

      final response = await _dio.get(
        '/channels/$channelId/properties/$propertyId/timeseries',
        queryParameters: queryParams,
      );

      if (response.statusCode == 200) {
        final data = response.data['data'] as Map<String, dynamic>;
        return PropertyTimeseries.fromJson(data);
      }

      return null;
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[PROPERTY TIMESERIES] Error fetching custom timeseries: ${e.message}',
        );
      }
      return null;
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[PROPERTY TIMESERIES] Unexpected error: $e',
        );
      }
      return null;
    }
  }
}

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

enum TimeRange {
  oneHour('1h'),
  sixHours('6h'),
  twelveHours('12h'),
  oneDay('24h'),
  sevenDays('7d');

  final String label;
  const TimeRange(this.label);

  Duration get duration {
    switch (this) {
      case TimeRange.oneHour:
        return const Duration(hours: 1);
      case TimeRange.sixHours:
        return const Duration(hours: 6);
      case TimeRange.twelveHours:
        return const Duration(hours: 12);
      case TimeRange.oneDay:
        return const Duration(hours: 24);
      case TimeRange.sevenDays:
        return const Duration(days: 7);
    }
  }

  String get bucket {
    switch (this) {
      case TimeRange.oneHour:
        return '1m';
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

class TimeseriesPoint {
  final DateTime time;
  final double numericValue;

  TimeseriesPoint({
    required this.time,
    required this.numericValue,
  });

  factory TimeseriesPoint.fromJson(Map<String, dynamic> json) {
    final rawValue = json['value'];
    double numValue;
    if (rawValue is num) {
      numValue = rawValue.toDouble();
    } else if (rawValue is String) {
      numValue = double.tryParse(rawValue) ?? 0.0;
    } else if (rawValue is bool) {
      numValue = rawValue ? 1.0 : 0.0;
    } else {
      numValue = 0.0;
    }

    return TimeseriesPoint(
      time: DateTime.parse(json['time'] as String),
      numericValue: numValue,
    );
  }
}

class PropertyTimeseries {
  final List<TimeseriesPoint> points;

  PropertyTimeseries({required this.points});

  bool get isEmpty => points.isEmpty;
  bool get isNotEmpty => points.isNotEmpty;

  double get minValue {
    if (points.isEmpty) return 0;
    return points.map((p) => p.numericValue).reduce((a, b) => a < b ? a : b);
  }

  double get maxValue {
    if (points.isEmpty) return 0;
    return points.map((p) => p.numericValue).reduce((a, b) => a > b ? a : b);
  }

  double get avgValue {
    if (points.isEmpty) return 0;
    return points.map((p) => p.numericValue).reduce((a, b) => a + b) /
        points.length;
  }
}

class PropertyTimeseriesService {
  final Dio _dio;

  PropertyTimeseriesService({required Dio dio}) : _dio = dio;

  Future<PropertyTimeseries?> getTimeseries({
    required String channelId,
    required String propertyId,
    required TimeRange timeRange,
  }) async {
    try {
      final now = DateTime.now();
      final from = now.subtract(timeRange.duration);

      final response = await _dio.get(
        '/modules/devices/channels/$channelId/properties/$propertyId/timeseries',
        queryParameters: {
          'from': from.toUtc().toIso8601String(),
          'to': now.toUtc().toIso8601String(),
          'bucket': timeRange.bucket,
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final responseData = response.data['data'];
        if (responseData is Map<String, dynamic>) {
          final pointsList = responseData['points'] as List<dynamic>?;
          if (pointsList != null) {
            final points = pointsList
                .map((item) =>
                    TimeseriesPoint.fromJson(item as Map<String, dynamic>))
                .toList();
            return PropertyTimeseries(points: points);
          }
        }
      }

      return PropertyTimeseries(points: []);
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][TIMESERIES] Failed to fetch timeseries: ${e.toString()}',
        );
      }
      return null;
    }
  }
}

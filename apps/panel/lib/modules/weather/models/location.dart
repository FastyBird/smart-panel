import 'package:fastybird_smart_panel/modules/weather/models/model.dart';

/// Base weather location model
class WeatherLocationModel extends Model {
  final String _id;
  final String _name;
  final String _type;
  final DateTime _createdAt;
  final DateTime? _updatedAt;

  WeatherLocationModel({
    required String id,
    required String name,
    required String type,
    required DateTime createdAt,
    DateTime? updatedAt,
  })  : _id = id,
        _name = name,
        _type = type,
        _createdAt = createdAt,
        _updatedAt = updatedAt;

  String get id => _id;
  String get name => _name;
  String get type => _type;
  DateTime get createdAt => _createdAt;
  DateTime? get updatedAt => _updatedAt;

  factory WeatherLocationModel.fromJson(Map<String, dynamic> json) {
    final type = json['type'] as String? ?? 'unknown';

    // Return specialized model based on type
    if (type == 'weather-openweathermap') {
      return OpenWeatherMapLocationModel.fromJson(json);
    }

    return WeatherLocationModel(
      id: json['id'] as String,
      name: json['name'] as String,
      type: type,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : null,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is WeatherLocationModel &&
          other._id == _id &&
          other._name == _name &&
          other._type == _type);

  @override
  int get hashCode => Object.hashAll([_id, _name, _type]);
}

/// Location type for OpenWeatherMap queries
enum OpenWeatherMapLocationType {
  latLon('lat_lon'),
  cityName('city_name'),
  cityId('city_id'),
  zipCode('zip_code');

  final String value;
  const OpenWeatherMapLocationType(this.value);

  static OpenWeatherMapLocationType? fromValue(String? value) {
    if (value == null) return null;
    return OpenWeatherMapLocationType.values.cast<OpenWeatherMapLocationType?>().firstWhere(
      (e) => e?.value == value,
      orElse: () => null,
    );
  }
}

/// OpenWeatherMap location model with provider-specific fields
class OpenWeatherMapLocationModel extends WeatherLocationModel {
  final OpenWeatherMapLocationType _locationType;
  final double? _latitude;
  final double? _longitude;
  final String? _cityName;
  final String? _countryCode;
  final int? _cityId;
  final String? _zipCode;

  OpenWeatherMapLocationModel({
    required super.id,
    required super.name,
    required super.createdAt,
    super.updatedAt,
    required OpenWeatherMapLocationType locationType,
    double? latitude,
    double? longitude,
    String? cityName,
    String? countryCode,
    int? cityId,
    String? zipCode,
  })  : _locationType = locationType,
        _latitude = latitude,
        _longitude = longitude,
        _cityName = cityName,
        _countryCode = countryCode,
        _cityId = cityId,
        _zipCode = zipCode,
        super(type: 'weather-openweathermap');

  OpenWeatherMapLocationType get locationType => _locationType;
  double? get latitude => _latitude;
  double? get longitude => _longitude;
  String? get cityName => _cityName;
  String? get countryCode => _countryCode;
  int? get cityId => _cityId;
  String? get zipCode => _zipCode;

  factory OpenWeatherMapLocationModel.fromJson(Map<String, dynamic> json) {
    return OpenWeatherMapLocationModel(
      id: json['id'] as String,
      name: json['name'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : null,
      locationType:
          OpenWeatherMapLocationType.fromValue(json['location_type'] as String?) ??
              OpenWeatherMapLocationType.cityName,
      latitude: json['latitude'] != null
          ? (json['latitude'] as num).toDouble()
          : null,
      longitude: json['longitude'] != null
          ? (json['longitude'] as num).toDouble()
          : null,
      cityName: json['city_name'] as String?,
      countryCode: json['country_code'] as String?,
      cityId: json['city_id'] as int?,
      zipCode: json['zip_code'] as String?,
    );
  }

  /// Get display string for location details
  String get locationDisplay {
    switch (_locationType) {
      case OpenWeatherMapLocationType.latLon:
        return '${_latitude?.toStringAsFixed(4)}, ${_longitude?.toStringAsFixed(4)}';
      case OpenWeatherMapLocationType.cityName:
        return _countryCode != null ? '$_cityName, $_countryCode' : _cityName ?? '';
      case OpenWeatherMapLocationType.cityId:
        return 'City ID: $_cityId';
      case OpenWeatherMapLocationType.zipCode:
        return 'ZIP: $_zipCode';
    }
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OpenWeatherMapLocationModel &&
          other.id == id &&
          other.name == name &&
          other._locationType == _locationType &&
          other._latitude == _latitude &&
          other._longitude == _longitude &&
          other._cityName == _cityName &&
          other._cityId == _cityId &&
          other._zipCode == _zipCode);

  @override
  int get hashCode => Object.hashAll([
        id,
        name,
        _locationType,
        _latitude,
        _longitude,
        _cityName,
        _cityId,
        _zipCode,
      ]);
}

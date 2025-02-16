class WeatherInfoModel {
  final int _code;
  final String _main;
  final String _description;
  final String _icon;

  WeatherInfoModel({
    required int code,
    required String main,
    required String description,
    required String icon,
  })  : _code = code,
        _main = main,
        _description = description,
        _icon = icon;

  int get code => _code;

  String get main => _main;

  String get description => _description;

  String get icon => _icon;

  WeatherInfoModel copyWith({
    int? code,
    String? main,
    String? description,
    String? icon,
  }) {
    return WeatherInfoModel(
      code: code ?? _code,
      main: main ?? _main,
      description: description ?? _description,
      icon: icon ?? _icon,
    );
  }
}

class WindModel {
  final double _speed;
  final int _deg;
  final double? _gust;

  WindModel({
    required double speed,
    required int deg,
    required double? gust,
  })  : _speed = speed,
        _deg = deg,
        _gust = gust;

  double get speed => _speed;

  int get deg => _deg;

  double? get gust => _gust;

  WindModel copyWith({
    double? speed,
    int? deg,
    double? gust,
  }) {
    return WindModel(
      speed: speed ?? _speed,
      deg: deg ?? _deg,
      gust: gust ?? _gust,
    );
  }
}

class ForecastTemperatureModel {
  final double? _morn;
  final double? _day;
  final double? _eve;
  final double? _night;
  final double? _min;
  final double? _max;

  ForecastTemperatureModel({
    required double? morn,
    required double? day,
    required double? eve,
    required double? night,
    required double? min,
    required double? max,
  })  : _morn = morn,
        _day = day,
        _eve = eve,
        _night = night,
        _min = min,
        _max = max;

  double? get morn => _morn;

  double? get day => _day;

  double? get eve => _eve;

  double? get night => _night;

  double? get min => _min;

  double? get max => _max;

  ForecastTemperatureModel copyWith({
    double? morn,
    double? day,
    double? eve,
    double? night,
    double? min,
    double? max,
  }) {
    return ForecastTemperatureModel(
      morn: morn ?? _morn,
      day: day ?? _day,
      eve: eve ?? _eve,
      night: night ?? _night,
      min: min ?? _min,
      max: max ?? _max,
    );
  }
}

class ForecastFeelsLikeModel {
  final double? _morn;
  final double? _day;
  final double? _eve;
  final double? _night;

  ForecastFeelsLikeModel({
    required double? morn,
    required double? day,
    required double? eve,
    required double? night,
  })  : _morn = morn,
        _day = day,
        _eve = eve,
        _night = night;

  double? get morn => _morn;

  double? get day => _day;

  double? get eve => _eve;

  double? get night => _night;

  ForecastFeelsLikeModel copyWith({
    double? morn,
    double? day,
    double? eve,
    double? night,
  }) {
    return ForecastFeelsLikeModel(
      morn: morn ?? _morn,
      day: day ?? _day,
      eve: eve ?? _eve,
      night: night ?? _night,
    );
  }
}

class CurrentDayModel {
  final double _temperature;
  final double? _temperatureMin;
  final double? _temperatureMax;
  final double _feelsLike;
  final int _pressure;
  final int _humidity;
  final WeatherInfoModel _weather;
  final WindModel _wind;
  final double _clouds;
  final double? _rain;
  final double? _snow;
  final DateTime _sunrise;
  final DateTime _sunset;
  final DateTime _dayTime;

  CurrentDayModel({
    required double temperature,
    required double? temperatureMin,
    required double? temperatureMax,
    required double feelsLike,
    required int pressure,
    required int humidity,
    required WeatherInfoModel weather,
    required WindModel wind,
    required double clouds,
    required double? rain,
    required double? snow,
    required DateTime sunrise,
    required DateTime sunset,
    required DateTime dayTime,
  })  : _temperature = temperature,
        _temperatureMin = temperatureMin,
        _temperatureMax = temperatureMax,
        _feelsLike = feelsLike,
        _pressure = pressure,
        _humidity = humidity,
        _weather = weather,
        _wind = wind,
        _clouds = clouds,
        _rain = rain,
        _snow = snow,
        _sunrise = sunrise,
        _sunset = sunset,
        _dayTime = dayTime;

  double get temperature => _temperature;

  double? get temperatureMin => _temperatureMin;

  double? get temperatureMax => _temperatureMax;

  double get feelsLike => _feelsLike;

  int get pressure => _pressure;

  int get humidity => _humidity;

  WeatherInfoModel get weather => _weather;

  WindModel get wind => _wind;

  double get clouds => _clouds;

  double? get rain => _rain;

  double? get snow => _snow;

  DateTime get sunrise => _sunrise;

  DateTime get sunset => _sunset;

  DateTime get dayTime => _dayTime;

  CurrentDayModel copyWith({
    double? temperature,
    double? temperatureMin,
    double? temperatureMax,
    double? feelsLike,
    int? pressure,
    int? humidity,
    WeatherInfoModel? weather,
    WindModel? wind,
    double? clouds,
    double? rain,
    double? snow,
    DateTime? sunrise,
    DateTime? sunset,
    DateTime? dayTime,
  }) {
    return CurrentDayModel(
      temperature: temperature ?? _temperature,
      temperatureMin: temperatureMin ?? _temperatureMin,
      temperatureMax: temperatureMax ?? _temperatureMax,
      feelsLike: feelsLike ?? _feelsLike,
      pressure: pressure ?? _pressure,
      humidity: humidity ?? _humidity,
      weather: weather ?? _weather,
      wind: wind ?? _wind,
      clouds: clouds ?? _clouds,
      rain: rain ?? _rain,
      snow: snow ?? _snow,
      sunrise: sunrise ?? _sunrise,
      sunset: sunset ?? _sunset,
      dayTime: dayTime ?? _dayTime,
    );
  }
}

class ForecastDayModel {
  final ForecastTemperatureModel _temperature;
  final ForecastFeelsLikeModel _feelsLike;
  final int _pressure;
  final int _humidity;
  final WeatherInfoModel _weather;
  final WindModel _wind;
  final double _clouds;
  final double? _rain;
  final double? _snow;
  final DateTime? _sunrise;
  final DateTime? _sunset;
  final DateTime? _moonrise;
  final DateTime? _moonset;
  final DateTime _dayTime;

  ForecastDayModel({
    required ForecastTemperatureModel temperature,
    required ForecastFeelsLikeModel feelsLike,
    required int pressure,
    required int humidity,
    required WeatherInfoModel weather,
    required WindModel wind,
    required double clouds,
    required double? rain,
    required double? snow,
    required DateTime? sunrise,
    required DateTime? sunset,
    required DateTime? moonrise,
    required DateTime? moonset,
    required DateTime dayTime,
  })  : _temperature = temperature,
        _feelsLike = feelsLike,
        _pressure = pressure,
        _humidity = humidity,
        _weather = weather,
        _wind = wind,
        _clouds = clouds,
        _rain = rain,
        _snow = snow,
        _sunrise = sunrise,
        _sunset = sunset,
        _moonrise = moonrise,
        _moonset = moonset,
        _dayTime = dayTime;

  ForecastTemperatureModel get temperature => _temperature;

  ForecastFeelsLikeModel get feelsLike => _feelsLike;

  int get pressure => _pressure;

  int get humidity => _humidity;

  WeatherInfoModel get weather => _weather;

  WindModel get wind => _wind;

  double get clouds => _clouds;

  double? get rain => _rain;

  double? get snow => _snow;

  DateTime? get sunrise => _sunrise;

  DateTime? get sunset => _sunset;

  DateTime? get moonrise => _moonrise;

  DateTime? get moonset => _moonset;

  DateTime get dayTime => _dayTime;

  ForecastDayModel copyWith({
    ForecastTemperatureModel? temperature,
    ForecastFeelsLikeModel? feelsLike,
    int? pressure,
    int? humidity,
    WeatherInfoModel? weather,
    WindModel? wind,
    double? clouds,
    double? rain,
    double? snow,
    DateTime? sunrise,
    DateTime? sunset,
    DateTime? moonrise,
    DateTime? moonset,
    DateTime? dayTime,
  }) {
    return ForecastDayModel(
      temperature: temperature ?? _temperature,
      feelsLike: feelsLike ?? _feelsLike,
      pressure: pressure ?? _pressure,
      humidity: humidity ?? _humidity,
      weather: weather ?? _weather,
      wind: wind ?? _wind,
      clouds: clouds ?? _clouds,
      rain: rain ?? _rain,
      snow: snow ?? _snow,
      sunrise: sunrise ?? _sunrise,
      sunset: sunset ?? _sunset,
      moonrise: moonrise ?? _moonrise,
      moonset: moonset ?? _moonset,
      dayTime: dayTime ?? _dayTime,
    );
  }
}

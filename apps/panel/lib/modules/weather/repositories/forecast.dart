import 'package:fastybird_smart_panel/api/models/weather_forecast_day.dart';
import 'package:fastybird_smart_panel/modules/weather/models/forecast_day.dart';
import 'package:fastybird_smart_panel/modules/weather/models/forecast_feels_like.dart';
import 'package:fastybird_smart_panel/modules/weather/models/forecast_temperature.dart';
import 'package:fastybird_smart_panel/modules/weather/models/weather_info.dart';
import 'package:fastybird_smart_panel/modules/weather/models/wind.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/repository.dart';

class ForecastWeatherRepository extends Repository<List<ForecastDayModel>> {
  ForecastWeatherRepository({required super.apiClient});

  Future<bool> refresh() async {
    try {
      await fetchWeather();

      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> insertForecastWeather(
      List<WeatherForecastDay> apiForecast) async {
    data = apiForecast
        .map(
          (day) => ForecastDayModel(
            temperature: ForecastTemperatureModel(
              morn: day.temperature.morn?.toDouble(),
              day: day.temperature.day?.toDouble(),
              eve: day.temperature.eve?.toDouble(),
              night: day.temperature.night?.toDouble(),
              min: day.temperature.min?.toDouble(),
              max: day.temperature.max?.toDouble(),
            ),
            feelsLike: ForecastFeelsLikeModel(
              morn: day.feelsLike.morn?.toDouble(),
              day: day.feelsLike.day?.toDouble(),
              eve: day.feelsLike.eve?.toDouble(),
              night: day.feelsLike.night?.toDouble(),
            ),
            pressure: day.pressure.toInt(),
            humidity: day.humidity.toInt(),
            weather: WeatherInfoModel(
              code: day.weather.code.toInt(),
              main: day.weather.main,
              description: day.weather.description,
              icon: day.weather.icon,
            ),
            wind: WindModel(
              speed: day.wind.speed.toDouble(),
              deg: day.wind.deg.toInt(),
              gust: day.wind.gust?.toDouble(),
            ),
            clouds: day.clouds.toDouble(),
            rain: day.rain?.toDouble(),
            snow: day.snow?.toDouble(),
            sunrise: day.sunrise,
            sunset: day.sunset,
            moonrise: day.moonrise,
            moonset: day.moonset,
            dayTime: day.dayTime,
          ),
        )
        .toList();
  }

  Future<void> fetchWeather() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getWeatherModuleForecast();

        final data = response.data.data;

        insertForecastWeather(data);
      },
      'fetch forecast weather',
    );
  }
}

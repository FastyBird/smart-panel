import 'package:fastybird_smart_panel/api/models/weather_current_day.dart';
import 'package:fastybird_smart_panel/modules/weather/models/current_day.dart';
import 'package:fastybird_smart_panel/modules/weather/models/weather_info.dart';
import 'package:fastybird_smart_panel/modules/weather/models/wind.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/repository.dart';

class CurrentWeatherRepository extends Repository<CurrentDayModel> {
  CurrentWeatherRepository({required super.apiClient});

  Future<bool> refresh() async {
    try {
      await fetchWeather();

      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> insertCurrentWeather(WeatherCurrentDay apiCurrent) async {
    data = CurrentDayModel(
      temperature: apiCurrent.temperature.toDouble(),
      temperatureMin: apiCurrent.temperatureMin?.toDouble(),
      temperatureMax: apiCurrent.temperatureMax?.toDouble(),
      feelsLike: apiCurrent.feelsLike.toDouble(),
      pressure: apiCurrent.pressure.toInt(),
      humidity: apiCurrent.humidity.toInt(),
      weather: WeatherInfoModel(
        code: apiCurrent.weather.code.toInt(),
        main: apiCurrent.weather.main,
        description: apiCurrent.weather.description,
        icon: apiCurrent.weather.icon,
      ),
      wind: WindModel(
        speed: apiCurrent.wind.speed.toDouble(),
        deg: apiCurrent.wind.deg.toInt(),
        gust: apiCurrent.wind.gust?.toDouble(),
      ),
      clouds: apiCurrent.clouds.toDouble(),
      rain: apiCurrent.rain?.toDouble(),
      snow: apiCurrent.snow?.toDouble(),
      sunrise: apiCurrent.sunrise,
      sunset: apiCurrent.sunset,
      dayTime: apiCurrent.dayTime,
    );
  }

  Future<void> fetchWeather() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getWeatherModuleCurrent();

        final data = response.data.data;

        insertCurrentWeather(data);
      },
      'fetch current weather',
    );
  }
}

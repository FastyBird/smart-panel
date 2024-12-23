import 'package:fastybird_smart_panel/core/repositories/weather.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class WeatherDetailPage extends StatelessWidget {
  const WeatherDetailPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<WeatherRepository>(builder: (
      context,
      weatherRepository,
      _,
    ) {
      var weather = weatherRepository.weather;

      return Scaffold(
        appBar: ScreenAppBar(title: '7 day forecast'),
        body: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Current Weather',
                  style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 16),
              Text('Temperature: ${weather.current.temp}'),
              Text('Condition: ${weather.current.condition}'),
              const SizedBox(height: 16),
              const Text('Forecast:'),
              const SizedBox(height: 8),
              ...weather.forecast.map((forecast) {
                return Text('${forecast.day}: ${forecast.temp}');
              }),
            ],
          ),
        ),
      );
    });
  }
}

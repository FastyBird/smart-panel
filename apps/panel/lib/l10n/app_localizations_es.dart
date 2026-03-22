// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Spanish Castilian (`es`).
class AppLocalizationsEs extends AppLocalizations {
  AppLocalizationsEs([String locale = 'es']) : super(locale);

  @override
  String get value_not_available => 'N/D';

  @override
  String get value_not_set => 'No configurado';

  @override
  String get value_loading => 'Cargando';

  @override
  String get information => 'Información';

  @override
  String get warning => 'Advertencia';

  @override
  String get error => 'Error';

  @override
  String get action_failed => 'No se pudo procesar la acción';

  @override
  String get action_retry => 'Reintentar';

  @override
  String domain_data_load_failed(String domain) {
    return 'Error al cargar $domain';
  }

  @override
  String get domain_data_load_failed_description => 'No se pudieron obtener los datos. Compruebe su conexión e inténtelo de nuevo.';

  @override
  String get domain_not_configured_subtitle => 'No configurado';

  @override
  String get services_not_available => 'Servicios no disponibles';

  @override
  String get button_ok => 'Aceptar';

  @override
  String get button_cancel => 'Cancelar';

  @override
  String get button_close => 'Cerrar';

  @override
  String get button_confirm => 'Confirmar';

  @override
  String get button_done => 'Hecho';

  @override
  String get unit_system_default => 'Predeterminado';

  @override
  String get unit_celsius => 'Celsius (°C)';

  @override
  String get unit_fahrenheit => 'Fahrenheit (°F)';

  @override
  String get unit_wind_speed_ms => 'Metros por segundo (m/s)';

  @override
  String get unit_wind_speed_kmh => 'Kilómetros por hora (km/h)';

  @override
  String get unit_wind_speed_mph => 'Millas por hora (mph)';

  @override
  String get unit_wind_speed_knots => 'Nudos (kn)';

  @override
  String get unit_pressure_hpa => 'Hectopascal (hPa)';

  @override
  String get unit_pressure_mbar => 'Milibar (mbar)';

  @override
  String get unit_pressure_inhg => 'Pulgadas de mercurio (inHg)';

  @override
  String get unit_pressure_mmhg => 'Milímetros de mercurio (mmHg)';

  @override
  String get unit_precipitation_mm => 'Milímetros (mm)';

  @override
  String get unit_precipitation_inches => 'Pulgadas (in)';

  @override
  String get unit_distance_km => 'Kilómetros (km)';

  @override
  String get unit_distance_miles => 'Millas (mi)';

  @override
  String get unit_distance_meters => 'Metros (m)';

  @override
  String get unit_distance_feet => 'Pies (ft)';

  @override
  String get time_format_12h => '12 horas';

  @override
  String get time_format_24h => '24 horas';

  @override
  String get day_monday => 'Lunes';

  @override
  String get day_tuesday => 'Martes';

  @override
  String get day_wednesday => 'Miércoles';

  @override
  String get day_thursday => 'Jueves';

  @override
  String get day_friday => 'Viernes';

  @override
  String get day_saturday => 'Sábado';

  @override
  String get day_sunday => 'Domingo';

  @override
  String get day_monday_short => 'Lun';

  @override
  String get day_tuesday_short => 'Mar';

  @override
  String get day_wednesday_short => 'Mié';

  @override
  String get day_thursday_short => 'Jue';

  @override
  String get day_friday_short => 'Vie';

  @override
  String get day_saturday_short => 'Sáb';

  @override
  String get day_sunday_short => 'Dom';

  @override
  String get message_error_tiles_not_configured_title => '¡No hay mosaicos configurados!';

  @override
  String get message_error_tiles_not_configured_description => 'Configure al menos un mosaico en la pantalla.';

  @override
  String get message_error_cards_not_configured_title => '¡No hay tarjetas configuradas!';

  @override
  String get message_error_cards_not_configured_description => 'Configure al menos una tarjeta en la pantalla.';

  @override
  String get message_error_device_not_found_title => '¡Dispositivo no encontrado!';

  @override
  String get message_error_device_not_found_description => 'No se pudo encontrar el dispositivo solicitado en la aplicación.';

  @override
  String get message_error_no_device_detail_title => '¡Sin detalle de dispositivo!';

  @override
  String get message_error_no_device_detail_description => 'La página de detalle no está disponible para el dispositivo seleccionado.';

  @override
  String get message_error_no_device_detail_preparing_title => '¡Detalle de dispositivo no listo!';

  @override
  String get message_error_no_device_detail_preparing_description => 'La página de detalle del dispositivo seleccionado aún no está lista.';

  @override
  String get device_status_offline => 'Sin conexión';

  @override
  String get device_offline_message => 'El dispositivo está sin conexión';

  @override
  String get device_offline_title => 'Dispositivo sin conexión';

  @override
  String get device_offline_description => 'No se puede comunicar con este dispositivo. Compruebe que esté encendido y conectado a la red.';

  @override
  String get device_offline_retry => 'Reintentar conexión';

  @override
  String device_offline_last_seen(String time) {
    return 'Visto por última vez $time';
  }

  @override
  String devices_offline_skipped(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Se omitieron $count dispositivos sin conexión',
      one: 'Se omitió 1 dispositivo sin conexión',
    );
    return '$_temp0';
  }

  @override
  String get all_devices_offline => 'Todos los dispositivos están sin conexión';

  @override
  String get time_ago_just_now => 'ahora mismo';

  @override
  String time_ago_minutes(int count) {
    return 'hace $count min';
  }

  @override
  String time_ago_hours(int count) {
    return 'hace $count h';
  }

  @override
  String time_ago_days(int count) {
    return 'hace $count d';
  }

  @override
  String time_ago_medium_minutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'hace $count minutos',
      one: 'hace 1 minuto',
    );
    return '$_temp0';
  }

  @override
  String time_ago_medium_hours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'hace $count horas',
      one: 'hace 1 hora',
    );
    return '$_temp0';
  }

  @override
  String time_ago_medium_days(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'hace $count días',
      one: 'hace 1 día',
    );
    return '$_temp0';
  }

  @override
  String time_ago_full_minutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'hace $count minutos',
      one: 'hace 1 minuto',
    );
    return '$_temp0';
  }

  @override
  String time_ago_full_hours_minutes(int hours, int minutes) {
    String _temp0 = intl.Intl.pluralLogic(
      hours,
      locale: localeName,
      other: '$hours horas',
      one: '1 hora',
    );
    String _temp1 = intl.Intl.pluralLogic(
      minutes,
      locale: localeName,
      other: '$minutes minutos',
      one: '1 minuto',
    );
    return 'hace $_temp0 $_temp1';
  }

  @override
  String time_ago_full_hours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'hace $count horas',
      one: 'hace 1 hora',
    );
    return '$_temp0';
  }

  @override
  String time_ago_full_days_hours(int days, int hours) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days días',
      one: '1 día',
    );
    String _temp1 = intl.Intl.pluralLogic(
      hours,
      locale: localeName,
      other: '$hours horas',
      one: '1 hora',
    );
    return 'hace $_temp0 $_temp1';
  }

  @override
  String time_ago_full_days(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'hace $count días',
      one: 'hace 1 día',
    );
    return '$_temp0';
  }

  @override
  String get device_config_issue => 'Problema de configuración';

  @override
  String get device_details => 'Detalles del dispositivo';

  @override
  String get message_error_page_not_found_title => '¡Página no encontrada!';

  @override
  String get message_error_page_not_found_description => 'No se pudo encontrar la página solicitada en la aplicación.';

  @override
  String get electrical_energy_consumption_title => 'Consumo de energía';

  @override
  String get electrical_energy_consumption_description => 'Energía total consumida a lo largo del tiempo';

  @override
  String get electrical_energy_average_power_title => 'Potencia media';

  @override
  String get electrical_energy_average_power_description => 'Potencia media consumida durante el último intervalo de informe';

  @override
  String get electrical_generation_production_title => 'Producción de energía';

  @override
  String get electrical_generation_production_description => 'Energía total producida por la fuente de generación';

  @override
  String get electrical_generation_power_title => 'Potencia de generación';

  @override
  String get electrical_generation_power_description => 'Potencia actual de salida de la fuente de generación';

  @override
  String get electrical_power_current_title => 'Corriente';

  @override
  String get electrical_power_current_description => 'Cuánta electricidad está fluyendo';

  @override
  String get electrical_power_voltage_title => 'Tensión';

  @override
  String get electrical_power_voltage_description => 'La intensidad de la electricidad';

  @override
  String get electrical_power_power_title => 'Potencia';

  @override
  String get electrical_power_power_description => 'Cuánta energía se está consumiendo';

  @override
  String get electrical_power_frequency_title => 'Frecuencia';

  @override
  String get electrical_power_frequency_description => 'Estabilidad de la electricidad';

  @override
  String get electrical_power_over_current_title => 'Sobrecorriente';

  @override
  String get electrical_power_over_current_description => 'Advertencia: Demasiada corriente fluyendo';

  @override
  String get electrical_power_over_voltage_title => 'Sobretensión';

  @override
  String get electrical_power_over_voltage_description => 'Advertencia: La electricidad es demasiado fuerte';

  @override
  String get electrical_power_over_power_title => 'Sobrepotencia';

  @override
  String get electrical_power_over_power_description => 'Advertencia: El consumo de energía es demasiado alto';

  @override
  String get light_state_on => 'Enc.';

  @override
  String get light_state_on_description => 'La luz está encendida';

  @override
  String get light_state_off => 'Apagado';

  @override
  String get light_state_failed => 'Error';

  @override
  String get light_state_off_description => 'La luz está apagada';

  @override
  String get light_state_brightness_description => 'Brillo actual';

  @override
  String get light_state_mixed_description => 'Los dispositivos tienen valores diferentes';

  @override
  String get light_state_syncing_description => 'Sincronizando dispositivos...';

  @override
  String get light_state_not_synced_description => 'Los dispositivos no están sincronizados';

  @override
  String get light_role_main => 'Principal';

  @override
  String get light_role_task => 'Trabajo';

  @override
  String get light_role_ambient => 'Ambiente';

  @override
  String get light_role_accent => 'Acento';

  @override
  String get light_role_night => 'Nocturna';

  @override
  String get light_role_other => 'Otras';

  @override
  String get light_role_hidden => 'Ocultas';

  @override
  String get light_role_on_description => 'Las luces están encendidas';

  @override
  String get light_role_off_description => 'Las luces están apagadas';

  @override
  String get light_role_not_synced_description => 'Error de sincronización de luces';

  @override
  String get light_role_syncing_description => 'Sincronizando luces';

  @override
  String get light_role_mixed_description => 'Las luces tienen valores diferentes';

  @override
  String get light_state_out_of_sync => 'Desincronizado';

  @override
  String get light_mode_off => 'Apagado';

  @override
  String get light_mode_on => 'Encendido';

  @override
  String get light_mode_brightness => 'Brillo';

  @override
  String get light_mode_color => 'Color';

  @override
  String get light_mode_temperature => 'Temperatura';

  @override
  String get light_mode_saturation => 'Saturación';

  @override
  String get light_mode_white => 'Blanco';

  @override
  String get light_mode_swatches => 'Paleta';

  @override
  String get lights_more_scenes => 'Más escenas';

  @override
  String get thermostat_state_title => 'Estado del termostato';

  @override
  String get thermostat_state_configured_temperature_description => 'Temperatura configurada';

  @override
  String get thermostat_state_current_temperature_description => 'Temperatura actual';

  @override
  String get thermostat_state_current_humidity_description => 'Humedad actual';

  @override
  String get thermostat_child_lock_title => 'Bloqueo infantil';

  @override
  String get thermostat_openings_state_title => 'La ventana está abierta';

  @override
  String get thermostat_openings_state_description => 'El termostato está desactivado';

  @override
  String get contact_sensor_window => 'Ventana';

  @override
  String get contact_sensor_open => 'Abierto';

  @override
  String get contact_sensor_closed => 'Cerrado';

  @override
  String get leak_sensor_water => 'Fuga de agua';

  @override
  String get leak_sensor_detected => 'Detectada';

  @override
  String get leak_sensor_dry => 'Seco';

  @override
  String get thermostat_lock_locked => 'Bloqueado';

  @override
  String get thermostat_lock_unlocked => 'Desbloqueado';

  @override
  String get thermostat_mode_label => 'Modo';

  @override
  String get thermostat_mode_off => 'Apagado';

  @override
  String get thermostat_mode_heat => 'Calefacción';

  @override
  String get thermostat_mode_cool => 'Refrigeración';

  @override
  String get thermostat_mode_auto => 'Automático';

  @override
  String get thermostat_mode_manual => 'Manual';

  @override
  String get thermostat_min => 'mín';

  @override
  String get thermostat_max => 'máx';

  @override
  String get thermostat_target_label => 'Objetivo';

  @override
  String get thermostat_state_off => 'Apagado';

  @override
  String get thermostat_state_heating => 'Calentando';

  @override
  String thermostat_state_heating_to(String temperature) {
    return 'Calentando a $temperature';
  }

  @override
  String get thermostat_state_cooling => 'Enfriando';

  @override
  String thermostat_state_cooling_to(String temperature) {
    return 'Enfriando a $temperature';
  }

  @override
  String get thermostat_state_idling => 'En reposo';

  @override
  String thermostat_state_idle_at(String temperature) {
    return 'En reposo a $temperature';
  }

  @override
  String get thermostat_with_invalid_configuration => 'Este termostato está configurado incorrectamente.';

  @override
  String get on_state_on => 'Encendido';

  @override
  String get on_state_off => 'Apagado';

  @override
  String get power_hint_tap_to_turn_on => 'Toque para encender';

  @override
  String get power_hint_tap_to_turn_off => 'Toque para apagar';

  @override
  String get message_info_app_reboot_title => '¡Reiniciando dispositivo!';

  @override
  String get message_info_app_reboot_description => 'Espere mientras el dispositivo se reinicia. Este proceso puede tardar unos momentos.';

  @override
  String get message_info_app_power_off_title => '¡Apagando!';

  @override
  String get message_info_app_power_off_description => 'El dispositivo se está apagando. Para volver a encenderlo, utilice el botón de encendido.';

  @override
  String get message_info_factory_reset_title => '¡Restableciendo dispositivo!';

  @override
  String get message_info_factory_reset_description => 'Se borrarán todos los ajustes y datos, y el dispositivo se restaurará a su configuración de fábrica. No apague el dispositivo durante el proceso de restablecimiento. Esto puede tardar unos minutos.';

  @override
  String get settings_general_settings_title => 'Ajustes generales';

  @override
  String get settings_general_settings_button_display_settings => 'Ajustes de pantalla';

  @override
  String get settings_general_settings_button_language_settings => 'Ajustes de idioma';

  @override
  String get settings_general_settings_button_audio_settings => 'Ajustes de audio';

  @override
  String get settings_general_settings_button_weather_settings => 'Ajustes del tiempo';

  @override
  String get settings_general_settings_button_about => 'Acerca de la aplicación';

  @override
  String get settings_general_settings_button_maintenance => 'Mantenimiento';

  @override
  String get settings_general_settings_button_voice_activation => 'Activación por voz';

  @override
  String get settings_voice_activation_settings_title => 'Ajustes de activación por voz';

  @override
  String get settings_voice_activation_section_detection => 'Detección de activación por voz';

  @override
  String get settings_voice_activation_enable_label => 'Activar activación por voz';

  @override
  String settings_voice_activation_enable_description(String wakeWord) {
    return 'Diga \"$wakeWord\" para activar los comandos de voz sin tocar el panel.';
  }

  @override
  String get settings_voice_activation_microphone_unavailable => 'El micrófono no está disponible o está desactivado en esta pantalla.';

  @override
  String get settings_voice_activation_section_sensitivity => 'Sensibilidad';

  @override
  String get settings_voice_activation_sensitivity_label => 'Sensibilidad de detección';

  @override
  String get settings_voice_activation_sensitivity_description => 'Una sensibilidad mayor detecta el habla más baja, pero puede activarse con el ruido ambiental.';

  @override
  String get settings_voice_activation_section_status => 'Estado';

  @override
  String get settings_voice_activation_status_label => 'Estado del motor';

  @override
  String get settings_voice_activation_status_stopped => 'Detenido';

  @override
  String get settings_voice_activation_status_listening => 'Escuchando activación por voz...';

  @override
  String get settings_voice_activation_status_recording => 'Grabando voz...';

  @override
  String get settings_voice_activation_status_processing => 'Procesando audio...';

  @override
  String get settings_weather_settings_title => 'Ajustes del tiempo';

  @override
  String get settings_weather_settings_temperature_unit_title => 'Unidad de temperatura';

  @override
  String get settings_weather_settings_temperature_unit_description => 'Configure la unidad de temperatura preferida para la visualización del tiempo.';

  @override
  String get settings_weather_settings_temperature_location_title => 'Ubicación meteorológica';

  @override
  String get settings_weather_settings_temperature_location_description => 'Seleccione la fuente de datos meteorológicos.';

  @override
  String get settings_weather_settings_temperature_location_single => 'Solo hay una ubicación disponible.';

  @override
  String get settings_maintenance_title => 'Mantenimiento';

  @override
  String get settings_maintenance_restart_title => 'Reiniciar';

  @override
  String get settings_maintenance_restart_description => 'Reinicie el dispositivo para aplicar los cambios.';

  @override
  String get settings_maintenance_restart_confirm_title => 'Reiniciar dispositivo';

  @override
  String get settings_maintenance_restart_confirm_description => '¿Está seguro de que desea reiniciar el dispositivo? Esta acción interrumpirá temporalmente la funcionalidad.';

  @override
  String get settings_maintenance_power_off_title => 'Apagar';

  @override
  String get settings_maintenance_power_off_description => 'Apagar completamente el dispositivo.';

  @override
  String get settings_maintenance_power_off_confirm_title => 'Apagar dispositivo';

  @override
  String get settings_maintenance_power_off_confirm_description => '¿Está seguro de que desea apagar el dispositivo? Será necesario encenderlo manualmente de nuevo.';

  @override
  String get settings_maintenance_factory_reset_title => 'Restablecimiento de fábrica';

  @override
  String get settings_maintenance_factory_reset_description => 'Restaurar el dispositivo a su configuración original de fábrica.';

  @override
  String get settings_maintenance_factory_reset_confirm_title => 'Restablecer dispositivo de fábrica';

  @override
  String get settings_maintenance_factory_reset_confirm_description => '¿Está seguro de que desea borrar todos los datos y restaurar la configuración de fábrica del dispositivo? Esta acción es irreversible.';

  @override
  String get settings_maintenance_system_heading => 'Sistema';

  @override
  String get settings_maintenance_danger_heading => 'Zona de peligro';

  @override
  String get settings_maintenance_restart_display_description => 'Reinicie esta pantalla para aplicar los cambios.';

  @override
  String get settings_maintenance_restart_display_confirm_title => 'Reiniciar pantalla';

  @override
  String get settings_maintenance_restart_display_confirm_description => '¿Está seguro de que desea reiniciar esta pantalla? La pasarela y otras pantallas no se verán afectadas.';

  @override
  String get settings_maintenance_power_off_display_description => 'Apagar completamente esta pantalla.';

  @override
  String get settings_maintenance_power_off_display_confirm_title => 'Apagar pantalla';

  @override
  String get settings_maintenance_power_off_display_confirm_description => '¿Está seguro de que desea apagar esta pantalla? Será necesario encenderla manualmente de nuevo. La pasarela no se verá afectada.';

  @override
  String get settings_maintenance_factory_reset_display_description => 'Eliminar esta pantalla de la pasarela y restaurar la configuración de fábrica.';

  @override
  String get settings_maintenance_factory_reset_display_confirm_title => 'Restablecimiento de fábrica de pantalla';

  @override
  String get settings_maintenance_factory_reset_display_confirm_description => '¿Está seguro de que desea restablecer de fábrica esta pantalla? Se eliminará de la pasarela y se borrarán todos los datos locales. Esta acción es irreversible.';

  @override
  String get settings_language_settings_title => 'Ajustes de idioma';

  @override
  String get settings_language_settings_language_title => 'Idioma';

  @override
  String get settings_language_settings_language_description => 'Seleccione su idioma preferido.';

  @override
  String get settings_language_settings_timezone_title => 'Zona horaria';

  @override
  String get settings_language_settings_timezone_description => 'Zona horaria local.';

  @override
  String get settings_language_settings_time_format_title => 'Formato de hora';

  @override
  String get settings_language_settings_time_format_description => 'Formato de 12 o 24 horas.';

  @override
  String get settings_display_settings_title => 'Ajustes de pantalla';

  @override
  String get settings_display_settings_theme_mode_title => 'Modo de tema';

  @override
  String get settings_display_settings_theme_mode_description => 'Cambiar entre tema claro y oscuro.';

  @override
  String get settings_display_settings_brightness_title => 'Brillo';

  @override
  String get settings_display_settings_brightness_description => 'Ajustar el nivel de brillo de la pantalla.';

  @override
  String get settings_display_settings_screen_lock_title => 'Bloqueo de pantalla';

  @override
  String get settings_display_settings_screen_lock_description => 'Bloqueo automático tras inactividad.';

  @override
  String get settings_display_settings_screen_saver_title => 'Salvapantallas';

  @override
  String get settings_display_settings_screen_saver_description => 'Mostrar salvapantallas en reposo.';

  @override
  String get settings_display_settings_unit_overrides_section => 'Anulación de unidades';

  @override
  String get settings_display_settings_temperature_unit_title => 'Unidad de temperatura';

  @override
  String get settings_display_settings_temperature_unit_description => 'Anular la unidad de temperatura del sistema para esta pantalla.';

  @override
  String get settings_display_settings_wind_speed_unit_title => 'Unidad de velocidad del viento';

  @override
  String get settings_display_settings_wind_speed_unit_description => 'Anular la unidad de velocidad del viento del sistema para esta pantalla.';

  @override
  String get settings_display_settings_pressure_unit_title => 'Unidad de presión';

  @override
  String get settings_display_settings_pressure_unit_description => 'Anular la unidad de presión del sistema para esta pantalla.';

  @override
  String get settings_display_settings_precipitation_unit_title => 'Unidad de precipitación';

  @override
  String get settings_display_settings_precipitation_unit_description => 'Anular la unidad de precipitación del sistema para esta pantalla.';

  @override
  String get settings_display_settings_distance_unit_title => 'Unidad de distancia';

  @override
  String get settings_display_settings_distance_unit_description => 'Anular la unidad de distancia del sistema para esta pantalla.';

  @override
  String get settings_audio_settings_title => 'Ajustes de audio';

  @override
  String get settings_audio_settings_speaker_title => 'Altavoz';

  @override
  String get settings_audio_settings_speaker_description => 'Activar o desactivar el altavoz.';

  @override
  String get settings_audio_settings_speaker_volume_title => 'Volumen del altavoz';

  @override
  String get settings_audio_settings_speaker_volume_description => 'Ajustar el nivel de salida del altavoz.';

  @override
  String get settings_audio_settings_microphone_title => 'Micrófono';

  @override
  String get settings_audio_settings_microphone_description => 'Activar o desactivar el micrófono.';

  @override
  String get settings_audio_settings_microphone_volume_title => 'Volumen del micrófono';

  @override
  String get settings_audio_settings_microphone_volume_description => 'Ajustar la sensibilidad de entrada.';

  @override
  String get settings_audio_settings_no_support => 'Esta pantalla no admite entrada ni salida de audio.';

  @override
  String get settings_about_title => 'Acerca de la aplicación';

  @override
  String get settings_about_about_heading => 'Acerca de';

  @override
  String get settings_about_about_info => 'FastyBird Smart Panel es una aplicación de domótica que permite la integración perfecta con sus dispositivos inteligentes, ofreciendo un control y monitorización mejorados.';

  @override
  String get settings_about_developed_by_heading => 'Desarrollado por';

  @override
  String get settings_about_license_heading => 'Licencia';

  @override
  String get settings_about_device_information_heading => 'Información del dispositivo';

  @override
  String get settings_about_show_license_button => 'Ver licencia';

  @override
  String get settings_about_ip_address_title => 'Dirección IP';

  @override
  String get settings_about_mac_address_title => 'Dirección MAC';

  @override
  String get settings_about_cpu_usage_title => 'Uso de CPU';

  @override
  String get settings_about_memory_usage_title => 'Uso de memoria';

  @override
  String get weather_forecast_title => 'Previsión meteorológica';

  @override
  String get weather_forecast_feels_like => 'Sensación térmica:';

  @override
  String get weather_forecast_humidity => 'Humedad:';

  @override
  String get weather_detail_rain => 'Lluvia';

  @override
  String get weather_detail_snow => 'Nieve';

  @override
  String get weather_detail_sunrise => 'Amanecer';

  @override
  String get weather_detail_sunset => 'Atardecer';

  @override
  String get weather_detail_forecast => 'Previsión';

  @override
  String get weather_detail_not_configured => 'Tiempo no configurado';

  @override
  String get weather_detail_today => 'Hoy';

  @override
  String get weather_detail_hourly_forecast => 'Previsión por horas';

  @override
  String get weather_condition_thunderstorm_with_light_rain => 'Tormenta con lluvia ligera';

  @override
  String get weather_condition_thunderstorm_with_rain => 'Tormenta con lluvia';

  @override
  String get weather_condition_thunderstorm_with_heavy_rain => 'Tormenta con lluvia intensa';

  @override
  String get weather_condition_light_thunderstorm => 'Tormenta leve';

  @override
  String get weather_condition_thunderstorm => 'Tormenta';

  @override
  String get weather_condition_heavy_thunderstorm => 'Tormenta fuerte';

  @override
  String get weather_condition_ragged_thunderstorm => 'Tormenta irregular';

  @override
  String get weather_condition_thunderstorm_with_light_drizzle => 'Tormenta con llovizna ligera';

  @override
  String get weather_condition_thunderstorm_with_drizzle => 'Tormenta con llovizna';

  @override
  String get weather_condition_thunderstorm_with_heavy_drizzle => 'Tormenta con llovizna intensa';

  @override
  String get weather_condition_light_intensity_drizzle => 'Llovizna ligera';

  @override
  String get weather_condition_drizzle => 'Llovizna';

  @override
  String get weather_condition_heavy_intensity_drizzle => 'Llovizna intensa';

  @override
  String get weather_condition_light_intensity_drizzle_rain => 'Llovizna ligera con lluvia';

  @override
  String get weather_condition_drizzle_rain => 'Llovizna con lluvia';

  @override
  String get weather_condition_heavy_intensity_drizzle_rain => 'Llovizna intensa con lluvia';

  @override
  String get weather_condition_shower_rain_and_drizzle => 'Chubascos con llovizna';

  @override
  String get weather_condition_heavy_shower_rain_and_drizzle => 'Chubascos fuertes con llovizna';

  @override
  String get weather_condition_shower_drizzle => 'Chubascos de llovizna';

  @override
  String get weather_condition_light_rain => 'Lluvia ligera';

  @override
  String get weather_condition_moderate_rain => 'Lluvia moderada';

  @override
  String get weather_condition_heavy_intensity_rain => 'Lluvia intensa';

  @override
  String get weather_condition_very_heavy_rain => 'Lluvia muy intensa';

  @override
  String get weather_condition_extreme_rain => 'Lluvia extrema';

  @override
  String get weather_condition_freezing_rain => 'Lluvia helada';

  @override
  String get weather_condition_light_intensity_shower_rain => 'Chubascos ligeros';

  @override
  String get weather_condition_shower_rain => 'Chubascos';

  @override
  String get weather_condition_heavy_intensity_shower_rain => 'Chubascos intensos';

  @override
  String get weather_condition_ragged_shower_rain => 'Chubascos irregulares';

  @override
  String get weather_condition_light_snow => 'Nevada ligera';

  @override
  String get weather_condition_snow => 'Nieve';

  @override
  String get weather_condition_heavy_snow => 'Nevada intensa';

  @override
  String get weather_condition_sleet => 'Aguanieve';

  @override
  String get weather_condition_light_shower_sleet => 'Chubascos ligeros de aguanieve';

  @override
  String get weather_condition_shower_sleet => 'Chubascos de aguanieve';

  @override
  String get weather_condition_light_rain_and_snow => 'Lluvia ligera con nieve';

  @override
  String get weather_condition_rain_and_snow => 'Lluvia con nieve';

  @override
  String get weather_condition_light_shower_snow => 'Chubascos ligeros de nieve';

  @override
  String get weather_condition_shower_snow => 'Chubascos de nieve';

  @override
  String get weather_condition_heavy_shower_snow => 'Chubascos intensos de nieve';

  @override
  String get weather_condition_mist => 'Neblina';

  @override
  String get weather_condition_smoke => 'Humo';

  @override
  String get weather_condition_haze => 'Calima';

  @override
  String get weather_condition_fog => 'Niebla';

  @override
  String get weather_condition_sand => 'Arena';

  @override
  String get weather_condition_dust => 'Polvo';

  @override
  String get weather_condition_volcanic_ash => 'Ceniza volcánica';

  @override
  String get weather_condition_squalls => 'Rachas de viento';

  @override
  String get weather_condition_tornado => 'Tornado';

  @override
  String get weather_condition_clear_sky => 'Cielo despejado';

  @override
  String get weather_condition_few_clouds => 'Pocas nubes';

  @override
  String get weather_condition_scattered_clouds => 'Nubes dispersas';

  @override
  String get weather_condition_broken_clouds => 'Parcialmente nublado';

  @override
  String get weather_condition_overcast_clouds => 'Nublado';

  @override
  String get weather_condition_unknown => 'Desconocido';

  @override
  String get discovery_searching_title => 'Buscando pasarelas';

  @override
  String get discovery_searching_description => 'Buscando pasarelas FastyBird Smart Panel en su red...';

  @override
  String discovery_found_count(int count) {
    return 'Se encontraron $count pasarela(s)...';
  }

  @override
  String get discovery_select_title => 'Seleccione una pasarela';

  @override
  String discovery_select_description(int count) {
    return 'Se encontraron $count pasarela(s) en su red:';
  }

  @override
  String get discovery_not_found_title => 'Pasarela no encontrada';

  @override
  String get discovery_not_found_description => 'No se pudo encontrar ninguna pasarela FastyBird Smart Panel en su red.\n\nAsegúrese de que la pasarela esté en funcionamiento y conectada a la misma red que este dispositivo.';

  @override
  String get discovery_error_title => 'Error de descubrimiento';

  @override
  String get discovery_error_description => 'Se produjo un error al buscar pasarelas.\n\nCompruebe su conexión de red e inténtelo de nuevo.';

  @override
  String discovery_error_failed(String error) {
    return 'Descubrimiento fallido: $error';
  }

  @override
  String get discovery_connecting_title => 'Conectando a la pasarela';

  @override
  String discovery_connecting_description(String address) {
    return 'Contactando con $address...';
  }

  @override
  String get discovery_connecting_fallback => 'pasarela';

  @override
  String get discovery_manual_entry_title => 'Introduzca la dirección de la pasarela';

  @override
  String get discovery_manual_entry_hint => '192.168.1.100:3000';

  @override
  String get discovery_manual_entry_label => 'Dirección de la pasarela';

  @override
  String get discovery_manual_entry_help => 'Introduzca la dirección IP o el nombre de host con puerto opcional.\nEjemplos: 192.168.1.100:3000, gateway.local, 10.0.0.5';

  @override
  String get discovery_validation_empty => 'Introduzca una dirección de pasarela';

  @override
  String get discovery_validation_invalid => 'Dirección no válida. Introduzca una dirección IP o nombre de host válidos.';

  @override
  String get discovery_button_back => 'Atrás';

  @override
  String get discovery_button_connect => 'Conectar';

  @override
  String get discovery_button_connect_selected => 'Conectar a la pasarela seleccionada';

  @override
  String get discovery_button_rescan => 'Buscar de nuevo';

  @override
  String get discovery_button_try_again => 'Intentar de nuevo';

  @override
  String get discovery_button_manual => 'Introducir manualmente';

  @override
  String get discovery_button_cancel => 'Cancelar';

  @override
  String get room_selection_title => 'Seleccione una habitación';

  @override
  String room_selection_description(int count) {
    return 'Elija a qué habitación pertenece esta pantalla ($count disponibles):';
  }

  @override
  String get room_selection_button_confirm => 'Asignar a esta habitación';

  @override
  String get room_selection_saving => 'Asignando habitación...';

  @override
  String get room_selection_error => 'Error al asignar la habitación. Inténtelo de nuevo.';

  @override
  String get room_selection_empty_title => 'No hay habitaciones disponibles';

  @override
  String get room_selection_empty_description => 'Aún no se han creado habitaciones. Abra la administración y añada al menos una habitación.';

  @override
  String get action_success => 'Acción completada correctamente';

  @override
  String get space_lighting_controls_title => 'Control de iluminación';

  @override
  String get space_lighting_mode_off => 'Apag.';

  @override
  String get space_lighting_mode_work => 'Trabajo';

  @override
  String get space_lighting_mode_relax => 'Relax';

  @override
  String get space_lighting_mode_night => 'Noche';

  @override
  String get space_devices_title => 'Dispositivos';

  @override
  String get space_devices_placeholder => 'Los dispositivos de esta estancia se mostrarán aquí';

  @override
  String get space_climate_controls_title => 'Climatización';

  @override
  String get space_climate_current_label => 'Actual';

  @override
  String get space_climate_target_label => 'Objetivo';

  @override
  String get climate_role_auxiliary => 'Auxiliar';

  @override
  String get climate_tap_for_details => 'Toque para más detalles';

  @override
  String get climate_role_ventilation => 'Ventilación';

  @override
  String get climate_role_humidity => 'Control de humedad';

  @override
  String get climate_role_other => 'Otros dispositivos';

  @override
  String get space_suggestion_applied => 'Sugerencia aplicada';

  @override
  String get space_suggestion_dismissed => 'Sugerencia descartada';

  @override
  String get space_undo_success => 'Acción deshecha';

  @override
  String get space_undo_button => 'Deshacer';

  @override
  String get space_empty_state_title => 'Pantalla lista';

  @override
  String space_empty_state_description(String spaceName) {
    return 'Para añadir dispositivos y controles, configure \"$spaceName\" a través de la administración.';
  }

  @override
  String get space_sensors_only_title => 'Solo sensores';

  @override
  String get space_sensors_only_description => 'Esta estancia solo tiene sensores — sin dispositivos controlables';

  @override
  String get house_overview_no_spaces_title => 'No hay estancias configuradas';

  @override
  String get house_overview_no_spaces_description => 'Cree estancias a través de la administración para verlas aquí';

  @override
  String get house_overview_no_space_page => 'No hay página configurada para esta estancia';

  @override
  String get house_overview_tap_to_view => 'Toque para ver';

  @override
  String get house_modes_home => 'En casa';

  @override
  String get house_modes_home_description => 'Funcionamiento normal en casa';

  @override
  String get house_modes_away => 'Fuera';

  @override
  String get house_modes_away_description => 'Fuera de casa';

  @override
  String get house_modes_night => 'Noche';

  @override
  String get house_modes_night_description => 'Ajustes nocturnos';

  @override
  String get house_modes_changed_success => 'Modo de la casa cambiado correctamente';

  @override
  String get house_modes_changed_error => 'Error al cambiar el modo de la casa';

  @override
  String get house_modes_confirm_title => 'Confirmar cambio de modo';

  @override
  String get house_modes_confirm_away_description => '¿Está seguro de que desea poner la casa en modo Fuera? Esto puede afectar a las reglas de automatización y los ajustes de seguridad.';

  @override
  String get space_scenes_title => 'Escenas rápidas';

  @override
  String get space_scene_triggered => 'Escena activada';

  @override
  String get space_scene_partial_success => 'Escena parcialmente activada';

  @override
  String get window_covering_status_open => 'Abierto';

  @override
  String get window_covering_status_closed => 'Cerrado';

  @override
  String get window_covering_status_opening => 'Abriendo';

  @override
  String get window_covering_status_closing => 'Cerrando';

  @override
  String get window_covering_status_stopped => 'Detenido';

  @override
  String get window_covering_type_curtain => 'Cortina';

  @override
  String get window_covering_type_blind => 'Persiana';

  @override
  String get window_covering_type_roller => 'Estor';

  @override
  String get window_covering_type_outdoor_blind => 'Persiana exterior';

  @override
  String get window_covering_type_venetian_blind => 'Persiana veneciana';

  @override
  String get window_covering_type_vertical_blind => 'Persiana vertical';

  @override
  String get window_covering_type_shutter => 'Contraventana';

  @override
  String get window_covering_type_awning => 'Toldo';

  @override
  String get window_covering_command_open => 'Abrir';

  @override
  String get window_covering_command_close => 'Cerrar';

  @override
  String get window_covering_command_stop => 'Detener';

  @override
  String get window_covering_position_label => 'Posición';

  @override
  String get window_covering_position_description => 'Posición actual';

  @override
  String get window_covering_tilt_label => 'Inclinación';

  @override
  String get window_covering_tilt_description => 'Ajustar ángulo de lamas';

  @override
  String get window_covering_obstruction_warning => 'Obstrucción detectada';

  @override
  String get window_covering_fault_warning => 'Avería detectada';

  @override
  String get window_covering_preset_morning => 'Mañana';

  @override
  String get window_covering_preset_day => 'Día';

  @override
  String get window_covering_preset_evening => 'Tarde';

  @override
  String get window_covering_preset_night => 'Noche';

  @override
  String get window_covering_preset_privacy => 'Privacidad';

  @override
  String get window_covering_preset_away => 'Fuera';

  @override
  String get window_covering_presets_label => 'Preajustes';

  @override
  String get window_covering_channels_label => 'Persianas';

  @override
  String get window_covering_info_status => 'Estado';

  @override
  String get window_covering_info_obstruction => 'Obstrucción';

  @override
  String get window_covering_obstruction_detected => 'Detectada';

  @override
  String get window_covering_obstruction_clear => 'Libre';

  @override
  String window_covering_position_open_percent(int position) {
    return '$position% Abierto';
  }

  @override
  String get battery_title => 'Batería';

  @override
  String get connection_lost_title => 'Conexión perdida';

  @override
  String get connection_lost_message => 'No se puede conectar a la pasarela. Compruebe su conexión de red e inténtelo de nuevo.';

  @override
  String get connection_lost_button_reconnect => 'Reconectar';

  @override
  String get connection_lost_button_change_gateway => 'Cambiar pasarela';

  @override
  String get button_retry => 'Reintentar';

  @override
  String get button_sync_all => 'Sincronizar todo';

  @override
  String get system_view_room => 'Habitación';

  @override
  String get system_view_master => 'Inicio';

  @override
  String get deck_nav_more => 'Más';

  @override
  String get deck_all_pages => 'Todas las páginas';

  @override
  String get system_view_entry => 'Entrada';

  @override
  String get domain_lights => 'Luces';

  @override
  String get domain_lights_other => 'Otras luces';

  @override
  String get domain_lights_empty_title => 'Iluminación no configurada';

  @override
  String get domain_lights_empty_description => 'Los roles de iluminación no se han configurado para esta habitación. Configure los roles en la administración para controlar sus luces.';

  @override
  String domain_lights_count_on(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count luces encendidas',
      one: '1 luz encendida',
    );
    return '$_temp0';
  }

  @override
  String get domain_lights_all_off => 'todo apagado';

  @override
  String get domain_lights_all_on => 'todo encendido';

  @override
  String get domain_lights_button_all_off => 'Apagar todo';

  @override
  String get domain_lights_button_all_on => 'Encender todo';

  @override
  String get domain_lights_syncing => 'sincronizando';

  @override
  String get domain_lights_unsynced => 'desincronizado';

  @override
  String get domain_lights_mixed => 'mixto';

  @override
  String get domain_climate => 'Climatización';

  @override
  String get domain_climate_empty_title => 'Climatización no configurada';

  @override
  String get domain_climate_empty_description => 'No hay termostatos ni actuadores de climatización configurados para esta habitación. Añada dispositivos de climatización en la administración.';

  @override
  String get domain_media => 'Multimedia';

  @override
  String media_devices_summary(Object count) {
    return '$count dispositivos';
  }

  @override
  String media_devices_summary_on(Object count, Object on) {
    return '$count dispositivos • $on encendidos';
  }

  @override
  String get media_modes_title => 'Modos';

  @override
  String get media_action_power_on => 'Encender';

  @override
  String get media_action_power_off => 'Apagar';

  @override
  String get media_action_mute => 'Silenciar';

  @override
  String get media_action_unmute => 'Activar sonido';

  @override
  String get media_mode_off => 'Apagado';

  @override
  String get media_mode_background => 'Fondo';

  @override
  String get media_mode_focused => 'Concentración';

  @override
  String get media_mode_party => 'Fiesta';

  @override
  String get media_roles_title => 'Roles';

  @override
  String media_role_summary(Object on, Object total) {
    return '$on de $total encendidos';
  }

  @override
  String get media_roles_unassigned => 'Dispositivos sin asignar';

  @override
  String get media_role_primary => 'Principal';

  @override
  String get media_role_secondary => 'Secundario';

  @override
  String get media_role_background => 'Fondo';

  @override
  String get media_role_gaming => 'Juegos';

  @override
  String get media_role_hidden => 'Oculto';

  @override
  String get media_targets_title => 'Dispositivos';

  @override
  String get media_capability_power => 'Energía';

  @override
  String get media_capability_volume => 'Volumen';

  @override
  String get media_capability_mute => 'Silencio';

  @override
  String get media_capability_none => 'Sin capacidades';

  @override
  String get media_no_endpoints_title => 'Sin dispositivos multimedia';

  @override
  String get media_no_endpoints_description => 'Esta habitación no tiene dispositivos multimedia. Añada un televisor, altavoz o reproductor.';

  @override
  String get media_no_bindings_description => 'Las actividades multimedia se están configurando. Deslice para actualizar.';

  @override
  String get media_ws_offline_title => 'Conexión perdida';

  @override
  String get media_ws_offline_description => 'Los controles multimedia requieren una conexión activa. Reconectando...';

  @override
  String get domain_sensors => 'Sensores';

  @override
  String get domain_energy => 'Energía';

  @override
  String get energy_consumption => 'Consumo';

  @override
  String get energy_production => 'Producción';

  @override
  String get energy_net => 'Neto';

  @override
  String get energy_range_today => 'Hoy';

  @override
  String get energy_range_week => 'Semana';

  @override
  String get energy_range_month => 'Mes';

  @override
  String get energy_top_consumers => 'Mayores consumidores';

  @override
  String get energy_chart_title => 'Consumo a lo largo del tiempo';

  @override
  String get energy_summary_title => 'Resumen';

  @override
  String get energy_unit_kwh => 'kWh';

  @override
  String get energy_empty_title => 'Sin datos de energía';

  @override
  String get energy_empty_description => 'No se encontraron dispositivos de monitorización de energía en esta estancia';

  @override
  String get energy_load_failed => 'Error al cargar los datos de energía';

  @override
  String get energy_consumed_today => 'Energía total consumida hoy';

  @override
  String get energy_consumed_week => 'Energía total consumida esta semana';

  @override
  String get energy_consumed_month => 'Energía total consumida este mes';

  @override
  String get energy_comparison_vs_yesterday => 'respecto a ayer';

  @override
  String get energy_comparison_vs_last_week => 'respecto a la semana pasada';

  @override
  String get energy_comparison_vs_last_month => 'respecto al mes pasado';

  @override
  String energy_comparison_same(String period) {
    return 'Igual que $period';
  }

  @override
  String get energy_period_yesterday => 'ayer';

  @override
  String get energy_period_last_week => 'la semana pasada';

  @override
  String get energy_period_last_month => 'el mes pasado';

  @override
  String energy_device_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count dispositivos',
      one: '1 dispositivo',
    );
    return '$_temp0';
  }

  @override
  String get device_category_lighting => 'Iluminación';

  @override
  String get device_category_climate => 'Climatización';

  @override
  String get device_category_sensors => 'Sensores';

  @override
  String get device_category_media => 'Multimedia';

  @override
  String get master_rooms => 'Habitaciones';

  @override
  String get master_devices => 'Dispositivos';

  @override
  String get master_scenes => 'Escenas';

  @override
  String get master_quick_actions => 'Acciones rápidas';

  @override
  String get entry_mode_activated => 'Modo activado';

  @override
  String get entry_house_modes => 'Modos de la casa';

  @override
  String get entry_mode_home => 'En casa';

  @override
  String get entry_mode_away => 'Fuera';

  @override
  String get entry_mode_night => 'Noche';

  @override
  String get entry_mode_movie => 'Película';

  @override
  String get entry_security => 'Seguridad';

  @override
  String get entry_no_security_devices => 'No hay dispositivos de seguridad configurados';

  @override
  String get entry_locks => 'Cerraduras';

  @override
  String get entry_alarm => 'Alarma';

  @override
  String get entry_cameras => 'Cámaras';

  @override
  String get air_quality_level_excellent => 'Excelente';

  @override
  String get air_quality_level_good => 'Buena';

  @override
  String get air_quality_level_fair => 'Aceptable';

  @override
  String get air_quality_level_inferior => 'Inferior';

  @override
  String get air_quality_level_poor => 'Mala';

  @override
  String get air_quality_level_unknown => 'Desconocida';

  @override
  String get aqi_label_good => 'Buena';

  @override
  String get aqi_label_moderate => 'Moderada';

  @override
  String get aqi_label_unhealthy_sensitive => 'Insalubre (sensibles)';

  @override
  String get aqi_label_unhealthy => 'Insalubre';

  @override
  String get aqi_label_very_unhealthy => 'Muy insalubre';

  @override
  String get aqi_label_hazardous => 'Peligrosa';

  @override
  String get particulate_label_pm1 => 'PM1';

  @override
  String get particulate_label_pm25 => 'PM2.5';

  @override
  String get particulate_label_pm10 => 'PM10';

  @override
  String get sensor_enum_voc_level_low => 'Bajo';

  @override
  String get sensor_enum_voc_level_low_long => 'VOC bajo';

  @override
  String get sensor_enum_voc_level_medium => 'Med';

  @override
  String get sensor_enum_voc_level_medium_long => 'VOC medio';

  @override
  String get sensor_enum_voc_level_high => 'Alto';

  @override
  String get sensor_enum_voc_level_high_long => 'VOC alto';

  @override
  String get fan_mode_auto => 'Automático';

  @override
  String get fan_mode_manual => 'Manual';

  @override
  String get fan_mode_eco => 'Eco';

  @override
  String get fan_mode_sleep => 'Dormir';

  @override
  String get fan_mode_natural => 'Natural';

  @override
  String get fan_mode_turbo => 'Turbo';

  @override
  String get fan_speed_off => 'Apagado';

  @override
  String get fan_speed_low => 'Bajo';

  @override
  String get fan_speed_medium => 'Medio';

  @override
  String get fan_speed_high => 'Alto';

  @override
  String get fan_speed_turbo => 'Turbo';

  @override
  String get fan_speed_auto => 'Automático';

  @override
  String get fan_timer_off => 'Apagado';

  @override
  String get fan_timer_30m => '30m';

  @override
  String get fan_timer_1h => '1h';

  @override
  String get fan_timer_2h => '2h';

  @override
  String get fan_timer_4h => '4h';

  @override
  String get fan_timer_8h => '8h';

  @override
  String get fan_timer_12h => '12h';

  @override
  String get fan_direction_clockwise => 'Horario';

  @override
  String get fan_direction_counter_clockwise => 'Antihorario';

  @override
  String get filter_status_good => 'Bueno';

  @override
  String get filter_status_replace_soon => 'Pronto';

  @override
  String get filter_status_replace_now => 'Cambiar';

  @override
  String get filter_status_unknown => 'Desconocido';

  @override
  String get dehumidifier_mode_auto => 'Automático';

  @override
  String get dehumidifier_mode_manual => 'Manual';

  @override
  String get dehumidifier_mode_continuous => 'Continuo';

  @override
  String get dehumidifier_mode_laundry => 'Secado de ropa';

  @override
  String get dehumidifier_mode_quiet => 'Silencioso';

  @override
  String get dehumidifier_status_idle => 'Inactivo';

  @override
  String get dehumidifier_status_dehumidifying => 'Deshumidificando';

  @override
  String get dehumidifier_status_defrosting => 'Descongelando';

  @override
  String get dehumidifier_timer_off => 'Apagado';

  @override
  String get dehumidifier_timer_30m => '30 min';

  @override
  String get dehumidifier_timer_1h => '1 hora';

  @override
  String get dehumidifier_timer_2h => '2 horas';

  @override
  String get dehumidifier_timer_4h => '4 horas';

  @override
  String get dehumidifier_timer_8h => '8 horas';

  @override
  String get dehumidifier_timer_12h => '12 horas';

  @override
  String get dehumidifier_water_tank => 'Depósito de agua';

  @override
  String get dehumidifier_defrost => 'Descongelación';

  @override
  String get dehumidifier_defrost_active => 'Descongelando';

  @override
  String get humidifier_mode_auto => 'Automático';

  @override
  String get humidifier_mode_manual => 'Manual';

  @override
  String get humidifier_mode_sleep => 'Dormir';

  @override
  String get humidifier_mode_baby => 'Bebé';

  @override
  String get humidifier_status_idle => 'Inactivo';

  @override
  String get humidifier_status_humidifying => 'Humidificando';

  @override
  String get humidifier_mist_level => 'Nivel de vapor';

  @override
  String get humidifier_mist_level_off => 'Apagado';

  @override
  String get humidifier_mist_level_low => 'Bajo';

  @override
  String get humidifier_mist_level_medium => 'Medio';

  @override
  String get humidifier_mist_level_high => 'Alto';

  @override
  String get humidifier_timer_off => 'Apagado';

  @override
  String get humidifier_timer_30m => '30 min';

  @override
  String get humidifier_timer_1h => '1 hora';

  @override
  String get humidifier_timer_2h => '2 horas';

  @override
  String get humidifier_timer_4h => '4 horas';

  @override
  String get humidifier_timer_8h => '8 horas';

  @override
  String get humidifier_timer_12h => '12 horas';

  @override
  String get humidifier_water_tank => 'Depósito de agua';

  @override
  String get humidifier_warm_mist => 'Vapor caliente';

  @override
  String get device_current_humidity => 'Actual';

  @override
  String get device_current_temperature => 'Temperatura';

  @override
  String get device_fan_speed => 'Velocidad';

  @override
  String get device_fan_mode => 'Modo ventilador';

  @override
  String get device_timer => 'Temporizador';

  @override
  String get device_child_lock => 'Bloqueo infantil';

  @override
  String get device_oscillation => 'Oscilación';

  @override
  String get device_direction => 'Dirección';

  @override
  String get device_natural_breeze => 'Brisa natural';

  @override
  String get device_auto_off_timer => 'Apagado automático';

  @override
  String get device_filter_life => 'Vida del filtro';

  @override
  String get device_filter_status => 'Filtro';

  @override
  String get device_voc => 'VOC';

  @override
  String get device_co2 => 'CO₂';

  @override
  String get device_co => 'CO';

  @override
  String get device_no2 => 'NO₂';

  @override
  String get device_o3 => 'O₃';

  @override
  String get device_so2 => 'SO₂';

  @override
  String get device_pressure => 'Presión';

  @override
  String get air_quality_healthy => 'Saludable';

  @override
  String get air_quality_unhealthy => 'Insalubre';

  @override
  String get gas_detected => 'Detectado';

  @override
  String get gas_clear => 'Despejado';

  @override
  String get gas_level_low => 'Bajo';

  @override
  String get gas_level_medium => 'Medio';

  @override
  String get gas_level_high => 'Alto';

  @override
  String get device_humidity => 'Humedad';

  @override
  String get device_air_quality_index => 'Índice de calidad del aire';

  @override
  String get device_temperature => 'Temp';

  @override
  String get device_sensors => 'Sensores';

  @override
  String get device_controls => 'Controles';

  @override
  String get device_settings => 'Ajustes';

  @override
  String duration_format_hours_minutes(int hours, int minutes) {
    return '${hours}h ${minutes}m';
  }

  @override
  String duration_format_hours(int hours) {
    return '${hours}h';
  }

  @override
  String duration_format_minutes(int minutes) {
    return '${minutes}m';
  }

  @override
  String get media_playing => 'Reproduciendo';

  @override
  String get media_idle => 'Inactivo';

  @override
  String get media_standby => 'En espera';

  @override
  String get media_volume => 'Volumen';

  @override
  String get media_source => 'Fuente';

  @override
  String get media_queue => 'Cola';

  @override
  String get media_up_next => 'A continuación';

  @override
  String get media_other_devices => 'Otros dispositivos';

  @override
  String get device_status_standby => 'En espera';

  @override
  String get device_status_active => 'Activo';

  @override
  String get device_status_inactive => 'Inactivo';

  @override
  String get climate_devices_section => 'Dispositivos de climatización';

  @override
  String get climate_more_sensors => 'Más sensores';

  @override
  String get domain_shading => 'Sombreado';

  @override
  String get domain_shading_empty_title => 'Sombreado no configurado';

  @override
  String get domain_shading_empty_description => 'Los roles de persianas no se han configurado para esta habitación. Configure los roles en la administración para controlar sus persianas.';

  @override
  String get shading_modes_title => 'Modos';

  @override
  String get shading_devices_title => 'Dispositivos';

  @override
  String shading_devices_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count dispositivos',
      one: '1 dispositivo',
    );
    return '$_temp0';
  }

  @override
  String get shading_action_open => 'Abrir';

  @override
  String get shading_action_close => 'Cerrar';

  @override
  String get shading_action_stop => 'Detener';

  @override
  String get shading_state_open => 'Abierto';

  @override
  String get shading_state_closed => 'Cerrado';

  @override
  String shading_state_partial(int position) {
    return '$position% abierto';
  }

  @override
  String get shading_position => 'Posición';

  @override
  String get shading_tap_for_controls => 'Toque para controles';

  @override
  String get shading_hide_controls => 'Ocultar controles';

  @override
  String get covers_mode_open => 'Abierto';

  @override
  String get covers_mode_closed => 'Cerrado';

  @override
  String get covers_mode_privacy => 'Privacidad';

  @override
  String get covers_mode_daylight => 'Luz natural';

  @override
  String get domain_mode_custom => 'Propio';

  @override
  String get covers_role_primary => 'Principal';

  @override
  String get covers_role_blackout => 'Oscurecimiento';

  @override
  String get covers_role_sheer => 'Visillo';

  @override
  String get covers_role_outdoor => 'Exterior';

  @override
  String get covers_role_hidden => 'Oculto';

  @override
  String get cover_type_curtain => 'Cortina';

  @override
  String get cover_type_blind => 'Persiana';

  @override
  String get cover_type_roller => 'Estor';

  @override
  String get cover_type_outdoor_blind => 'Persiana exterior';

  @override
  String get cover_type_cover => 'Cubierta';

  @override
  String get light_preset_candle => 'Vela';

  @override
  String get light_preset_warm => 'Cálida';

  @override
  String get light_preset_daylight => 'Luz natural';

  @override
  String get light_preset_cool => 'Fría';

  @override
  String get light_preset_warm_white => 'Blanco cálido';

  @override
  String get light_preset_neutral => 'Neutro';

  @override
  String get light_preset_cool_white => 'Blanco frío';

  @override
  String get light_color_red => 'Rojo';

  @override
  String get light_color_orange => 'Naranja';

  @override
  String get light_color_yellow => 'Amarillo';

  @override
  String get light_color_green => 'Verde';

  @override
  String get light_color_cyan => 'Cian';

  @override
  String get light_color_blue => 'Azul';

  @override
  String get light_color_purple => 'Púrpura';

  @override
  String get light_color_pink => 'Rosa';

  @override
  String get light_color_violet => 'Violeta';

  @override
  String get light_color_white => 'Blanco';

  @override
  String get light_cap_brightness => 'Brillo';

  @override
  String get light_cap_color_temp => 'Temp';

  @override
  String get light_cap_hue => 'Tono';

  @override
  String get light_cap_saturation => 'Sat';

  @override
  String get light_cap_white => 'Blanco';

  @override
  String light_header_mode_count(String mode, int count) {
    return '$mode • $count enc.';
  }

  @override
  String light_header_count_of_total(int count, int total) {
    return '$count de $total enc.';
  }

  @override
  String get popup_label_mode => 'Modo';

  @override
  String get connection_banner_reconnecting => 'Reconectando...';

  @override
  String get connection_banner_retry => 'Reintentar';

  @override
  String get connection_overlay_title_reconnecting => 'Reconectando';

  @override
  String get connection_overlay_message_reconnecting => 'Intentando reconectar...';

  @override
  String get connection_overlay_message_still_trying => 'Seguimos intentando reconectar...';

  @override
  String get connection_overlay_retry => 'Reintentar ahora';

  @override
  String get connection_overlay_retrying => 'Reconectando...';

  @override
  String get connection_recovery_connected => 'Conectado';

  @override
  String get connection_auth_error_title => 'Sesión expirada';

  @override
  String get connection_auth_error_message => 'Su sesión ha expirado o ha sido revocada. Restablezca el dispositivo para reconectar.';

  @override
  String get connection_auth_error_button_reset => 'Restablecer dispositivo';

  @override
  String get connection_network_error_title => 'Red no disponible';

  @override
  String get connection_network_error_message => 'No se puede contactar con el servidor. Compruebe su conexión de red.';

  @override
  String get connection_network_error_button_retry => 'Intentar de nuevo';

  @override
  String get connection_server_error_title => 'Servidor no disponible';

  @override
  String get connection_server_error_message => 'El servidor no está disponible temporalmente. Inténtelo más tarde.';

  @override
  String get connection_server_error_button_retry => 'Intentar de nuevo';

  @override
  String get sensor_enum_illuminance_bright => 'Brillante';

  @override
  String get sensor_enum_illuminance_bright_long => 'Brillante';

  @override
  String get sensor_enum_illuminance_moderate => 'Moderado';

  @override
  String get sensor_enum_illuminance_moderate_long => 'Iluminación moderada';

  @override
  String get sensor_enum_illuminance_dusky => 'Penumbra';

  @override
  String get sensor_enum_illuminance_dusky_long => 'Penumbra';

  @override
  String get sensor_enum_illuminance_dark => 'Oscuro';

  @override
  String get sensor_enum_illuminance_dark_long => 'Oscuro';

  @override
  String get sensor_enum_gas_status_normal => 'OK';

  @override
  String get sensor_enum_gas_status_normal_long => 'Normal';

  @override
  String get sensor_enum_gas_status_warning => 'Adv.';

  @override
  String get sensor_enum_gas_status_warning_long => 'Advertencia';

  @override
  String get sensor_enum_gas_status_alarm => 'Alarma';

  @override
  String get sensor_enum_gas_status_alarm_long => 'Alarma de gas';

  @override
  String get sensor_enum_leak_level_low => 'Bajo';

  @override
  String get sensor_enum_leak_level_low_long => 'Fuga leve';

  @override
  String get sensor_enum_leak_level_medium => 'Med';

  @override
  String get sensor_enum_leak_level_medium_long => 'Fuga media';

  @override
  String get sensor_enum_leak_level_high => 'Alto';

  @override
  String get sensor_enum_leak_level_high_long => 'Fuga grave';

  @override
  String get sensor_enum_battery_level_critical => 'Crít';

  @override
  String get sensor_enum_battery_level_critical_long => 'Crítica';

  @override
  String get sensor_enum_battery_level_low => 'Baja';

  @override
  String get sensor_enum_battery_level_low_long => 'Baja';

  @override
  String get sensor_enum_battery_level_medium => 'Med';

  @override
  String get sensor_enum_battery_level_medium_long => 'Media';

  @override
  String get sensor_enum_battery_level_high => 'Alta';

  @override
  String get sensor_enum_battery_level_high_long => 'Alta';

  @override
  String get sensor_enum_battery_level_full => 'Llena';

  @override
  String get sensor_enum_battery_level_full_long => 'Llena';

  @override
  String get sensor_enum_battery_status_ok => 'OK';

  @override
  String get sensor_enum_battery_status_ok_long => 'Batería OK';

  @override
  String get sensor_enum_battery_status_low => 'Baja';

  @override
  String get sensor_enum_battery_status_low_long => 'Batería baja';

  @override
  String get sensor_enum_battery_status_charging => 'Carg.';

  @override
  String get sensor_enum_battery_status_charging_long => 'Cargando';

  @override
  String get sensor_enum_alarm_alarm_idle => 'Reposo';

  @override
  String get sensor_enum_alarm_alarm_idle_long => 'Alarma en reposo';

  @override
  String get sensor_enum_alarm_alarm_pending => 'Pend.';

  @override
  String get sensor_enum_alarm_alarm_pending_long => 'Alarma pendiente';

  @override
  String get sensor_enum_alarm_alarm_triggered => 'Disp.';

  @override
  String get sensor_enum_alarm_alarm_triggered_long => 'Alarma disparada';

  @override
  String get sensor_enum_alarm_alarm_silenced => 'Silen.';

  @override
  String get sensor_enum_alarm_alarm_silenced_long => 'Alarma silenciada';

  @override
  String get sensor_enum_alarm_disarmed => 'Des.';

  @override
  String get sensor_enum_alarm_disarmed_long => 'Desarmada';

  @override
  String get sensor_enum_alarm_armed_home => 'Casa';

  @override
  String get sensor_enum_alarm_armed_home_long => 'Armada en casa';

  @override
  String get sensor_enum_alarm_armed_away => 'Fuera';

  @override
  String get sensor_enum_alarm_armed_away_long => 'Armada fuera';

  @override
  String get sensor_enum_alarm_armed_night => 'Noche';

  @override
  String get sensor_enum_alarm_armed_night_long => 'Armada noche';

  @override
  String get sensor_enum_filter_good => 'Bueno';

  @override
  String get sensor_enum_filter_good_long => 'Filtro bueno';

  @override
  String get sensor_enum_filter_replace_soon => 'Pronto';

  @override
  String get sensor_enum_filter_replace_soon_long => 'Cambiar pronto';

  @override
  String get sensor_enum_filter_replace_now => '¡Ya!';

  @override
  String get sensor_enum_filter_replace_now_long => 'Cambiar ahora';

  @override
  String get sensor_enum_door_opened => 'Abie.';

  @override
  String get sensor_enum_door_opened_long => 'Puerta abierta';

  @override
  String get sensor_enum_door_closed => 'Cerr.';

  @override
  String get sensor_enum_door_closed_long => 'Puerta cerrada';

  @override
  String get sensor_enum_door_opening => 'Abr.';

  @override
  String get sensor_enum_door_opening_long => 'Puerta abriéndose';

  @override
  String get sensor_enum_door_closing => 'Cerr.';

  @override
  String get sensor_enum_door_closing_long => 'Puerta cerrándose';

  @override
  String get sensor_enum_door_stopped => 'Det.';

  @override
  String get sensor_enum_door_stopped_long => 'Puerta detenida';

  @override
  String get sensor_enum_lock_locked => 'Cerr.';

  @override
  String get sensor_enum_lock_locked_long => 'Cerrada';

  @override
  String get sensor_enum_lock_unlocked => 'Abie.';

  @override
  String get sensor_enum_lock_unlocked_long => 'Abierta';

  @override
  String get sensor_enum_camera_available => 'Enc.';

  @override
  String get sensor_enum_camera_available_long => 'Cámara disponible';

  @override
  String get sensor_enum_camera_in_use => 'En uso';

  @override
  String get sensor_enum_camera_in_use_long => 'Cámara en uso';

  @override
  String get sensor_enum_camera_unavailable => 'N/D';

  @override
  String get sensor_enum_camera_unavailable_long => 'Cámara no disponible';

  @override
  String get sensor_enum_camera_offline => 'Apag.';

  @override
  String get sensor_enum_camera_offline_long => 'Cámara sin conexión';

  @override
  String get sensor_enum_camera_initializing => 'Inic.';

  @override
  String get sensor_enum_camera_initializing_long => 'Cámara inicializando';

  @override
  String get sensor_enum_camera_error => 'Error';

  @override
  String get sensor_enum_camera_error_long => 'Error de cámara';

  @override
  String get sensor_enum_device_info_connected => 'Enc.';

  @override
  String get sensor_enum_device_info_connected_long => 'Conectado';

  @override
  String get sensor_enum_device_info_disconnected => 'Apag.';

  @override
  String get sensor_enum_device_info_disconnected_long => 'Desconectado';

  @override
  String get sensor_enum_device_info_init => 'Inic.';

  @override
  String get sensor_enum_device_info_init_long => 'Inicializando';

  @override
  String get sensor_enum_device_info_ready => 'Listo';

  @override
  String get sensor_enum_device_info_ready_long => 'Listo';

  @override
  String get sensor_enum_device_info_running => 'Ejec.';

  @override
  String get sensor_enum_device_info_running_long => 'En ejecución';

  @override
  String get sensor_enum_device_info_sleeping => 'Dorm.';

  @override
  String get sensor_enum_device_info_sleeping_long => 'Durmiendo';

  @override
  String get sensor_enum_device_info_stopped => 'Det.';

  @override
  String get sensor_enum_device_info_stopped_long => 'Detenido';

  @override
  String get sensor_enum_device_info_lost => 'Perd.';

  @override
  String get sensor_enum_device_info_lost_long => 'Conexión perdida';

  @override
  String get sensor_enum_device_info_alert => 'Alerta';

  @override
  String get sensor_enum_device_info_alert_long => 'Alerta';

  @override
  String get sensor_enum_device_info_unknown => 'N/D';

  @override
  String get sensor_enum_device_info_unknown_long => 'Desconocido';

  @override
  String get sensor_freshness_live => 'En vivo';

  @override
  String get sensor_freshness_stale => 'Obsoleto';

  @override
  String get sensor_freshness_offline => 'Sin conexión';

  @override
  String get media_input_hdmi1 => 'HDMI 1';

  @override
  String get media_input_hdmi2 => 'HDMI 2';

  @override
  String get media_input_hdmi3 => 'HDMI 3';

  @override
  String get media_input_hdmi4 => 'HDMI 4';

  @override
  String get media_input_hdmi5 => 'HDMI 5';

  @override
  String get media_input_hdmi6 => 'HDMI 6';

  @override
  String get media_input_arc => 'ARC';

  @override
  String get media_input_earc => 'eARC';

  @override
  String get media_input_tv => 'TV';

  @override
  String get media_input_cable => 'Cable';

  @override
  String get media_input_satellite => 'Satélite';

  @override
  String get media_input_antenna => 'Antena';

  @override
  String get media_input_av1 => 'AV 1';

  @override
  String get media_input_av2 => 'AV 2';

  @override
  String get media_input_component => 'Componente';

  @override
  String get media_input_vga => 'VGA';

  @override
  String get media_input_dvi => 'DVI';

  @override
  String get media_input_usb => 'USB';

  @override
  String get media_input_bluetooth => 'Bluetooth';

  @override
  String get media_input_wifi => 'Wi-Fi';

  @override
  String get media_input_airplay => 'AirPlay';

  @override
  String get media_input_cast => 'Chromecast';

  @override
  String get media_input_dlna => 'DLNA';

  @override
  String get media_input_miracast => 'Miracast';

  @override
  String get media_input_app_netflix => 'Netflix';

  @override
  String get media_input_app_youtube => 'YouTube';

  @override
  String get media_input_app_spotify => 'Spotify';

  @override
  String get media_input_app_prime_video => 'Prime Video';

  @override
  String get media_input_app_disney_plus => 'Disney+';

  @override
  String get media_input_app_hbo_max => 'HBO Max';

  @override
  String get media_input_app_apple_tv => 'Apple TV';

  @override
  String get media_input_app_plex => 'Plex';

  @override
  String get media_input_app_kodi => 'Kodi';

  @override
  String get media_input_other => 'Otro';

  @override
  String get media_off_title => 'Multimedia apagado';

  @override
  String get media_off_subtitle => 'Seleccione una actividad para comenzar';

  @override
  String get media_not_configured_title => 'Multimedia no configurado';

  @override
  String get media_not_configured_description => 'Las actividades multimedia no se han configurado para esta habitación. Configure las vinculaciones de actividades en la administración.';

  @override
  String media_starting_activity(String activityName) {
    return 'Iniciando $activityName...';
  }

  @override
  String media_activity_failed(String activityName) {
    return '$activityName falló';
  }

  @override
  String get media_activity_failed_description => 'No se pudo aplicar la actividad. Compruebe la conectividad del dispositivo.';

  @override
  String get media_activity_retry => 'Reintentar';

  @override
  String get media_activity_turn_off => 'Apagar';

  @override
  String get media_warning_audio_offline => 'Salida de audio sin conexión — usando altavoces de pantalla';

  @override
  String get media_warning_some_devices_offline => 'Algunos dispositivos sin conexión';

  @override
  String media_warning_steps_failed(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'advertencias',
      one: 'advertencia',
    );
    return 'Algunos pasos fallaron ($count $_temp0)';
  }

  @override
  String get media_warning_steps_had_issues => 'Algunos pasos tuvieron problemas';

  @override
  String get media_remote => 'Control';

  @override
  String get media_remote_control => 'Control remoto';

  @override
  String media_volume_percent(int volume) {
    return '$volume%';
  }

  @override
  String get media_failure_details_title => 'Detalles de activación';

  @override
  String get media_failure_summary_total => 'Total';

  @override
  String get media_failure_summary_ok => 'OK';

  @override
  String get media_failure_summary_errors => 'Errores';

  @override
  String get media_failure_summary_warnings => 'Advertencias';

  @override
  String get media_failure_errors_critical => 'Errores (críticos)';

  @override
  String get media_failure_warnings_non_critical => 'Advertencias (no críticas)';

  @override
  String get media_failure_warnings_label => 'Advertencias';

  @override
  String get media_failure_retry_activity => 'Reintentar actividad';

  @override
  String get media_failure_deactivate => 'Desactivar';

  @override
  String media_failure_device_label(String deviceId) {
    return 'Dispositivo: $deviceId';
  }

  @override
  String media_failure_inline(int errors, int warnings) {
    String _temp0 = intl.Intl.pluralLogic(
      errors,
      locale: localeName,
      other: 'errores',
      one: 'error',
    );
    String _temp1 = intl.Intl.pluralLogic(
      warnings,
      locale: localeName,
      other: 'advertencias',
      one: 'advertencia',
    );
    return 'No se pudo aplicar la actividad ($errors $_temp0, $warnings $_temp1)';
  }

  @override
  String get media_activity_watch => 'Ver';

  @override
  String get media_activity_listen => 'Escuchar';

  @override
  String get media_activity_gaming => 'Juegos';

  @override
  String get media_activity_background => 'Fondo';

  @override
  String get media_activity_off => 'Apag.';

  @override
  String media_activity_active(String activityName) {
    return '$activityName activo';
  }

  @override
  String get media_status_standby => 'En espera';

  @override
  String get media_status_activating => 'Activando...';

  @override
  String get media_status_failed => 'Error';

  @override
  String get media_status_stopping => 'Deteniendo...';

  @override
  String get media_status_active_with_issues => 'Activo con problemas';

  @override
  String get media_status_active => 'Activo';

  @override
  String get media_status_ready => 'Listo';

  @override
  String get media_remote_up => 'Arriba';

  @override
  String get media_remote_down => 'Abajo';

  @override
  String get media_remote_left => 'Izquierda';

  @override
  String get media_remote_right => 'Derecha';

  @override
  String get media_remote_ok => 'OK';

  @override
  String get media_remote_back => 'Atrás';

  @override
  String get media_remote_exit => 'Salir';

  @override
  String get media_remote_info => 'Info';

  @override
  String get media_remote_rewind => 'Rebobinar';

  @override
  String get media_remote_fast_forward => 'Avanzar';

  @override
  String get media_remote_play => 'Reproducir';

  @override
  String get media_remote_pause => 'Pausa';

  @override
  String get media_remote_next => 'Siguiente';

  @override
  String get media_remote_prev => 'Anterior';

  @override
  String get media_detail_connection_lost => 'Conexión perdida';

  @override
  String get media_detail_connection_lost_description => 'Los controles multimedia requieren una conexión WebSocket activa.';

  @override
  String get media_detail_go_back => 'Volver';

  @override
  String get media_detail_section_display => 'Pantalla';

  @override
  String get media_detail_section_audio => 'Audio';

  @override
  String get media_detail_section_source => 'Fuente';

  @override
  String get media_detail_section_remote => 'Control remoto';

  @override
  String get media_detail_input => 'Entrada';

  @override
  String get media_detail_select => 'Seleccionar';

  @override
  String get media_detail_now_playing => 'Reproduciendo ahora';

  @override
  String get media_detail_no_track_info => 'Información de pista no disponible';

  @override
  String get media_detail_home => 'Inicio';

  @override
  String get media_detail_menu => 'Menú';

  @override
  String get media_playback => 'Reproducción';

  @override
  String get filter_all => 'Todo';

  @override
  String sensor_alert_high_title(String name) {
    return 'Alerta de $name alta';
  }

  @override
  String sensor_alert_exceeded_threshold(String name) {
    return '$name superó el umbral';
  }

  @override
  String get sensor_state_detected => 'Detectado';

  @override
  String get sensor_state_not_detected => 'No detectado';

  @override
  String get sensor_state_clear => 'Despejado';

  @override
  String get sensor_state_open => 'Abierto';

  @override
  String get sensor_state_closed => 'Cerrado';

  @override
  String get sensor_state_active => 'Activo';

  @override
  String get sensor_state_inactive => 'Inactivo';

  @override
  String get sensor_state_occupied => 'Ocupado';

  @override
  String get sensor_state_unoccupied => 'Desocupado';

  @override
  String get sensor_state_smoke_detected => 'Humo detectado';

  @override
  String get sensor_state_gas_detected => 'Gas detectado';

  @override
  String get sensor_state_leak_detected => 'Fuga detectada';

  @override
  String get sensor_state_co_detected => 'CO detectado';

  @override
  String get sensor_label_temperature => 'Temperatura';

  @override
  String get sensor_label_humidity => 'Humedad';

  @override
  String get sensor_label_pressure => 'Presión';

  @override
  String get sensor_label_illuminance => 'Iluminación';

  @override
  String get sensor_label_carbon_dioxide => 'Dióxido de carbono';

  @override
  String get sensor_label_carbon_monoxide => 'Monóxido de carbono';

  @override
  String get sensor_label_ozone => 'Ozono';

  @override
  String get sensor_label_nitrogen_dioxide => 'Dióxido de nitrógeno';

  @override
  String get sensor_label_sulphur_dioxide => 'Dióxido de azufre';

  @override
  String get sensor_label_voc => 'VOC';

  @override
  String get sensor_label_particulate_matter => 'Partículas en suspensión';

  @override
  String get sensor_label_motion => 'Movimiento';

  @override
  String get sensor_label_occupancy => 'Ocupación';

  @override
  String get sensor_label_contact => 'Contacto';

  @override
  String get sensor_label_leak => 'Fuga';

  @override
  String get sensor_label_smoke => 'Humo';

  @override
  String get sensor_label_battery => 'Batería';

  @override
  String get sensor_label_alarm => 'Alarma';

  @override
  String get sensor_label_door => 'Puerta';

  @override
  String get sensor_label_lock => 'Cerradura';

  @override
  String get sensor_label_camera => 'Cámara';

  @override
  String get sensor_label_filter => 'Filtro';

  @override
  String get sensor_label_device_info => 'Info del dispositivo';

  @override
  String get sensor_label_gas => 'Gas';

  @override
  String get sensor_label_electrical_energy => 'Energía';

  @override
  String get sensor_label_electrical_generation => 'Generación';

  @override
  String get sensor_label_electrical_power => 'Potencia';

  @override
  String get sensor_alert_high_level => 'Nivel alto';

  @override
  String get sensor_alert_low_battery => 'Batería baja';

  @override
  String get sensor_alert_charging => 'Cargando';

  @override
  String get sensor_category_temperature => 'Temperatura';

  @override
  String get sensor_category_humidity => 'Humedad';

  @override
  String get sensor_category_air_quality => 'Calidad del aire';

  @override
  String get sensor_category_motion => 'Movimiento';

  @override
  String get sensor_category_safety => 'Seguridad';

  @override
  String get sensor_category_light => 'Luz';

  @override
  String get sensor_category_energy => 'Energía';

  @override
  String get sensor_ui_event_log => 'Registro de eventos';

  @override
  String get sensor_ui_history => 'Historial';

  @override
  String get sensor_ui_current => 'Actual';

  @override
  String sensor_ui_current_value(String name) {
    return '$name actual';
  }

  @override
  String get sensor_ui_min => 'Mín';

  @override
  String get sensor_ui_max => 'Máx';

  @override
  String get sensor_ui_avg => 'Med';

  @override
  String sensor_ui_period_min(String period) {
    return '$period Mín';
  }

  @override
  String sensor_ui_period_max(String period) {
    return '$period Máx';
  }

  @override
  String sensor_ui_period_avg(String period) {
    return '$period Med';
  }

  @override
  String get sensor_ui_online => 'En línea';

  @override
  String get sensor_ui_offline => 'Sin conexión';

  @override
  String get sensor_ui_period_1h => '1H';

  @override
  String get sensor_ui_period_24h => '24H';

  @override
  String get sensor_ui_period_7d => '7D';

  @override
  String get sensor_ui_period_30d => '30D';

  @override
  String get sensor_empty_no_events => 'Sin eventos registrados';

  @override
  String get sensor_empty_no_state_changes => 'Sin cambios de estado';

  @override
  String get sensor_empty_no_history => 'Sin datos históricos disponibles';

  @override
  String get sensor_empty_no_data => 'Sin datos disponibles';

  @override
  String get sensor_status_loading => 'Cargando datos...';

  @override
  String get sensor_status_failed => 'Error al cargar datos';

  @override
  String get sensor_status_retry => 'Reintentar';

  @override
  String get sensors_domain_title => 'Sensores';

  @override
  String get sensors_domain_empty_title => 'Sensores no configurados';

  @override
  String get sensors_domain_empty_description => 'Los roles de sensores no se han configurado para esta habitación. Configure las asignaciones de sensores en la administración.';

  @override
  String sensors_domain_alerts_active(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Alertas activas',
      one: 'Alerta activa',
    );
    return '$_temp0';
  }

  @override
  String get sensors_domain_no_summary => 'Sin datos del entorno disponibles';

  @override
  String get sensors_domain_no_sensors => 'Sin sensores configurados';

  @override
  String sensors_domain_health_stale(int count) {
    return '$count obsoletos';
  }

  @override
  String sensors_domain_health_offline(int count) {
    return '$count sin conexión';
  }

  @override
  String get sensors_domain_health_normal => 'Todo normal';

  @override
  String get sensors_domain_avg_temperature => 'Temp. media';

  @override
  String get sensors_domain_avg_humidity => 'Humedad media';

  @override
  String get sensors_domain_all_sensors => 'Todos los sensores';

  @override
  String sensors_domain_sensor_count(int count) {
    return '$count sensores';
  }

  @override
  String get domain_security => 'Seguridad';

  @override
  String get security_tab_entry_points => 'Puntos de acceso';

  @override
  String get security_tab_alerts => 'Alertas';

  @override
  String get security_tab_events => 'Eventos';

  @override
  String get security_header_recent_events => 'Eventos recientes';

  @override
  String get security_status_triggered => 'Disparada';

  @override
  String get security_status_warning => 'Advertencia';

  @override
  String get security_status_secure => 'Seguro';

  @override
  String get security_armed_disarmed => 'Desarmada';

  @override
  String get security_armed_home => 'Armada en casa';

  @override
  String get security_armed_away => 'Armada fuera';

  @override
  String get security_armed_night => 'Armada noche';

  @override
  String get security_armed_unknown => 'Desconocido';

  @override
  String get security_alarm_idle => 'En reposo';

  @override
  String get security_alarm_pending => 'Pendiente';

  @override
  String get security_alarm_triggered => 'Disparada';

  @override
  String get security_alarm_silenced => 'Silenciada';

  @override
  String get security_alarm_unknown => 'Desconocido';

  @override
  String security_entry_open_count(int count) {
    return '$count abiertos';
  }

  @override
  String get security_entry_all_secure => 'Todo seguro';

  @override
  String get security_entry_status_breach => 'Intrusión';

  @override
  String get security_entry_status_open => 'Abierto';

  @override
  String get security_entry_status_unknown => 'Desconocido';

  @override
  String get security_entry_status_closed => 'Cerrado';

  @override
  String security_summary_all_clear(int count) {
    return 'Todo despejado · $count puntos de acceso seguros';
  }

  @override
  String security_summary_alerts(int count) {
    return '$count alertas';
  }

  @override
  String get security_summary_alerts_label => 'Alertas';

  @override
  String security_summary_entry_points_open(int count) {
    return '$count puntos de acceso abiertos';
  }

  @override
  String get security_summary_open_label => 'Abierto';

  @override
  String get security_no_active_alerts => 'Sin alertas activas';

  @override
  String get security_ack_all => 'Confirmar todo';

  @override
  String get security_no_recent_events => 'Sin eventos recientes';

  @override
  String get security_events_load_failed => 'Error al cargar eventos';

  @override
  String get security_retry => 'Reintentar';

  @override
  String get security_alert_type_intrusion => 'Intrusión detectada';

  @override
  String get security_alert_type_entry_open => 'Acceso abierto';

  @override
  String get security_alert_type_smoke => 'Humo detectado';

  @override
  String get security_alert_type_co => 'CO detectado';

  @override
  String get security_alert_type_water_leak => 'Fuga de agua';

  @override
  String get security_alert_type_gas => 'Gas detectado';

  @override
  String get security_alert_type_tamper => 'Manipulación detectada';

  @override
  String get security_alert_type_fault => 'Fallo del sistema';

  @override
  String get security_alert_type_device_offline => 'Dispositivo sin conexión';

  @override
  String get security_alert_type_unknown => 'Desconocido';

  @override
  String get security_event_alert_raised => 'Alerta emitida';

  @override
  String get security_event_alert_resolved => 'Alerta resuelta';

  @override
  String get security_event_alert_acknowledged => 'Alerta confirmada';

  @override
  String get security_event_alarm_state_changed => 'Estado de alarma cambiado';

  @override
  String get security_event_arming_mode_changed => 'Modo de armado cambiado';

  @override
  String security_event_title_alert_raised(String alertType) {
    return 'Alerta emitida: $alertType';
  }

  @override
  String security_event_title_alert_resolved(String alertType) {
    return 'Alerta resuelta: $alertType';
  }

  @override
  String security_event_title_alert_acknowledged(String alertType) {
    return 'Alerta confirmada: $alertType';
  }

  @override
  String security_event_title_alarm_state_changed(String from, String to) {
    return 'Estado de alarma cambiado: $from → $to';
  }

  @override
  String security_event_title_arming_mode_changed(String from, String to) {
    return 'Modo de armado cambiado: $from → $to';
  }

  @override
  String security_state_transition(String from, String to) {
    return '$from → $to';
  }

  @override
  String get security_state_unknown => 'desconocido';

  @override
  String get security_overlay_alarm_triggered => 'Alarma disparada';

  @override
  String get security_overlay_default_title => 'Alerta de seguridad';

  @override
  String get security_overlay_acknowledge => 'Confirmar';

  @override
  String get security_overlay_open_security => 'Abrir seguridad';

  @override
  String security_overlay_more_alerts(int count) {
    return '+$count alertas más';
  }

  @override
  String get room_overview_no_room => 'No hay habitación asignada a esta pantalla';

  @override
  String get room_overview_display_not_configured => 'Pantalla no configurada';

  @override
  String get room_overview_load_failed => 'Error al cargar datos de la habitación';

  @override
  String room_overview_lights_active(int lightsOn, int totalLights) {
    return '$lightsOn de $totalLights activas';
  }

  @override
  String room_overview_light_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count luces',
      one: '1 luz',
    );
    return '$_temp0';
  }

  @override
  String room_overview_device_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count dispositivos',
      one: '1 dispositivo',
    );
    return '$_temp0';
  }

  @override
  String room_overview_reading_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count lecturas',
      one: '1 lectura',
    );
    return '$_temp0';
  }

  @override
  String get room_overview_action_failed => 'Acción fallida';

  @override
  String get suggested_action_turn_off_lights => 'Apagar luces';

  @override
  String get suggested_action_movie_mode => 'Modo película';

  @override
  String get suggested_action_night_mode => 'Modo nocturno';

  @override
  String get shading_fully_closed => 'Totalmente cerrado';

  @override
  String get shading_fully_open => 'Totalmente abierto';

  @override
  String get sensor_label_light => 'Luz';

  @override
  String get settings_save_failed => 'Error al guardar los ajustes.';

  @override
  String get settings_about_version_loading => 'Cargando...';

  @override
  String get app_error_failed_to_start => 'Error al iniciar la aplicación';

  @override
  String get app_error_failed_to_start_short => 'Error al iniciar';

  @override
  String get app_error_unexpected => 'Se produjo un error inesperado al iniciar la aplicación.';

  @override
  String get app_error_see_details => 'Se produjo un error. Vea los detalles a continuación.';

  @override
  String get app_error_restart_button => 'Reiniciar aplicación';

  @override
  String get app_error_permit_join_hint => 'Solicite al administrador que active \"Permit Join\" en la administración y luego reinicie la aplicación.';

  @override
  String get app_error_connection_failed_stored => 'No se pudo conectar al servidor almacenado.';

  @override
  String app_error_connection_failed_backend(String name, String address) {
    return 'No se pudo conectar a $name en $address';
  }

  @override
  String get app_error_initialization_failed => 'Error al inicializar la conexión con el servidor.';

  @override
  String app_error_connection_failed_url(String url) {
    return 'No se pudo conectar a $url';
  }

  @override
  String get deck_empty_title => 'No hay páginas configuradas';

  @override
  String get deck_empty_description => 'Configure su panel de control en la administración.';

  @override
  String get alert_banner_view_button => 'Ver';

  @override
  String get sensor_chart_label_now => 'Ahora';

  @override
  String get room_name_fallback => 'Habitación';

  @override
  String get weather_tile_not_configured => 'No configurado';

  @override
  String get entry_error_load_security_data => 'Error al cargar datos de seguridad';

  @override
  String get entry_locks_all_locked => 'Todo cerrado';

  @override
  String entry_locks_status_partial(int locked, int total) {
    return '$locked/$total cerrados';
  }

  @override
  String get entry_alarm_armed => 'Armada';

  @override
  String get entry_alarm_disarmed => 'Desarmada';

  @override
  String entry_cameras_status_active(int count) {
    return '$count activas';
  }

  @override
  String get master_error_load_house_data => 'Error al cargar datos de la casa';

  @override
  String master_room_device_count(int online, int total) {
    return '$online/$total dispositivos';
  }

  @override
  String get buddy_dismiss => 'Cerrar';

  @override
  String get buddy_apply => 'Aplicar';

  @override
  String get buddy_got_it => 'Entendido';

  @override
  String get buddy_empty_state_message => '¡Pregúntame lo que quieras sobre tu hogar!';

  @override
  String get buddy_init_failed_message => 'No se pudo iniciar la conversación';

  @override
  String get buddy_provider_not_configured_title => 'Proveedor de IA no configurado';

  @override
  String get buddy_provider_not_configured_description => 'Configure un proveedor de IA en la administración para activar el chat.';

  @override
  String get buddy_thinking => 'Pensando...';

  @override
  String get buddy_hint_init_failed => 'No se pudo iniciar la conversación';

  @override
  String get buddy_hint_starting_conversation => 'Iniciando conversación...';

  @override
  String get buddy_hint_default => 'Pregunte sobre su hogar...';

  @override
  String get buddy_error_load_conversations => 'Error al cargar conversaciones';

  @override
  String get buddy_error_create_conversation => 'Error al crear conversación';

  @override
  String get buddy_error_load_messages => 'Error al cargar mensajes';

  @override
  String get buddy_error_send_message => 'Error al enviar mensaje';

  @override
  String get buddy_error_provider_not_configured => 'Proveedor de IA no configurado';

  @override
  String get buddy_error_request_timeout => 'Tiempo de espera agotado. Inténtelo de nuevo.';

  @override
  String get buddy_error_connection_error => 'Error de conexión. Compruebe su red.';

  @override
  String get buddy_error_generic => 'Algo salió mal. Inténtelo de nuevo.';

  @override
  String get buddy_hint_recording => 'Grabando audio...';

  @override
  String buddy_recording_progress(int seconds, int maxSeconds) {
    return 'Grabando... ${seconds}s / ${maxSeconds}s';
  }

  @override
  String get buddy_recording_cancel => 'Cancelar';

  @override
  String get buddy_recording_too_short => 'Grabación demasiado corta. Mantenga pulsado más tiempo.';

  @override
  String get buddy_recording_permission_error => 'No se pudo iniciar la grabación. Compruebe los permisos del micrófono.';

  @override
  String get buddy_voice_listening => 'Escuchando...';

  @override
  String buddy_voice_recording_timer(int seconds, int maxSeconds) {
    return '${seconds}s / ${maxSeconds}s';
  }

  @override
  String buddy_voice_recording_progress(int seconds, int maxSeconds) {
    return 'Grabando ${seconds}s / ${maxSeconds}s';
  }

  @override
  String get buddy_voice_processing => 'Procesando...';

  @override
  String get buddy_voice_transcribing => 'Transcribiendo audio...';

  @override
  String get security_events_error_unexpected_response => 'Respuesta inesperada';

  @override
  String media_activation_step_fallback(int index) {
    return 'Paso $index';
  }

  @override
  String get intent_error_deck_not_initialized => 'Deck no inicializado';

  @override
  String get intent_error_deck_item_not_found => 'Elemento del deck no encontrado';

  @override
  String get intent_error_no_home_item => 'Elemento de inicio no disponible';

  @override
  String get intent_error_scenes_not_available => 'Servicio de escenas no disponible';

  @override
  String get intent_error_scene_activation_failed => 'Error al activar la escena';

  @override
  String get intent_error_scene_activation_error => 'Error durante la activación de la escena';

  @override
  String get intent_error_device_repo_not_available => 'Repositorio de propiedades del dispositivo no disponible';

  @override
  String get intent_error_set_property_failed => 'Error al establecer el valor de la propiedad';

  @override
  String get intent_error_set_property_error => 'Error al configurar el valor de la propiedad';

  @override
  String get intent_error_toggle_device_failed => 'Error al conmutar el dispositivo';

  @override
  String get intent_error_toggle_device_error => 'Error durante la conmutación del dispositivo';

  @override
  String get settings_display_screen_lock_never => 'Nunca';
}

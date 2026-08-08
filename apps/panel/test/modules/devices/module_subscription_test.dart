import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/api/devices_module/devices_module_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/module.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockDevicesModuleClient extends Mock implements DevicesModuleClient {}

/// Records the order of the two things that matter here.
class RecordingSocketService extends Mock implements SocketService {
  RecordingSocketService(this.log);

  final List<String> log;

  @override
  void registerEventHandler(
    String event,
    void Function(String, Map<String, dynamic>) handler,
  ) {
    log.add('subscribe');
  }
}

/// A device hidden while the panel is starting announces itself once. A handler registered after the
/// initial fetch is not there to hear it, and the list snapshot the fetch is applying was taken
/// before the hide — so the panel renders the physical source, commandable, beside a replacement it
/// never learned about, until something refreshes it.
void main() {
  setUp(() async {
    await locator.reset();
  });

  tearDown(() async {
    await locator.reset();
  });

  test('subscribes to the socket before it reads the first device list', () async {
    final log = <String>[];

    final devicesClient = MockDevicesModuleClient();

    // Every read fails immediately: this test is about *when* the first one is made, not what it
    // answers, and a failing fetch is already handled by the repositories.
    when(() => devicesClient.getDevicesModuleDevices()).thenAnswer((_) async {
      log.add('fetch');

      throw DioException(requestOptions: RequestOptions());
    });

    final apiClient = MockApiClient();

    when(() => apiClient.devicesModule).thenReturn(devicesClient);

    final module = DevicesModuleService(
      apiClient: apiClient,
      socketService: RecordingSocketService(log),
    );

    // The read fails, which is fine: the subscription has to have happened before it was even
    // attempted, and that is what the log says.
    await expectLater(module.initialize(), throwsA(isA<Exception>()));

    expect(log.first, 'subscribe');
    expect(log, contains('fetch'));
  });
}

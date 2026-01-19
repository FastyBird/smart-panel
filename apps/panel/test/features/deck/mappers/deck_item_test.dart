import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('buildDeckItemWidget', () {
    group('DomainViewItem routing', () {
      test('should route lights domain to LightsDomainViewPage', () {
        final domainViewItem = DomainViewItem(
          id: 'domain-lights-room123',
          domainType: DomainType.lights,
          roomId: 'room123',
          title: 'Lights',
          deviceCount: 3,
        );

        final widget = buildDeckItemWidget(domainViewItem);

        expect(widget, isA<LightsDomainViewPage>());
        expect((widget as LightsDomainViewPage).viewItem, domainViewItem);
      });

      test('should route climate domain to ClimateDomainViewPage', () {
        final domainViewItem = DomainViewItem(
          id: 'domain-climate-room123',
          domainType: DomainType.climate,
          roomId: 'room123',
          title: 'Climate',
          deviceCount: 2,
        );

        final widget = buildDeckItemWidget(domainViewItem);

        expect(widget, isA<ClimateDomainViewPage>());
        expect((widget as ClimateDomainViewPage).viewItem, domainViewItem);
      });

      test('should route sensors domain to DomainViewPage placeholder', () {
        final domainViewItem = DomainViewItem(
          id: 'domain-sensors-room123',
          domainType: DomainType.sensors,
          roomId: 'room123',
          title: 'Sensors',
          deviceCount: 5,
        );

        final widget = buildDeckItemWidget(domainViewItem);

        expect(widget, isA<DomainViewPage>());
        expect((widget as DomainViewPage).viewItem, domainViewItem);
      });

      test('should route media domain to MediaDomainViewPage', () {
        final domainViewItem = DomainViewItem(
          id: 'domain-media-room123',
          domainType: DomainType.media,
          roomId: 'room123',
          title: 'Media',
          deviceCount: 1,
        );

        final widget = buildDeckItemWidget(domainViewItem);

        expect(widget, isA<MediaDomainViewPage>());
        expect((widget as MediaDomainViewPage).viewItem, domainViewItem);
      });
    });

    group('DomainViewItem ID generation', () {
      test('should generate correct ID for lights domain', () {
        final id = DomainViewItem.generateId(DomainType.lights, 'room123');
        expect(id, 'domain-lights-room123');
      });

      test('should generate correct ID for climate domain', () {
        final id = DomainViewItem.generateId(DomainType.climate, 'room456');
        expect(id, 'domain-climate-room456');
      });

      test('should generate correct ID for sensors domain', () {
        final id = DomainViewItem.generateId(DomainType.sensors, 'room789');
        expect(id, 'domain-sensors-room789');
      });

      test('should generate correct ID for media domain', () {
        final id = DomainViewItem.generateId(DomainType.media, 'room-abc');
        expect(id, 'domain-media-room-abc');
      });
    });
  });
}

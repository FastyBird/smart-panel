import 'package:fastybird_smart_panel/modules/security/utils/entry_points.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
	group('EntryPointData isOpen mapping', () {
		test('isOpen true when detected', () {
			const ep = EntryPointData(
				deviceId: 'd1',
				name: 'Front Door',
				isOpen: true,
			);
			expect(ep.isOpen, isTrue);
		});

		test('isOpen false when not detected', () {
			const ep = EntryPointData(
				deviceId: 'd1',
				name: 'Front Door',
				isOpen: false,
			);
			expect(ep.isOpen, isFalse);
		});

		test('isOpen null when unknown', () {
			const ep = EntryPointData(
				deviceId: 'd1',
				name: 'Front Door',
				isOpen: null,
			);
			expect(ep.isOpen, isNull);
		});
	});

	group('EntryPointsSummary counts', () {
		test('computes open/closed/unknown correctly', () {
			const summary = EntryPointsSummary(
				all: [
					EntryPointData(deviceId: 'd1', name: 'A', isOpen: true),
					EntryPointData(deviceId: 'd2', name: 'B', isOpen: false),
					EntryPointData(deviceId: 'd3', name: 'C', isOpen: false),
					EntryPointData(deviceId: 'd4', name: 'D', isOpen: null),
					EntryPointData(deviceId: 'd5', name: 'E', isOpen: true),
				],
				openCount: 2,
				closedCount: 2,
				unknownCount: 1,
				openItems: [
					EntryPointData(deviceId: 'd1', name: 'A', isOpen: true),
					EntryPointData(deviceId: 'd5', name: 'E', isOpen: true),
				],
			);

			expect(summary.openCount, 2);
			expect(summary.closedCount, 2);
			expect(summary.unknownCount, 1);
			expect(summary.isEmpty, isFalse);
			expect(summary.allClosed, isFalse);
		});

		test('allClosed is true when no open and no unknown', () {
			const summary = EntryPointsSummary(
				all: [
					EntryPointData(deviceId: 'd1', name: 'A', isOpen: false),
					EntryPointData(deviceId: 'd2', name: 'B', isOpen: false),
				],
				openCount: 0,
				closedCount: 2,
				unknownCount: 0,
				openItems: [],
			);

			expect(summary.allClosed, isTrue);
		});

		test('isEmpty is true when no entry points', () {
			const summary = EntryPointsSummary(
				all: [],
				openCount: 0,
				closedCount: 0,
				unknownCount: 0,
				openItems: [],
			);

			expect(summary.isEmpty, isTrue);
		});
	});

	group('sortEntryPoints', () {
		test('sorts by room asc, name asc, deviceId asc', () {
			final items = [
				const EntryPointData(deviceId: 'd3', name: 'Window', room: 'Kitchen', isOpen: true),
				const EntryPointData(deviceId: 'd1', name: 'Door', room: 'Bedroom', isOpen: true),
				const EntryPointData(deviceId: 'd2', name: 'Door', room: 'Bedroom', isOpen: true),
				const EntryPointData(deviceId: 'd4', name: 'Window', room: null, isOpen: true),
			];

			sortEntryPoints(items);

			expect(items[0].deviceId, 'd1'); // Bedroom, Door, d1
			expect(items[1].deviceId, 'd2'); // Bedroom, Door, d2
			expect(items[2].deviceId, 'd3'); // Kitchen, Window, d3
			expect(items[3].deviceId, 'd4'); // null room (last)
		});

		test('null rooms sort last', () {
			final items = [
				const EntryPointData(deviceId: 'd1', name: 'A', room: null, isOpen: true),
				const EntryPointData(deviceId: 'd2', name: 'A', room: 'Alpha', isOpen: true),
			];

			sortEntryPoints(items);

			expect(items[0].deviceId, 'd2'); // Alpha room first
			expect(items[1].deviceId, 'd1'); // null last
		});

		test('stable sort with identical fields', () {
			final items = [
				const EntryPointData(deviceId: 'd2', name: 'Door', room: 'A', isOpen: true),
				const EntryPointData(deviceId: 'd1', name: 'Door', room: 'A', isOpen: true),
			];

			sortEntryPoints(items);

			expect(items[0].deviceId, 'd1');
			expect(items[1].deviceId, 'd2');
		});
	});
}

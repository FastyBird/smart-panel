// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_res_page_card_tile_data_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardResPageCardTileDataUnion _$DashboardResPageCardTileDataUnionFromJson(
    Map<String, dynamic> json) {
  switch (json['type']) {
    case 'device-preview':
      return DashboardResPageCardTileDataUnionDevicePreview.fromJson(json);
    case 'clock':
      return DashboardResPageCardTileDataUnionClock.fromJson(json);
    case 'weather-day':
      return DashboardResPageCardTileDataUnionWeatherDay.fromJson(json);
    case 'weather-forecast':
      return DashboardResPageCardTileDataUnionWeatherForecast.fromJson(json);

    default:
      throw CheckedFromJsonException(
          json,
          'type',
          'DashboardResPageCardTileDataUnion',
          'Invalid union type "${json['type']}"!');
  }
}

/// @nodoc
mixin _$DashboardResPageCardTileDataUnion {
  /// A unique identifier for the dashboard tile.
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the tile type
  String get type => throw _privateConstructorUsedError;

  /// The row position of the tile in the grid.
  int get row => throw _privateConstructorUsedError;

  /// The column position of the tile in the grid.
  int get col => throw _privateConstructorUsedError;

  /// A list of data sources used by the tile, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource =>
      throw _privateConstructorUsedError;

  /// The timestamp when the dashboard tile was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// The timestamp when the dashboard tile was last updated.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// The unique identifier of the associated card.
  String get card => throw _privateConstructorUsedError;

  /// The number of rows the tile spans.
  @JsonKey(name: 'row_span')
  int get rowSpan => throw _privateConstructorUsedError;

  /// The number of columns the tile spans.
  @JsonKey(name: 'col_span')
  int get colSpan => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        devicePreview,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardResPageCardTileDataUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardResPageCardTileDataUnionClock value)
        clock,
    required TResult Function(DashboardResPageCardTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardResPageCardTileDataUnionWeatherForecast value)
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardResPageCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardResPageCardTileDataUnionClock value)? clock,
    TResult? Function(DashboardResPageCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardResPageCardTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardResPageCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardResPageCardTileDataUnionClock value)? clock,
    TResult Function(DashboardResPageCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardResPageCardTileDataUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardResPageCardTileDataUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardResPageCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardResPageCardTileDataUnionCopyWith<DashboardResPageCardTileDataUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardResPageCardTileDataUnionCopyWith<$Res> {
  factory $DashboardResPageCardTileDataUnionCopyWith(
          DashboardResPageCardTileDataUnion value,
          $Res Function(DashboardResPageCardTileDataUnion) then) =
      _$DashboardResPageCardTileDataUnionCopyWithImpl<$Res,
          DashboardResPageCardTileDataUnion>;
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String card,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class _$DashboardResPageCardTileDataUnionCopyWithImpl<$Res,
        $Val extends DashboardResPageCardTileDataUnion>
    implements $DashboardResPageCardTileDataUnionCopyWith<$Res> {
  _$DashboardResPageCardTileDataUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardResPageCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? card = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardTileBaseDataSourceUnion>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      card: null == card
          ? _value.card
          : card // ignore: cast_nullable_to_non_nullable
              as String,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardResPageCardTileDataUnionDevicePreviewImplCopyWith<
    $Res> implements $DashboardResPageCardTileDataUnionCopyWith<$Res> {
  factory _$$DashboardResPageCardTileDataUnionDevicePreviewImplCopyWith(
          _$DashboardResPageCardTileDataUnionDevicePreviewImpl value,
          $Res Function(_$DashboardResPageCardTileDataUnionDevicePreviewImpl)
              then) =
      __$$DashboardResPageCardTileDataUnionDevicePreviewImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String device,
      String? icon,
      String card,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class __$$DashboardResPageCardTileDataUnionDevicePreviewImplCopyWithImpl<$Res>
    extends _$DashboardResPageCardTileDataUnionCopyWithImpl<$Res,
        _$DashboardResPageCardTileDataUnionDevicePreviewImpl>
    implements
        _$$DashboardResPageCardTileDataUnionDevicePreviewImplCopyWith<$Res> {
  __$$DashboardResPageCardTileDataUnionDevicePreviewImplCopyWithImpl(
      _$DashboardResPageCardTileDataUnionDevicePreviewImpl _value,
      $Res Function(_$DashboardResPageCardTileDataUnionDevicePreviewImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardResPageCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? device = null,
    Object? icon = freezed,
    Object? card = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_$DashboardResPageCardTileDataUnionDevicePreviewImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardTileBaseDataSourceUnion>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      card: null == card
          ? _value.card
          : card // ignore: cast_nullable_to_non_nullable
              as String,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardResPageCardTileDataUnionDevicePreviewImpl
    implements DashboardResPageCardTileDataUnionDevicePreview {
  const _$DashboardResPageCardTileDataUnionDevicePreviewImpl(
      {required this.id,
      required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required this.device,
      required this.icon,
      required this.card,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0})
      : _dataSource = dataSource;

  factory _$DashboardResPageCardTileDataUnionDevicePreviewImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardResPageCardTileDataUnionDevicePreviewImplFromJson(json);

  /// A unique identifier for the dashboard tile.
  @override
  final String id;

  /// Discriminator for the tile type
  @override
  final String type;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The timestamp when the dashboard tile was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the dashboard tile was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// The icon representing the device tile.
  @override
  final String? icon;

  /// The unique identifier of the associated card.
  @override
  final String card;

  /// The number of rows the tile spans.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  @override
  String toString() {
    return 'DashboardResPageCardTileDataUnion.devicePreview(id: $id, type: $type, row: $row, col: $col, dataSource: $dataSource, createdAt: $createdAt, updatedAt: $updatedAt, device: $device, icon: $icon, card: $card, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardResPageCardTileDataUnionDevicePreviewImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.card, card) || other.card == card) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      type,
      row,
      col,
      const DeepCollectionEquality().hash(_dataSource),
      createdAt,
      updatedAt,
      device,
      icon,
      card,
      rowSpan,
      colSpan);

  /// Create a copy of DashboardResPageCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardResPageCardTileDataUnionDevicePreviewImplCopyWith<
          _$DashboardResPageCardTileDataUnionDevicePreviewImpl>
      get copyWith =>
          __$$DashboardResPageCardTileDataUnionDevicePreviewImplCopyWithImpl<
                  _$DashboardResPageCardTileDataUnionDevicePreviewImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        devicePreview,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) {
    return devicePreview(id, type, row, col, dataSource, createdAt, updatedAt,
        device, icon, card, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) {
    return devicePreview?.call(id, type, row, col, dataSource, createdAt,
        updatedAt, device, icon, card, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (devicePreview != null) {
      return devicePreview(id, type, row, col, dataSource, createdAt, updatedAt,
          device, icon, card, rowSpan, colSpan);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardResPageCardTileDataUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardResPageCardTileDataUnionClock value)
        clock,
    required TResult Function(DashboardResPageCardTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardResPageCardTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return devicePreview(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardResPageCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardResPageCardTileDataUnionClock value)? clock,
    TResult? Function(DashboardResPageCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardResPageCardTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return devicePreview?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardResPageCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardResPageCardTileDataUnionClock value)? clock,
    TResult Function(DashboardResPageCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardResPageCardTileDataUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (devicePreview != null) {
      return devicePreview(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardResPageCardTileDataUnionDevicePreviewImplToJson(
      this,
    );
  }
}

abstract class DashboardResPageCardTileDataUnionDevicePreview
    implements DashboardResPageCardTileDataUnion {
  const factory DashboardResPageCardTileDataUnionDevicePreview(
          {required final String id,
          required final String type,
          required final int row,
          required final int col,
          @JsonKey(name: 'data_source')
          required final List<DashboardTileBaseDataSourceUnion> dataSource,
          @JsonKey(name: 'created_at') required final DateTime createdAt,
          @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
          required final String device,
          required final String? icon,
          required final String card,
          @JsonKey(name: 'row_span') final int rowSpan,
          @JsonKey(name: 'col_span') final int colSpan}) =
      _$DashboardResPageCardTileDataUnionDevicePreviewImpl;

  factory DashboardResPageCardTileDataUnionDevicePreview.fromJson(
          Map<String, dynamic> json) =
      _$DashboardResPageCardTileDataUnionDevicePreviewImpl.fromJson;

  /// A unique identifier for the dashboard tile.
  @override
  String get id;

  /// Discriminator for the tile type
  @override
  String get type;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource;

  /// The timestamp when the dashboard tile was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the dashboard tile was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// The unique identifier of the associated device.
  String get device;

  /// The icon representing the device tile.
  String? get icon;

  /// The unique identifier of the associated card.
  @override
  String get card;

  /// The number of rows the tile spans.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Create a copy of DashboardResPageCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardResPageCardTileDataUnionDevicePreviewImplCopyWith<
          _$DashboardResPageCardTileDataUnionDevicePreviewImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardResPageCardTileDataUnionClockImplCopyWith<$Res>
    implements $DashboardResPageCardTileDataUnionCopyWith<$Res> {
  factory _$$DashboardResPageCardTileDataUnionClockImplCopyWith(
          _$DashboardResPageCardTileDataUnionClockImpl value,
          $Res Function(_$DashboardResPageCardTileDataUnionClockImpl) then) =
      __$$DashboardResPageCardTileDataUnionClockImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String card,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class __$$DashboardResPageCardTileDataUnionClockImplCopyWithImpl<$Res>
    extends _$DashboardResPageCardTileDataUnionCopyWithImpl<$Res,
        _$DashboardResPageCardTileDataUnionClockImpl>
    implements _$$DashboardResPageCardTileDataUnionClockImplCopyWith<$Res> {
  __$$DashboardResPageCardTileDataUnionClockImplCopyWithImpl(
      _$DashboardResPageCardTileDataUnionClockImpl _value,
      $Res Function(_$DashboardResPageCardTileDataUnionClockImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardResPageCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? card = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_$DashboardResPageCardTileDataUnionClockImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardTileBaseDataSourceUnion>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      card: null == card
          ? _value.card
          : card // ignore: cast_nullable_to_non_nullable
              as String,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardResPageCardTileDataUnionClockImpl
    implements DashboardResPageCardTileDataUnionClock {
  const _$DashboardResPageCardTileDataUnionClockImpl(
      {required this.id,
      required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required this.card,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0})
      : _dataSource = dataSource;

  factory _$DashboardResPageCardTileDataUnionClockImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardResPageCardTileDataUnionClockImplFromJson(json);

  /// A unique identifier for the dashboard tile.
  @override
  final String id;

  /// Discriminator for the tile type
  @override
  final String type;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The timestamp when the dashboard tile was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the dashboard tile was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// The unique identifier of the associated card.
  @override
  final String card;

  /// The number of rows the tile spans.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  @override
  String toString() {
    return 'DashboardResPageCardTileDataUnion.clock(id: $id, type: $type, row: $row, col: $col, dataSource: $dataSource, createdAt: $createdAt, updatedAt: $updatedAt, card: $card, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardResPageCardTileDataUnionClockImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.card, card) || other.card == card) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      type,
      row,
      col,
      const DeepCollectionEquality().hash(_dataSource),
      createdAt,
      updatedAt,
      card,
      rowSpan,
      colSpan);

  /// Create a copy of DashboardResPageCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardResPageCardTileDataUnionClockImplCopyWith<
          _$DashboardResPageCardTileDataUnionClockImpl>
      get copyWith =>
          __$$DashboardResPageCardTileDataUnionClockImplCopyWithImpl<
              _$DashboardResPageCardTileDataUnionClockImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        devicePreview,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) {
    return clock(id, type, row, col, dataSource, createdAt, updatedAt, card,
        rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) {
    return clock?.call(id, type, row, col, dataSource, createdAt, updatedAt,
        card, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (clock != null) {
      return clock(id, type, row, col, dataSource, createdAt, updatedAt, card,
          rowSpan, colSpan);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardResPageCardTileDataUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardResPageCardTileDataUnionClock value)
        clock,
    required TResult Function(DashboardResPageCardTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardResPageCardTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return clock(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardResPageCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardResPageCardTileDataUnionClock value)? clock,
    TResult? Function(DashboardResPageCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardResPageCardTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return clock?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardResPageCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardResPageCardTileDataUnionClock value)? clock,
    TResult Function(DashboardResPageCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardResPageCardTileDataUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (clock != null) {
      return clock(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardResPageCardTileDataUnionClockImplToJson(
      this,
    );
  }
}

abstract class DashboardResPageCardTileDataUnionClock
    implements DashboardResPageCardTileDataUnion {
  const factory DashboardResPageCardTileDataUnionClock(
          {required final String id,
          required final String type,
          required final int row,
          required final int col,
          @JsonKey(name: 'data_source')
          required final List<DashboardTileBaseDataSourceUnion> dataSource,
          @JsonKey(name: 'created_at') required final DateTime createdAt,
          @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
          required final String card,
          @JsonKey(name: 'row_span') final int rowSpan,
          @JsonKey(name: 'col_span') final int colSpan}) =
      _$DashboardResPageCardTileDataUnionClockImpl;

  factory DashboardResPageCardTileDataUnionClock.fromJson(
          Map<String, dynamic> json) =
      _$DashboardResPageCardTileDataUnionClockImpl.fromJson;

  /// A unique identifier for the dashboard tile.
  @override
  String get id;

  /// Discriminator for the tile type
  @override
  String get type;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource;

  /// The timestamp when the dashboard tile was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the dashboard tile was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// The unique identifier of the associated card.
  @override
  String get card;

  /// The number of rows the tile spans.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Create a copy of DashboardResPageCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardResPageCardTileDataUnionClockImplCopyWith<
          _$DashboardResPageCardTileDataUnionClockImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardResPageCardTileDataUnionWeatherDayImplCopyWith<$Res>
    implements $DashboardResPageCardTileDataUnionCopyWith<$Res> {
  factory _$$DashboardResPageCardTileDataUnionWeatherDayImplCopyWith(
          _$DashboardResPageCardTileDataUnionWeatherDayImpl value,
          $Res Function(_$DashboardResPageCardTileDataUnionWeatherDayImpl)
              then) =
      __$$DashboardResPageCardTileDataUnionWeatherDayImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String card,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class __$$DashboardResPageCardTileDataUnionWeatherDayImplCopyWithImpl<$Res>
    extends _$DashboardResPageCardTileDataUnionCopyWithImpl<$Res,
        _$DashboardResPageCardTileDataUnionWeatherDayImpl>
    implements
        _$$DashboardResPageCardTileDataUnionWeatherDayImplCopyWith<$Res> {
  __$$DashboardResPageCardTileDataUnionWeatherDayImplCopyWithImpl(
      _$DashboardResPageCardTileDataUnionWeatherDayImpl _value,
      $Res Function(_$DashboardResPageCardTileDataUnionWeatherDayImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardResPageCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? card = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_$DashboardResPageCardTileDataUnionWeatherDayImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardTileBaseDataSourceUnion>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      card: null == card
          ? _value.card
          : card // ignore: cast_nullable_to_non_nullable
              as String,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardResPageCardTileDataUnionWeatherDayImpl
    implements DashboardResPageCardTileDataUnionWeatherDay {
  const _$DashboardResPageCardTileDataUnionWeatherDayImpl(
      {required this.id,
      required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required this.card,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0})
      : _dataSource = dataSource;

  factory _$DashboardResPageCardTileDataUnionWeatherDayImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardResPageCardTileDataUnionWeatherDayImplFromJson(json);

  /// A unique identifier for the dashboard tile.
  @override
  final String id;

  /// Discriminator for the tile type
  @override
  final String type;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The timestamp when the dashboard tile was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the dashboard tile was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// The unique identifier of the associated card.
  @override
  final String card;

  /// The number of rows the tile spans.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  @override
  String toString() {
    return 'DashboardResPageCardTileDataUnion.weatherDay(id: $id, type: $type, row: $row, col: $col, dataSource: $dataSource, createdAt: $createdAt, updatedAt: $updatedAt, card: $card, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardResPageCardTileDataUnionWeatherDayImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.card, card) || other.card == card) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      type,
      row,
      col,
      const DeepCollectionEquality().hash(_dataSource),
      createdAt,
      updatedAt,
      card,
      rowSpan,
      colSpan);

  /// Create a copy of DashboardResPageCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardResPageCardTileDataUnionWeatherDayImplCopyWith<
          _$DashboardResPageCardTileDataUnionWeatherDayImpl>
      get copyWith =>
          __$$DashboardResPageCardTileDataUnionWeatherDayImplCopyWithImpl<
                  _$DashboardResPageCardTileDataUnionWeatherDayImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        devicePreview,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) {
    return weatherDay(id, type, row, col, dataSource, createdAt, updatedAt,
        card, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) {
    return weatherDay?.call(id, type, row, col, dataSource, createdAt,
        updatedAt, card, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherDay != null) {
      return weatherDay(id, type, row, col, dataSource, createdAt, updatedAt,
          card, rowSpan, colSpan);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardResPageCardTileDataUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardResPageCardTileDataUnionClock value)
        clock,
    required TResult Function(DashboardResPageCardTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardResPageCardTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return weatherDay(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardResPageCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardResPageCardTileDataUnionClock value)? clock,
    TResult? Function(DashboardResPageCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardResPageCardTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return weatherDay?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardResPageCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardResPageCardTileDataUnionClock value)? clock,
    TResult Function(DashboardResPageCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardResPageCardTileDataUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherDay != null) {
      return weatherDay(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardResPageCardTileDataUnionWeatherDayImplToJson(
      this,
    );
  }
}

abstract class DashboardResPageCardTileDataUnionWeatherDay
    implements DashboardResPageCardTileDataUnion {
  const factory DashboardResPageCardTileDataUnionWeatherDay(
          {required final String id,
          required final String type,
          required final int row,
          required final int col,
          @JsonKey(name: 'data_source')
          required final List<DashboardTileBaseDataSourceUnion> dataSource,
          @JsonKey(name: 'created_at') required final DateTime createdAt,
          @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
          required final String card,
          @JsonKey(name: 'row_span') final int rowSpan,
          @JsonKey(name: 'col_span') final int colSpan}) =
      _$DashboardResPageCardTileDataUnionWeatherDayImpl;

  factory DashboardResPageCardTileDataUnionWeatherDay.fromJson(
          Map<String, dynamic> json) =
      _$DashboardResPageCardTileDataUnionWeatherDayImpl.fromJson;

  /// A unique identifier for the dashboard tile.
  @override
  String get id;

  /// Discriminator for the tile type
  @override
  String get type;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource;

  /// The timestamp when the dashboard tile was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the dashboard tile was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// The unique identifier of the associated card.
  @override
  String get card;

  /// The number of rows the tile spans.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Create a copy of DashboardResPageCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardResPageCardTileDataUnionWeatherDayImplCopyWith<
          _$DashboardResPageCardTileDataUnionWeatherDayImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardResPageCardTileDataUnionWeatherForecastImplCopyWith<
    $Res> implements $DashboardResPageCardTileDataUnionCopyWith<$Res> {
  factory _$$DashboardResPageCardTileDataUnionWeatherForecastImplCopyWith(
          _$DashboardResPageCardTileDataUnionWeatherForecastImpl value,
          $Res Function(_$DashboardResPageCardTileDataUnionWeatherForecastImpl)
              then) =
      __$$DashboardResPageCardTileDataUnionWeatherForecastImplCopyWithImpl<
          $Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String card,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class __$$DashboardResPageCardTileDataUnionWeatherForecastImplCopyWithImpl<$Res>
    extends _$DashboardResPageCardTileDataUnionCopyWithImpl<$Res,
        _$DashboardResPageCardTileDataUnionWeatherForecastImpl>
    implements
        _$$DashboardResPageCardTileDataUnionWeatherForecastImplCopyWith<$Res> {
  __$$DashboardResPageCardTileDataUnionWeatherForecastImplCopyWithImpl(
      _$DashboardResPageCardTileDataUnionWeatherForecastImpl _value,
      $Res Function(_$DashboardResPageCardTileDataUnionWeatherForecastImpl)
          _then)
      : super(_value, _then);

  /// Create a copy of DashboardResPageCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? card = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_$DashboardResPageCardTileDataUnionWeatherForecastImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardTileBaseDataSourceUnion>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      card: null == card
          ? _value.card
          : card // ignore: cast_nullable_to_non_nullable
              as String,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardResPageCardTileDataUnionWeatherForecastImpl
    implements DashboardResPageCardTileDataUnionWeatherForecast {
  const _$DashboardResPageCardTileDataUnionWeatherForecastImpl(
      {required this.id,
      required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required this.card,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0})
      : _dataSource = dataSource;

  factory _$DashboardResPageCardTileDataUnionWeatherForecastImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardResPageCardTileDataUnionWeatherForecastImplFromJson(json);

  /// A unique identifier for the dashboard tile.
  @override
  final String id;

  /// Discriminator for the tile type
  @override
  final String type;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The timestamp when the dashboard tile was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the dashboard tile was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// The unique identifier of the associated card.
  @override
  final String card;

  /// The number of rows the tile spans.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  @override
  String toString() {
    return 'DashboardResPageCardTileDataUnion.weatherForecast(id: $id, type: $type, row: $row, col: $col, dataSource: $dataSource, createdAt: $createdAt, updatedAt: $updatedAt, card: $card, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardResPageCardTileDataUnionWeatherForecastImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.card, card) || other.card == card) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      type,
      row,
      col,
      const DeepCollectionEquality().hash(_dataSource),
      createdAt,
      updatedAt,
      card,
      rowSpan,
      colSpan);

  /// Create a copy of DashboardResPageCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardResPageCardTileDataUnionWeatherForecastImplCopyWith<
          _$DashboardResPageCardTileDataUnionWeatherForecastImpl>
      get copyWith =>
          __$$DashboardResPageCardTileDataUnionWeatherForecastImplCopyWithImpl<
                  _$DashboardResPageCardTileDataUnionWeatherForecastImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        devicePreview,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) {
    return weatherForecast(id, type, row, col, dataSource, createdAt, updatedAt,
        card, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) {
    return weatherForecast?.call(id, type, row, col, dataSource, createdAt,
        updatedAt, card, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String card,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherForecast != null) {
      return weatherForecast(id, type, row, col, dataSource, createdAt,
          updatedAt, card, rowSpan, colSpan);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardResPageCardTileDataUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardResPageCardTileDataUnionClock value)
        clock,
    required TResult Function(DashboardResPageCardTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardResPageCardTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return weatherForecast(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardResPageCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardResPageCardTileDataUnionClock value)? clock,
    TResult? Function(DashboardResPageCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardResPageCardTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return weatherForecast?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardResPageCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardResPageCardTileDataUnionClock value)? clock,
    TResult Function(DashboardResPageCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardResPageCardTileDataUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherForecast != null) {
      return weatherForecast(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardResPageCardTileDataUnionWeatherForecastImplToJson(
      this,
    );
  }
}

abstract class DashboardResPageCardTileDataUnionWeatherForecast
    implements DashboardResPageCardTileDataUnion {
  const factory DashboardResPageCardTileDataUnionWeatherForecast(
          {required final String id,
          required final String type,
          required final int row,
          required final int col,
          @JsonKey(name: 'data_source')
          required final List<DashboardTileBaseDataSourceUnion> dataSource,
          @JsonKey(name: 'created_at') required final DateTime createdAt,
          @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
          required final String card,
          @JsonKey(name: 'row_span') final int rowSpan,
          @JsonKey(name: 'col_span') final int colSpan}) =
      _$DashboardResPageCardTileDataUnionWeatherForecastImpl;

  factory DashboardResPageCardTileDataUnionWeatherForecast.fromJson(
          Map<String, dynamic> json) =
      _$DashboardResPageCardTileDataUnionWeatherForecastImpl.fromJson;

  /// A unique identifier for the dashboard tile.
  @override
  String get id;

  /// Discriminator for the tile type
  @override
  String get type;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource;

  /// The timestamp when the dashboard tile was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the dashboard tile was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// The unique identifier of the associated card.
  @override
  String get card;

  /// The number of rows the tile spans.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Create a copy of DashboardResPageCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardResPageCardTileDataUnionWeatherForecastImplCopyWith<
          _$DashboardResPageCardTileDataUnionWeatherForecastImpl>
      get copyWith => throw _privateConstructorUsedError;
}

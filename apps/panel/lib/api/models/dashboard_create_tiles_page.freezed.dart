// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_create_tiles_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCreateTilesPage _$DashboardCreateTilesPageFromJson(
    Map<String, dynamic> json) {
  return _DashboardCreateTilesPage.fromJson(json);
}

/// @nodoc
mixin _$DashboardCreateTilesPage {
  /// The unique identifier for the dashboard page (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the page type
  String get type => throw _privateConstructorUsedError;

  /// The title of the dashboard page.
  String get title => throw _privateConstructorUsedError;

  /// A list of data sources used by the page, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardCreateDataSource> get dataSource =>
      throw _privateConstructorUsedError;

  /// A list of tiles associated with the tiles page.
  List<DashboardCreateTile> get tiles => throw _privateConstructorUsedError;

  /// The position of the page in the dashboard’s list.
  int get order => throw _privateConstructorUsedError;

  /// The icon associated with the dashboard page.
  String? get icon => throw _privateConstructorUsedError;

  /// Serializes this DashboardCreateTilesPage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCreateTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCreateTilesPageCopyWith<DashboardCreateTilesPage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCreateTilesPageCopyWith<$Res> {
  factory $DashboardCreateTilesPageCopyWith(DashboardCreateTilesPage value,
          $Res Function(DashboardCreateTilesPage) then) =
      _$DashboardCreateTilesPageCopyWithImpl<$Res, DashboardCreateTilesPage>;
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      @JsonKey(name: 'data_source') List<DashboardCreateDataSource> dataSource,
      List<DashboardCreateTile> tiles,
      int order,
      String? icon});
}

/// @nodoc
class _$DashboardCreateTilesPageCopyWithImpl<$Res,
        $Val extends DashboardCreateTilesPage>
    implements $DashboardCreateTilesPageCopyWith<$Res> {
  _$DashboardCreateTilesPageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCreateTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? dataSource = null,
    Object? tiles = null,
    Object? order = null,
    Object? icon = freezed,
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
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateDataSource>,
      tiles: null == tiles
          ? _value.tiles
          : tiles // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTile>,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardCreateTilesPageImplCopyWith<$Res>
    implements $DashboardCreateTilesPageCopyWith<$Res> {
  factory _$$DashboardCreateTilesPageImplCopyWith(
          _$DashboardCreateTilesPageImpl value,
          $Res Function(_$DashboardCreateTilesPageImpl) then) =
      __$$DashboardCreateTilesPageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      @JsonKey(name: 'data_source') List<DashboardCreateDataSource> dataSource,
      List<DashboardCreateTile> tiles,
      int order,
      String? icon});
}

/// @nodoc
class __$$DashboardCreateTilesPageImplCopyWithImpl<$Res>
    extends _$DashboardCreateTilesPageCopyWithImpl<$Res,
        _$DashboardCreateTilesPageImpl>
    implements _$$DashboardCreateTilesPageImplCopyWith<$Res> {
  __$$DashboardCreateTilesPageImplCopyWithImpl(
      _$DashboardCreateTilesPageImpl _value,
      $Res Function(_$DashboardCreateTilesPageImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? dataSource = null,
    Object? tiles = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardCreateTilesPageImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateDataSource>,
      tiles: null == tiles
          ? _value._tiles
          : tiles // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTile>,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCreateTilesPageImpl implements _DashboardCreateTilesPage {
  const _$DashboardCreateTilesPageImpl(
      {required this.id,
      required this.type,
      required this.title,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateDataSource> dataSource,
      required final List<DashboardCreateTile> tiles,
      this.order = 0,
      this.icon})
      : _dataSource = dataSource,
        _tiles = tiles;

  factory _$DashboardCreateTilesPageImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardCreateTilesPageImplFromJson(json);

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  final String id;

  /// Discriminator for the page type
  @override
  final String type;

  /// The title of the dashboard page.
  @override
  final String title;

  /// A list of data sources used by the page, typically for real-time updates.
  final List<DashboardCreateDataSource> _dataSource;

  /// A list of data sources used by the page, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateDataSource> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// A list of tiles associated with the tiles page.
  final List<DashboardCreateTile> _tiles;

  /// A list of tiles associated with the tiles page.
  @override
  List<DashboardCreateTile> get tiles {
    if (_tiles is EqualUnmodifiableListView) return _tiles;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_tiles);
  }

  /// The position of the page in the dashboard’s list.
  @override
  @JsonKey()
  final int order;

  /// The icon associated with the dashboard page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardCreateTilesPage(id: $id, type: $type, title: $title, dataSource: $dataSource, tiles: $tiles, order: $order, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateTilesPageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            const DeepCollectionEquality().equals(other._tiles, _tiles) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      type,
      title,
      const DeepCollectionEquality().hash(_dataSource),
      const DeepCollectionEquality().hash(_tiles),
      order,
      icon);

  /// Create a copy of DashboardCreateTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateTilesPageImplCopyWith<_$DashboardCreateTilesPageImpl>
      get copyWith => __$$DashboardCreateTilesPageImplCopyWithImpl<
          _$DashboardCreateTilesPageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateTilesPageImplToJson(
      this,
    );
  }
}

abstract class _DashboardCreateTilesPage implements DashboardCreateTilesPage {
  const factory _DashboardCreateTilesPage(
      {required final String id,
      required final String type,
      required final String title,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateDataSource> dataSource,
      required final List<DashboardCreateTile> tiles,
      final int order,
      final String? icon}) = _$DashboardCreateTilesPageImpl;

  factory _DashboardCreateTilesPage.fromJson(Map<String, dynamic> json) =
      _$DashboardCreateTilesPageImpl.fromJson;

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  String get id;

  /// Discriminator for the page type
  @override
  String get type;

  /// The title of the dashboard page.
  @override
  String get title;

  /// A list of data sources used by the page, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateDataSource> get dataSource;

  /// A list of tiles associated with the tiles page.
  @override
  List<DashboardCreateTile> get tiles;

  /// The position of the page in the dashboard’s list.
  @override
  int get order;

  /// The icon associated with the dashboard page.
  @override
  String? get icon;

  /// Create a copy of DashboardCreateTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateTilesPageImplCopyWith<_$DashboardCreateTilesPageImpl>
      get copyWith => throw _privateConstructorUsedError;
}

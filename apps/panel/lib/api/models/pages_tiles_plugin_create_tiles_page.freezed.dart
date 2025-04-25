// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'pages_tiles_plugin_create_tiles_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

PagesTilesPluginCreateTilesPage _$PagesTilesPluginCreateTilesPageFromJson(
    Map<String, dynamic> json) {
  return _PagesTilesPluginCreateTilesPage.fromJson(json);
}

/// @nodoc
mixin _$PagesTilesPluginCreateTilesPage {
  /// The unique identifier for the dashboard page (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the page type
  String get type => throw _privateConstructorUsedError;

  /// The title of the dashboard page.
  String get title => throw _privateConstructorUsedError;

  /// A list of data sources used by the page, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardModuleCreateDataSource> get dataSource =>
      throw _privateConstructorUsedError;

  /// A list of tiles associated with the tiles page.
  List<DashboardModuleCreateTile> get tiles =>
      throw _privateConstructorUsedError;

  /// The position of the page in the dashboard’s list.
  int get order => throw _privateConstructorUsedError;

  /// The icon associated with the dashboard page.
  String? get icon => throw _privateConstructorUsedError;

  /// Serializes this PagesTilesPluginCreateTilesPage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PagesTilesPluginCreateTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PagesTilesPluginCreateTilesPageCopyWith<PagesTilesPluginCreateTilesPage>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PagesTilesPluginCreateTilesPageCopyWith<$Res> {
  factory $PagesTilesPluginCreateTilesPageCopyWith(
          PagesTilesPluginCreateTilesPage value,
          $Res Function(PagesTilesPluginCreateTilesPage) then) =
      _$PagesTilesPluginCreateTilesPageCopyWithImpl<$Res,
          PagesTilesPluginCreateTilesPage>;
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      @JsonKey(name: 'data_source')
      List<DashboardModuleCreateDataSource> dataSource,
      List<DashboardModuleCreateTile> tiles,
      int order,
      String? icon});
}

/// @nodoc
class _$PagesTilesPluginCreateTilesPageCopyWithImpl<$Res,
        $Val extends PagesTilesPluginCreateTilesPage>
    implements $PagesTilesPluginCreateTilesPageCopyWith<$Res> {
  _$PagesTilesPluginCreateTilesPageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PagesTilesPluginCreateTilesPage
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
              as List<DashboardModuleCreateDataSource>,
      tiles: null == tiles
          ? _value.tiles
          : tiles // ignore: cast_nullable_to_non_nullable
              as List<DashboardModuleCreateTile>,
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
abstract class _$$PagesTilesPluginCreateTilesPageImplCopyWith<$Res>
    implements $PagesTilesPluginCreateTilesPageCopyWith<$Res> {
  factory _$$PagesTilesPluginCreateTilesPageImplCopyWith(
          _$PagesTilesPluginCreateTilesPageImpl value,
          $Res Function(_$PagesTilesPluginCreateTilesPageImpl) then) =
      __$$PagesTilesPluginCreateTilesPageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      @JsonKey(name: 'data_source')
      List<DashboardModuleCreateDataSource> dataSource,
      List<DashboardModuleCreateTile> tiles,
      int order,
      String? icon});
}

/// @nodoc
class __$$PagesTilesPluginCreateTilesPageImplCopyWithImpl<$Res>
    extends _$PagesTilesPluginCreateTilesPageCopyWithImpl<$Res,
        _$PagesTilesPluginCreateTilesPageImpl>
    implements _$$PagesTilesPluginCreateTilesPageImplCopyWith<$Res> {
  __$$PagesTilesPluginCreateTilesPageImplCopyWithImpl(
      _$PagesTilesPluginCreateTilesPageImpl _value,
      $Res Function(_$PagesTilesPluginCreateTilesPageImpl) _then)
      : super(_value, _then);

  /// Create a copy of PagesTilesPluginCreateTilesPage
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
    return _then(_$PagesTilesPluginCreateTilesPageImpl(
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
              as List<DashboardModuleCreateDataSource>,
      tiles: null == tiles
          ? _value._tiles
          : tiles // ignore: cast_nullable_to_non_nullable
              as List<DashboardModuleCreateTile>,
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
class _$PagesTilesPluginCreateTilesPageImpl
    implements _PagesTilesPluginCreateTilesPage {
  const _$PagesTilesPluginCreateTilesPageImpl(
      {required this.id,
      required this.type,
      required this.title,
      @JsonKey(name: 'data_source')
      required final List<DashboardModuleCreateDataSource> dataSource,
      required final List<DashboardModuleCreateTile> tiles,
      this.order = 0,
      this.icon})
      : _dataSource = dataSource,
        _tiles = tiles;

  factory _$PagesTilesPluginCreateTilesPageImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$PagesTilesPluginCreateTilesPageImplFromJson(json);

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
  final List<DashboardModuleCreateDataSource> _dataSource;

  /// A list of data sources used by the page, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardModuleCreateDataSource> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// A list of tiles associated with the tiles page.
  final List<DashboardModuleCreateTile> _tiles;

  /// A list of tiles associated with the tiles page.
  @override
  List<DashboardModuleCreateTile> get tiles {
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
    return 'PagesTilesPluginCreateTilesPage(id: $id, type: $type, title: $title, dataSource: $dataSource, tiles: $tiles, order: $order, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PagesTilesPluginCreateTilesPageImpl &&
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

  /// Create a copy of PagesTilesPluginCreateTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PagesTilesPluginCreateTilesPageImplCopyWith<
          _$PagesTilesPluginCreateTilesPageImpl>
      get copyWith => __$$PagesTilesPluginCreateTilesPageImplCopyWithImpl<
          _$PagesTilesPluginCreateTilesPageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PagesTilesPluginCreateTilesPageImplToJson(
      this,
    );
  }
}

abstract class _PagesTilesPluginCreateTilesPage
    implements PagesTilesPluginCreateTilesPage {
  const factory _PagesTilesPluginCreateTilesPage(
      {required final String id,
      required final String type,
      required final String title,
      @JsonKey(name: 'data_source')
      required final List<DashboardModuleCreateDataSource> dataSource,
      required final List<DashboardModuleCreateTile> tiles,
      final int order,
      final String? icon}) = _$PagesTilesPluginCreateTilesPageImpl;

  factory _PagesTilesPluginCreateTilesPage.fromJson(Map<String, dynamic> json) =
      _$PagesTilesPluginCreateTilesPageImpl.fromJson;

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
  List<DashboardModuleCreateDataSource> get dataSource;

  /// A list of tiles associated with the tiles page.
  @override
  List<DashboardModuleCreateTile> get tiles;

  /// The position of the page in the dashboard’s list.
  @override
  int get order;

  /// The icon associated with the dashboard page.
  @override
  String? get icon;

  /// Create a copy of PagesTilesPluginCreateTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PagesTilesPluginCreateTilesPageImplCopyWith<
          _$PagesTilesPluginCreateTilesPageImpl>
      get copyWith => throw _privateConstructorUsedError;
}

// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_create_page_data_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqCreatePageDataUnion _$DashboardReqCreatePageDataUnionFromJson(
    Map<String, dynamic> json) {
  switch (json['type']) {
    case 'cards':
      return DashboardReqCreatePageDataUnionCards.fromJson(json);
    case 'tiles':
      return DashboardReqCreatePageDataUnionTiles.fromJson(json);
    case 'device-detail':
      return DashboardReqCreatePageDataUnionDeviceDetail.fromJson(json);

    default:
      throw CheckedFromJsonException(
          json,
          'type',
          'DashboardReqCreatePageDataUnion',
          'Invalid union type "${json['type']}"!');
  }
}

/// @nodoc
mixin _$DashboardReqCreatePageDataUnion {
  /// The unique identifier for the dashboard page (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the page type
  String get type => throw _privateConstructorUsedError;

  /// The title of the dashboard page.
  String get title => throw _privateConstructorUsedError;

  /// The position of the page in the dashboard’s list.
  int get order => throw _privateConstructorUsedError;

  /// The icon associated with the dashboard page.
  String? get icon => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            String title,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            int order,
            String? icon)
        cards,
    required TResult Function(
            String id,
            String type,
            String title,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            int order,
            String? icon)
        tiles,
    required TResult Function(String id, String type, String title,
            String device, int order, String? icon)
        deviceDetail,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            String title,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            int order,
            String? icon)?
        cards,
    TResult? Function(
            String id,
            String type,
            String title,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            int order,
            String? icon)?
        tiles,
    TResult? Function(String id, String type, String title, String device,
            int order, String? icon)?
        deviceDetail,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            String title,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            int order,
            String? icon)?
        cards,
    TResult Function(
            String id,
            String type,
            String title,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            int order,
            String? icon)?
        tiles,
    TResult Function(String id, String type, String title, String device,
            int order, String? icon)?
        deviceDetail,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqCreatePageDataUnionCards value) cards,
    required TResult Function(DashboardReqCreatePageDataUnionTiles value) tiles,
    required TResult Function(DashboardReqCreatePageDataUnionDeviceDetail value)
        deviceDetail,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreatePageDataUnionCards value)? cards,
    TResult? Function(DashboardReqCreatePageDataUnionTiles value)? tiles,
    TResult? Function(DashboardReqCreatePageDataUnionDeviceDetail value)?
        deviceDetail,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreatePageDataUnionCards value)? cards,
    TResult Function(DashboardReqCreatePageDataUnionTiles value)? tiles,
    TResult Function(DashboardReqCreatePageDataUnionDeviceDetail value)?
        deviceDetail,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardReqCreatePageDataUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqCreatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqCreatePageDataUnionCopyWith<DashboardReqCreatePageDataUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqCreatePageDataUnionCopyWith<$Res> {
  factory $DashboardReqCreatePageDataUnionCopyWith(
          DashboardReqCreatePageDataUnion value,
          $Res Function(DashboardReqCreatePageDataUnion) then) =
      _$DashboardReqCreatePageDataUnionCopyWithImpl<$Res,
          DashboardReqCreatePageDataUnion>;
  @useResult
  $Res call({String id, String type, String title, int order, String? icon});
}

/// @nodoc
class _$DashboardReqCreatePageDataUnionCopyWithImpl<$Res,
        $Val extends DashboardReqCreatePageDataUnion>
    implements $DashboardReqCreatePageDataUnionCopyWith<$Res> {
  _$DashboardReqCreatePageDataUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqCreatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
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
abstract class _$$DashboardReqCreatePageDataUnionCardsImplCopyWith<$Res>
    implements $DashboardReqCreatePageDataUnionCopyWith<$Res> {
  factory _$$DashboardReqCreatePageDataUnionCardsImplCopyWith(
          _$DashboardReqCreatePageDataUnionCardsImpl value,
          $Res Function(_$DashboardReqCreatePageDataUnionCardsImpl) then) =
      __$$DashboardReqCreatePageDataUnionCardsImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      List<DashboardCreateCard> cards,
      @JsonKey(name: 'data_source')
      List<DashboardCreateCardsPageDataSourceUnion> dataSource,
      int order,
      String? icon});
}

/// @nodoc
class __$$DashboardReqCreatePageDataUnionCardsImplCopyWithImpl<$Res>
    extends _$DashboardReqCreatePageDataUnionCopyWithImpl<$Res,
        _$DashboardReqCreatePageDataUnionCardsImpl>
    implements _$$DashboardReqCreatePageDataUnionCardsImplCopyWith<$Res> {
  __$$DashboardReqCreatePageDataUnionCardsImplCopyWithImpl(
      _$DashboardReqCreatePageDataUnionCardsImpl _value,
      $Res Function(_$DashboardReqCreatePageDataUnionCardsImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? cards = null,
    Object? dataSource = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardReqCreatePageDataUnionCardsImpl(
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
      cards: null == cards
          ? _value._cards
          : cards // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateCard>,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateCardsPageDataSourceUnion>,
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
class _$DashboardReqCreatePageDataUnionCardsImpl
    implements DashboardReqCreatePageDataUnionCards {
  const _$DashboardReqCreatePageDataUnionCardsImpl(
      {required this.id,
      required this.type,
      required this.title,
      required final List<DashboardCreateCard> cards,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateCardsPageDataSourceUnion> dataSource,
      this.order = 0,
      this.icon})
      : _cards = cards,
        _dataSource = dataSource;

  factory _$DashboardReqCreatePageDataUnionCardsImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreatePageDataUnionCardsImplFromJson(json);

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  final String id;

  /// Discriminator for the page type
  @override
  final String type;

  /// The title of the dashboard page.
  @override
  final String title;

  /// A list of cards associated with the page.
  final List<DashboardCreateCard> _cards;

  /// A list of cards associated with the page.
  @override
  List<DashboardCreateCard> get cards {
    if (_cards is EqualUnmodifiableListView) return _cards;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_cards);
  }

  /// A list of data sources associated with the page.
  final List<DashboardCreateCardsPageDataSourceUnion> _dataSource;

  /// A list of data sources associated with the page.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateCardsPageDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
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
    return 'DashboardReqCreatePageDataUnion.cards(id: $id, type: $type, title: $title, cards: $cards, dataSource: $dataSource, order: $order, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreatePageDataUnionCardsImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            const DeepCollectionEquality().equals(other._cards, _cards) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
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
      const DeepCollectionEquality().hash(_cards),
      const DeepCollectionEquality().hash(_dataSource),
      order,
      icon);

  /// Create a copy of DashboardReqCreatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreatePageDataUnionCardsImplCopyWith<
          _$DashboardReqCreatePageDataUnionCardsImpl>
      get copyWith => __$$DashboardReqCreatePageDataUnionCardsImplCopyWithImpl<
          _$DashboardReqCreatePageDataUnionCardsImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            String title,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            int order,
            String? icon)
        cards,
    required TResult Function(
            String id,
            String type,
            String title,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            int order,
            String? icon)
        tiles,
    required TResult Function(String id, String type, String title,
            String device, int order, String? icon)
        deviceDetail,
  }) {
    return cards(id, type, title, this.cards, dataSource, order, icon);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            String title,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            int order,
            String? icon)?
        cards,
    TResult? Function(
            String id,
            String type,
            String title,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            int order,
            String? icon)?
        tiles,
    TResult? Function(String id, String type, String title, String device,
            int order, String? icon)?
        deviceDetail,
  }) {
    return cards?.call(id, type, title, this.cards, dataSource, order, icon);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            String title,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            int order,
            String? icon)?
        cards,
    TResult Function(
            String id,
            String type,
            String title,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            int order,
            String? icon)?
        tiles,
    TResult Function(String id, String type, String title, String device,
            int order, String? icon)?
        deviceDetail,
    required TResult orElse(),
  }) {
    if (cards != null) {
      return cards(id, type, title, this.cards, dataSource, order, icon);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqCreatePageDataUnionCards value) cards,
    required TResult Function(DashboardReqCreatePageDataUnionTiles value) tiles,
    required TResult Function(DashboardReqCreatePageDataUnionDeviceDetail value)
        deviceDetail,
  }) {
    return cards(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreatePageDataUnionCards value)? cards,
    TResult? Function(DashboardReqCreatePageDataUnionTiles value)? tiles,
    TResult? Function(DashboardReqCreatePageDataUnionDeviceDetail value)?
        deviceDetail,
  }) {
    return cards?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreatePageDataUnionCards value)? cards,
    TResult Function(DashboardReqCreatePageDataUnionTiles value)? tiles,
    TResult Function(DashboardReqCreatePageDataUnionDeviceDetail value)?
        deviceDetail,
    required TResult orElse(),
  }) {
    if (cards != null) {
      return cards(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqCreatePageDataUnionCardsImplToJson(
      this,
    );
  }
}

abstract class DashboardReqCreatePageDataUnionCards
    implements DashboardReqCreatePageDataUnion {
  const factory DashboardReqCreatePageDataUnionCards(
      {required final String id,
      required final String type,
      required final String title,
      required final List<DashboardCreateCard> cards,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateCardsPageDataSourceUnion> dataSource,
      final int order,
      final String? icon}) = _$DashboardReqCreatePageDataUnionCardsImpl;

  factory DashboardReqCreatePageDataUnionCards.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreatePageDataUnionCardsImpl.fromJson;

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  String get id;

  /// Discriminator for the page type
  @override
  String get type;

  /// The title of the dashboard page.
  @override
  String get title;

  /// A list of cards associated with the page.
  List<DashboardCreateCard> get cards;

  /// A list of data sources associated with the page.
  @JsonKey(name: 'data_source')
  List<DashboardCreateCardsPageDataSourceUnion> get dataSource;

  /// The position of the page in the dashboard’s list.
  @override
  int get order;

  /// The icon associated with the dashboard page.
  @override
  String? get icon;

  /// Create a copy of DashboardReqCreatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreatePageDataUnionCardsImplCopyWith<
          _$DashboardReqCreatePageDataUnionCardsImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardReqCreatePageDataUnionTilesImplCopyWith<$Res>
    implements $DashboardReqCreatePageDataUnionCopyWith<$Res> {
  factory _$$DashboardReqCreatePageDataUnionTilesImplCopyWith(
          _$DashboardReqCreatePageDataUnionTilesImpl value,
          $Res Function(_$DashboardReqCreatePageDataUnionTilesImpl) then) =
      __$$DashboardReqCreatePageDataUnionTilesImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      List<DashboardCreateTilesPageTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTilesPageDataSourceUnion> dataSource,
      int order,
      String? icon});
}

/// @nodoc
class __$$DashboardReqCreatePageDataUnionTilesImplCopyWithImpl<$Res>
    extends _$DashboardReqCreatePageDataUnionCopyWithImpl<$Res,
        _$DashboardReqCreatePageDataUnionTilesImpl>
    implements _$$DashboardReqCreatePageDataUnionTilesImplCopyWith<$Res> {
  __$$DashboardReqCreatePageDataUnionTilesImplCopyWithImpl(
      _$DashboardReqCreatePageDataUnionTilesImpl _value,
      $Res Function(_$DashboardReqCreatePageDataUnionTilesImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? tiles = null,
    Object? dataSource = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardReqCreatePageDataUnionTilesImpl(
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
      tiles: null == tiles
          ? _value._tiles
          : tiles // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTilesPageTilesUnion>,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTilesPageDataSourceUnion>,
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
class _$DashboardReqCreatePageDataUnionTilesImpl
    implements DashboardReqCreatePageDataUnionTiles {
  const _$DashboardReqCreatePageDataUnionTilesImpl(
      {required this.id,
      required this.type,
      required this.title,
      required final List<DashboardCreateTilesPageTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTilesPageDataSourceUnion> dataSource,
      this.order = 0,
      this.icon})
      : _tiles = tiles,
        _dataSource = dataSource;

  factory _$DashboardReqCreatePageDataUnionTilesImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreatePageDataUnionTilesImplFromJson(json);

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  final String id;

  /// Discriminator for the page type
  @override
  final String type;

  /// The title of the dashboard page.
  @override
  final String title;

  /// A list of tiles associated with the tiles page.
  final List<DashboardCreateTilesPageTilesUnion> _tiles;

  /// A list of tiles associated with the tiles page.
  @override
  List<DashboardCreateTilesPageTilesUnion> get tiles {
    if (_tiles is EqualUnmodifiableListView) return _tiles;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_tiles);
  }

  /// A list of data sources associated with the tiles page.
  final List<DashboardCreateTilesPageDataSourceUnion> _dataSource;

  /// A list of data sources associated with the tiles page.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTilesPageDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
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
    return 'DashboardReqCreatePageDataUnion.tiles(id: $id, type: $type, title: $title, tiles: $tiles, dataSource: $dataSource, order: $order, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreatePageDataUnionTilesImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            const DeepCollectionEquality().equals(other._tiles, _tiles) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
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
      const DeepCollectionEquality().hash(_tiles),
      const DeepCollectionEquality().hash(_dataSource),
      order,
      icon);

  /// Create a copy of DashboardReqCreatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreatePageDataUnionTilesImplCopyWith<
          _$DashboardReqCreatePageDataUnionTilesImpl>
      get copyWith => __$$DashboardReqCreatePageDataUnionTilesImplCopyWithImpl<
          _$DashboardReqCreatePageDataUnionTilesImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            String title,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            int order,
            String? icon)
        cards,
    required TResult Function(
            String id,
            String type,
            String title,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            int order,
            String? icon)
        tiles,
    required TResult Function(String id, String type, String title,
            String device, int order, String? icon)
        deviceDetail,
  }) {
    return tiles(id, type, title, this.tiles, dataSource, order, icon);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            String title,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            int order,
            String? icon)?
        cards,
    TResult? Function(
            String id,
            String type,
            String title,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            int order,
            String? icon)?
        tiles,
    TResult? Function(String id, String type, String title, String device,
            int order, String? icon)?
        deviceDetail,
  }) {
    return tiles?.call(id, type, title, this.tiles, dataSource, order, icon);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            String title,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            int order,
            String? icon)?
        cards,
    TResult Function(
            String id,
            String type,
            String title,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            int order,
            String? icon)?
        tiles,
    TResult Function(String id, String type, String title, String device,
            int order, String? icon)?
        deviceDetail,
    required TResult orElse(),
  }) {
    if (tiles != null) {
      return tiles(id, type, title, this.tiles, dataSource, order, icon);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqCreatePageDataUnionCards value) cards,
    required TResult Function(DashboardReqCreatePageDataUnionTiles value) tiles,
    required TResult Function(DashboardReqCreatePageDataUnionDeviceDetail value)
        deviceDetail,
  }) {
    return tiles(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreatePageDataUnionCards value)? cards,
    TResult? Function(DashboardReqCreatePageDataUnionTiles value)? tiles,
    TResult? Function(DashboardReqCreatePageDataUnionDeviceDetail value)?
        deviceDetail,
  }) {
    return tiles?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreatePageDataUnionCards value)? cards,
    TResult Function(DashboardReqCreatePageDataUnionTiles value)? tiles,
    TResult Function(DashboardReqCreatePageDataUnionDeviceDetail value)?
        deviceDetail,
    required TResult orElse(),
  }) {
    if (tiles != null) {
      return tiles(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqCreatePageDataUnionTilesImplToJson(
      this,
    );
  }
}

abstract class DashboardReqCreatePageDataUnionTiles
    implements DashboardReqCreatePageDataUnion {
  const factory DashboardReqCreatePageDataUnionTiles(
      {required final String id,
      required final String type,
      required final String title,
      required final List<DashboardCreateTilesPageTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTilesPageDataSourceUnion> dataSource,
      final int order,
      final String? icon}) = _$DashboardReqCreatePageDataUnionTilesImpl;

  factory DashboardReqCreatePageDataUnionTiles.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreatePageDataUnionTilesImpl.fromJson;

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  String get id;

  /// Discriminator for the page type
  @override
  String get type;

  /// The title of the dashboard page.
  @override
  String get title;

  /// A list of tiles associated with the tiles page.
  List<DashboardCreateTilesPageTilesUnion> get tiles;

  /// A list of data sources associated with the tiles page.
  @JsonKey(name: 'data_source')
  List<DashboardCreateTilesPageDataSourceUnion> get dataSource;

  /// The position of the page in the dashboard’s list.
  @override
  int get order;

  /// The icon associated with the dashboard page.
  @override
  String? get icon;

  /// Create a copy of DashboardReqCreatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreatePageDataUnionTilesImplCopyWith<
          _$DashboardReqCreatePageDataUnionTilesImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardReqCreatePageDataUnionDeviceDetailImplCopyWith<$Res>
    implements $DashboardReqCreatePageDataUnionCopyWith<$Res> {
  factory _$$DashboardReqCreatePageDataUnionDeviceDetailImplCopyWith(
          _$DashboardReqCreatePageDataUnionDeviceDetailImpl value,
          $Res Function(_$DashboardReqCreatePageDataUnionDeviceDetailImpl)
              then) =
      __$$DashboardReqCreatePageDataUnionDeviceDetailImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      String device,
      int order,
      String? icon});
}

/// @nodoc
class __$$DashboardReqCreatePageDataUnionDeviceDetailImplCopyWithImpl<$Res>
    extends _$DashboardReqCreatePageDataUnionCopyWithImpl<$Res,
        _$DashboardReqCreatePageDataUnionDeviceDetailImpl>
    implements
        _$$DashboardReqCreatePageDataUnionDeviceDetailImplCopyWith<$Res> {
  __$$DashboardReqCreatePageDataUnionDeviceDetailImplCopyWithImpl(
      _$DashboardReqCreatePageDataUnionDeviceDetailImpl _value,
      $Res Function(_$DashboardReqCreatePageDataUnionDeviceDetailImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? device = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardReqCreatePageDataUnionDeviceDetailImpl(
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
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
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
class _$DashboardReqCreatePageDataUnionDeviceDetailImpl
    implements DashboardReqCreatePageDataUnionDeviceDetail {
  const _$DashboardReqCreatePageDataUnionDeviceDetailImpl(
      {required this.id,
      required this.type,
      required this.title,
      required this.device,
      this.order = 0,
      this.icon});

  factory _$DashboardReqCreatePageDataUnionDeviceDetailImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreatePageDataUnionDeviceDetailImplFromJson(json);

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  final String id;

  /// Discriminator for the page type
  @override
  final String type;

  /// The title of the dashboard page.
  @override
  final String title;

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// The position of the page in the dashboard’s list.
  @override
  @JsonKey()
  final int order;

  /// The icon associated with the dashboard page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardReqCreatePageDataUnion.deviceDetail(id: $id, type: $type, title: $title, device: $device, order: $order, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreatePageDataUnionDeviceDetailImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, type, title, device, order, icon);

  /// Create a copy of DashboardReqCreatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreatePageDataUnionDeviceDetailImplCopyWith<
          _$DashboardReqCreatePageDataUnionDeviceDetailImpl>
      get copyWith =>
          __$$DashboardReqCreatePageDataUnionDeviceDetailImplCopyWithImpl<
                  _$DashboardReqCreatePageDataUnionDeviceDetailImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            String title,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            int order,
            String? icon)
        cards,
    required TResult Function(
            String id,
            String type,
            String title,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            int order,
            String? icon)
        tiles,
    required TResult Function(String id, String type, String title,
            String device, int order, String? icon)
        deviceDetail,
  }) {
    return deviceDetail(id, type, title, device, order, icon);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            String title,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            int order,
            String? icon)?
        cards,
    TResult? Function(
            String id,
            String type,
            String title,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            int order,
            String? icon)?
        tiles,
    TResult? Function(String id, String type, String title, String device,
            int order, String? icon)?
        deviceDetail,
  }) {
    return deviceDetail?.call(id, type, title, device, order, icon);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            String title,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            int order,
            String? icon)?
        cards,
    TResult Function(
            String id,
            String type,
            String title,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            int order,
            String? icon)?
        tiles,
    TResult Function(String id, String type, String title, String device,
            int order, String? icon)?
        deviceDetail,
    required TResult orElse(),
  }) {
    if (deviceDetail != null) {
      return deviceDetail(id, type, title, device, order, icon);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqCreatePageDataUnionCards value) cards,
    required TResult Function(DashboardReqCreatePageDataUnionTiles value) tiles,
    required TResult Function(DashboardReqCreatePageDataUnionDeviceDetail value)
        deviceDetail,
  }) {
    return deviceDetail(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreatePageDataUnionCards value)? cards,
    TResult? Function(DashboardReqCreatePageDataUnionTiles value)? tiles,
    TResult? Function(DashboardReqCreatePageDataUnionDeviceDetail value)?
        deviceDetail,
  }) {
    return deviceDetail?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreatePageDataUnionCards value)? cards,
    TResult Function(DashboardReqCreatePageDataUnionTiles value)? tiles,
    TResult Function(DashboardReqCreatePageDataUnionDeviceDetail value)?
        deviceDetail,
    required TResult orElse(),
  }) {
    if (deviceDetail != null) {
      return deviceDetail(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqCreatePageDataUnionDeviceDetailImplToJson(
      this,
    );
  }
}

abstract class DashboardReqCreatePageDataUnionDeviceDetail
    implements DashboardReqCreatePageDataUnion {
  const factory DashboardReqCreatePageDataUnionDeviceDetail(
      {required final String id,
      required final String type,
      required final String title,
      required final String device,
      final int order,
      final String? icon}) = _$DashboardReqCreatePageDataUnionDeviceDetailImpl;

  factory DashboardReqCreatePageDataUnionDeviceDetail.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreatePageDataUnionDeviceDetailImpl.fromJson;

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  String get id;

  /// Discriminator for the page type
  @override
  String get type;

  /// The title of the dashboard page.
  @override
  String get title;

  /// The unique identifier of the associated device.
  String get device;

  /// The position of the page in the dashboard’s list.
  @override
  int get order;

  /// The icon associated with the dashboard page.
  @override
  String? get icon;

  /// Create a copy of DashboardReqCreatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreatePageDataUnionDeviceDetailImplCopyWith<
          _$DashboardReqCreatePageDataUnionDeviceDetailImpl>
      get copyWith => throw _privateConstructorUsedError;
}

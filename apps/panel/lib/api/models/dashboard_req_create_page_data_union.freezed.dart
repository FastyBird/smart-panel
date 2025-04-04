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
    case 'device':
      return DashboardReqCreatePageDataUnionDevice.fromJson(json);

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

  /// The title of the dashboard page.
  String get title => throw _privateConstructorUsedError;

  /// The position of the page in the dashboard’s list.
  int get order => throw _privateConstructorUsedError;

  /// Indicates that this is a cards dashboard page.
  String get type => throw _privateConstructorUsedError;

  /// The icon associated with the dashboard page.
  String? get icon => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String title,
            int order,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            String type,
            String? icon)
        cards,
    required TResult Function(
            String id,
            String title,
            int order,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            String type,
            String? icon)
        tiles,
    required TResult Function(String id, String title, int order, String device,
            String type, String? icon)
        device,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String title,
            int order,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            String type,
            String? icon)?
        cards,
    TResult? Function(
            String id,
            String title,
            int order,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            String type,
            String? icon)?
        tiles,
    TResult? Function(String id, String title, int order, String device,
            String type, String? icon)?
        device,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String title,
            int order,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            String type,
            String? icon)?
        cards,
    TResult Function(
            String id,
            String title,
            int order,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            String type,
            String? icon)?
        tiles,
    TResult Function(String id, String title, int order, String device,
            String type, String? icon)?
        device,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqCreatePageDataUnionCards value) cards,
    required TResult Function(DashboardReqCreatePageDataUnionTiles value) tiles,
    required TResult Function(DashboardReqCreatePageDataUnionDevice value)
        device,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreatePageDataUnionCards value)? cards,
    TResult? Function(DashboardReqCreatePageDataUnionTiles value)? tiles,
    TResult? Function(DashboardReqCreatePageDataUnionDevice value)? device,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreatePageDataUnionCards value)? cards,
    TResult Function(DashboardReqCreatePageDataUnionTiles value)? tiles,
    TResult Function(DashboardReqCreatePageDataUnionDevice value)? device,
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
  $Res call({String id, String title, int order, String type, String? icon});
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
    Object? title = null,
    Object? order = null,
    Object? type = null,
    Object? icon = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
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
      String title,
      int order,
      List<DashboardCreateCard> cards,
      @JsonKey(name: 'data_source')
      List<DashboardCreateCardsPageDataSourceUnion> dataSource,
      String type,
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
    Object? title = null,
    Object? order = null,
    Object? cards = null,
    Object? dataSource = null,
    Object? type = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardReqCreatePageDataUnionCardsImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      cards: null == cards
          ? _value._cards
          : cards // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateCard>,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateCardsPageDataSourceUnion>,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
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
      required this.title,
      required this.order,
      required final List<DashboardCreateCard> cards,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateCardsPageDataSourceUnion> dataSource,
      this.type = 'cards',
      this.icon})
      : _cards = cards,
        _dataSource = dataSource;

  factory _$DashboardReqCreatePageDataUnionCardsImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreatePageDataUnionCardsImplFromJson(json);

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  final String id;

  /// The title of the dashboard page.
  @override
  final String title;

  /// The position of the page in the dashboard’s list.
  @override
  final int order;

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

  /// Indicates that this is a cards dashboard page.
  @override
  @JsonKey()
  final String type;

  /// The icon associated with the dashboard page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardReqCreatePageDataUnion.cards(id: $id, title: $title, order: $order, cards: $cards, dataSource: $dataSource, type: $type, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreatePageDataUnionCardsImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            const DeepCollectionEquality().equals(other._cards, _cards) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      title,
      order,
      const DeepCollectionEquality().hash(_cards),
      const DeepCollectionEquality().hash(_dataSource),
      type,
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
            String title,
            int order,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            String type,
            String? icon)
        cards,
    required TResult Function(
            String id,
            String title,
            int order,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            String type,
            String? icon)
        tiles,
    required TResult Function(String id, String title, int order, String device,
            String type, String? icon)
        device,
  }) {
    return cards(id, title, order, this.cards, dataSource, type, icon);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String title,
            int order,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            String type,
            String? icon)?
        cards,
    TResult? Function(
            String id,
            String title,
            int order,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            String type,
            String? icon)?
        tiles,
    TResult? Function(String id, String title, int order, String device,
            String type, String? icon)?
        device,
  }) {
    return cards?.call(id, title, order, this.cards, dataSource, type, icon);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String title,
            int order,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            String type,
            String? icon)?
        cards,
    TResult Function(
            String id,
            String title,
            int order,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            String type,
            String? icon)?
        tiles,
    TResult Function(String id, String title, int order, String device,
            String type, String? icon)?
        device,
    required TResult orElse(),
  }) {
    if (cards != null) {
      return cards(id, title, order, this.cards, dataSource, type, icon);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqCreatePageDataUnionCards value) cards,
    required TResult Function(DashboardReqCreatePageDataUnionTiles value) tiles,
    required TResult Function(DashboardReqCreatePageDataUnionDevice value)
        device,
  }) {
    return cards(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreatePageDataUnionCards value)? cards,
    TResult? Function(DashboardReqCreatePageDataUnionTiles value)? tiles,
    TResult? Function(DashboardReqCreatePageDataUnionDevice value)? device,
  }) {
    return cards?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreatePageDataUnionCards value)? cards,
    TResult Function(DashboardReqCreatePageDataUnionTiles value)? tiles,
    TResult Function(DashboardReqCreatePageDataUnionDevice value)? device,
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
      required final String title,
      required final int order,
      required final List<DashboardCreateCard> cards,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateCardsPageDataSourceUnion> dataSource,
      final String type,
      final String? icon}) = _$DashboardReqCreatePageDataUnionCardsImpl;

  factory DashboardReqCreatePageDataUnionCards.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreatePageDataUnionCardsImpl.fromJson;

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  String get id;

  /// The title of the dashboard page.
  @override
  String get title;

  /// The position of the page in the dashboard’s list.
  @override
  int get order;

  /// A list of cards associated with the page.
  List<DashboardCreateCard> get cards;

  /// A list of data sources associated with the page.
  @JsonKey(name: 'data_source')
  List<DashboardCreateCardsPageDataSourceUnion> get dataSource;

  /// Indicates that this is a cards dashboard page.
  @override
  String get type;

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
      String title,
      int order,
      List<DashboardCreateTilesPageTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTilesPageDataSourceUnion> dataSource,
      String type,
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
    Object? title = null,
    Object? order = null,
    Object? tiles = null,
    Object? dataSource = null,
    Object? type = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardReqCreatePageDataUnionTilesImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      tiles: null == tiles
          ? _value._tiles
          : tiles // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTilesPageTilesUnion>,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTilesPageDataSourceUnion>,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
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
      required this.title,
      required this.order,
      required final List<DashboardCreateTilesPageTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTilesPageDataSourceUnion> dataSource,
      this.type = 'tiles',
      this.icon})
      : _tiles = tiles,
        _dataSource = dataSource;

  factory _$DashboardReqCreatePageDataUnionTilesImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreatePageDataUnionTilesImplFromJson(json);

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  final String id;

  /// The title of the dashboard page.
  @override
  final String title;

  /// The position of the page in the dashboard’s list.
  @override
  final int order;

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

  /// Indicates that this is a tiles dashboard page.
  @override
  @JsonKey()
  final String type;

  /// The icon associated with the dashboard page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardReqCreatePageDataUnion.tiles(id: $id, title: $title, order: $order, tiles: $tiles, dataSource: $dataSource, type: $type, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreatePageDataUnionTilesImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            const DeepCollectionEquality().equals(other._tiles, _tiles) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      title,
      order,
      const DeepCollectionEquality().hash(_tiles),
      const DeepCollectionEquality().hash(_dataSource),
      type,
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
            String title,
            int order,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            String type,
            String? icon)
        cards,
    required TResult Function(
            String id,
            String title,
            int order,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            String type,
            String? icon)
        tiles,
    required TResult Function(String id, String title, int order, String device,
            String type, String? icon)
        device,
  }) {
    return tiles(id, title, order, this.tiles, dataSource, type, icon);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String title,
            int order,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            String type,
            String? icon)?
        cards,
    TResult? Function(
            String id,
            String title,
            int order,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            String type,
            String? icon)?
        tiles,
    TResult? Function(String id, String title, int order, String device,
            String type, String? icon)?
        device,
  }) {
    return tiles?.call(id, title, order, this.tiles, dataSource, type, icon);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String title,
            int order,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            String type,
            String? icon)?
        cards,
    TResult Function(
            String id,
            String title,
            int order,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            String type,
            String? icon)?
        tiles,
    TResult Function(String id, String title, int order, String device,
            String type, String? icon)?
        device,
    required TResult orElse(),
  }) {
    if (tiles != null) {
      return tiles(id, title, order, this.tiles, dataSource, type, icon);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqCreatePageDataUnionCards value) cards,
    required TResult Function(DashboardReqCreatePageDataUnionTiles value) tiles,
    required TResult Function(DashboardReqCreatePageDataUnionDevice value)
        device,
  }) {
    return tiles(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreatePageDataUnionCards value)? cards,
    TResult? Function(DashboardReqCreatePageDataUnionTiles value)? tiles,
    TResult? Function(DashboardReqCreatePageDataUnionDevice value)? device,
  }) {
    return tiles?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreatePageDataUnionCards value)? cards,
    TResult Function(DashboardReqCreatePageDataUnionTiles value)? tiles,
    TResult Function(DashboardReqCreatePageDataUnionDevice value)? device,
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
      required final String title,
      required final int order,
      required final List<DashboardCreateTilesPageTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTilesPageDataSourceUnion> dataSource,
      final String type,
      final String? icon}) = _$DashboardReqCreatePageDataUnionTilesImpl;

  factory DashboardReqCreatePageDataUnionTiles.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreatePageDataUnionTilesImpl.fromJson;

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  String get id;

  /// The title of the dashboard page.
  @override
  String get title;

  /// The position of the page in the dashboard’s list.
  @override
  int get order;

  /// A list of tiles associated with the tiles page.
  List<DashboardCreateTilesPageTilesUnion> get tiles;

  /// A list of data sources associated with the tiles page.
  @JsonKey(name: 'data_source')
  List<DashboardCreateTilesPageDataSourceUnion> get dataSource;

  /// Indicates that this is a tiles dashboard page.
  @override
  String get type;

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
abstract class _$$DashboardReqCreatePageDataUnionDeviceImplCopyWith<$Res>
    implements $DashboardReqCreatePageDataUnionCopyWith<$Res> {
  factory _$$DashboardReqCreatePageDataUnionDeviceImplCopyWith(
          _$DashboardReqCreatePageDataUnionDeviceImpl value,
          $Res Function(_$DashboardReqCreatePageDataUnionDeviceImpl) then) =
      __$$DashboardReqCreatePageDataUnionDeviceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      int order,
      String device,
      String type,
      String? icon});
}

/// @nodoc
class __$$DashboardReqCreatePageDataUnionDeviceImplCopyWithImpl<$Res>
    extends _$DashboardReqCreatePageDataUnionCopyWithImpl<$Res,
        _$DashboardReqCreatePageDataUnionDeviceImpl>
    implements _$$DashboardReqCreatePageDataUnionDeviceImplCopyWith<$Res> {
  __$$DashboardReqCreatePageDataUnionDeviceImplCopyWithImpl(
      _$DashboardReqCreatePageDataUnionDeviceImpl _value,
      $Res Function(_$DashboardReqCreatePageDataUnionDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? order = null,
    Object? device = null,
    Object? type = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardReqCreatePageDataUnionDeviceImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqCreatePageDataUnionDeviceImpl
    implements DashboardReqCreatePageDataUnionDevice {
  const _$DashboardReqCreatePageDataUnionDeviceImpl(
      {required this.id,
      required this.title,
      required this.order,
      required this.device,
      this.type = 'device',
      this.icon});

  factory _$DashboardReqCreatePageDataUnionDeviceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreatePageDataUnionDeviceImplFromJson(json);

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  final String id;

  /// The title of the dashboard page.
  @override
  final String title;

  /// The position of the page in the dashboard’s list.
  @override
  final int order;

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// Indicates that this is a device-specific dashboard page.
  @override
  @JsonKey()
  final String type;

  /// The icon associated with the dashboard page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardReqCreatePageDataUnion.device(id: $id, title: $title, order: $order, device: $device, type: $type, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreatePageDataUnionDeviceImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, title, order, device, type, icon);

  /// Create a copy of DashboardReqCreatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreatePageDataUnionDeviceImplCopyWith<
          _$DashboardReqCreatePageDataUnionDeviceImpl>
      get copyWith => __$$DashboardReqCreatePageDataUnionDeviceImplCopyWithImpl<
          _$DashboardReqCreatePageDataUnionDeviceImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String title,
            int order,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            String type,
            String? icon)
        cards,
    required TResult Function(
            String id,
            String title,
            int order,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            String type,
            String? icon)
        tiles,
    required TResult Function(String id, String title, int order, String device,
            String type, String? icon)
        device,
  }) {
    return device(id, title, order, this.device, type, icon);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String title,
            int order,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            String type,
            String? icon)?
        cards,
    TResult? Function(
            String id,
            String title,
            int order,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            String type,
            String? icon)?
        tiles,
    TResult? Function(String id, String title, int order, String device,
            String type, String? icon)?
        device,
  }) {
    return device?.call(id, title, order, this.device, type, icon);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String title,
            int order,
            List<DashboardCreateCard> cards,
            @JsonKey(name: 'data_source')
            List<DashboardCreateCardsPageDataSourceUnion> dataSource,
            String type,
            String? icon)?
        cards,
    TResult Function(
            String id,
            String title,
            int order,
            List<DashboardCreateTilesPageTilesUnion> tiles,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTilesPageDataSourceUnion> dataSource,
            String type,
            String? icon)?
        tiles,
    TResult Function(String id, String title, int order, String device,
            String type, String? icon)?
        device,
    required TResult orElse(),
  }) {
    if (device != null) {
      return device(id, title, order, this.device, type, icon);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqCreatePageDataUnionCards value) cards,
    required TResult Function(DashboardReqCreatePageDataUnionTiles value) tiles,
    required TResult Function(DashboardReqCreatePageDataUnionDevice value)
        device,
  }) {
    return device(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreatePageDataUnionCards value)? cards,
    TResult? Function(DashboardReqCreatePageDataUnionTiles value)? tiles,
    TResult? Function(DashboardReqCreatePageDataUnionDevice value)? device,
  }) {
    return device?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreatePageDataUnionCards value)? cards,
    TResult Function(DashboardReqCreatePageDataUnionTiles value)? tiles,
    TResult Function(DashboardReqCreatePageDataUnionDevice value)? device,
    required TResult orElse(),
  }) {
    if (device != null) {
      return device(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqCreatePageDataUnionDeviceImplToJson(
      this,
    );
  }
}

abstract class DashboardReqCreatePageDataUnionDevice
    implements DashboardReqCreatePageDataUnion {
  const factory DashboardReqCreatePageDataUnionDevice(
      {required final String id,
      required final String title,
      required final int order,
      required final String device,
      final String type,
      final String? icon}) = _$DashboardReqCreatePageDataUnionDeviceImpl;

  factory DashboardReqCreatePageDataUnionDevice.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreatePageDataUnionDeviceImpl.fromJson;

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  String get id;

  /// The title of the dashboard page.
  @override
  String get title;

  /// The position of the page in the dashboard’s list.
  @override
  int get order;

  /// The unique identifier of the associated device.
  String get device;

  /// Indicates that this is a device-specific dashboard page.
  @override
  String get type;

  /// The icon associated with the dashboard page.
  @override
  String? get icon;

  /// Create a copy of DashboardReqCreatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreatePageDataUnionDeviceImplCopyWith<
          _$DashboardReqCreatePageDataUnionDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}

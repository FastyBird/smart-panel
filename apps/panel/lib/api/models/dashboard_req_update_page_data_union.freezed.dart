// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_update_page_data_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqUpdatePageDataUnion _$DashboardReqUpdatePageDataUnionFromJson(
    Map<String, dynamic> json) {
  switch (json['type']) {
    case 'cards':
      return DashboardReqUpdatePageDataUnionCards.fromJson(json);
    case 'tiles':
      return DashboardReqUpdatePageDataUnionTiles.fromJson(json);
    case 'device':
      return DashboardReqUpdatePageDataUnionDevice.fromJson(json);

    default:
      throw CheckedFromJsonException(
          json,
          'type',
          'DashboardReqUpdatePageDataUnion',
          'Invalid union type "${json['type']}"!');
  }
}

/// @nodoc
mixin _$DashboardReqUpdatePageDataUnion {
  /// The title of the page.
  String get title => throw _privateConstructorUsedError;

  /// The display order of the page.
  int get order => throw _privateConstructorUsedError;

  /// Indicates that this is a cards dashboard page.
  String get type => throw _privateConstructorUsedError;

  /// The icon associated with the page.
  String? get icon => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String title, int order, String type, String? icon)
        cards,
    required TResult Function(
            String title, int order, String type, String? icon)
        tiles,
    required TResult Function(
            String title, int order, String device, String type, String? icon)
        device,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String title, int order, String type, String? icon)?
        cards,
    TResult? Function(String title, int order, String type, String? icon)?
        tiles,
    TResult? Function(
            String title, int order, String device, String type, String? icon)?
        device,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String title, int order, String type, String? icon)? cards,
    TResult Function(String title, int order, String type, String? icon)? tiles,
    TResult Function(
            String title, int order, String device, String type, String? icon)?
        device,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqUpdatePageDataUnionCards value) cards,
    required TResult Function(DashboardReqUpdatePageDataUnionTiles value) tiles,
    required TResult Function(DashboardReqUpdatePageDataUnionDevice value)
        device,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqUpdatePageDataUnionCards value)? cards,
    TResult? Function(DashboardReqUpdatePageDataUnionTiles value)? tiles,
    TResult? Function(DashboardReqUpdatePageDataUnionDevice value)? device,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqUpdatePageDataUnionCards value)? cards,
    TResult Function(DashboardReqUpdatePageDataUnionTiles value)? tiles,
    TResult Function(DashboardReqUpdatePageDataUnionDevice value)? device,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardReqUpdatePageDataUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqUpdatePageDataUnionCopyWith<DashboardReqUpdatePageDataUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqUpdatePageDataUnionCopyWith<$Res> {
  factory $DashboardReqUpdatePageDataUnionCopyWith(
          DashboardReqUpdatePageDataUnion value,
          $Res Function(DashboardReqUpdatePageDataUnion) then) =
      _$DashboardReqUpdatePageDataUnionCopyWithImpl<$Res,
          DashboardReqUpdatePageDataUnion>;
  @useResult
  $Res call({String title, int order, String type, String? icon});
}

/// @nodoc
class _$DashboardReqUpdatePageDataUnionCopyWithImpl<$Res,
        $Val extends DashboardReqUpdatePageDataUnion>
    implements $DashboardReqUpdatePageDataUnionCopyWith<$Res> {
  _$DashboardReqUpdatePageDataUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? title = null,
    Object? order = null,
    Object? type = null,
    Object? icon = freezed,
  }) {
    return _then(_value.copyWith(
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
abstract class _$$DashboardReqUpdatePageDataUnionCardsImplCopyWith<$Res>
    implements $DashboardReqUpdatePageDataUnionCopyWith<$Res> {
  factory _$$DashboardReqUpdatePageDataUnionCardsImplCopyWith(
          _$DashboardReqUpdatePageDataUnionCardsImpl value,
          $Res Function(_$DashboardReqUpdatePageDataUnionCardsImpl) then) =
      __$$DashboardReqUpdatePageDataUnionCardsImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String title, int order, String type, String? icon});
}

/// @nodoc
class __$$DashboardReqUpdatePageDataUnionCardsImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdatePageDataUnionCopyWithImpl<$Res,
        _$DashboardReqUpdatePageDataUnionCardsImpl>
    implements _$$DashboardReqUpdatePageDataUnionCardsImplCopyWith<$Res> {
  __$$DashboardReqUpdatePageDataUnionCardsImplCopyWithImpl(
      _$DashboardReqUpdatePageDataUnionCardsImpl _value,
      $Res Function(_$DashboardReqUpdatePageDataUnionCardsImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? title = null,
    Object? order = null,
    Object? type = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardReqUpdatePageDataUnionCardsImpl(
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
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqUpdatePageDataUnionCardsImpl
    implements DashboardReqUpdatePageDataUnionCards {
  const _$DashboardReqUpdatePageDataUnionCardsImpl(
      {required this.title,
      required this.order,
      this.type = 'cards',
      this.icon});

  factory _$DashboardReqUpdatePageDataUnionCardsImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqUpdatePageDataUnionCardsImplFromJson(json);

  /// The title of the page.
  @override
  final String title;

  /// The display order of the page.
  @override
  final int order;

  /// Indicates that this is a cards dashboard page.
  @override
  @JsonKey()
  final String type;

  /// The icon associated with the page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardReqUpdatePageDataUnion.cards(title: $title, order: $order, type: $type, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqUpdatePageDataUnionCardsImpl &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, title, order, type, icon);

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqUpdatePageDataUnionCardsImplCopyWith<
          _$DashboardReqUpdatePageDataUnionCardsImpl>
      get copyWith => __$$DashboardReqUpdatePageDataUnionCardsImplCopyWithImpl<
          _$DashboardReqUpdatePageDataUnionCardsImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String title, int order, String type, String? icon)
        cards,
    required TResult Function(
            String title, int order, String type, String? icon)
        tiles,
    required TResult Function(
            String title, int order, String device, String type, String? icon)
        device,
  }) {
    return cards(title, order, type, icon);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String title, int order, String type, String? icon)?
        cards,
    TResult? Function(String title, int order, String type, String? icon)?
        tiles,
    TResult? Function(
            String title, int order, String device, String type, String? icon)?
        device,
  }) {
    return cards?.call(title, order, type, icon);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String title, int order, String type, String? icon)? cards,
    TResult Function(String title, int order, String type, String? icon)? tiles,
    TResult Function(
            String title, int order, String device, String type, String? icon)?
        device,
    required TResult orElse(),
  }) {
    if (cards != null) {
      return cards(title, order, type, icon);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqUpdatePageDataUnionCards value) cards,
    required TResult Function(DashboardReqUpdatePageDataUnionTiles value) tiles,
    required TResult Function(DashboardReqUpdatePageDataUnionDevice value)
        device,
  }) {
    return cards(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqUpdatePageDataUnionCards value)? cards,
    TResult? Function(DashboardReqUpdatePageDataUnionTiles value)? tiles,
    TResult? Function(DashboardReqUpdatePageDataUnionDevice value)? device,
  }) {
    return cards?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqUpdatePageDataUnionCards value)? cards,
    TResult Function(DashboardReqUpdatePageDataUnionTiles value)? tiles,
    TResult Function(DashboardReqUpdatePageDataUnionDevice value)? device,
    required TResult orElse(),
  }) {
    if (cards != null) {
      return cards(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqUpdatePageDataUnionCardsImplToJson(
      this,
    );
  }
}

abstract class DashboardReqUpdatePageDataUnionCards
    implements DashboardReqUpdatePageDataUnion {
  const factory DashboardReqUpdatePageDataUnionCards(
      {required final String title,
      required final int order,
      final String type,
      final String? icon}) = _$DashboardReqUpdatePageDataUnionCardsImpl;

  factory DashboardReqUpdatePageDataUnionCards.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqUpdatePageDataUnionCardsImpl.fromJson;

  /// The title of the page.
  @override
  String get title;

  /// The display order of the page.
  @override
  int get order;

  /// Indicates that this is a cards dashboard page.
  @override
  String get type;

  /// The icon associated with the page.
  @override
  String? get icon;

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqUpdatePageDataUnionCardsImplCopyWith<
          _$DashboardReqUpdatePageDataUnionCardsImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardReqUpdatePageDataUnionTilesImplCopyWith<$Res>
    implements $DashboardReqUpdatePageDataUnionCopyWith<$Res> {
  factory _$$DashboardReqUpdatePageDataUnionTilesImplCopyWith(
          _$DashboardReqUpdatePageDataUnionTilesImpl value,
          $Res Function(_$DashboardReqUpdatePageDataUnionTilesImpl) then) =
      __$$DashboardReqUpdatePageDataUnionTilesImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String title, int order, String type, String? icon});
}

/// @nodoc
class __$$DashboardReqUpdatePageDataUnionTilesImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdatePageDataUnionCopyWithImpl<$Res,
        _$DashboardReqUpdatePageDataUnionTilesImpl>
    implements _$$DashboardReqUpdatePageDataUnionTilesImplCopyWith<$Res> {
  __$$DashboardReqUpdatePageDataUnionTilesImplCopyWithImpl(
      _$DashboardReqUpdatePageDataUnionTilesImpl _value,
      $Res Function(_$DashboardReqUpdatePageDataUnionTilesImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? title = null,
    Object? order = null,
    Object? type = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardReqUpdatePageDataUnionTilesImpl(
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
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqUpdatePageDataUnionTilesImpl
    implements DashboardReqUpdatePageDataUnionTiles {
  const _$DashboardReqUpdatePageDataUnionTilesImpl(
      {required this.title,
      required this.order,
      this.type = 'tiles',
      this.icon});

  factory _$DashboardReqUpdatePageDataUnionTilesImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqUpdatePageDataUnionTilesImplFromJson(json);

  /// The title of the page.
  @override
  final String title;

  /// The display order of the page.
  @override
  final int order;

  /// Indicates that this is a tiles dashboard page.
  @override
  @JsonKey()
  final String type;

  /// The icon associated with the page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardReqUpdatePageDataUnion.tiles(title: $title, order: $order, type: $type, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqUpdatePageDataUnionTilesImpl &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, title, order, type, icon);

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqUpdatePageDataUnionTilesImplCopyWith<
          _$DashboardReqUpdatePageDataUnionTilesImpl>
      get copyWith => __$$DashboardReqUpdatePageDataUnionTilesImplCopyWithImpl<
          _$DashboardReqUpdatePageDataUnionTilesImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String title, int order, String type, String? icon)
        cards,
    required TResult Function(
            String title, int order, String type, String? icon)
        tiles,
    required TResult Function(
            String title, int order, String device, String type, String? icon)
        device,
  }) {
    return tiles(title, order, type, icon);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String title, int order, String type, String? icon)?
        cards,
    TResult? Function(String title, int order, String type, String? icon)?
        tiles,
    TResult? Function(
            String title, int order, String device, String type, String? icon)?
        device,
  }) {
    return tiles?.call(title, order, type, icon);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String title, int order, String type, String? icon)? cards,
    TResult Function(String title, int order, String type, String? icon)? tiles,
    TResult Function(
            String title, int order, String device, String type, String? icon)?
        device,
    required TResult orElse(),
  }) {
    if (tiles != null) {
      return tiles(title, order, type, icon);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqUpdatePageDataUnionCards value) cards,
    required TResult Function(DashboardReqUpdatePageDataUnionTiles value) tiles,
    required TResult Function(DashboardReqUpdatePageDataUnionDevice value)
        device,
  }) {
    return tiles(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqUpdatePageDataUnionCards value)? cards,
    TResult? Function(DashboardReqUpdatePageDataUnionTiles value)? tiles,
    TResult? Function(DashboardReqUpdatePageDataUnionDevice value)? device,
  }) {
    return tiles?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqUpdatePageDataUnionCards value)? cards,
    TResult Function(DashboardReqUpdatePageDataUnionTiles value)? tiles,
    TResult Function(DashboardReqUpdatePageDataUnionDevice value)? device,
    required TResult orElse(),
  }) {
    if (tiles != null) {
      return tiles(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqUpdatePageDataUnionTilesImplToJson(
      this,
    );
  }
}

abstract class DashboardReqUpdatePageDataUnionTiles
    implements DashboardReqUpdatePageDataUnion {
  const factory DashboardReqUpdatePageDataUnionTiles(
      {required final String title,
      required final int order,
      final String type,
      final String? icon}) = _$DashboardReqUpdatePageDataUnionTilesImpl;

  factory DashboardReqUpdatePageDataUnionTiles.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqUpdatePageDataUnionTilesImpl.fromJson;

  /// The title of the page.
  @override
  String get title;

  /// The display order of the page.
  @override
  int get order;

  /// Indicates that this is a tiles dashboard page.
  @override
  String get type;

  /// The icon associated with the page.
  @override
  String? get icon;

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqUpdatePageDataUnionTilesImplCopyWith<
          _$DashboardReqUpdatePageDataUnionTilesImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardReqUpdatePageDataUnionDeviceImplCopyWith<$Res>
    implements $DashboardReqUpdatePageDataUnionCopyWith<$Res> {
  factory _$$DashboardReqUpdatePageDataUnionDeviceImplCopyWith(
          _$DashboardReqUpdatePageDataUnionDeviceImpl value,
          $Res Function(_$DashboardReqUpdatePageDataUnionDeviceImpl) then) =
      __$$DashboardReqUpdatePageDataUnionDeviceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String title, int order, String device, String type, String? icon});
}

/// @nodoc
class __$$DashboardReqUpdatePageDataUnionDeviceImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdatePageDataUnionCopyWithImpl<$Res,
        _$DashboardReqUpdatePageDataUnionDeviceImpl>
    implements _$$DashboardReqUpdatePageDataUnionDeviceImplCopyWith<$Res> {
  __$$DashboardReqUpdatePageDataUnionDeviceImplCopyWithImpl(
      _$DashboardReqUpdatePageDataUnionDeviceImpl _value,
      $Res Function(_$DashboardReqUpdatePageDataUnionDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? title = null,
    Object? order = null,
    Object? device = null,
    Object? type = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardReqUpdatePageDataUnionDeviceImpl(
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
class _$DashboardReqUpdatePageDataUnionDeviceImpl
    implements DashboardReqUpdatePageDataUnionDevice {
  const _$DashboardReqUpdatePageDataUnionDeviceImpl(
      {required this.title,
      required this.order,
      required this.device,
      this.type = 'device',
      this.icon});

  factory _$DashboardReqUpdatePageDataUnionDeviceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqUpdatePageDataUnionDeviceImplFromJson(json);

  /// The title of the page.
  @override
  final String title;

  /// The display order of the page.
  @override
  final int order;

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// Indicates that this is a tiles dashboard page.
  @override
  @JsonKey()
  final String type;

  /// The icon associated with the page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardReqUpdatePageDataUnion.device(title: $title, order: $order, device: $device, type: $type, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqUpdatePageDataUnionDeviceImpl &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, title, order, device, type, icon);

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqUpdatePageDataUnionDeviceImplCopyWith<
          _$DashboardReqUpdatePageDataUnionDeviceImpl>
      get copyWith => __$$DashboardReqUpdatePageDataUnionDeviceImplCopyWithImpl<
          _$DashboardReqUpdatePageDataUnionDeviceImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String title, int order, String type, String? icon)
        cards,
    required TResult Function(
            String title, int order, String type, String? icon)
        tiles,
    required TResult Function(
            String title, int order, String device, String type, String? icon)
        device,
  }) {
    return device(title, order, this.device, type, icon);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String title, int order, String type, String? icon)?
        cards,
    TResult? Function(String title, int order, String type, String? icon)?
        tiles,
    TResult? Function(
            String title, int order, String device, String type, String? icon)?
        device,
  }) {
    return device?.call(title, order, this.device, type, icon);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String title, int order, String type, String? icon)? cards,
    TResult Function(String title, int order, String type, String? icon)? tiles,
    TResult Function(
            String title, int order, String device, String type, String? icon)?
        device,
    required TResult orElse(),
  }) {
    if (device != null) {
      return device(title, order, this.device, type, icon);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqUpdatePageDataUnionCards value) cards,
    required TResult Function(DashboardReqUpdatePageDataUnionTiles value) tiles,
    required TResult Function(DashboardReqUpdatePageDataUnionDevice value)
        device,
  }) {
    return device(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqUpdatePageDataUnionCards value)? cards,
    TResult? Function(DashboardReqUpdatePageDataUnionTiles value)? tiles,
    TResult? Function(DashboardReqUpdatePageDataUnionDevice value)? device,
  }) {
    return device?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqUpdatePageDataUnionCards value)? cards,
    TResult Function(DashboardReqUpdatePageDataUnionTiles value)? tiles,
    TResult Function(DashboardReqUpdatePageDataUnionDevice value)? device,
    required TResult orElse(),
  }) {
    if (device != null) {
      return device(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqUpdatePageDataUnionDeviceImplToJson(
      this,
    );
  }
}

abstract class DashboardReqUpdatePageDataUnionDevice
    implements DashboardReqUpdatePageDataUnion {
  const factory DashboardReqUpdatePageDataUnionDevice(
      {required final String title,
      required final int order,
      required final String device,
      final String type,
      final String? icon}) = _$DashboardReqUpdatePageDataUnionDeviceImpl;

  factory DashboardReqUpdatePageDataUnionDevice.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqUpdatePageDataUnionDeviceImpl.fromJson;

  /// The title of the page.
  @override
  String get title;

  /// The display order of the page.
  @override
  int get order;

  /// The unique identifier of the associated device.
  String get device;

  /// Indicates that this is a tiles dashboard page.
  @override
  String get type;

  /// The icon associated with the page.
  @override
  String? get icon;

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqUpdatePageDataUnionDeviceImplCopyWith<
          _$DashboardReqUpdatePageDataUnionDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}

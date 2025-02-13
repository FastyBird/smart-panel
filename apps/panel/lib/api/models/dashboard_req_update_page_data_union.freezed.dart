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
      return DashboardUpdateCardsPage.fromJson(json);
    case 'tiles':
      return DashboardUpdateTilesPage.fromJson(json);
    case 'device':
      return DashboardUpdateDevicePage.fromJson(json);

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
    required TResult Function(DashboardUpdateCardsPage value) cards,
    required TResult Function(DashboardUpdateTilesPage value) tiles,
    required TResult Function(DashboardUpdateDevicePage value) device,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardUpdateCardsPage value)? cards,
    TResult? Function(DashboardUpdateTilesPage value)? tiles,
    TResult? Function(DashboardUpdateDevicePage value)? device,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardUpdateCardsPage value)? cards,
    TResult Function(DashboardUpdateTilesPage value)? tiles,
    TResult Function(DashboardUpdateDevicePage value)? device,
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
abstract class _$$DashboardUpdateCardsPageImplCopyWith<$Res>
    implements $DashboardReqUpdatePageDataUnionCopyWith<$Res> {
  factory _$$DashboardUpdateCardsPageImplCopyWith(
          _$DashboardUpdateCardsPageImpl value,
          $Res Function(_$DashboardUpdateCardsPageImpl) then) =
      __$$DashboardUpdateCardsPageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String title, int order, String type, String? icon});
}

/// @nodoc
class __$$DashboardUpdateCardsPageImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdatePageDataUnionCopyWithImpl<$Res,
        _$DashboardUpdateCardsPageImpl>
    implements _$$DashboardUpdateCardsPageImplCopyWith<$Res> {
  __$$DashboardUpdateCardsPageImplCopyWithImpl(
      _$DashboardUpdateCardsPageImpl _value,
      $Res Function(_$DashboardUpdateCardsPageImpl) _then)
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
    return _then(_$DashboardUpdateCardsPageImpl(
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
class _$DashboardUpdateCardsPageImpl implements DashboardUpdateCardsPage {
  const _$DashboardUpdateCardsPageImpl(
      {required this.title,
      required this.order,
      this.type = 'cards',
      this.icon});

  factory _$DashboardUpdateCardsPageImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardUpdateCardsPageImplFromJson(json);

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
            other is _$DashboardUpdateCardsPageImpl &&
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
  _$$DashboardUpdateCardsPageImplCopyWith<_$DashboardUpdateCardsPageImpl>
      get copyWith => __$$DashboardUpdateCardsPageImplCopyWithImpl<
          _$DashboardUpdateCardsPageImpl>(this, _$identity);

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
    required TResult Function(DashboardUpdateCardsPage value) cards,
    required TResult Function(DashboardUpdateTilesPage value) tiles,
    required TResult Function(DashboardUpdateDevicePage value) device,
  }) {
    return cards(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardUpdateCardsPage value)? cards,
    TResult? Function(DashboardUpdateTilesPage value)? tiles,
    TResult? Function(DashboardUpdateDevicePage value)? device,
  }) {
    return cards?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardUpdateCardsPage value)? cards,
    TResult Function(DashboardUpdateTilesPage value)? tiles,
    TResult Function(DashboardUpdateDevicePage value)? device,
    required TResult orElse(),
  }) {
    if (cards != null) {
      return cards(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardUpdateCardsPageImplToJson(
      this,
    );
  }
}

abstract class DashboardUpdateCardsPage
    implements DashboardReqUpdatePageDataUnion {
  const factory DashboardUpdateCardsPage(
      {required final String title,
      required final int order,
      final String type,
      final String? icon}) = _$DashboardUpdateCardsPageImpl;

  factory DashboardUpdateCardsPage.fromJson(Map<String, dynamic> json) =
      _$DashboardUpdateCardsPageImpl.fromJson;

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
  _$$DashboardUpdateCardsPageImplCopyWith<_$DashboardUpdateCardsPageImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardUpdateTilesPageImplCopyWith<$Res>
    implements $DashboardReqUpdatePageDataUnionCopyWith<$Res> {
  factory _$$DashboardUpdateTilesPageImplCopyWith(
          _$DashboardUpdateTilesPageImpl value,
          $Res Function(_$DashboardUpdateTilesPageImpl) then) =
      __$$DashboardUpdateTilesPageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String title, int order, String type, String? icon});
}

/// @nodoc
class __$$DashboardUpdateTilesPageImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdatePageDataUnionCopyWithImpl<$Res,
        _$DashboardUpdateTilesPageImpl>
    implements _$$DashboardUpdateTilesPageImplCopyWith<$Res> {
  __$$DashboardUpdateTilesPageImplCopyWithImpl(
      _$DashboardUpdateTilesPageImpl _value,
      $Res Function(_$DashboardUpdateTilesPageImpl) _then)
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
    return _then(_$DashboardUpdateTilesPageImpl(
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
class _$DashboardUpdateTilesPageImpl implements DashboardUpdateTilesPage {
  const _$DashboardUpdateTilesPageImpl(
      {required this.title,
      required this.order,
      this.type = 'tiles',
      this.icon});

  factory _$DashboardUpdateTilesPageImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardUpdateTilesPageImplFromJson(json);

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
            other is _$DashboardUpdateTilesPageImpl &&
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
  _$$DashboardUpdateTilesPageImplCopyWith<_$DashboardUpdateTilesPageImpl>
      get copyWith => __$$DashboardUpdateTilesPageImplCopyWithImpl<
          _$DashboardUpdateTilesPageImpl>(this, _$identity);

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
    required TResult Function(DashboardUpdateCardsPage value) cards,
    required TResult Function(DashboardUpdateTilesPage value) tiles,
    required TResult Function(DashboardUpdateDevicePage value) device,
  }) {
    return tiles(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardUpdateCardsPage value)? cards,
    TResult? Function(DashboardUpdateTilesPage value)? tiles,
    TResult? Function(DashboardUpdateDevicePage value)? device,
  }) {
    return tiles?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardUpdateCardsPage value)? cards,
    TResult Function(DashboardUpdateTilesPage value)? tiles,
    TResult Function(DashboardUpdateDevicePage value)? device,
    required TResult orElse(),
  }) {
    if (tiles != null) {
      return tiles(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardUpdateTilesPageImplToJson(
      this,
    );
  }
}

abstract class DashboardUpdateTilesPage
    implements DashboardReqUpdatePageDataUnion {
  const factory DashboardUpdateTilesPage(
      {required final String title,
      required final int order,
      final String type,
      final String? icon}) = _$DashboardUpdateTilesPageImpl;

  factory DashboardUpdateTilesPage.fromJson(Map<String, dynamic> json) =
      _$DashboardUpdateTilesPageImpl.fromJson;

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
  _$$DashboardUpdateTilesPageImplCopyWith<_$DashboardUpdateTilesPageImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardUpdateDevicePageImplCopyWith<$Res>
    implements $DashboardReqUpdatePageDataUnionCopyWith<$Res> {
  factory _$$DashboardUpdateDevicePageImplCopyWith(
          _$DashboardUpdateDevicePageImpl value,
          $Res Function(_$DashboardUpdateDevicePageImpl) then) =
      __$$DashboardUpdateDevicePageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String title, int order, String device, String type, String? icon});
}

/// @nodoc
class __$$DashboardUpdateDevicePageImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdatePageDataUnionCopyWithImpl<$Res,
        _$DashboardUpdateDevicePageImpl>
    implements _$$DashboardUpdateDevicePageImplCopyWith<$Res> {
  __$$DashboardUpdateDevicePageImplCopyWithImpl(
      _$DashboardUpdateDevicePageImpl _value,
      $Res Function(_$DashboardUpdateDevicePageImpl) _then)
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
    return _then(_$DashboardUpdateDevicePageImpl(
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
class _$DashboardUpdateDevicePageImpl implements DashboardUpdateDevicePage {
  const _$DashboardUpdateDevicePageImpl(
      {required this.title,
      required this.order,
      required this.device,
      this.type = 'device',
      this.icon});

  factory _$DashboardUpdateDevicePageImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardUpdateDevicePageImplFromJson(json);

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
            other is _$DashboardUpdateDevicePageImpl &&
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
  _$$DashboardUpdateDevicePageImplCopyWith<_$DashboardUpdateDevicePageImpl>
      get copyWith => __$$DashboardUpdateDevicePageImplCopyWithImpl<
          _$DashboardUpdateDevicePageImpl>(this, _$identity);

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
    required TResult Function(DashboardUpdateCardsPage value) cards,
    required TResult Function(DashboardUpdateTilesPage value) tiles,
    required TResult Function(DashboardUpdateDevicePage value) device,
  }) {
    return device(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardUpdateCardsPage value)? cards,
    TResult? Function(DashboardUpdateTilesPage value)? tiles,
    TResult? Function(DashboardUpdateDevicePage value)? device,
  }) {
    return device?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardUpdateCardsPage value)? cards,
    TResult Function(DashboardUpdateTilesPage value)? tiles,
    TResult Function(DashboardUpdateDevicePage value)? device,
    required TResult orElse(),
  }) {
    if (device != null) {
      return device(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardUpdateDevicePageImplToJson(
      this,
    );
  }
}

abstract class DashboardUpdateDevicePage
    implements DashboardReqUpdatePageDataUnion {
  const factory DashboardUpdateDevicePage(
      {required final String title,
      required final int order,
      required final String device,
      final String type,
      final String? icon}) = _$DashboardUpdateDevicePageImpl;

  factory DashboardUpdateDevicePage.fromJson(Map<String, dynamic> json) =
      _$DashboardUpdateDevicePageImpl.fromJson;

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
  _$$DashboardUpdateDevicePageImplCopyWith<_$DashboardUpdateDevicePageImpl>
      get copyWith => throw _privateConstructorUsedError;
}

---
title: "Dart 3 class modifier 와 sealed, 완전성 검사로 닫는 타입 계층"
description: "Dart 3 의 class modifier(abstract, base, interface, final, sealed, mixin class)가 각각 무엇을 막는지 표로 정리하고 sealed 와 switch 표현식·패턴·records 를 조합해 완전성 검사를 받는 방법과 Kotlin sealed 와의 차이를 설명합니다."
pubDatetime: 2024-07-09T22:00:00+09:00
category: dart
tags:
  - Dart
  - sealed
  - 패턴 매칭
  - 클래스 modifier
---

Dart 2 까지 모든 클래스는 기본적으로 어디서든 상속하고 구현할 수 있었습니다. 라이브러리 작성자가 확장을 막으려면 생성자를 private 으로 감추는 정도가 전부였습니다. Dart 3(2023년 5월)은 class modifier 다섯 개(base, interface, final, sealed, mixin class)를 도입해서 "이 클래스를 라이브러리 밖에서 무엇까지 할 수 있는가"를 선언부에 직접 적게 했습니다. 이 가운데 `sealed` 는 하위 타입의 목록을 컴파일러가 알게 만들어 switch 의 완전성 검사까지 연결됩니다.

## modifier 가 막는 것

modifier 의 상속·구현 제약은 대부분 클래스가 정의된 라이브러리 바깥에만 적용됩니다. 같은 라이브러리 안에서는 상속과 구현이 가능하지만, base·final 클래스의 하위 타입은 같은 라이브러리 안에서도 base·final·sealed 중 하나여야 하고, abstract·sealed 클래스는 어디서도 직접 생성할 수 없습니다. 공식 문서의 설명을 표로 옮겼습니다. 모든 modifier 는 언어 버전 3.0 이상이 필요하고 `abstract` 만은 이전 버전에서도 쓸 수 있었습니다.

| modifier    | 바깥에서 생성 | 바깥에서 extends | 바깥에서 implements |
| ----------- | ------------- | ---------------- | ------------------- |
| (없음)      | 가능          | 가능             | 가능                |
| `abstract`  | 불가          | 가능             | 가능                |
| `base`      | 가능          | 가능             | 불가                |
| `interface` | 가능          | 불가             | 가능                |
| `final`     | 가능          | 불가             | 불가                |
| `sealed`    | 불가          | 불가             | 불가                |

`base` 는 구현을 상속으로만 재사용하도록 강제합니다. implements 를 막으면 모든 하위 타입이 base 클래스의 생성자와 private 멤버를 실제로 물려받게 되므로, 클래스에 멤버를 추가해도 하위 타입이 깨지지 않습니다. 이 클래스를 extends 하거나 implements 하는 클래스는 다시 `base`, `final`, `sealed` 중 하나여야 합니다. `final` 은 `base` 의 효과를 포함하기 때문에 하위 클래스에 같은 요구를 합니다.

`interface` 는 반대로 인터페이스로만 쓰이게 합니다. 바깥에서 상속할 수 없으니 클래스 안의 `this` 호출이 항상 같은 라이브러리의 구현에 도달합니다. 생성을 막고 싶으면 `abstract interface class` 로 선언하며 이 조합이 다른 언어의 순수 인터페이스에 해당합니다.

```dart
base class Vehicle {
  void moveForward(int meters) {}
}

abstract interface class Repository {
  Future<void> save(String id);
}
```

`mixin class` 는 일반 클래스로도, mixin 으로도 쓸 수 있는 선언입니다. `interface`, `final`, `sealed` 는 mixin 으로 섞이는 것을 막는 modifier 라서 `mixin` 과 함께 쓸 수 없고 `abstract` 와 `sealed` 도 겹쳐 쓰지 않습니다. sealed 가 이미 암묵적으로 abstract 이기 때문입니다.

## sealed 는 직접 하위 타입을 한 곳에 모읍니다

`sealed` 클래스는 같은 라이브러리 안에서만 상속하거나 구현할 수 있습니다. 직접 하위 타입이 전부 한 라이브러리에 있으므로 컴파일러가 목록을 알고 이 목록이 완전성 검사의 근거가 됩니다. sealed 클래스는 암묵적으로 abstract 여서 직접 생성할 수 없고 하위 클래스만 생성할 수 있습니다.

![sealed class Shape 의 직접 하위 타입 Circle, Square, Triangle 이 한 라이브러리 안에 있고 Triangle 케이스가 빠진 switch 는 컴파일 오류가 난다](@/assets/images/dart-sealed-hierarchy.png)

```dart
import 'dart:math';

sealed class Shape {}

class Circle extends Shape {
  final double radius;
  Circle(this.radius);
}

class Square extends Shape {
  final double side;
  Square(this.side);
}

class Triangle extends Shape {
  final double width, height;
  Triangle(this.width, this.height);
}

double area(Shape shape) => switch (shape) {
  Circle(:final radius) => pi * radius * radius,
  Square(:final side) => side * side,
  Triangle(:final width, :final height) => width * height / 2,
};
```

세 하위 타입 가운데 하나라도 빠지면 컴파일러가 처리되지 않은 타입을 가리키며 오류를 냅니다. `default` 나 `_` 를 붙이면 오류는 사라지지만 그 순간부터 완전성 검사도 함께 꺼집니다. 나중에 `Shape` 에 `Pentagon` 이 추가되어도 `_` 가 삼켜버려 어디에서도 경고가 나오지 않습니다. 완전성 검사를 받으려면 하위 타입을 하나씩 모두 적어야 합니다.

목록의 단위는 직접 하위 타입입니다. 하위 타입을 다시 `sealed` 로 선언하면 계층이 한 단계 더 깊어지며 그 안에서도 같은 검사가 적용됩니다.

## 패턴과 함께 쓰기

switch 의 `case` 에 쓰는 객체 패턴은 타입 검사와 필드 구조 분해를 한 번에 합니다. `Circle(:final radius)` 는 값이 `Circle` 인지 확인하고 `radius` 필드를 같은 이름의 지역 변수로 꺼냅니다. `when` 으로 조건을 더할 수 있으며 가드가 붙은 케이스는 완전성 판정에서 제외됩니다. 가드가 실패하면 값이 다음 케이스로 넘어가기 때문입니다.

```dart
sealed class Result<T> {}

class Ok<T> extends Result<T> {
  final T value;
  Ok(this.value);
}

class Err<T> extends Result<T> {
  final Object error;
  Err(this.error);
}

String describe(Result<int> r) => switch (r) {
  Ok(:final value) when value > 100 => 'large $value',
  Ok(:final value) => 'ok $value',
  Err(:final error) => 'failed: $error',
};
```

`Ok` 에는 가드 있는 케이스와 없는 케이스가 모두 있어서 `Ok` 전체를 커버하는 것은 두 번째 줄입니다. 가드 있는 케이스만 남기면 `Ok` 가 미처리로 판정됩니다.

records 와 섞으면 두 값을 한꺼번에 검사할 수 있습니다. 괄호로 묶은 `(a, b)` 가 record 이고 패턴도 같은 모양으로 씁니다. 완전성 검사는 record 각 위치의 조합 전체를 따져 봅니다.

```dart
String combine(Result<int> a, Result<int> b) => switch ((a, b)) {
  (Ok(:final value), Ok(value: final other)) => 'sum ${value + other}',
  (Err(), _) || (_, Err()) => 'failed',
};
```

`(Ok, Ok)`, `(Err, 아무거나)`, `(아무거나, Err)` 세 케이스로 네 가지 조합이 모두 덮입니다. 컴파일러가 이 계산을 대신하므로 조합이 늘어나도 빠진 경우를 손으로 세지 않아도 됩니다. switch 문에서도 enum 과 sealed 타입을 검사 대상으로 삼으면 완전해야 하며 같은 규칙을 따릅니다.

## sealed 대신 고를 수 있는 것

확장을 막기만 하고 완전성 검사는 필요 없다면 `final` 이 더 단순합니다. 공식 문서도 하위 타입을 나중에 추가하는 변경이 API 를 깨지 않게 하려면 sealed 대신 final 을 고려하라고 안내합니다. sealed 에 하위 타입을 하나 더하면 그 클래스를 switch 하던 모든 코드가 오류가 되기 때문입니다. 라이브러리 바깥에서 이 변화가 문제가 된다면 sealed 는 외부에 공개하는 타입보다 내부 모델에 어울립니다.

## Kotlin sealed 와 비교

Kotlin 의 sealed class/interface 와 역할이 거의 같습니다. 하위 타입을 제한하고 컴파일러가 `when` 의 완전성을 검사하며 클래스 자체는 직접 생성할 수 없습니다. 차이는 제약의 범위에 있습니다.

|                   | Dart                               | Kotlin                 |
| ----------------- | ---------------------------------- | ---------------------- |
| 하위 타입 위치    | 같은 라이브러리(파일, part 파일)   | 같은 패키지, 같은 모듈 |
| 분기 구문         | `switch` 표현식·문                 | `when`                 |
| 타입 확인 뒤 접근 | 객체·record 패턴으로 필드까지 분해 | 스마트 캐스트          |
| 직접 생성         | 불가(암묵적 abstract)              | 불가(abstract)         |

Kotlin 은 하위 타입을 같은 패키지의 다른 파일에 둘 수 있지만 Dart 는 라이브러리 경계인 파일 하나가 단위입니다. 파일이 커지는 것을 피하려면 `part`/`part of` 로 쪼갤 수 있습니다. 반면 Dart 의 패턴은 중첩된 구조와 record 까지 한 번에 분해하므로 `when` 에서 `is` 검사 뒤 필드에 접근하는 것보다 표현할 수 있는 범위가 넓습니다.

## 참고 자료

- [Class modifiers](https://dart.dev/language/class-modifiers)
- [Branches: Exhaustiveness checking](https://dart.dev/language/branches#exhaustiveness-checking)
- [Patterns](https://dart.dev/language/patterns)
- [Pattern types](https://dart.dev/language/pattern-types)
- [Diagnostic: non_exhaustive_switch_expression](https://dart.dev/tools/diagnostics/non_exhaustive_switch_expression)
- [Patterns exhaustiveness specification (dart-lang/language)](https://github.com/dart-lang/language/blob/main/accepted/3.0/patterns/exhaustiveness.md)
- [Dart language evolution: Dart 3.0](https://dart.dev/resources/language/evolution#dart-3-0)
- [Kotlin: Sealed classes and interfaces](https://kotlinlang.org/docs/sealed-classes.html)
- [Kotlin: Smart casts](https://kotlinlang.org/docs/typecasts.html#smart-casts)

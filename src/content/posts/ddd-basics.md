---
title: "도메인 주도 설계 입문: 바운디드 컨텍스트와 컨텍스트 맵, 엔티티·값 객체·애그리거트, Kotlin 으로 보는 불변식"
description: "DDD 의 전략적 설계(바운디드 컨텍스트, 유비쿼터스 언어, 컨텍스트 맵 관계)와 전술적 설계(엔티티, 값 객체, 애그리거트, 리포지토리, 도메인 이벤트, 도메인 서비스)를 Evans 의 레퍼런스와 Vernon 의 애그리거트 설계 규칙, Kotlin 코드로 풀어 봅니다."
pubDatetime: 2024-02-27T21:40:00+09:00
category: server
tags:
  - DDD
  - 아키텍처
  - 도메인 모델
  - Kotlin
---

도메인 주도 설계(DDD)는 Eric Evans 가 『Domain-Driven Design: Tackling Complexity in the Heart of Software』에서 정리한 설계 접근으로, 복잡한 업무 규칙을 코드의 중심에 두고 모델을 도메인 전문가와 함께 다듬는 데 초점을 둡니다. 내용은 모델을 어디까지 하나로 볼지 정하는 전략적 설계와, 그 모델을 코드 구성 요소로 옮기는 전술적 설계로 나뉩니다. Evans 가 직접 정리한 「DDD Reference」는 책의 정의와 패턴 요약에 책 출간 이후 추가된 용어(별표 항목)를 더한 문서이고 본문에서 짚는 용어의 정의는 이 문서를 기준으로 합니다.

## 전략적 설계

### 바운디드 컨텍스트와 유비쿼터스 언어

Martin Fowler 는 바운디드 컨텍스트를 DDD 전략적 설계의 중심 패턴이라고 설명합니다. 큰 모델을 여러 컨텍스트로 쪼개고 각 컨텍스트 안에서 모델을 하나로 통일한 뒤 컨텍스트 사이의 관계를 명시하는 방식입니다. Evans 는 큰 시스템의 도메인 모델을 완전히 통일하는 일이 현실적이지도 경제적이지도 않다고 보았습니다.

같은 단어가 조직 안에서 다른 뜻으로 쓰이기 때문입니다. Fowler 가 든 전력 회사의 예에서 "미터"는 전력망과 위치의 연결을, 전력망과 고객의 연결을, 물리적 계량기를 각각 가리킬 수 있습니다. `Customer` 나 `Product` 도 마찬가지입니다. 모델은 개발자와 도메인 전문가가 소통하는 유비쿼터스 언어의 역할을 하므로 언어가 바뀌는 지점은 모델이 달라져야 하는 지점이고 컨텍스트 경계는 주로 이 지점에서 갈립니다. Fowler 는 컨텍스트 경계를 긋는 요인 중 보통 가장 큰 것이 사람의 문화라고 말하고, 같은 글의 참고 자료에서는 Verraes 와 Wirfs-Brock 이 도메인 개념만큼이나 역사와 사람 사이의 관계 때문에 컨텍스트를 나눠야 하는 경우를 다룬다고 소개합니다.

![컨텍스트 맵 예시. 주문, 결제, 배송 세 바운디드 컨텍스트가 점선으로 경계를 이루고 Customer 라는 단어가 컨텍스트마다 다른 의미로 쓰인다. 주문과 결제는 Customer/Supplier 관계, 주문과 배송은 Published Language, 배송과 외부 택배사 시스템 사이에는 Anticorruption Layer 가 있다](@/assets/images/ddd-bounded-contexts-map.png)

주문 컨텍스트의 `Customer` 는 주문한 사람이고 결제 컨텍스트의 `Customer` 는 결제 수단의 소유자이며 배송 컨텍스트에서는 수령인입니다. 각각 필요한 속성과 규칙이 다르므로 하나의 거대한 `Customer` 클래스로 합치기보다 컨텍스트마다 자기 모델을 갖는 편이 자연스럽습니다. [모놀리스와 마이크로서비스 글](/posts/monolith-vs-microservices/)에서 본 것처럼 서비스를 나누는 단위를 찾을 때 이 경계가 후보가 되지만 바운디드 컨텍스트는 한 프로세스 안의 모듈로 구현해도 성립하는 개념입니다.

### 컨텍스트 맵의 관계

컨텍스트 사이의 관계는 컨텍스트 맵으로 그립니다. 「DDD Reference」는 이 관계를 다음 패턴들로 나눕니다.

Partnership 은 두 컨텍스트의 팀이 함께 성공하거나 실패하는 관계에서, 계획과 통합을 함께 조율하는 협력 관계입니다. Shared Kernel 은 모델과 코드의 일부를 공유하는 것으로, 문서는 이를 아주 밀접한 상호 의존이라고 표현합니다. Customer/Supplier Development(이하 Customer/Supplier)는 상류와 하류 관계에서 하류의 요구가 공식적으로 반영되도록 하는 방식이고 Conformist 는 상류가 하류의 필요를 챙길 동기가 없을 때 하류가 상류 모델을 그대로 따르는 선택입니다. Anticorruption Layer 는 통제나 소통이 부족한 상대 시스템과 연결할 때 번역 계층을 두어 자기 모델을 지키는 방식입니다. Open-host Service 는 여러 컨텍스트가 쓰도록 공개 서비스를 두는 것이고 Published Language 는 두 모델 사이를 번역할 때 공통 언어를 정해 쓰는 것입니다. Separate Ways 는 두 기능 사이에 의미 있는 관계가 없다면 통합 비용을 치르지 않고 완전히 분리한다는 결정이고 Big Ball of Mud 는 모델이 뒤섞여 경계가 일관되지 않은 시스템을 가리키는 이름입니다.

앞의 그림에서 주문(상류, U)과 결제(하류, D)는 Customer/Supplier 로 맺고 외부 택배사 시스템은 바꿀 수 없는 기존 모델이므로 Anticorruption Layer 가 그 모델이 배송 컨텍스트로 스며드는 것을 막습니다.

## 전술적 설계

전술적 설계는 하나의 바운디드 컨텍스트 안에서 모델을 코드로 만드는 규칙입니다.

### 엔티티와 값 객체

「DDD Reference」에 따르면 엔티티는 속성이 바뀌어도 이어지는 연속성과 정체성을 가진 객체입니다. 주문 번호가 같으면 항목이 바뀌어도 같은 주문입니다. 값 객체는 어떤 사물의 특성을 설명하거나 계산하는 객체로, 개념적 정체성이 없습니다. 모든 객체에 정체성을 부여하면 성능 비용이 늘고 분석 작업이 늘며 모든 객체가 똑같아 보여서 모델이 흐려진다고 문서는 경고합니다. 금액, 기간, 주소처럼 값이 같으면 같은 것으로 취급하는 개념이 값 객체 후보입니다.

Kotlin 에서는 속성이 하나인 값 객체에 `value class`, 여러 속성이 있는 값 객체에 `data class` 가 어울립니다. Kotlin 문서에 따르면 `@JvmInline value class` 는 주 생성자에 속성이 정확히 하나여야 하며 런타임에는 그 속성 자체로 표현되어 대부분의 자리에서 래퍼 객체를 만들지 않습니다. 제네릭 타입, 인터페이스 타입, nullable 타입으로 쓰일 때는 박싱됩니다.

```kotlin
@JvmInline
value class OrderId(val value: String) {
    init { require(value.isNotBlank()) { "주문 ID 가 비어 있습니다" } }
}

@JvmInline
value class CustomerId(val value: String)

@JvmInline
value class ProductId(val value: String)

data class Money(val amount: Long, val currency: String) {
    init {
        require(amount >= 0) { "금액은 0 이상이어야 합니다" }
        require(currency.length == 3) { "통화 코드는 세 글자입니다" }
    }

    operator fun plus(other: Money): Money {
        require(currency == other.currency) { "통화가 다릅니다" }
        return Money(amount + other.amount, currency)
    }

    operator fun times(quantity: Int) = Money(amount * quantity, currency)

    companion object {
        fun zero(currency: String) = Money(0, currency)
    }
}
```

`OrderId` 와 `CustomerId` 를 둘 다 `String` 으로 두면 서로 바꿔 넘겨도 컴파일이 됩니다. 값 클래스로 감싸면 컴파일 타임에 구분되고 생성 시점에 형식 검증도 한 곳에 모입니다. `Money` 는 생성자에서 음수와 잘못된 통화를 막고 통화가 다른 두 금액의 덧셈을 거부합니다. 불변이므로 어디에 넘겨도 안전하고 값이 같으면 `equals` 가 같습니다.

### 애그리거트와 루트

복잡한 연관을 가진 객체 모델에서는 변경의 일관성을 보장하기가 어렵습니다. 「DDD Reference」의 애그리거트는 이 문제를 풀려고 객체를 묶고 경계를 그어, 그중 하나의 엔티티를 루트로 정하고 바깥 객체는 루트에만 참조를 갖게 합니다. 애그리거트 전체에 대한 속성과 불변식은 루트가 책임집니다. Fowler 의 설명도 같습니다. 애그리거트는 데이터를 읽고 저장하는 기본 단위이고 바깥에서 오는 참조는 루트로만 향해야 루트가 무결성을 지킬 수 있으며 트랜잭션은 여러 애그리거트에 걸치지 않아야 합니다.

![애그리거트 경계 도식. Order 애그리거트는 루트 Order 와 OrderLine, Money 값 객체를 하나의 트랜잭션 경계로 묶는다. 외부 코드는 루트로만 접근하고 내부 객체를 직접 수정할 수 없다. Customer 와 Product 같은 다른 애그리거트는 ID 로만 참조한다](@/assets/images/ddd-aggregate-boundary.png)

Order 애그리거트를 코드로 쓰면 다음과 같습니다. 항목 목록은 읽기 전용으로만 내보내고 모든 변경이 루트의 메서드를 지나가게 해서 불변식을 한곳에서 지킵니다.

```kotlin
enum class OrderStatus { DRAFT, CONFIRMED, CANCELLED }

data class OrderLine(val productId: ProductId, val unitPrice: Money, val quantity: Int) {
    val subtotal: Money get() = unitPrice * quantity
}

sealed interface DomainEvent

data class OrderConfirmed(
    val orderId: OrderId,
    val customerId: CustomerId,
    val total: Money,
) : DomainEvent

class Order(
    val id: OrderId,
    val customerId: CustomerId,
    private val currency: String,
) {
    private val _lines = mutableListOf<OrderLine>()
    private val _events = mutableListOf<DomainEvent>()

    val lines: List<OrderLine> get() = _lines.toList()

    var status: OrderStatus = OrderStatus.DRAFT
        private set

    val total: Money
        get() = _lines.fold(Money.zero(currency)) { sum, line -> sum + line.subtotal }

    fun addLine(productId: ProductId, unitPrice: Money, quantity: Int) {
        check(status == OrderStatus.DRAFT) { "확정된 주문은 수정할 수 없습니다" }
        require(quantity > 0) { "수량은 1 이상이어야 합니다" }
        require(unitPrice.currency == currency) { "주문 통화와 다릅니다" }

        val index = _lines.indexOfFirst { it.productId == productId }
        if (index >= 0) {
            val existing = _lines[index]
            _lines[index] = existing.copy(quantity = existing.quantity + quantity)
        } else {
            _lines += OrderLine(productId, unitPrice, quantity)
        }
    }

    fun confirm() {
        check(status == OrderStatus.DRAFT) { "이미 처리된 주문입니다" }
        check(_lines.isNotEmpty()) { "항목이 없는 주문은 확정할 수 없습니다" }
        status = OrderStatus.CONFIRMED
        _events += OrderConfirmed(id, customerId, total)
    }

    fun pullEvents(): List<DomainEvent> = _events.toList().also { _events.clear() }

    override fun equals(other: Any?) = other is Order && other.id == id
    override fun hashCode() = id.hashCode()
}
```

`Order` 는 엔티티라서 `equals` 가 `id` 만 봅니다. `OrderLine` 은 애그리거트 안에 있지만 값 객체처럼 `data class` 로 다뤘습니다. 같은 상품을 두 번 담으면 항목이 합쳐지고 수량이 0 이하이거나 통화가 다르면 예외가 나며 확정된 뒤에는 항목을 바꿀 수 없습니다. 이 규칙들이 `Order` 안에 있으므로 어느 호출 경로로 들어와도 같은 규칙이 적용됩니다.

### 애그리거트 설계 규칙

Vaughn Vernon 은 「Effective Aggregate Design」(2011, 세 편)에서 애그리거트 설계의 규칙을 정리했습니다. 진짜 불변식은 일관성 경계 안에서 모델링해야 합니다. 불변식은 항상 일관되어야 하는 비즈니스 규칙이고 여기서 말하는 일관성은 즉시 원자적으로 이루어지는 트랜잭션 일관성입니다. 이 규칙에 맞는 객체들만 한 애그리거트로 묶고 단순히 편해서 묶은 거대한 클러스터는 거짓 불변식에서 나온다고 그는 지적합니다.

애그리거트는 작게 설계해야 합니다. 항목이 수천 개 달린 상품에 항목 하나를 더하려고 그 전부를 메모리에 올려야 하는 구조는 성능과 확장성을 모두 해칩니다. Vernon 은 루트 엔티티와 필요한 최소한의 속성이나 값 타입 속성만 남기라고 권하며 필요한 만큼만 두고 그 이상은 넣지 않는 것이 적절한 최소라고 말합니다.

다른 애그리거트는 ID 로만 참조해야 합니다. 객체 참조 대신 전역적으로 고유한 ID 만 보관하면 참조 대상이 미리 로드되지 않아 애그리거트가 자연히 작아지고 영속 상태를 옮겨 분산하기 쉬워져 확장성도 얻습니다. 위 예의 `Order` 는 `Customer` 객체 없이 `CustomerId` 만 들고 있습니다.

경계 밖에서는 최종적 일관성을 씁니다. 한 요청이 여러 애그리거트에 영향을 줘야 한다면 하나만 그 트랜잭션에서 바꾸고 나머지는 시간차를 두고 맞춥니다. Vernon 은 이를 위해 애그리거트가 도메인 이벤트를 발행하고 구독자가 다른 트랜잭션에서 다른 애그리거트를 바꾸는 방식을 제시하고 즉시 일관되어야 하는지는 개발자가 정하지 말고 도메인 전문가에게 물어보라고 합니다. 구독자 처리가 실패하면 재시도하고 끝내 안 되면 보상하거나 사람의 개입을 요청합니다.

### 도메인 이벤트와 리포지토리

도메인 이벤트는 도메인 전문가가 관심을 갖는, 과거에 일어난 일을 표현합니다. 「DDD Reference」에서 이 패턴은 책 출간 후 Evans 가 DDD 의 일부로 추가한 것(문서의 별표 항목)이며 이벤트는 보통 불변이고 설명과 함께 발생 시각을 담는다고 말합니다. 위 `Order.confirm()` 은 상태를 바꾸면서 `OrderConfirmed` 를 쌓아 두고 저장 이후에 응용 계층이 이를 꺼내 발행합니다.

리포지토리는 유비쿼터스 언어로 표현한 애그리거트 조회 수단입니다. 문서에 따르면 단지 찾기 위해 모델에 탐색 가능한 연관을 늘리면 모델이 흐려지고 데이터베이스 접근 기술의 복잡성이 클라이언트 코드를 덮치면 도메인 계층이 빈약해집니다. 리포지토리는 직접 접근이 필요한 애그리거트 루트에만 둡니다. 인터페이스를 도메인 쪽에 두는 것은 이 글의 선택으로, [서버 아키텍처의 의존 방향 글](/posts/server-layered-hexagonal-clean/)에서 본 출력 포트가 이 인터페이스에 해당합니다.

```kotlin
interface OrderRepository {
    fun nextId(): OrderId
    fun findById(id: OrderId): Order?
    fun save(order: Order)
}

class ConfirmOrderService(
    private val orders: OrderRepository,
    private val publisher: DomainEventPublisher,
) {
    fun confirm(id: OrderId) {
        val order = orders.findById(id) ?: error("주문을 찾을 수 없습니다: ${id.value}")
        order.confirm()
        orders.save(order)
        order.pullEvents().forEach(publisher::publish)
    }
}

fun interface DomainEventPublisher {
    fun publish(event: DomainEvent)
}
```

이 서비스는 한 트랜잭션에서 `Order` 하나만 바꿉니다. 고객의 적립 포인트를 올리는 일은 `OrderConfirmed` 를 받는 별도의 핸들러가 `Customer` 애그리거트를 대상으로 다른 트랜잭션에서 처리하며 경계 밖에서는 최종적 일관성을 쓰라는 Vernon 의 규칙을 따른 모습입니다. 이벤트 발행이 저장과 원자적이지 않으면 저장은 됐는데 발행이 빠질 수 있다는 문제는 별개로 다뤄야 하며 이 문제를 푸는 아웃박스 같은 방식은 이 글의 범위를 벗어납니다.

### 도메인 서비스

어떤 개념은 엔티티나 값 객체의 동작으로 자연스럽게 들어가지 않습니다. 여러 애그리거트에 걸친 계산이나 정책이 대표적입니다. 「DDD Reference」는 이런 동작을 독립된 서비스 인터페이스로 모델에 추가하고 서비스의 이름도 유비쿼터스 언어의 일부로 삼으라고 말합니다.

```kotlin
enum class Grade { GENERAL, GOLD }

data class CustomerProfile(val id: CustomerId, val grade: Grade)

fun interface DiscountPolicy {
    fun discountFor(customer: CustomerProfile, total: Money): Money
}

class LoyaltyDiscountPolicy : DiscountPolicy {
    override fun discountFor(customer: CustomerProfile, total: Money): Money =
        if (customer.grade == Grade.GOLD) Money(total.amount / 10, total.currency)
        else Money.zero(total.currency)
}
```

도메인 서비스는 업무 규칙을 담는 곳이라서, 트랜잭션을 열고 리포지토리를 조합하는 응용 서비스(`ConfirmOrderService`)와 역할이 다릅니다. 도메인 서비스에 로직이 쌓이고 엔티티가 데이터만 들고 있는 상태가 되면 모델이 빈약해졌다는 신호입니다.

## 시작할 때의 우선순위

DDD 의 무게는 도메인의 복잡도에 비례해 정당화됩니다. 규칙이 단순한 CRUD 에 애그리거트와 이벤트를 모두 적용하면 코드만 늘어납니다. 전략적 설계는 작은 시스템에서도 비용이 적게 들어서 같은 단어를 서로 다른 뜻으로 쓰는 지점을 찾아 목록으로 만드는 일부터 시작해도 됩니다. 전술적 요소는 규칙이 복잡하고 자주 바뀌는 컨텍스트 하나에 먼저 적용하고 거기서 효과를 확인한 만큼 범위를 넓히는 순서가 부담이 적습니다.

## 참고 자료

- Eric Evans, 『Domain-Driven Design: Tackling Complexity in the Heart of Software』 (Addison-Wesley, 2003)
- Eric Evans, DDD Reference — https://www.domainlanguage.com/ddd/reference/
- Eric Evans, DDD Reference (PDF, 2015-03) — https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf
- Martin Fowler, Bounded Context — https://martinfowler.com/bliki/BoundedContext.html
- Martin Fowler, DDD Aggregate — https://martinfowler.com/bliki/DDD_Aggregate.html
- Vaughn Vernon, Effective Aggregate Design (Part I-III) — https://www.dddcommunity.org/library/vernon_2011/
- https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_1.pdf
- https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_2.pdf
- Kotlin, Inline value classes — https://kotlinlang.org/docs/inline-classes.html

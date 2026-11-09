---
title: "CQRS 와 이벤트 소싱: 읽기 모델과 프로젝션, 최종적 일관성, 아웃박스 패턴, 쓰지 말아야 할 때"
description: "명령과 조회의 모델을 나누는 CQRS, 상태 대신 이벤트를 저장하는 이벤트 소싱, 읽기 모델과 프로젝션 재구축, 최종적 일관성, 이벤트 발행을 신뢰할 수 있게 만드는 트랜잭셔널 아웃박스를 Kotlin 코드와 애니메이션으로 확인하고 Fowler 의 경고까지 짚습니다."
pubDatetime: 2025-07-15T21:50:00+09:00
category: server
tags:
  - CQRS
  - 이벤트 소싱
  - 아웃박스
  - 아키텍처
---

대부분의 애플리케이션은 하나의 모델로 데이터를 쓰고 읽습니다. 주문 객체를 저장하는 코드와 주문 목록 화면에 보여 줄 데이터를 뽑는 코드가 같은 엔티티와 같은 테이블을 공유하는 식입니다. 규칙이 단순할 때는 문제가 없지만 쓰기 쪽 규칙이 복잡해지고 읽기 쪽 화면이 제각각이 되면 한 모델이 양쪽을 모두 어정쩡하게 만족시키는 상황이 나옵니다. CQRS 와 이벤트 소싱은 이 지점에서 쓰는 두 가지 도구로, 서로 독립적이지만 함께 쓰는 일이 많습니다.

## CQRS 는 갱신 모델과 조회 모델을 나눕니다

Martin Fowler 의 설명(2011)에 따르면 CQRS(Command Query Responsibility Segregation)는 정보를 갱신하는 모델과 읽는 모델을 분리하는 패턴입니다. 그는 이 패턴을 Greg Young 에게서 처음 들었다고 밝힙니다. 개념 모델을 갱신을 맡는 Command 쪽과 표시를 맡는 Query 쪽으로 가르면, 하나의 모델로는 두 목적을 다 잘 채우지 못하는 복잡한 도메인에서 도움이 됩니다.

![CQRS 도식. 클라이언트의 Command 는 Command Handler 와 도메인 모델을 거쳐 쓰기 저장소에 반영되고, 변경은 이벤트로 읽기 모델을 갱신한다. Query 는 Query Handler 가 읽기 모델에서 바로 응답한다](@/assets/images/cqrs-command-query-split.png)

Chris Richardson 의 microservices.io 는 이 패턴을 마이크로서비스 맥락에서 설명합니다. 서비스마다 자기 데이터베이스를 갖는 구조에서는 여러 서비스의 데이터가 필요한 쿼리를 만들기 어렵고 이를 위해 특정 쿼리 묶음에 맞춘 읽기 전용 뷰 데이터베이스를 따로 둡니다. 이 뷰는 데이터를 소유한 서비스들이 발행하는 도메인 이벤트를 구독해 최신 상태를 유지하고 쿼리에 맞게 최적화한 스키마와 종류(문서 DB, 키-값 저장소 등)를 쓸 수 있습니다. 같은 페이지가 꼽는 이점은 비정규화된 뷰를 여럿 두어 성능과 확장성을 얻는 것, 그리고 읽기와 쓰기를 나눠 두 모델이 각각 단순해지는 것입니다.

### 코드로 보는 분리

쓰기 쪽은 도메인 규칙을 지키는 일에 집중하고 읽기 쪽은 화면이 필요한 모양의 데이터를 그대로 돌려줍니다.

```kotlin
sealed interface OrderEvent {
    val orderId: String

    data class Placed(
        override val orderId: String,
        val customerId: String,
        val total: Long,
        val itemCount: Int,
    ) : OrderEvent

    data class Shipped(override val orderId: String) : OrderEvent
}

data class PlaceOrder(val orderId: String, val customerId: String, val lines: List<Line>) {
    data class Line(val sku: String, val quantity: Int, val unitPrice: Long)
}

class PlaceOrderHandler(
    private val orders: OrderRepository,
    private val events: EventPublisher,
) {
    fun handle(command: PlaceOrder) {
        val order = Order.place(command.orderId, command.customerId, command.lines)
        orders.save(order)
        events.publish(OrderEvent.Placed(order.id, order.customerId, order.total, order.lines.size))
    }
}
```

저장과 발행이 원자적이지 않은 이 코드는 뒤의 아웃박스 절에서 다시 다룹니다.

```kotlin
data class OrderSummary(
    val orderId: String,
    val customerId: String,
    val status: String,
    val total: Long,
    val itemCount: Int,
)

interface OrderSummaryQuery {
    fun findByCustomer(customerId: String): List<OrderSummary>
}

class OrderSummaryProjection(private val store: OrderSummaryStore) {
    fun on(event: OrderEvent) = when (event) {
        is OrderEvent.Placed -> store.upsert(
            OrderSummary(event.orderId, event.customerId, "PLACED", event.total, event.itemCount)
        )
        is OrderEvent.Shipped -> store.updateStatus(event.orderId, "SHIPPED")
    }
}
```

`OrderSummary` 에는 도메인 로직이 없습니다. 화면의 목록 한 줄에 필요한 필드만 평평하게 담았고 조인이나 계산 없이 한 번의 조회로 나옵니다. `OrderSummaryProjection` 이 이벤트를 받아 이 읽기 모델을 갱신하는 부분이 프로젝션입니다. 읽기 모델이 별도 저장소라면 이벤트가 도착하기 전까지 값이 이전 상태에 머물러 있고 이것이 최종적 일관성입니다. Fowler 도 모델을 나누면 데이터 일관성을 지키기 어려워져 최종적 일관성이 나타나기 쉽다고 지적하며 microservices.io 는 뷰가 원본 데이터보다 뒤처질 수 있다고 단점으로 적습니다. 주문 직후 목록 화면에 방금 주문이 보이지 않는 증상이 대표적이고 명령의 응답에 결과를 담아 화면이 그 값을 먼저 보여 주거나 읽기 모델이 따라잡을 때까지 잠시 기다리는 식으로 다룹니다. 어느 방식이 맞는지는 업무가 지연을 얼마나 허용하는지에 달렸습니다.

CQRS 를 쓴다고 저장소가 두 개일 필요는 없습니다. 같은 데이터베이스에서 쓰기용 모델과 읽기용 조회 모델을 코드로만 나누는 단계도 CQRS 의 시작점이 됩니다. 읽기 부하나 모양이 달라져서 쓰기 저장소가 감당하기 어려울 때 읽기 저장소를 분리하는 식으로 단계를 올릴 수 있습니다.

## 이벤트 소싱은 상태 대신 사건을 저장합니다

Fowler 가 2005년에 쓴 「Event Sourcing」은 애플리케이션 상태의 모든 변화를 이벤트 객체로 기록하고 이벤트를 적용된 순서대로 저장하는 패턴으로 정의합니다. 현재 상태는 이벤트들에서 도출됩니다. 로그가 알려 주는 것은 어떤 상태인지에 더해 어떻게 그 상태에 이르렀는지이고 버전 관리 시스템과 감사 이력이 익숙한 예입니다.

microservices.io 의 Event Sourcing 패턴은 같은 아이디어를 마이크로서비스 문제에 연결합니다. 엔티티의 현재 상태 대신 상태 변화의 연속을 이벤트로 저장하면 저장 동작이 하나의 원자적 작업이 되고 현재 상태는 이벤트를 재생해 복원합니다. 이벤트 저장소는 메시지 브로커 역할도 겸할 수 있어서 서비스가 이벤트가 저장되는 대로 구독할 수 있습니다. 상태가 바뀔 때마다 이벤트가 빠짐없이 발행되고 변경 이력이 그대로 감사 로그가 되며 특정 시점의 상태를 되짚는 시간 질의도 이점으로 듭니다.

```kotlin
sealed interface AccountEvent {
    val accountId: String

    data class Opened(override val accountId: String) : AccountEvent
    data class Deposited(override val accountId: String, val amount: Long) : AccountEvent
    data class Withdrawn(override val accountId: String, val amount: Long) : AccountEvent
}

class Account private constructor() {
    var id: String = ""
        private set
    var balance: Long = 0
        private set
    var version: Int = 0
        private set

    private val pending = mutableListOf<AccountEvent>()

    fun deposit(amount: Long) {
        require(amount > 0) { "입금액은 양수여야 합니다" }
        raise(AccountEvent.Deposited(id, amount))
    }

    fun withdraw(amount: Long) {
        require(amount > 0) { "출금액은 양수여야 합니다" }
        check(balance >= amount) { "잔액이 부족합니다" }
        raise(AccountEvent.Withdrawn(id, amount))
    }

    fun pullEvents(): List<AccountEvent> = pending.toList().also { pending.clear() }

    private fun raise(event: AccountEvent) {
        on(event)
        pending += event
    }

    private fun on(event: AccountEvent) {
        when (event) {
            is AccountEvent.Opened -> id = event.accountId
            is AccountEvent.Deposited -> balance += event.amount
            is AccountEvent.Withdrawn -> balance -= event.amount
        }
        version++
    }

    companion object {
        fun open(id: String) = Account().also { it.raise(AccountEvent.Opened(id)) }

        fun fromHistory(history: List<AccountEvent>) = Account().also { acct -> history.forEach(acct::on) }
    }
}
```

명령 메서드는 검증을 통과하면 이벤트를 만들어 `raise` 로 자기 상태에 적용하고 `pending` 에 쌓습니다. 상태를 직접 바꾸는 코드는 `on` 에만 있어서 처음 만들 때와 저장된 이력에서 복원할 때 같은 경로를 탑니다. `on` 은 검증하지 않고 이미 일어난 사실만 반영하므로 규칙이 나중에 바뀌어도 과거 이벤트를 재생할 수 있습니다.

```kotlin
interface EventStore {
    fun load(streamId: String): List<AccountEvent>
    fun append(streamId: String, expectedVersion: Int, events: List<AccountEvent>)
}

class WithdrawService(private val store: EventStore) {
    fun withdraw(accountId: String, amount: Long) {
        val account = Account.fromHistory(store.load(accountId))
        val loadedVersion = account.version
        account.withdraw(amount)
        store.append(accountId, loadedVersion, account.pullEvents())
    }
}
```

`append` 의 `expectedVersion` 은 같은 스트림에 동시에 쓰는 요청 중 하나만 성공하게 하는 낙관적 동시성 제어입니다. 읽은 뒤 다른 요청이 먼저 이벤트를 붙였다면 버전이 어긋나 실패하고 호출 쪽이 다시 읽어 재시도합니다.

### 이벤트에서 상태를 다시 만듭니다

아래 애니메이션은 계좌 이벤트가 쌓이면서 잔액 프로젝션이 갱신되는 과정과, 프로젝션을 잃었을 때 이벤트 로그를 처음부터 재생해 같은 상태를 복원하는 과정을 보여 줍니다.

![이벤트 스트림과 프로젝션 애니메이션. 이벤트가 하나씩 추가될 때마다 잔액 프로젝션이 0, 100, 70, 120, 100 으로 갱신된다. 프로젝션을 잃으면 상태를 초기화하고 로그를 1번부터 재생해 같은 100 을 다시 만든다](@/assets/images/cqrs-event-stream-projection.gif)

현재 상태는 `fold(events)` 의 결과일 뿐이고 진실의 원천은 로그입니다. Fowler 는 현재 상태를 버리고 빈 애플리케이션에 이벤트를 재생해 다시 만들 수 있고 수정된 로직으로 이벤트를 다시 처리하거나 순서가 어긋나 도착한 이벤트를 바로잡는 데도 쓸 수 있다고 설명합니다. 이 성질은 CQRS 의 읽기 모델과 만납니다. 새 화면이 필요해 읽기 모델을 추가할 때 기존 이벤트 전체를 새 프로젝션에 흘려 보내면 과거 데이터까지 채워지고 프로젝션 버그를 고쳤다면 프로젝션만 지우고 다시 돌리면 됩니다.

```kotlin
fun balanceOf(events: List<AccountEvent>): Long =
    events.fold(0L) { balance, event ->
        when (event) {
            is AccountEvent.Opened -> balance
            is AccountEvent.Deposited -> balance + event.amount
            is AccountEvent.Withdrawn -> balance - event.amount
        }
    }
```

이벤트가 많아지면 매번 처음부터 재생하기가 느려지므로 스냅샷을 씁니다. Fowler 는 현재 상태를 저장해 두고 이후 이벤트만 재생하는 방식을 설명하고 스냅샷은 실행 중인 애플리케이션을 멈추지 않고 병렬로 만들 수 있다고 적습니다. microservices.io 도 이벤트가 많은 엔티티는 주기적으로 스냅샷을 저장하고 최신 스냅샷 이후의 이벤트만 재생한다고 설명합니다.

재생에는 주의점이 있습니다. 이벤트 처리가 외부 시스템에 메시지를 보내는 부수 효과를 가지면 재생할 때 같은 메시지가 다시 나갑니다. Fowler 는 외부 시스템을 게이트웨이로 감싸서 이벤트 처리기가 재생 모드인지 확인하고 모드일 때는 호출을 막으라고 권합니다. 외부 조회 결과(환율이나 가격)는 응답을 로그로 남겨 재생 때 원래 답을 재사용하게 합니다. 같은 글은 시간에 따라 달라지는 규칙(특정 날짜부터 바뀌는 수수료 등)은 도메인 모델에서 날짜로 전략을 고르도록 두고 버그 수정과 시간 규칙이 겹치면 매우 복잡해진다고 경고합니다. Fowler 의 글은 이벤트 형식 자체가 바뀌는 스키마 진화는 다루지 않습니다. 이미 저장된 이벤트는 고칠 수 없으므로, 새 코드가 옛 형식의 이벤트를 읽을 때 새 형식으로 바꾸는 변환 규칙(업캐스팅)을 버전별로 따로 관리해야 합니다.

## 이벤트를 신뢰할 수 있게 내보내는 아웃박스

이벤트 소싱을 쓰지 않는 서비스도 상태를 바꾸면서 다른 서비스에 이벤트를 알려야 하는 일이 흔합니다. 흔히 이중 쓰기(dual write) 문제라고 부르는 상황입니다. microservices.io 의 Transactional outbox 패턴은 이를 데이터베이스 갱신과 메시지 발행을 어떻게 원자적으로 할 것인가의 문제로 설명합니다. 서비스는 이 두 작업을 원자적으로 해야 하는데, 2단계 커밋은 데이터베이스나 브로커가 지원하지 않거나 둘에 서비스를 묶는 점 때문에 좋은 선택이 못 됩니다. 트랜잭션 안에서 메시지를 보내면 트랜잭션이 롤백될 수 있고 커밋 뒤에 보내면 그 사이에 서비스가 죽어서 메시지를 잃을 수 있습니다.

트랜잭셔널 아웃박스 패턴은 보낼 메시지를 비즈니스 데이터와 같은 트랜잭션에서 아웃박스 테이블에 저장합니다. 이후 별도의 메시지 릴레이가 아웃박스를 읽어 브로커에 발행합니다. 릴레이 구현으로는 테이블을 주기적으로 조회하는 폴링 퍼블리셔와 데이터베이스의 트랜잭션 로그를 읽는 방식이 있습니다. 이점은 2단계 커밋이 필요 없고 데이터베이스 트랜잭션이 커밋될 때만 메시지가 나가며 메시지가 애플리케이션이 만든 순서대로 나간다는 것입니다.

```kotlin
class OrderRepository(private val db: Database) {
    fun save(order: Order, events: List<OrderEvent>) = db.transaction { tx ->
        tx.upsert(order)
        events.forEach { event ->
            tx.insertOutbox(OutboxRow(id = UUID.randomUUID().toString(), type = event::class.simpleName ?: "Unknown", payload = Json.encode(event)))
        }
    }
}

class OutboxRelay(private val db: Database, private val broker: MessageBroker) {
    fun pollOnce() {
        db.fetchUnpublished(limit = 100).forEach { row ->
            broker.publish(messageId = row.id, type = row.type, payload = row.payload)
            db.markPublished(row.id)
        }
    }
}
```

단점도 있습니다. 릴레이가 메시지를 발행한 직후 발행 사실을 기록하기 전에 죽으면 같은 메시지가 다시 발행됩니다. 메시지는 적어도 한 번 전달되는 것으로 보고 소비자가 멱등해야 합니다. microservices.io 는 처리한 메시지 ID 를 기록하는 방식을 예로 들며 브로커도 중복 전달을 할 수 있어서 이미 필요한 요건인 경우가 많다고 덧붙입니다.

```kotlin
class IdempotentConsumer(
    private val processed: ProcessedMessages,
    private val handler: (Message) -> Unit,
) {
    fun onMessage(message: Message) {
        if (processed.markIfNew(message.id)) handler(message)
    }
}
```

실제로는 `markIfNew` 와 `handler` 의 부작용을 같은 트랜잭션에 넣어야 중복 방지가 완전해집니다. 이벤트 소싱에서는 이벤트 저장이 곧 기록이므로 소비자가 이벤트 저장소를 직접 구독하게 하면 아웃박스가 따로 필요 없습니다. 별도 브로커로 넘긴다면 그 전달 구간은 아웃박스 릴레이와 같은 at-least-once 처리가 필요합니다. microservices.io 도 이벤트 소싱의 이점으로 상태가 바뀔 때마다 이벤트가 안정적으로 발행되는 것을 듭니다.

## DDD, 사가와의 관계

[DDD 입문 글](/posts/ddd-basics/)의 애그리거트는 트랜잭션 일관성의 경계이고 이벤트 소싱에서는 애그리거트 하나가 이벤트 스트림 하나에 대응하는 것이 자연스럽습니다. 위 `Account` 가 그 모양입니다. 도메인 이벤트는 애그리거트 사이를 최종적 일관성으로 잇는 수단이고 이 이벤트를 신뢰할 수 있게 내보내는 데 아웃박스나 이벤트 소싱이 쓰입니다.

Fowler 는 CQRS 가 DDD 의 바운디드 컨텍스트 단위로 적용되어야 한다고 말합니다. 컨텍스트마다 자기 모델링 방식을 고르고 시스템 전체에 일률로 적용하지 않는다는 뜻입니다. 이벤트 중심 프로그래밍과 잘 맞고 이벤트를 내는 쓰기 모델 덕분에 읽기 모델을 메모리 구조로 만들어 데이터베이스 접근을 줄일 수도 있다고 덧붙입니다.

[모놀리스와 마이크로서비스 글](/posts/monolith-vs-microservices/)의 사가도 이 도구들과 이어집니다. 코레오그래피 방식의 사가는 서비스가 발행하는 도메인 이벤트로 다음 단계를 촉발하므로, 이벤트가 유실되면 사가가 중간에서 멈춥니다. 아웃박스가 그 유실을 막고 소비자의 멱등성이 중복 전달을 견디게 합니다. 서비스 경계를 넘는 조회는 CQRS 의 읽기 모델이 맡습니다. microservices.io 는 서비스별 데이터베이스 구조에서 서비스 간 트랜잭션에는 사가를, 서비스 간 쿼리에는 API 조합(API Composition)과 CQRS 를 해법으로 소개합니다.

## 쓰지 말아야 할 때

Fowler 는 CQRS 가 상당한 사고의 도약을 요구하고 자신이 본 사례의 대부분이 잘 풀리지 않았다고 말합니다. 대부분의 시스템에서는 위험한 복잡도를 더하므로 CRUD 방식이 더 낫고 적용하더라도 시스템 전체가 아닌 특정 부분에만 쓰라고 권합니다. 도메인이 복잡해서 DDD 의 이점을 보는 소수의 경우에만 맞고 대부분의 도메인은 모델이 겹치는 부분이 커서 하나를 공유하는 쪽이 단순하다고도 합니다.

microservices.io 는 이벤트 소싱의 단점으로 익숙하지 않은 프로그래밍 스타일과 학습 곡선, 이벤트 저장소를 직접 쿼리하기 어려운 것을 듭니다. 읽기는 대개 CQRS 에 기대야 하고 그러면 최종적 일관성을 다뤄야 합니다. 도입 비용을 항목별로 비교하면 다음과 같습니다.

| 항목             | 단순 CRUD             | CQRS                      | CQRS + 이벤트 소싱              |
| ---------------- | --------------------- | ------------------------- | ------------------------------- |
| 모델 수          | 1개                   | 쓰기와 읽기 2종           | 이벤트, 쓰기 모델, 읽기 모델    |
| 일관성           | 즉시                  | 읽기 모델이 따로면 최종적 | 쓰기는 즉시, 읽기 모델은 최종적 |
| 이력 보존        | 별도 감사 테이블 필요 | 별도 감사 테이블 필요     | 로그 자체가 이력                |
| 디버깅           | 현재 상태만           | 현재 상태만               | 이벤트 재생으로 재현            |
| 학습과 운영 부담 | 낮음                  | 중간                      | 높음                            |

도입 근거가 될 만한 신호는 읽기와 쓰기의 부하나 모양이 크게 달라 한 모델이 둘 다 못 맞추는 경우, 감사 이력이나 특정 시점 조회가 업무 요구사항인 경우, 다른 서비스가 변경을 구독해야 하는 경우입니다. 이런 요구가 없다면 한 모델과 단순한 트랜잭션이 더 싸고 안전합니다. 필요가 생긴 컨텍스트에서만, 가능한 가장 가벼운 단계(같은 DB 의 조회 전용 쿼리, 아웃박스를 붙인 이벤트 발행)부터 시작하는 편이 안전합니다.

## 참고 자료

- Martin Fowler, CQRS — https://martinfowler.com/bliki/CQRS.html
- Martin Fowler, Event Sourcing — https://martinfowler.com/eaaDev/EventSourcing.html
- Chris Richardson, Pattern: Event sourcing — https://microservices.io/patterns/data/event-sourcing.html
- Chris Richardson, Pattern: Command Query Responsibility Segregation (CQRS) — https://microservices.io/patterns/data/cqrs.html
- Chris Richardson, Pattern: Transactional outbox — https://microservices.io/patterns/data/transactional-outbox.html
- Chris Richardson, Pattern: Saga — https://microservices.io/patterns/data/saga.html
- Chris Richardson, Pattern: Database per service — https://microservices.io/patterns/data/database-per-service.html
- Chris Richardson, Pattern: API Composition — https://microservices.io/patterns/data/api-composition.html

---
title: "MySQL, Oracle, PostgreSQL 은 같은 SQL 을 써도 같은 데이터베이스가 아닙니다"
description: "MySQL(MariaDB), Oracle, PostgreSQL 의 라이선스, MVCC, 기본 격리 수준, upsert 와 JSON 문법, 벡터 검색을 나란히 놓고 최신 버전과 인기 지표, 어떤 상황에 무엇을 고를지까지 적었습니다."
pubDatetime: 2026-11-08T22:06:00+09:00
category: server
tags:
  - MySQL
  - MariaDB
  - Oracle
  - PostgreSQL
  - 데이터베이스
---

서버 개발에서 데이터베이스를 고를 때 가장 먼저 나오는 이름이 MySQL, Oracle, PostgreSQL 입니다. 셋 다 오래된 관계형 데이터베이스고 SQL 로 같은 일을 하는 것처럼 보이지만 **소유자, 라이선스, 이전 버전 행을 두는 위치, 트랜잭션 기본 동작이 전부 다릅니다.** MySQL 에서 갈라져 나온 MariaDB 는 이제 별개 제품에 가까워서 같이 다룹니다.

주요 버전은 PostgreSQL 18(최신 마이너 18.6), MySQL 8.4 LTS 와 9.7 LTS(최신 9.7.4), MariaDB 12.3 LTS, Oracle AI Database 26ai 입니다.

## 라이선스와 거버넌스

PostgreSQL 은 BSD, MIT 와 비슷한 permissive 라이선스인 PostgreSQL License 로 배포됩니다. 저작권 고지만 남기면 무료로 쓰고 고치고 배포할 수 있습니다. 프로젝트는 영구히 자유 소프트웨어로 두고 라이선스를 바꿀 계획이 없다고 밝힙니다. 특정 기업이 아니라 PostgreSQL Global Development Group 이라는 커뮤니티가 개발합니다.

MySQL 은 이중 라이선스입니다. 오픈소스 쪽은 GPLv2 이고, 자사 상용 소프트웨어에 MySQL 을 내장해 파는 OEM 이나 ISV 에게는 상용 라이선스를 따로 팝니다. 서버를 사내에서 쓰는 보통의 경우에는 GPL 로 충분합니다. 그래도 소유권이 Oracle 에 있다는 건 알고 있어야 합니다.

MariaDB 는 그 구조에 대한 대응으로 나온 포크입니다. 서버는 GPL 계열이고 MariaDB Foundation 이 개발을 지원합니다.

Oracle Database 는 상용 제품입니다. 코어 수, 메모리, 데이터 크기 제한 없이 쓰려면 Enterprise Edition 라이선스가 필요합니다. 학습용으로는 무료 에디션 Oracle AI Database Free 가 있고 제약은 CPU 2코어, RAM 2GB, 사용자 데이터 12GB, 호스트당 인스턴스 1개입니다. 12GB 를 넘으면 `ORA-12954` 가 납니다.

## 저장 구조와 MVCC

셋 다 MVCC 로 읽기가 쓰기를 막지 않게 하지만 이전 버전을 두는 곳이 다릅니다.

MySQL 의 InnoDB 는 테이블 자체가 클러스터드 인덱스이고 행을 제자리에서 갱신합니다. 이전 버전은 undo log 에 있고, 행마다 숨은 컬럼 `DB_TRX_ID` 와 `DB_ROLL_PTR` 가 마지막 수정 트랜잭션과 이전 버전 포인터를 담습니다. 읽는 쪽은 필요하면 undo 를 따라가 과거 행을 복원합니다. 삭제는 delete-mark 만 해 두고 purge 스레드가 나중에 치웁니다. 오래 열린 트랜잭션은 undo 를 붙잡으므로 매뉴얼도 주기적인 커밋을 권합니다.

Oracle 도 undo segment 에 변경 전 값을 기록하니 구조가 가깝습니다. 쿼리가 시작된 SCN 이후에 바뀐 블록을 만나면 버퍼에 복사해 undo 를 적용한 consistent read clone 으로 읽습니다. undo 영역은 순환 재사용되기 때문에 오래 도는 쿼리는 필요한 undo 가 덮어써져 `snapshot too old` 를 만날 수 있고, 이걸 줄이는 설정이 undo retention 입니다.

```sql
ALTER SYSTEM SET UNDO_RETENTION = 900;
```

PostgreSQL 은 완전히 다릅니다. `UPDATE` 나 `DELETE` 는 이전 행 버전을 지우지 않고 힙 안에 남기고, 어떤 트랜잭션도 더는 볼 수 없는 죽은 버전을 `VACUUM` 이 회수합니다. 공식 문서는 autovacuum 을 기본으로 켜 두고 강하게 권장하며, 트랜잭션 ID 가 32비트라 약 20억 트랜잭션마다 오래된 행을 freeze 해야 한다고 설명합니다. 쓰기가 많은 테이블이라면 autovacuum 을 테이블 단위로 조정하는 일이 운영의 한 부분입니다.

```sql
ALTER TABLE busy_table SET (autovacuum_vacuum_scale_factor = 0.02);
```

![MySQL InnoDB 는 클러스터드 인덱스의 행에서 DB_ROLL_PTR 로 undo log 의 이전 버전을 따라가고 purge 스레드가 나중에 정리하며, Oracle 은 undo segment 를 SCN 이후 바뀐 블록에 적용해 consistent read clone 으로 읽고, PostgreSQL 은 힙에 행 버전을 남겨 두었다가 VACUUM 이 죽은 버전을 회수한다](@/assets/images/mysql-oracle-postgresql-mvcc.png)

PostgreSQL 18 은 2025년 9월 25일에 나왔고 비동기 I/O(AIO) 하위 시스템이 들어왔습니다. 순차 스캔, 비트맵 힙 스캔, vacuum 이 여러 I/O 요청을 동시에 던지고, `io_method` 로 `worker`, `io_uring`, `sync`(18 이전 동작) 중에서 고릅니다. 릴리즈 노트에는 특정 상황에서 최대 3배 향상이라고 나옵니다. 타임스탬프 정렬 UUID 를 만드는 `uuidv7()`, 기본이 virtual 인 generated column, 멀티컬럼 B-tree 의 skip scan 도 같은 릴리즈에 들어 있습니다.

## 트랜잭션 격리 수준 기본값

애플리케이션 동작에 가장 직접 닿는 차이입니다.

InnoDB 의 기본은 `REPEATABLE READ` 로, 트랜잭션에서 첫 읽기가 만든 스냅샷을 이후 일반 `SELECT` 가 계속 씁니다. PostgreSQL 과 Oracle 은 `READ COMMITTED` 가 기본이라 PostgreSQL 은 문장마다, Oracle 은 쿼리마다 새 스냅샷을 봅니다. PostgreSQL 에서 `REPEATABLE READ` 를 요청하면 스냅샷 격리가 되는데, 다른 트랜잭션이 이미 커밋한 행을 갱신하려 하면 `could not serialize access due to concurrent update` 가 나서 애플리케이션이 트랜잭션을 재시도해야 합니다.

InnoDB 는 같은 `REPEATABLE READ` 안에서도 잠금을 거는 문장(`UPDATE`, `SELECT ... FOR UPDATE`)이 최신 커밋 상태를 읽습니다. 그래서 일반 `SELECT` 와 잠금 문장을 한 트랜잭션에 섞으면 결과가 어긋날 수 있다고 매뉴얼이 경고합니다. 격리 수준은 세션 단위로 바꿀 수 있습니다.

```sql
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

## SQL 기능과 문법 차이

윈도우 함수와 CTE 는 이제 세 제품 모두 평범하게 씁니다. 차이는 방언에서 나옵니다. upsert 하나만 봐도 문법이 셋 다 다릅니다.

MySQL 은 `ON DUPLICATE KEY UPDATE` 입니다. 새 값을 참조하던 `VALUES(col)` 은 deprecated 라서 행 별칭을 쓰라고 매뉴얼이 안내합니다.

```sql
INSERT INTO users (id, name, login_count)
VALUES (1, 'kim', 1) AS new
ON DUPLICATE KEY UPDATE login_count = login_count + new.login_count;
```

PostgreSQL 은 `ON CONFLICT` 로 충돌 대상을 반드시 지정해야 하고, 넣으려던 행은 `EXCLUDED` 로 읽습니다.

```sql
INSERT INTO users (id, name, login_count)
VALUES (1, 'kim', 1)
ON CONFLICT (id) DO UPDATE
SET login_count = users.login_count + EXCLUDED.login_count;
```

Oracle 은 표준 SQL 의 `MERGE` 입니다. 소스와 대상을 조인해 맞으면 갱신하고 아니면 삽입합니다.

```sql
MERGE INTO users t
USING (SELECT 1 AS id, 'kim' AS name FROM dual) s
ON (t.id = s.id)
WHEN MATCHED THEN UPDATE SET t.login_count = t.login_count + 1
WHEN NOT MATCHED THEN INSERT (id, name, login_count)
  VALUES (s.id, s.name, 1);
```

MySQL 방식은 유니크 키가 여럿인 테이블에서 한 행만 갱신하기 때문에 쓰지 말라는 것이 매뉴얼의 권고입니다. `MERGE` 는 같은 대상 행을 한 문장에서 두 번 갱신할 수 없습니다.

JSON 을 꺼내는 문법도 제각각입니다. PostgreSQL 은 이진 형식 `jsonb` 에 인덱스를 걸 수 있고, MySQL 은 `JSON` 타입과 경로 연산자, Oracle 은 `JSON_VALUE` 같은 함수를 씁니다.

```sql
-- PostgreSQL
SELECT payload ->> 'name' FROM events WHERE payload @> '{"type":"login"}';

-- MySQL
SELECT payload ->> '$.name' FROM events WHERE payload ->> '$.type' = 'login';

-- Oracle
SELECT JSON_VALUE(payload, '$.name') FROM events
WHERE JSON_VALUE(payload, '$.type') = 'login';
```

절차형 언어는 Oracle 의 PL/SQL, PostgreSQL 의 PL/pgSQL, MySQL 의 저장 프로시저입니다. PL/pgSQL 이 PL/SQL 과 닮긴 했어도 마이그레이션할 때 패키지, 예외 처리, 데이터 타입은 그대로 옮겨지지 않습니다.

## 확장과 벡터 검색

PostgreSQL 은 확장이 생태계의 중심입니다. 지리 정보는 PostGIS, 시계열은 TimescaleDB, 벡터 검색은 pgvector 가 대표적입니다. pgvector 최신 버전은 0.8.7 이고 PostgreSQL 13 이상을 지원합니다. 인덱스에 쓸 수 있는 차원은 `vector` 타입이 2,000 까지, `halfvec` 가 4,000 까지이고 인덱스는 HNSW 와 IVFFlat 중에서 고릅니다. HNSW 는 속도와 재현율의 균형이 좋은 대신 빌드가 느리고 메모리를 더 씁니다.

Oracle 은 AI Vector Search 를 데이터베이스 기능으로 내장합니다. `VECTOR` 타입을 일반 컬럼과 함께 저장하고, 전체를 비교하는 정확 검색과 벡터 인덱스를 쓰는 근사 검색을 둘 다 지원합니다. ONNX 모델을 데이터베이스로 가져와 SQL 로 임베딩을 만들 수도 있습니다.

MySQL 9.7 에도 `VECTOR(N)` 타입이 생겼습니다. 기본 길이 2048, 최대 16383 이고 `STRING_TO_VECTOR()` 로 문자열을 변환하지만, 키로는 못 쓰고 동등 비교만 됩니다. 내장 벡터 스토어와 RAG 는 MySQL HeatWave 쪽에서 제공한다고 문서에 나옵니다.

## 복제, 고가용성, 관리형 서비스

MySQL 은 Group Replication 으로 다중 노드를 구성하고, Oracle 은 Data Guard 와 RAC 를 씁니다. PostgreSQL 은 스트리밍 복제와 논리 복제를 내장하고 자동 장애 조치에는 Patroni 같은 외부 도구를 흔히 붙입니다.

관리형으로는 AWS 의 Aurora 와 RDS, Google Cloud SQL, 서버리스 형태의 Neon 과 Supabase, Oracle 의 Autonomous Database 가 있습니다. 지원 버전과 요금은 서비스마다 빠르게 바뀌니 도입 전에 각사 문서를 보셔야 합니다.

## MariaDB 는 MySQL 의 대체품이 아닙니다

MariaDB 는 MySQL 5.x 시절 호환 포크로 시작했지만 지금은 릴리즈 라인이 따로 있습니다. 10.x, 11.x, 12.x 로 번호가 올라가고 MySQL 8.0, 8.4, 9.x 와는 번호가 대응되지 않습니다. MariaDB 문서에 "MariaDB 11.8 과 MySQL 8.0 의 비호환성 및 기능 차이" 같은 별도 페이지가 있는 것도 그래서입니다. 드롭인 대체로 가정하지 말고, 연결 프로토콜이 비슷한 다른 제품으로 보고 쓰는 기능을 하나씩 확인하는 쪽이 안전합니다.

## 지금 상황

PostgreSQL 은 5개 메이저 버전을 지원합니다. 18(최신 마이너 18.6, 지원 종료 2030년 11월 14일), 17(17.11), 16(16.15), 15(15.19), 14(14.24)이고 14 는 2026년 11월 12일에 끝납니다. 공식 정책은 늘 해당 메이저의 최신 마이너를 쓰라고 합니다.

MySQL 은 릴리즈 모델이 바뀌었습니다. 공식 EOL 공지로 MySQL 8.0 은 2026년 4월에 끝났고 지금 현역은 8.4 LTS 와 9.7 LTS 입니다. 9.7 은 2026년 4월 21일의 9.7.0 으로 시작해 2026년 10월 20일에 9.7.4 가 나왔습니다.

MariaDB 의 LTS 는 12.3(2026년 5월 28일 GA, 커뮤니티 지원 종료 2029년 6월 12일), 11.8(2025년 6월 4일, 2028년 6월 4일), 11.4(2024년 5월 29일, 2029년 5월 29일), 10.11(2028년 2월 종료)입니다. 10.6 은 2026년 7월에 커뮤니티 지원이 끝났고, 롤링 릴리즈로 13.0 과 13.1 이 있습니다.

Oracle 은 이름이 바뀌었습니다. 23ai 의 후속이 Oracle AI Database 26ai 이고, 문서 세트 이름도 같으며 무료 에디션은 Oracle AI Database Free 입니다.

인기 지표로는 DB-Engines 와 Stack Overflow 설문이 자주 인용됩니다. DB-Engines 2026년 11월 랭킹은 Oracle 1096.15점, MySQL 823.23점, Microsoft SQL Server 693.53점, PostgreSQL 689.69점 순이고 MariaDB 는 13위(75.07점)입니다. 1년 전과 비교하면 PostgreSQL 은 38.32점 올랐고 Oracle 은 143.63점, MySQL 은 42.59점 내렸습니다. Stack Overflow Developer Survey 2025 에서는 전체 응답자 기준 PostgreSQL 55.6%, MySQL 40.5%, SQLite 37.5%, MariaDB 22.5%, Oracle 10.6% 로 PostgreSQL 이 가장 많이 쓰는 데이터베이스였습니다. 두 지표의 순위가 다른 건 DB-Engines 점수가 검색, 구인, 언급량으로 계산한 인기도이고 설문은 개발자가 실제로 쓴다고 답한 결과이기 때문입니다.

## 그래서 무엇을 고를까

지금까지 본 차이를 한 장으로 줄이면 다음과 같습니다.

![MySQL, Oracle, PostgreSQL 을 라이선스, 이전 버전 위치, 기본 격리 수준, upsert 문법, JSON 접근 방식, 벡터 검색, 복제와 고가용성 항목으로 비교한 표](@/assets/images/mysql-oracle-postgresql-matrix.png)

새 프로젝트에 특별한 제약이 없다면 **PostgreSQL 이 무난합니다.** 라이선스가 자유롭고, PostGIS, pgvector, TimescaleDB 같은 확장이 풍부하고, `jsonb` 와 SQL 기능이 넉넉해서 데이터베이스 하나로 여러 용도를 감당하기 쉽습니다. 대신 쓰기가 많은 테이블은 vacuum 과 트랜잭션 ID 관리를 운영 항목으로 가져가야 합니다.

MySQL(또는 MariaDB)은 읽기 위주의 웹 서비스, 기존 LAMP 계열 자산, MySQL 에 익숙한 운영 팀이 있는 곳에 어울립니다. 기본 격리 수준이 `REPEATABLE READ` 라는 점과 갭 락 동작은 알고 쓰셔야 합니다. 라이선스를 중립적으로 가져가고 싶어서 MariaDB 를 후보에 넣는다면 MySQL 과 호환된다고 가정하지 말고 검증하세요.

Oracle 은 이미 Oracle 로 돌아가는 대규모 기간계, RAC 와 Data Guard 같은 상용 고가용성이 필요한 곳, PL/SQL 자산이 큰 조직에서 합리적입니다. 라이선스 비용과 벤더 종속이 크지만 단일 벤더의 기술 지원을 받습니다. 개발과 학습에 쓴다면 Free 에디션의 제한(2코어, 2GB, 12GB)만 염두에 두면 됩니다.

데이터베이스를 갈아타는 작업이라면 SQL 문법보다 **격리 수준, 시퀀스와 자동 증가 키, 날짜와 NULL 처리 같은 동작 차이부터** 점검하는 게 먼저입니다.

## 참고 자료

- [PostgreSQL: Versioning policy](https://www.postgresql.org/support/versioning/)
- [PostgreSQL 18 Released](https://www.postgresql.org/about/news/postgresql-18-released-3142/)
- [PostgreSQL: License](https://www.postgresql.org/about/licence/)
- [PostgreSQL 18 Docs: Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
- [PostgreSQL 18 Docs: Routine Vacuuming](https://www.postgresql.org/docs/18/routine-vacuuming.html)
- [PostgreSQL 18 Docs: INSERT](https://www.postgresql.org/docs/18/sql-insert.html)
- [pgvector (GitHub)](https://github.com/pgvector/pgvector)
- [MySQL: End of Life notices](https://www.mysql.com/support/eol-notice.html)
- [MySQL 9.7 Release Notes](https://dev.mysql.com/doc/relnotes/mysql/9.7/en/)
- [MySQL 8.4 Reference Manual: What Is New in 8.4](https://dev.mysql.com/doc/refman/8.4/en/mysql-nutshell.html)
- [MySQL 8.4 Reference Manual: InnoDB Transaction Isolation Levels](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html)
- [MySQL 8.4 Reference Manual: InnoDB Multi-Versioning](https://dev.mysql.com/doc/refman/8.4/en/innodb-multi-versioning.html)
- [MySQL 8.4 Reference Manual: INSERT ... ON DUPLICATE KEY UPDATE](https://dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html)
- [MySQL 9.7 Reference Manual: The VECTOR Type](https://dev.mysql.com/doc/refman/9.7/en/vector.html)
- [MySQL HeatWave: Vector Store](https://dev.mysql.com/doc/heatwave/en/mys-hw-genai-vector-store.html)
- [MySQL: OEM licensing](https://www.mysql.com/about/legal/licensing/oem/)
- [MariaDB: About and maintenance policy](https://mariadb.org/about/#maintenance-policy)
- [MariaDB Foundation](https://mariadb.org/mariadb-foundation/)
- [Oracle AI Database 26ai documentation](https://docs.oracle.com/en/database/oracle/oracle-database/26/index.html)
- [Oracle AI Database Free: Licensing Restrictions](https://docs.oracle.com/en/database/oracle/oracle-database/26/xeinl/licensing-restrictions.html)
- [Oracle Concepts: Data Concurrency and Consistency](https://docs.oracle.com/en/database/oracle/oracle-database/26/cncpt/data-concurrency-and-consistency.html)
- [Oracle SQL Language Reference: MERGE](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/MERGE.html)
- [Oracle AI Vector Search Overview](https://docs.oracle.com/en/database/oracle/oracle-database/26/vecse/overview-ai-vector-search.html)
- [DB-Engines Ranking](https://db-engines.com/en/ranking)
- [Stack Overflow Developer Survey 2025: Technology](https://survey.stackoverflow.co/2025/technology#1-databases)

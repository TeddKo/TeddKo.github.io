---
title: "웹 서버, WAS, API 서버는 제품 이름이 아니라 맡은 일입니다"
description: "웹 서버와 WAS 와 API 서버가 각각 무엇을 하는지, 리버스 프록시와 로드 밸런서와 API 게이트웨이는 어디에 끼는지 정리했습니다. 국내 기업형 WEB-WAS-DB 구성과 AJP 보안 이슈, Spring Boot 내장 서버 이후 경계가 흐려진 현재 구성까지 다룹니다."
pubDatetime: 2026-11-09T08:33:00+09:00
category: server
tags:
  - WAS
  - 웹서버
  - Nginx
  - Tomcat
  - API 서버
---

Android 앱을 만들다 보니 서버 쪽 대화에 끼는 일이 늘었는데, 처음에 가장 헷갈린 게 "웹 서버 앞에 WAS 가 있고 그 뒤에 DB 가 있다"는 문장이었습니다. 우리 앱이 붙는 건 API 서버라고 부르는데, 이게 웹 서버인지 WAS 인지 어느 쪽 이야기인지 알기 어려웠습니다. 결론부터 적으면 셋은 같은 층위의 분류가 아닙니다. 웹 서버와 WAS 는 소프트웨어가 하는 일을 기준으로 한 이름이고, API 서버는 그 소프트웨어가 어떤 응답을 돌려주느냐를 기준으로 한 이름입니다. 한 프로세스가 셋을 다 겸하는 경우도 흔합니다.

서버 언어와 런타임이 어떻게 갈리는지는 [서버 개발 언어별 런타임 비교](/posts/server-js-jvm-php-python/)에서, 클라이언트와 서버 사이의 프로토콜은 [클라이언트와 서버가 대화하는 방식](/posts/client-server-protocols/)에서 다뤘습니다. 이 글은 그 사이에 놓인 서버 프로그램들이 각각 무슨 일을 맡는지를 정리합니다.

## 웹 서버는 요청을 받아 파일을 내주거나 넘깁니다

웹 서버의 본업은 HTTP 요청을 받아 정적 파일을 읽어 응답하는 일입니다. HTML, CSS, JS, 이미지처럼 요청 때마다 내용이 바뀌지 않는 것들입니다. 여기에 TLS 종료, 압축, 리다이렉트, 접근 로그 같은 HTTP 레벨의 잡일이 붙고, 동적 처리가 필요한 요청은 뒤쪽 서버로 넘기는 프록시 역할도 합니다. Nginx, Apache httpd, Caddy 가 대표적입니다.

웹 서버 자체는 애플리케이션 로직을 모릅니다. 주문을 만들고 포인트를 차감하는 코드는 여기 없습니다. 이 서버가 아는 건 "이 경로는 디스크의 이 파일, 저 경로는 저쪽 서버로 전달" 정도의 규칙입니다.

## WAS 는 애플리케이션 코드를 컨테이너 안에서 실행합니다

WAS(Web Application Server)는 애플리케이션 코드가 실제로 도는 곳입니다. 자바 진영에서는 서블릿 컨테이너가 핵심이어서, 요청을 받아 서블릿이나 그 위의 프레임워크 코드를 호출하고, 스레드와 세션과 생명주기를 관리합니다. Tomcat 이 가장 널리 쓰이는 서블릿 컨테이너입니다.

여기서 구분할 게 하나 있습니다. Tomcat 은 서블릿과 JSP 같은 웹 스펙을 구현한 서블릿 컨테이너이지, EJB 나 JMS 나 JTA 까지 한 묶음으로 제공하는 풀 스택 서버는 아닙니다. 그런 쪽은 WildFly, WebLogic, JEUS 같은 제품이 맡았습니다. 이들은 Java EE, 지금 이름으로는 Jakarta EE 스펙의 더 넓은 범위를 구현한 애플리케이션 서버입니다.

**WAS 라는 용어는 한국에서 유독 자주 쓰입니다.** 해외 문서에서는 보통 application server 나 servlet container 라고 하고, "WAS"라는 약어를 대화에서 쓰는 곳은 많지 않습니다. 국내 SI 현장에서는 JEUS 나 WebLogic 위에 시스템을 올리던 관행 때문에 WAS 가 보통명사처럼 굳었습니다. 해외 자료를 찾을 때는 이 점을 알고 검색어를 바꿔야 합니다.

이름이 Java EE 에서 Jakarta EE 로 바뀐 것도 알아 둘 만합니다. 스펙과 TCK 가 Eclipse Foundation 으로 넘어갔고, Jakarta EE 9 부터 패키지 이름이 `javax.*` 에서 `jakarta.*` 로 바뀌었습니다. 그래서 같은 서블릿 코드라도 Tomcat 9 이하와 Tomcat 10 이상, Spring Boot 2 와 3 사이에서는 import 문이 달라집니다. 서버를 올릴 때 버전 조합이 안 맞으면 이 이름 차이 때문에 클래스를 못 찾는 오류가 납니다.

## API 서버는 역할의 이름입니다

API 서버는 제품 분류가 아닙니다. HTML 화면을 만들어 내려주는 대신 JSON 같은 데이터를 돌려주는 서버를 가리킵니다. 우리 앱이 호출하는 `GET /orders/1001` 을 받아 JSON 을 응답하는 Spring Boot 앱이 API 서버이고, 그 앱은 동시에 WAS 입니다. Express 로 만든 Node 앱도, Go 의 `net/http` 로 만든 서버도 같은 의미로 API 서버입니다.

그래서 "웹 서버냐 WAS 냐 API 서버냐"는 선택지 중 하나를 고르는 질문이 아닙니다. 어떤 프로세스든 이 세 가지 질문에 따로 답할 수 있습니다. 정적 파일을 내주는가, 애플리케이션 코드를 실행하는가, 데이터를 돌려주는가입니다.

![왼쪽은 브라우저에서 웹 서버, WAS, DB 로 이어지는 전통적인 3티어이고 웹 서버와 WAS 사이에 mod_jk 또는 mod_proxy_ajp 가 있다. 오른쪽은 브라우저나 앱에서 CDN, 로드 밸런서와 API 게이트웨이, 여러 대의 앱 서버, DB 로 이어지는 클라우드 네이티브 구성이다](@/assets/images/ws-was-api-server-layout.png)

## 주변 역할들

네 가지 이름이 더 나오는데, 이것도 제품이 아니라 위치와 역할입니다.

리버스 프록시는 클라이언트 대신 뒤쪽 서버로 요청을 전달하는 서버입니다. 클라이언트는 프록시만 보고 뒤쪽 서버는 보지 못합니다. Nginx 가 웹 서버이면서 리버스 프록시로 가장 많이 쓰이는 이유가 이것입니다. 로드 밸런서는 같은 일을 여러 대에 나눠 보내는 역할로, 리버스 프록시가 업스트림을 여러 개 두면 사실상 로드 밸런서가 됩니다. 클라우드에서는 ALB 같은 관리형 서비스가 이 일을 합니다. CDN 은 정적 자산을 사용자와 가까운 곳에 캐시해 두는 서비스라서, 웹 서버가 하던 정적 서빙의 상당 부분을 가져갑니다.

API 게이트웨이는 API 호출 단위로 인증, rate limit, 라우팅, 로깅 같은 공통 정책을 걸어 주는 관문입니다. Kong 이나 AWS API Gateway 가 해당합니다. 리버스 프록시와 겹치는 부분이 많지만, 프록시가 HTTP 요청을 전달하는 데 초점이 있다면 게이트웨이는 API 의 소비자와 정책을 관리하는 데 초점이 있습니다.

![웹 서버, WAS, API 서버, 리버스 프록시, API 게이트웨이를 역할, 주로 다루는 것, 예시, 놓이는 자리로 비교한 표](@/assets/images/ws-was-api-server-matrix.png)

## 국내 기업형 구성: Apache + Tomcat

국내 금융권이나 공공 시스템에서 흔한 구성은 이렇습니다. 맨 앞에 Apache httpd 를 두고, 그 뒤에 Tomcat 이나 JEUS 같은 WAS 를, 맨 뒤에 DB 를 둡니다. 보안 정책상 네트워크 구간을 DMZ, 내부망, DB 망으로 나누는 경우가 많아서, 웹 서버는 DMZ 에 두고 WAS 는 내부망에 두는 식으로 층이 갈렸습니다. 정적 파일은 웹 서버가 직접 응답하고, 동적 요청만 WAS 로 넘기는 게 원래 의도였습니다.

Apache 와 Tomcat 을 잇는 방법으로는 mod_jk 나 mod_proxy_ajp 로 AJP(Apache JServ Protocol)를 쓰는 방식이 오래 쓰였습니다. HTTP 대신 바이너리 프로토콜을 써서 오버헤드를 줄이려던 것인데, 이게 2020년에 문제가 됐습니다.

### AJP 와 Ghostcat

CVE-2020-1938, 이른바 Ghostcat 은 AJP 커넥터가 HTTP 커넥터보다 요청을 더 신뢰한다는 점을 노린 취약점입니다. AJP 포트에 접근할 수 있는 공격자는 웹 애플리케이션 안의 임의 파일, `WEB-INF` 와 `META-INF` 까지 읽을 수 있었고, 애플리케이션 안의 어떤 파일이든 JSP 로 실행시킬 수 있었습니다. 업로드된 파일이 웹 애플리케이션 경로에 저장되는 서비스라면 원격 코드 실행까지 이어질 수 있었습니다. 9.0.0.M1 부터 9.0.30 까지가 영향을 받았고 9.0.31 에서 고쳐졌습니다.

이 수정과 함께 AJP 커넥터의 기본 설정이 바뀌었습니다. Tomcat 문서에 적힌 기본값은 이렇습니다.

- `address` 기본값은 루프백이라, 별도로 지정하지 않으면 로컬에서만 연결을 받습니다.
- `secretRequired` 기본값이 `true` 라서, `secret` 에 값을 넣지 않으면 AJP 커넥터가 시작되지 않습니다.

그래서 예전 설정을 그대로 두고 Tomcat 만 올리면 AJP 연결이 안 되는 일이 생깁니다. 이 구성을 계속 써야 한다면 이렇게 명시해야 합니다.

```xml
<Connector protocol="AJP/1.3"
           address="127.0.0.1"
           port="8009"
           secret="긴-무작위-공유-비밀값"
           secretRequired="true" />
```

`secretRequired="false"` 로 풀어 버리는 방법이 인터넷에 많이 돌지만, 문서는 신뢰할 수 있는 네트워크에서만 쓰라고 못박습니다. 애초에 AJP 를 쓸 이유가 없다면 HTTP 로 넘기는 편이 단순합니다. 웹 서버와 WAS 가 같은 장비에 있거나 내부망에 있다면 `proxy_pass` 한 줄로 충분합니다.

## 클라우드 네이티브 구성

요즘 새로 만드는 서비스는 대부분 층이 훨씬 얇습니다. 정적 자산은 CDN 에 올리고, 로드 밸런서나 API 게이트웨이가 TLS 를 끝내고 인증과 rate limit 을 처리하고, 그 뒤에 컨테이너로 띄운 앱 서버가 여러 대 있습니다. 앱 서버는 Spring Boot 나 Node, Go 처럼 자기 안에 HTTP 서버를 가진 형태라서 별도 웹 서버가 없어도 요청을 직접 받을 수 있습니다.

그렇다고 Nginx 가 사라지지는 않았습니다. 컨테이너 한 대 앞에 Nginx 를 두고 TLS, 압축, 정적 파일, 요청 크기 제한과 rate limit 을 맡기는 구성은 여전히 흔합니다. 클라우드 LB 를 쓰더라도 앱 서버에 앞단 정책을 모두 넣고 싶지 않다면 같은 역할을 하는 sidecar 나 Ingress 컨트롤러가 대신 자리합니다.

### Nginx 리버스 프록시 설정

가장 기본이 되는 형태는 이렇습니다.

```nginx
upstream app {
    server 10.0.1.11:8080;
    server 10.0.1.12:8080;
}

server {
    listen 443 ssl;
    server_name api.example.com;

    ssl_certificate     /etc/ssl/api.example.com.crt;
    ssl_certificate_key /etc/ssl/api.example.com.key;

    location /static/ {
        root /var/www;
        expires 7d;
    }

    location / {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

`proxy_set_header Host $host;` 를 적는 이유가 있습니다. Nginx 문서를 보면 `proxy_set_header` 의 기본값이 `Host $proxy_host` 이고 클라이언트가 보낸 `Host` 헤더는 업스트림으로 넘어가지 않습니다. 그대로 두면 앱 서버는 `app` 이라는 업스트림 이름만 보게 되고, 클라이언트가 접속한 도메인으로 리다이렉트 URL 을 만드는 코드가 어긋납니다. `X-Forwarded-*` 헤더도 같은 이유로 직접 채워 줘야 앱이 원래 클라이언트 IP 와 스킴을 알 수 있습니다.

### Spring Boot 내장 서버

Spring Boot 는 Tomcat 을 의존성으로 품고 `main` 에서 띄웁니다. WAR 로 만들어 외부 Tomcat 에 올리던 방식과 달리 JAR 하나를 `java -jar` 로 실행하면 서버와 앱이 같이 올라옵니다. 서블릿 스택의 기본 서버는 Tomcat 이고, `spring-boot-starter-tomcat` 을 제외하고 `spring-boot-starter-jetty` 를 넣으면 Jetty 로 바뀝니다. 포트는 `server.port` 로, 기본값은 8080 입니다.

Nginx 뒤에 둘 때 신경 쓸 속성이 있습니다.

```properties
server.forward-headers-strategy=NATIVE
server.compression.enabled=true
```

`server.forward-headers-strategy` 는 프록시가 붙인 `X-Forwarded-For` 와 `X-Forwarded-Proto` 를 앱이 해석할지를 정합니다. 기본값은 지원되는 클라우드 플랫폼이 아니면 `NONE` 이라서, 이걸 켜지 않으면 HTTPS 로 들어온 요청을 앱이 HTTP 로 오해해 리다이렉트가 어긋날 수 있습니다. 압축은 Nginx 와 앱 중 한 곳에서만 걸면 되니 앞단에서 처리한다면 앱 쪽은 끄는 편이 낫습니다.

예전 자바 서버 구성에서 가장 큰 변화는 이겁니다. 서버가 앱을 품는 구조에서 앱이 서버를 품는 구조로 뒤집혔습니다. 컨테이너 이미지에는 JAR 하나가 들어가고, 서버 버전도 앱 의존성과 함께 올라갑니다. 외부 Tomcat 의 버전과 설정을 따로 관리하던 부담이 줄어든 만큼, 서버 설정이 앱 코드 쪽 책임이 되었습니다. Spring 과 Ktor 중 어느 쪽을 쓸지는 [Spring Boot 와 Ktor 비교](/posts/spring-vs-ktor/)에서 따로 다뤘습니다.

## 그래서 어떻게 구성할지

처음 서버를 구성한다면 이렇게 판단하면 됩니다. 정적 파일이 많은 웹 서비스라면 CDN 을 먼저 붙이고, 앱 서버 앞에 로드 밸런서를 둡니다. 서버가 한두 대라면 Nginx 하나로 TLS 와 프록시와 정적 파일을 같이 처리해도 충분합니다. API 서비스가 여러 개로 쪼개지고 인증이나 호출량 제한을 공통으로 걸어야 하는 시점이 되면 API 게이트웨이를 검토합니다.

기존 시스템을 맡게 됐다면 Apache + Tomcat 구성을 억지로 바꿀 이유는 없습니다. 다만 AJP 포트가 외부에서 열려 있지는 않은지, Tomcat 이 9.0.31 이상인지는 꼭 확인해야 합니다. 그리고 "WAS 가 느리다"는 말을 들으면 그게 웹 서버 구간인지, 컨테이너 스레드 풀인지, 그 뒤의 DB 커넥션 풀인지를 먼저 나눠 보는 게 순서입니다. 이름이 층을 말해 주지 않아도 요청이 지나가는 경로는 그려 볼 수 있기 때문입니다.

## 참고 자료

- [Apache Tomcat 9: The AJP Connector](https://tomcat.apache.org/tomcat-9.0-doc/config/ajp.html)
- [Apache Tomcat 9: Security Vulnerabilities](https://tomcat.apache.org/security-9.html)
- [nginx: Module ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [Spring Boot: Embedded Web Servers](https://docs.spring.io/spring-boot/how-to/webserver.html)
- [Jakarta EE: Frequently Asked Questions](https://jakarta.ee/about/faq/)

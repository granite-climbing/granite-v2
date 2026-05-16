---
id: 0015
title: 공개 정책 문서를 앱 내 정적 페이지로 이관
status: Accepted
date: 2026-05-13
---

## Context

이용약관, 개인정보처리방침, 데이터 삭제 안내는 이미 `granite.kr/terms/`, `granite.kr/privacy/`, `granite.kr/data-deletion/`에 공개되어 있다. 회원가입/마이페이지/푸터에서 이를 외부 링크로 띄우면 앱 흐름이 깨지고, Meta·OAuth provider 검수에서 "앱 내 정책 노출"을 요구할 가능성이 있다.

## Decision

기존 공개 URL의 원문을 파싱/이관해 앱 내부 정적 페이지로 제공한다. 원본 URL은 출처와 동기화 기준으로 유지한다.

- 회원가입/로그인/마이페이지/탈퇴 흐름과 푸터에서 내부 페이지로 링크.
- 원문이 변경되면 앱 내 페이지도 동기화한다. 동기화 주체와 주기는 운영 SOP에서 정의.

## Consequences

- 앱 흐름이 끊기지 않음, OAuth/Meta 검수 통과 용이.
- 원문 변경 시 동기화 누락 리스크 → 변경 PR에 정책 문서 갱신 체크리스트 항목 추가.
- 단점: 원본 사이트와 미세한 표기 차이가 발생 가능 → "출처는 `granite.kr/…`"라는 명시 문구를 본문에 포함.

## Alternatives considered

- **외부 링크만**: 흐름 끊김, 검수 리스크.
- **iframe 임베드**: 모바일 UX·SEO·접근성에 모두 불리.

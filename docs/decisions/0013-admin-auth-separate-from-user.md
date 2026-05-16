---
id: 0013
title: 관리자 인증을 사용자 인증과 분리
status: Accepted
date: 2026-05-13
---

## Context

관리자는 콘텐츠 CRUD, 베타 모더레이션, 웹훅 인박스 처리 등 영향이 큰 작업을 한다. 일반 사용자 OAuth(4종)와 같은 인증 채널/세션/시크릿을 공유하면 권한 상승 위험이 커지고, OAuth provider 장애가 관리자 운영을 차단할 수 있다.

## Decision

- 관리자는 `/admin/login`에서 **이메일+비밀번호**로 별도 인증한다. bcrypt 또는 Argon2 해시.
- 관리자 세션은 `granite_admin` HttpOnly cookie + `ADMIN_JWT_SECRET`(사용자 `JWT_SECRET`과 다른 키)로 서명.
- `/admin/*`는 layout/middleware에서 1차 방어, Server Action 진입점에서 `requireAdmin()`로 2차 방어한다.
- 관리자 계정 생성은 마이그레이션 또는 별도 CLI로만. 셀프 회원가입 불가.
- 관리자 주요 작업은 `admin_audit_logs`에 기록.

## Consequences

- OAuth provider 장애와 무관하게 운영 가능.
- 시크릿 유출 시 폭발 범위가 관리자 또는 사용자 한쪽으로 제한됨.
- 단점: 비밀번호 분실 복구 흐름을 별도 SOP로 마련해야 함 → 운영 인원 적을 때는 마이그레이션으로 리셋.

## Alternatives considered

- **OAuth + role flag**: provider 의존, 권한 상승 리스크.
- **단일 JWT secret + role claim**: 시크릿 유출 시 폭발 범위 큼.

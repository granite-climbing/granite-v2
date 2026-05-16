---
id: 0005
title: R2 원본 + Cloudflare Image Resizing
status: Accepted
date: 2026-05-13
---

## Context

스팟·바위·루트·베타 썸네일은 모바일 환경에서 빠르게 떠야 하고, 동일 원본을 여러 크기로 노출한다(목록 카드 / 상세 히어로 / 바텀시트). 외부 미디어(Instagram, YouTube) 썸네일도 자체 호스팅해야 노출 안정성과 정책 통제가 가능하다.

## Decision

- 원본은 R2에 1회 업로드. 키 컨벤션: `{entityType}/{entityId}/{purpose}-{uuid}.{ext}`.
- 클라이언트에는 `cdn.granite.kr/cdn-cgi/image/width=…,format=auto,quality=…/<r2-key>` 형태의 변환 URL만 노출.
- `next/image` custom loader가 Cloudflare Image Resizing URL을 생성한다.
- R2 원본 URL과 credential은 외부에 노출하지 않는다.
- 업로드 시 EXIF 위치정보를 제거한다.

## Consequences

- 동일 원본으로 WebP/AVIF, 다양한 폭을 자동 서빙.
- 이미지 메타데이터 테이블을 별도로 두지 않음 → 스키마 단순화 ([0006](0006-image-urls-on-entities.md)).
- Image Resizing 비용은 사용량 기반이므로 런칭 전 플랜 재검증 필요.
- 외부 미디어 썸네일은 우리 R2에 복제 → 외부 URL이 깨져도 노출 유지.

## Alternatives considered

- **외부 URL 직접 노출**: 정책·가용성·핫링크 정책 변화에 취약.
- **별도 이미지 호스트(Cloudinary/imgix)**: 비용 증가, 인프라 추가.
- **Next.js 기본 image optimization**: Vercel 사용량 비용과 한계.

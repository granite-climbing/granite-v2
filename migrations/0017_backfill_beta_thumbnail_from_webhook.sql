-- Granite — backfill beta 썸네일을 webhook_inbox에 저장된 R2 이미지로 채우기
--
-- Instagram 웹훅 워커는 썸네일을 R2에 복사한 뒤 그 CDN URL을
-- webhook_inbox.thumbnail_url 에 저장한다. 예전 수동 매칭 경로
-- (manualMatchWebhookToRoute)는 beta INSERT 시 thumbnail_url 을 NULL 로
-- 하드코딩해 이 저장 이미지를 버렸다 (코드는 커밋 bc601c3 에서 수정됨).
--
-- 이 마이그레이션은 이미 생성된 베타 중 썸네일이 비어 있는 행을,
-- 해당 webhook_inbox 행에 저장된 CDN 썸네일로 소급 채운다.
-- 롤포워드 전용이며, 이미 채워진 행은 제외하므로 재실행해도 안전(멱등)하다.

UPDATE betas
SET thumbnail_url = (
      SELECT wi.thumbnail_url
      FROM webhook_inbox wi
      WHERE wi.matched_beta_id = betas.id
        AND wi.thumbnail_url IS NOT NULL
        AND wi.thumbnail_url <> ''
      ORDER BY wi.updated_at DESC
      LIMIT 1
    ),
    updated_at = datetime('now')
WHERE (betas.thumbnail_url IS NULL OR betas.thumbnail_url = '')
  AND EXISTS (
      SELECT 1
      FROM webhook_inbox wi2
      WHERE wi2.matched_beta_id = betas.id
        AND wi2.thumbnail_url IS NOT NULL
        AND wi2.thumbnail_url <> ''
    );

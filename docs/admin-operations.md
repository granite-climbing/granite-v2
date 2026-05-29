# Granite Admin Operations

## Initial Admin

Generate a password hash locally:

```bash
pnpm dlx tsx scripts/create-admin-hash.ts '<strong-password>'
```

The script will output a bcrypt hash. Insert the first admin through D1 migration or one-time D1 console execution:

```sql
INSERT INTO admins (id, email, password_hash, display_name, is_active)
VALUES ('admin_primary', 'ops@granite.kr', '<bcrypt-hash>', 'Granite Ops', 1);
```

Do not commit real password hashes for production admins unless the repository is private and the operational risk is accepted. Prefer a one-time D1 console insert for production.

## Password Rotation

1. Generate a new hash with `pnpm dlx tsx scripts/create-admin-hash.ts '<new-password>'`.
2. Update `admins.password_hash` for the target admin:
   ```sql
   UPDATE admins SET password_hash = '<new-hash>' WHERE id = '<admin-id>';
   ```
3. Rotate `ADMIN_JWT_SECRET` if session compromise is suspected.
4. Confirm old sessions no longer access `/admin/content`.

## Image Policy

Public image serving is already configured through R2/CDN. Admin forms must store only URLs on the configured `CDN_BASE_URL` host (currently `https://cdn.granite.kr/...`) or approved relative CDN paths. Do not store private R2 URLs, signed URLs, or raw S3 endpoint URLs.

## Seed Strategy

For production environments, create the initial admin user through a **one-time D1 console insert**. Do NOT create a seed migration file with a committed password hash, as this poses an operational security risk in a shared repository.

For local development and testing, you may optionally create a local-only seed file (e.g., `migrations/0004_seed_initial_admin.sql` in `.gitignore`) if needed, but it should never be committed to version control.

### Process

1. Deploy migrations (including `0003_admin_operations.sql` with the admin table schema).
2. In the D1 console or command-line tool, run the INSERT statement above with a strong, randomly generated password hash.
3. Securely distribute the password to the initial admin via a separate channel (not email, git, or chat).
4. Delete any temporary seed files or notes containing the hash.

### Credentials Management

- Passwords must be at least 12 characters long (enforced by `create-admin-hash.ts`).
- Store rotated hashes only in D1; never log plaintext passwords.
- Use a password manager or secure credential store for operational secrets.

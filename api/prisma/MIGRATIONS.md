# Prisma Migrations Workflow

We share one staging database. To avoid two people's migrations colliding, never apply migrations straight from a feature branch.

## When you change `schema.prisma`

1. Generate the migration file (does **not** touch the database):
   ```
   npm run migrate:staging:create
   ```
2. Review the generated SQL in `api/prisma/migrations/<timestamp>_new-migration/`.
3. Commit `schema.prisma` + the migration folder, push, open a PR.

## When it merges to `main`

- CI (`.github/workflows/prisma-migrate-deploy.yml`) automatically runs `prisma migrate deploy` against staging.
- No one needs to run anything manually.

## Rules

- Never run `migrate:staging` or `migrate` (the old scripts) — they apply immediately, before merge, which caused schema drift before.
- Pull latest `main` before creating your migration, so it's generated after teammates' already-merged ones.
- If two people's migrations touch different tables, they merge fine (Prisma applies by filename timestamp). If they touch the same table, expect a normal merge conflict in `schema.prisma` — resolve it, then regenerate your migration.

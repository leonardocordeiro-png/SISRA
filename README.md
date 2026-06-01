# SISRA

Sistema de retirada escolar com portais para administracao, recepcao, sala de aula, responsaveis, display e totem.

## Stack

- React + TypeScript + Vite
- Supabase Auth, Database, Realtime e RLS
- Vercel para deploy estatico

## Configuracao local

Crie um arquivo `.env` com:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
VITE_ESCOLA_ID=uuid-da-escola
```

Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no frontend.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
npm audit --audit-level=moderate
```

## Banco de dados

As migrations ficam em `supabase/migrations`.

Antes de liberar uso real, aplique a migration de hardening publica:

```text
supabase/migrations/20260316000001_public_rpc_hardening.sql
```

Ela remove policies anonimas amplas em tabelas sensiveis e troca os fluxos publicos para RPCs `SECURITY DEFINER` com validacao de vinculo responsavel-aluno.

## Validacao de producao

Veja [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md).


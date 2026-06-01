# SISRA - Checklist de Producao

## Status atual

- Build de producao: `npm run build`
- Auditoria de dependencias: `npm audit --audit-level=moderate`
- Banco: aplicar todas as migrations em `supabase/migrations`
- Fluxos publicos: devem usar RPCs `sisra_*`; nao conceder leitura/escrita anonima direta em tabelas sensiveis

## Antes de ativar com dados reais

1. Aplicar a migration `20260316000001_public_rpc_hardening.sql` no Supabase.
2. Confirmar que as policies anon antigas foram removidas:
   - `alunos_anon_by_id`
   - `solicitacoes_anon_read`
   - `solicitacoes_anon_insert`
   - `solicitacoes_anon_update`
   - `autorizacoes_anon_read`
   - `responsaveis_anon_read`
   - `ar_anon_read`
   - `turmas_anon_read`
3. Testar os fluxos publicos:
   - Portal do responsavel com CPF + codigo do cartao.
   - Portal por codigo.
   - Totem por codigo.
   - Totem por QR.
   - Status de retirada.
   - Confirmacao de chegada.
4. Validar que um responsavel nao consegue consultar ou solicitar aluno nao vinculado.
5. Validar que usuarios autenticados continuam restritos por `escola_id`.
6. Fazer backup do banco antes de liberar para uso.
7. Criar procedimento de contingencia para retirada manual se Supabase, internet ou totem ficarem indisponiveis.

## Seguranca operacional

- Nunca publicar `SUPABASE_SERVICE_ROLE_KEY` no frontend.
- Usar somente `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_ESCOLA_ID` no deploy do Vite.
- Revisar logs de auditoria diariamente no inicio do piloto.
- Rotacionar codigos/cartoes em caso de perda.
- Usar HTTPS obrigatoriamente para camera, geolocalizacao e QR.

## Pendencias tecnicas conhecidas

- O lint ainda possui uma baseline antiga com `any`, dependencias de hooks e regras novas do React Compiler.
- Alguns bundles continuam grandes, especialmente o WASM de imagem e telas administrativas pesadas.
- O README principal ainda deve ser substituido por documentacao completa de instalacao, deploy, suporte e LGPD.
- O export de planilha usa formato `.xls` HTML compativel com Excel para evitar o pacote `xlsx`, que nao possui correcao de seguranca.


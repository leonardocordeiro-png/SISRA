-- =====================================================================
-- SISRA – Migração: Adicionar coordenadas geográficas à tabela escolas
-- Executar no SQL Editor do Supabase Dashboard
-- =====================================================================

-- 1. Adiciona colunas de latitude e longitude à tabela escolas
ALTER TABLE escolas
    ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 2. Atualiza o registro do La Salle Sobradinho com as coordenadas exatas do portão
--    Coordenadas: 15°39'03.5"S  47°46'55.6"W
--    Endereço: Q 14 - Sobradinho, Brasília - DF, 73050-069
UPDATE escolas
SET
    nome      = 'La Salle Sobradinho',
    endereco  = 'Q 14 - Sobradinho, Brasília - DF, 73050-069',
    latitude  = -15.650972,
    longitude = -47.782111
WHERE id = 'e6328325-1845-420a-b333-87a747953259';

-- 3. (Opcional) Verificar o resultado
SELECT id, nome, endereco, latitude, longitude FROM escolas WHERE id = 'e6328325-1845-420a-b333-87a747953259';

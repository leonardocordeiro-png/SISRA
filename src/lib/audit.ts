import { supabase } from './supabase';

export type AuditAction =
    | 'SISTEMA_LOGIN'
    | 'SISTEMA_LOGOUT'
    | 'LOGIN_SUCESSO'
    | 'LOGIN_FALHA'
    | 'LIMPEZA_REGISTROS'
    | 'EXPORTACAO_DADOS'
    | 'ALTERACAO_CONFIGURACAO'
    | 'EXCLUSAO_ESTUDANTE'
    | 'EXCLUSAO_ESTUDANTE_MASSA'
    | 'CADASTRO_ESTUDANTE'
    | 'EDICAO_ESTUDANTE'
    | 'REMANEJAMENTO_TURMA'
    | 'GERACAO_LINK_ACESSO'
    | 'SOLICITACAO_RETIRADA'
    | 'CONFIRMACAO_ENTREGA'
    | 'CADASTRO_RESPONSAVEL'
    | 'MANIPULACAO_DADOS'
    | 'ANALISE'
    | 'MANUTENCAO';

/**
 * Registra uma ação no log de auditoria do sistema.
 * 
 * @param action Tipo da ação (enum AuditAction)
 * @param table Tabela afetada (opcional)
 * @param recordId ID do registro afetado (opcional)
 * @param details Objeto JSON com detalhes adicionais da ação
 * @param userId ID do usuário que realizou a ação
 * @param escolaId ID da escola associada
 */
export async function logAudit(
    action: AuditAction,
    table?: string,
    recordId?: string,
    details?: any,
    userId?: string,
    escolaId?: string
) {
    try {
        // Se escolaId não for provido, tentamos usar o padrão
        const finalEscolaId = escolaId || 'e6328325-1845-420a-b333-87a747953259';

        const { error } = await supabase
            .from('logs_auditoria')
            .insert({
                acao: action,
                tabela_afetada: table,
                registro_id: recordId,
                detalhes: details,
                usuario_id: userId,
                escola_id: finalEscolaId,
                ip_address: '0.0.0.0',
                user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server-side'
            });

        if (error) {
            // Error 42501 is RLS violation, we expect this until DB policy is fixed
            if (error.code === '42501') {
                console.warn(`[Audit] Permissão negada (RLS) para ação: ${action}. Verifique as políticas da tabela 'logs_auditoria'.`);
            } else {
                console.error('[Audit] Erro ao registrar log:', error);
            }
        } else {
            if (process.env.NODE_ENV === 'development') {
                console.log(`[Audit] Evento registrado: ${action} em ${table || 'sistema'}`);
            }
        }
    } catch (err) {
        // Silently catch to prevent app crashes if logging fails
        console.warn('[Audit] Falha crítica no subsistema de auditoria:', err);
    }
}

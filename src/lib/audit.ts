import { supabase } from './supabase';

export type AuditAction =
    | 'SISTEMA_LOGIN'
    | 'SISTEMA_LOGOUT'
    | 'LIMPEZA_REGISTROS'
    | 'EXPORTACAO_DADOS'
    | 'ALTERACAO_CONFIGURACAO'
    | 'EXCLUSAO_ESTUDANTE'
    | 'CADASTRO_ESTUDANTE'
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
        const { error } = await supabase
            .from('logs_auditoria')
            .insert({
                acao: action,
                tabela_afetada: table,
                registro_id: recordId,
                detalhes: details,
                usuario_id: userId,
                escola_id: escolaId,
                ip_address: '0.0.0.0', // Idealmente capturado pelo backend/edge function no Supabase
                user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server-side'
            });

        if (error) {
            console.error('Audit Log Error:', error);
        }
    } catch (err) {
        console.error('Failed to log audit event:', err);
    }
}

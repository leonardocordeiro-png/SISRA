import { supabase } from './supabase';

export type AuditAction =
    | 'SISTEMA_LOGIN'
    | 'SISTEMA_LOGOUT'
    | 'LOGIN_SUCESSO'
    | 'LOGIN_FALHA'
    | 'ACESSO_NEGADO'
    | 'LIMPEZA_REGISTROS'
    | 'EXPORTACAO_DADOS'
    | 'ALTERACAO_CONFIGURACAO'
    | 'EXCLUSAO_ESTUDANTE'
    | 'EXCLUSAO_ESTUDANTE_MASSA'
    | 'EXCLUSAO_USUARIO'
    | 'CADASTRO_ESTUDANTE'
    | 'EDICAO_ESTUDANTE'
    | 'REMANEJAMENTO_TURMA'
    | 'GERACAO_LINK_ACESSO'
    | 'GERACAO_CARTAO_QR'
    | 'GERACAO_RELATORIO'
    | 'SOLICITACAO_RETIRADA'
    | 'CONFIRMACAO_ENTREGA'
    | 'CADASTRO_RESPONSAVEL'
    | 'MANIPULACAO_DADOS'
    | 'ANALISE'
    | 'MANUTENCAO';

let cachedIP: string | null = null;

/**
 * Obtém o endereço IP público do cliente.
 */
async function getPublicIP(): Promise<string> {
    if (cachedIP) return cachedIP;
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        cachedIP = data.ip;
        return cachedIP || '0.0.0.0';
    } catch (err) {
        console.warn('[Audit] Falha ao obter IP público:', err);
        return '0.0.0.0';
    }
}

/**
 * Registra uma ação no log de auditoria do sistema.
 * Implementado como não-bloqueante para não interromper o fluxo principal do usuário em caso de falha.
 */
export async function logAudit(
    action: AuditAction,
    table?: string,
    recordId?: string,
    details?: any,
    userId?: string,
    escolaId?: string
) {
    const runAsync = async () => {
        try {
            // Use provided escolaId first, then env var — no hard-coded UUID fallback
            // to avoid silently associating logs with the wrong school in multi-tenant deploys.
            const finalEscolaId = escolaId || import.meta.env.VITE_ESCOLA_ID || null;
            const ip = await getPublicIP();
            const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Server-side';

            const logData: any = {
                acao: action,
                tabela_afetada: table,
                registro_id: recordId,
                detalhes: details,
                escola_id: finalEscolaId,
                ip_address: ip,
                user_agent: userAgent
            };

            // Se o ID for de um usuário interno (Staff/Admin), preenchemos usuario_id.
            // Caso contrário, mantemos apenas nos detalhes para evitar erros de integridade (FK).
            if (userId) {
                const isSystemUser =
                    table === 'usuarios' ||
                    (['SISTEMA_LOGIN', 'SISTEMA_LOGOUT', 'LOGIN_SUCESSO'].includes(action) && details?.role);

                if (isSystemUser) {
                    logData.usuario_id = userId;
                } else {
                    logData.detalhes = { ...details, responsavel_id: userId };
                }
            }

            const { error } = await supabase
                .from('logs_auditoria')
                .insert(logData);

            if (error) {
                if (error.code === '42501') {
                    console.warn(`[Audit] Permissão negada (RLS) para ação: ${action}.`);
                } else if (error.code === '23503') {
                    console.warn(`[Audit] Erro de Integridade (FK) para ação: ${action}. ID: ${userId}`);
                } else {
                    console.error('[Audit] Erro ao registrar log:', error);
                }
            }
        } catch (err) {
            console.warn('[Audit] Falha crítica silenciosa no subsistema de auditoria:', err);
        }
    };

    return runAsync();
}

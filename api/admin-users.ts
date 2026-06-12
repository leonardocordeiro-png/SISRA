import { createClient } from '@supabase/supabase-js';

/* global process */

type Role = 'ADMIN' | 'RECEPCIONISTA' | 'SCT' | 'COORDENADOR';
type ServiceClient = ReturnType<typeof createClient<any>>;

type AdminProfile = {
    id: string;
    email: string | null;
    nome: string | null;
    escola_id: string;
    tipo_usuario: Role;
    ativo: boolean;
};

type RequestBody = {
    action?: 'create' | 'update' | 'set_status' | 'delete';
    id?: string;
    nome?: string;
    email?: string;
    password?: string;
    tipo_usuario?: Role;
    sala_atribuida?: string | null;
    ativo?: boolean;
};

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res: any, status: number, payload: unknown) {
    res.status(status).json(payload);
}

function getBearerToken(req: any) {
    const header = String(req.headers.authorization || '');
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match?.[1] ?? null;
}

function assertEnvironment() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw Object.assign(new Error('SUPABASE_ENV_MISSING'), { status: 500 });
    }
    if (!SUPABASE_SERVICE_ROLE_KEY) {
        throw Object.assign(new Error('SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED'), { status: 503 });
    }
}

function cleanText(value: unknown, field: string, maxLength = 160) {
    const text = String(value ?? '').trim();
    if (!text) throw Object.assign(new Error(`${field}_OBRIGATORIO`), { status: 400 });
    if (text.length > maxLength) throw Object.assign(new Error(`${field}_MUITO_LONGO`), { status: 400 });
    return text;
}

function cleanEmail(value: unknown) {
    const email = cleanText(value, 'EMAIL', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw Object.assign(new Error('EMAIL_INVALIDO'), { status: 400 });
    }
    return email;
}

function cleanPassword(value: unknown, required: boolean) {
    const password = String(value ?? '');
    if (!password && !required) return null;
    if (password.length < 8) {
        throw Object.assign(new Error('SENHA_MINIMA_8_CARACTERES'), { status: 400 });
    }
    if (password.length > 72) {
        throw Object.assign(new Error('SENHA_MUITO_LONGA'), { status: 400 });
    }
    return password;
}

function cleanRole(value: unknown): Role {
    const role = String(value ?? '') as Role;
    if (!['ADMIN', 'RECEPCIONISTA', 'SCT', 'COORDENADOR'].includes(role)) {
        throw Object.assign(new Error('TIPO_USUARIO_INVALIDO'), { status: 400 });
    }
    return role;
}

function resolveSala(role: Role, sala: unknown) {
    if (role === 'SCT') return cleanText(sala, 'SALA_ATRIBUIDA', 120);
    if (role === 'ADMIN' || role === 'COORDENADOR') return 'TODAS';
    return null;
}

function publicMessage(error: unknown) {
    const message = String((error as { message?: string })?.message || error || 'ERRO_INTERNO');
    const map: Record<string, string> = {
        SUPABASE_ENV_MISSING: 'Configuracao do Supabase ausente no servidor.',
        SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED: 'SUPABASE_SERVICE_ROLE_KEY nao esta configurada na Vercel.',
        TOKEN_AUSENTE: 'Sessao administrativa ausente.',
        ADMIN_NAO_AUTORIZADO: 'Apenas administradores ativos podem gerenciar usuarios.',
        EMAIL_INVALIDO: 'Informe um e-mail valido.',
        EMAIL_OBRIGATORIO: 'Informe o e-mail.',
        NOME_OBRIGATORIO: 'Informe o nome completo.',
        SENHA_MINIMA_8_CARACTERES: 'A senha deve ter no minimo 8 caracteres.',
        TIPO_USUARIO_INVALIDO: 'Tipo de usuario invalido.',
        SALA_ATRIBUIDA_OBRIGATORIO: 'Selecione uma sala para usuarios SCT.',
        USUARIO_NAO_ENCONTRADO: 'Usuario nao encontrado nesta escola.',
        AUTO_BLOQUEIO_NEGADO: 'Voce nao pode bloquear, excluir ou rebaixar sua propria conta.',
        ULTIMO_ADMIN_NEGADO: 'Mantenha pelo menos um administrador ativo na escola.',
        ACAO_INVALIDA: 'Acao administrativa invalida.',
    };
    return map[message] ?? message;
}

async function requireAdmin(req: any, serviceClient: ServiceClient) {
    const token = getBearerToken(req);
    if (!token) throw Object.assign(new Error('TOKEN_AUSENTE'), { status: 401 });

    const authClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) {
        throw Object.assign(new Error('TOKEN_AUSENTE'), { status: 401 });
    }

    const { data, error: profileError } = await serviceClient
        .from('usuarios')
        .select('id, email, nome, escola_id, tipo_usuario, ativo')
        .eq('id', authData.user.id)
        .is('excluido_em', null)
        .single();
    const profile = data as AdminProfile | null;

    if (profileError || !profile || profile.tipo_usuario !== 'ADMIN' || !profile.ativo) {
        throw Object.assign(new Error('ADMIN_NAO_AUTORIZADO'), { status: 403 });
    }

    return profile as AdminProfile;
}

async function countActiveAdmins(serviceClient: ServiceClient, escolaId: string) {
    const { count, error } = await serviceClient
        .from('usuarios')
        .select('id', { count: 'exact', head: true })
        .eq('escola_id', escolaId)
        .eq('tipo_usuario', 'ADMIN')
        .eq('ativo', true)
        .is('excluido_em', null);
    if (error) throw error;
    return count ?? 0;
}

async function getTarget(serviceClient: ServiceClient, escolaId: string, id: string) {
    const { data, error } = await serviceClient
        .from('usuarios')
        .select('id, email, nome, escola_id, tipo_usuario, ativo')
        .eq('id', id)
        .eq('escola_id', escolaId)
        .is('excluido_em', null)
        .single();
    if (error || !data) throw Object.assign(new Error('USUARIO_NAO_ENCONTRADO'), { status: 404 });
    return data as AdminProfile;
}

async function logAudit(
    serviceClient: ServiceClient,
    admin: AdminProfile,
    action: string,
    recordId: string | null,
    details: Record<string, unknown>,
) {
    await serviceClient.from('logs_auditoria').insert({
        acao: action,
        tabela_afetada: 'usuarios',
        registro_id: recordId,
        usuario_id: admin.id,
        escola_id: admin.escola_id,
        detalhes: {
            ...details,
            executado_por: admin.id,
            origem: 'ADMIN_USUARIOS_API',
        },
    });
}

export default async function handler(req: any, res: any) {
    if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) {
        res.setHeader('Allow', 'POST, PATCH, DELETE');
        return json(res, 405, { error: 'Metodo nao permitido.' });
    }

    try {
        assertEnvironment();
        const serviceClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const admin = await requireAdmin(req, serviceClient);
        const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}) as RequestBody;
        const action = body.action;

        if (req.method === 'POST' && action === 'create') {
            const nome = cleanText(body.nome, 'NOME');
            const email = cleanEmail(body.email);
            const password = cleanPassword(body.password, true)!;
            const role = cleanRole(body.tipo_usuario);
            const sala = resolveSala(role, body.sala_atribuida);

            const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { nome },
                app_metadata: { sisra_role: role, escola_id: admin.escola_id },
            });
            if (createError || !created.user) throw createError || new Error('FALHA_CRIAR_AUTH');

            const profile = {
                id: created.user.id,
                escola_id: admin.escola_id,
                nome,
                email,
                tipo_usuario: role,
                sala_atribuida: sala,
                turma_atribuida: null,
                ativo: true,
                excluido_em: null,
            };

            const { error: profileError } = await serviceClient.from('usuarios').insert(profile);
            if (profileError) {
                await serviceClient.auth.admin.deleteUser(created.user.id).catch(() => undefined);
                throw profileError;
            }

            await logAudit(serviceClient, admin, 'ALTERACAO_CONFIGURACAO', created.user.id, {
                acao: 'CRIACAO_USUARIO',
                nome,
                email,
                tipo_usuario: role,
            });

            return json(res, 200, { user: profile });
        }

        if (req.method === 'PATCH' && action === 'update') {
            const id = cleanText(body.id, 'ID', 80);
            const target = await getTarget(serviceClient, admin.escola_id, id);
            const nome = cleanText(body.nome, 'NOME');
            const email = cleanEmail(body.email);
            const password = cleanPassword(body.password, false);
            const role = cleanRole(body.tipo_usuario);
            const sala = resolveSala(role, body.sala_atribuida);

            if (target.id === admin.id && role !== 'ADMIN') {
                throw Object.assign(new Error('AUTO_BLOQUEIO_NEGADO'), { status: 400 });
            }
            if (target.tipo_usuario === 'ADMIN' && role !== 'ADMIN' && await countActiveAdmins(serviceClient, admin.escola_id) <= 1) {
                throw Object.assign(new Error('ULTIMO_ADMIN_NEGADO'), { status: 400 });
            }

            const authUpdates: Record<string, unknown> = { user_metadata: { nome } };
            if (email !== target.email) authUpdates.email = email;
            if (password) authUpdates.password = password;

            const { error: authError } = await serviceClient.auth.admin.updateUserById(id, authUpdates);
            if (authError) throw authError;

            const { data, error } = await serviceClient
                .from('usuarios')
                .update({ nome, email, tipo_usuario: role, sala_atribuida: sala })
                .eq('id', id)
                .eq('escola_id', admin.escola_id)
                .select('id, nome, email, tipo_usuario, turma_atribuida, sala_atribuida, ativo')
                .single();
            if (error) throw error;

            await logAudit(serviceClient, admin, 'ALTERACAO_CONFIGURACAO', id, {
                acao: 'EDICAO_USUARIO',
                nome,
                email,
                tipo_usuario: role,
                credenciais_alteradas: Boolean(password || email !== target.email),
            });

            return json(res, 200, { user: data });
        }

        if (req.method === 'PATCH' && action === 'set_status') {
            const id = cleanText(body.id, 'ID', 80);
            const ativo = Boolean(body.ativo);
            const target = await getTarget(serviceClient, admin.escola_id, id);

            if (target.id === admin.id && !ativo) {
                throw Object.assign(new Error('AUTO_BLOQUEIO_NEGADO'), { status: 400 });
            }
            if (target.tipo_usuario === 'ADMIN' && !ativo && await countActiveAdmins(serviceClient, admin.escola_id) <= 1) {
                throw Object.assign(new Error('ULTIMO_ADMIN_NEGADO'), { status: 400 });
            }

            const { error: banError } = await serviceClient.auth.admin.updateUserById(id, {
                ban_duration: ativo ? 'none' : '876000h',
            } as Record<string, unknown>);
            if (banError) throw banError;

            const { data, error } = await serviceClient
                .from('usuarios')
                .update({ ativo })
                .eq('id', id)
                .eq('escola_id', admin.escola_id)
                .select('id, nome, email, tipo_usuario, turma_atribuida, sala_atribuida, ativo')
                .single();
            if (error) throw error;

            await logAudit(serviceClient, admin, 'ALTERACAO_CONFIGURACAO', id, {
                acao: ativo ? 'DESBLOQUEIO_USUARIO' : 'BLOQUEIO_USUARIO',
                nome: target.nome,
                email: target.email,
                novo_status: ativo ? 'ATIVO' : 'BLOQUEADO',
            });

            return json(res, 200, { user: data });
        }

        if (req.method === 'DELETE' && action === 'delete') {
            const id = cleanText(body.id, 'ID', 80);
            const target = await getTarget(serviceClient, admin.escola_id, id);

            if (target.id === admin.id) {
                throw Object.assign(new Error('AUTO_BLOQUEIO_NEGADO'), { status: 400 });
            }
            if (target.tipo_usuario === 'ADMIN' && await countActiveAdmins(serviceClient, admin.escola_id) <= 1) {
                throw Object.assign(new Error('ULTIMO_ADMIN_NEGADO'), { status: 400 });
            }

            const { error } = await serviceClient
                .from('usuarios')
                .update({ ativo: false, excluido_em: new Date().toISOString() })
                .eq('id', id)
                .eq('escola_id', admin.escola_id);
            if (error) throw error;

            await serviceClient.auth.admin.deleteUser(id).catch(() => undefined);

            await logAudit(serviceClient, admin, 'EXCLUSAO_USUARIO', id, {
                acao: 'REVOGACAO_USUARIO',
                nome: target.nome,
                email: target.email,
                tipo_usuario: target.tipo_usuario,
            });

            return json(res, 200, { deleted: true });
        }

        throw Object.assign(new Error('ACAO_INVALIDA'), { status: 400 });
    } catch (error) {
        const status = Number((error as { status?: number })?.status || 500);
        console.error('[admin-users]', error);
        return json(res, status, { error: publicMessage(error) });
    }
}

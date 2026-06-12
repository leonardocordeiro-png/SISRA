import { supabase } from './supabase';

export type PublicGuardian = {
    id: string;
    nome_completo: string;
    foto_url: string | null;
    parentesco?: string;
};

export type PublicStudent = {
    id: string;
    nome_completo: string;
    turma: string;
    sala: string;
    foto_url: string | null;
    escola_id: string;
};

export type PickupStatusPayload = {
    allowed: boolean;
    student: PublicStudent | null;
    pickup: {
        id: string;
        status: string;
        mensagem_sala: string | null;
        mensagem_recepcao: string | null;
        horario_solicitacao: string;
    } | null;
};

type GuardianLookupPayload = {
    guardian: PublicGuardian | null;
    students: PublicStudent[];
};

function escolaIdOrNull() {
    return (import.meta.env.VITE_ESCOLA_ID as string | undefined)?.trim() || null;
}

function normalizeLookupPayload(data: unknown): GuardianLookupPayload {
    const payload = (data ?? {}) as Partial<GuardianLookupPayload>;
    const guardian = payload.guardian
        ? {
            ...payload.guardian,
            parentesco: payload.guardian.parentesco ?? undefined,
        }
        : null;
    return {
        guardian,
        students: Array.isArray(payload.students)
            ? payload.students.map((student) => ({
                ...student,
                turma: student.turma ?? '',
                sala: student.sala ?? '',
            }))
            : [],
    };
}

export async function lookupGuardianByCode(code: string) {
    const { data, error } = await supabase.rpc('sisra_lookup_guardian_by_code', {
        p_code: code.trim(),
        p_escola_id: escolaIdOrNull(),
    });
    if (error) throw error;
    return normalizeLookupPayload(data);
}

export async function lookupGuardianByCpfAndCode(cpf: string, code: string) {
    const { data, error } = await supabase.rpc('sisra_lookup_guardian_by_cpf_and_code', {
        p_cpf: cpf,
        p_code: code.trim(),
        p_escola_id: escolaIdOrNull(),
    });
    if (error) throw error;
    return normalizeLookupPayload(data);
}

export async function lookupGuardianByQr(qr: string) {
    const { data, error } = await supabase.rpc('sisra_lookup_guardian_by_qr', {
        p_qr: qr,
        p_escola_id: escolaIdOrNull(),
    });
    if (error) throw error;
    return normalizeLookupPayload(data);
}

export async function lookupGuardianByCpf(cpf: string) {
    const { data, error } = await supabase.rpc('sisra_lookup_guardian_by_cpf', {
        p_cpf: cpf,
        p_escola_id: escolaIdOrNull(),
    });
    if (error) throw error;
    return normalizeLookupPayload(data);
}

export async function createPickupRequests(
    guardianId: string,
    studentIds: string[],
    origin: string,
    markArrived = false,
) {
    const { data, error } = await supabase.rpc('sisra_create_pickup_requests', {
        p_responsavel_id: guardianId,
        p_aluno_ids: studentIds,
        p_origem: origin,
        p_mark_arrived: markArrived,
    });
    if (error) throw error;
    return (data ?? { inserted: 0, skipped: 0 }) as { inserted: number; skipped: number };
}

export async function getPickupStatus(guardianId: string, studentId: string) {
    const { data, error } = await supabase.rpc('sisra_get_pickup_status', {
        p_responsavel_id: guardianId,
        p_aluno_id: studentId,
    });
    if (error) throw error;
    const payload = (data ?? { allowed: false, student: null, pickup: null }) as PickupStatusPayload;
    if (payload.student) {
        payload.student.turma = payload.student.turma ?? '';
        payload.student.sala = payload.student.sala ?? '';
    }
    return payload;
}

export async function markGuardianArrived(guardianId: string, pickupId?: string) {
    const { data, error } = await supabase.rpc('sisra_mark_guardian_arrived', {
        p_responsavel_id: guardianId,
        p_pickup_id: pickupId || null,
    });
    if (error) throw error;
    return (data ?? { updated: 0 }) as { updated: number };
}

// ── New public RPCs added in migration 20260317000001 ─────────────────────────

export async function getStudentsGuardians(studentIds: string[], escolaId?: string | null) {
    const { data, error } = await supabase.rpc('sisra_get_students_guardians', {
        p_aluno_ids: studentIds,
        p_escola_id: escolaId !== undefined ? escolaId : escolaIdOrNull(),
    });
    if (error) throw error;
    return (Array.isArray(data) ? data : []) as PublicGuardian[];
}

type RequestItem = {
    id: string;
    status: string;
    tipo_solicitacao: string;
    horario_solicitacao: string;
    horario_liberacao: string | null;
    horario_confirmacao: string | null;
    mensagem_sala: string | null;
    mensagem_recepcao: string | null;
    aluno: {
        id: string;
        nome_completo: string;
        turma: string;
        sala: string;
        foto_url: string | null;
    };
};

export type GuardianRequestsPayload = {
    active: RequestItem[];
    history: RequestItem[];
};

export async function getGuardianRequests(guardianId: string, escolaId?: string | null) {
    const { data, error } = await supabase.rpc('sisra_get_guardian_requests', {
        p_responsavel_id: guardianId,
        p_escola_id: escolaId !== undefined ? escolaId : escolaIdOrNull(),
    });
    if (error) throw error;
    return (data ?? { active: [], history: [] }) as GuardianRequestsPayload;
}

export type SchoolActiveRequestsPayload = {
    requests: Array<{
        id: string;
        status: string;
        tipo_solicitacao: string;
        horario_solicitacao: string;
        status_geofence: string | null;
        mensagem_sala: string | null;
        aluno: {
            id: string;
            nome_completo: string;
            turma: string;
            sala: string;
            foto_url: string | null;
        };
        responsavel: { nome_completo: string; foto_url: string | null } | null;
    }>;
    completed_today: number;
};

export async function getSchoolActiveRequests(escolaId: string) {
    const { data, error } = await supabase.rpc('sisra_get_school_active_requests', {
        p_escola_id: escolaId,
    });
    if (error) throw error;
    return (data ?? { requests: [], completed_today: 0 }) as SchoolActiveRequestsPayload;
}

export async function getRegistrationStudentByToken(token: string) {
    const { data, error } = await supabase.rpc('sisra_registration_student_by_token', {
        p_token: token,
    });
    if (error) throw error;
    return (data ?? { student: null }) as { student: PublicStudent | null };
}

export async function lookupRegistrationGuardianByCpf(token: string, cpf: string) {
    const { data, error } = await supabase.rpc('sisra_registration_guardian_by_cpf', {
        p_token: token,
        p_cpf: cpf,
    });
    if (error) throw error;
    return (data ?? { guardian: null }) as { guardian: (PublicGuardian & {
        cpf?: string;
        telefone?: string | null;
        codigo_acesso?: string | null;
    }) | null };
}

export async function registerGuardianByToken(input: {
    token: string;
    nome: string;
    cpf: string;
    telefone: string;
    parentesco: string;
    fotoUrl?: string | null;
}) {
    const { data, error } = await supabase.rpc('sisra_register_guardian_by_token', {
        p_token: input.token,
        p_nome: input.nome,
        p_cpf: input.cpf,
        p_telefone: input.telefone,
        p_parentesco: input.parentesco,
        p_foto_url: input.fotoUrl ?? null,
    });
    if (error) throw error;
    return (data ?? { guardian: null }) as { guardian: (PublicGuardian & {
        cpf: string;
        telefone: string | null;
        codigo_acesso: string | null;
        qr_code: string;
        expires_at: string;
    }) | null };
}

export async function getGuardianQrCard(guardianId: string) {
    const { data, error } = await supabase.rpc('sisra_get_guardian_qr_card', {
        p_responsavel_id: guardianId,
    });
    if (error) throw error;
    return (data ?? { guardian: null }) as { guardian: (PublicGuardian & {
        cpf: string;
        telefone: string | null;
        codigo_acesso: string | null;
        qr_code: string;
        expires_at: string;
    }) | null };
}

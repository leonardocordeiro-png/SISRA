export type Student = {
    id: string;
    nome_completo: string;
    turma: string;
    sala: string;
    foto_url: string | null;
    matricula?: string;
    escola_id?: string;
    sala_id?: string;
    turma_id?: string;
};

export type Guardian = {
    id: string;
    nome_completo: string;
    foto_url: string | null;
    parentesco?: string;
    codigo_acesso?: string;
    cpf?: string;
    telefone?: string;
    expires_at?: string;
    qr_code?: string;
};

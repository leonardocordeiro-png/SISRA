export const getSalaBySerie = (serie: string, turma: string = '') => {
    const t = turma.toUpperCase();

    // Specific mappings based on Turma code (Shift)
    if (['131M', '132M', '122T', '123T'].includes(t)) return 'Sala 101';
    if (['141M', '142M', '133T'].includes(t)) return 'Sala 102';
    if (['111M', '121M', '112T', '113T'].includes(t)) return 'Sala 103';
    if (['151M', '152M', '153T', '154T'].includes(t)) return 'Sala 104';
    if (['143T', '144T'].includes(t)) return 'Sala 109';

    // Fallbacks based on Serie name (Old logic)
    // Fallbacks based on Serie name (Less precise, won't distinguish shift)
    if (serie.includes('4º Ano')) return t.includes('T') ? 'Sala 109' : 'Sala 102';
    if (serie.includes('3º Ano')) return t.includes('T') ? 'Sala 102' : 'Sala 101';
    if (serie.includes('1º Ano')) return t.includes('T') ? 'Sala 103' : 'Sala 103';
    if (serie.includes('2º Ano')) return t.includes('T') ? 'Sala 101' : 'Sala 103';
    if (serie.includes('5º Ano')) return 'Sala 104';

    return '';
};
export const generateToken = (length: number = 6) => {
    // crypto.getRandomValues() is cryptographically secure (CSPRNG).
    // Math.random() must NOT be used for security tokens — it is predictable.
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars like O, 0, I, 1
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => chars[byte % chars.length]).join('');
};

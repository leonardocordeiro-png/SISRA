export const getSalaBySerie = (serie: string) => {
    if (serie.includes('4º Ano')) return 'Sala 101';
    if (serie.includes('3º Ano')) return 'Sala 102';
    if (serie.includes('1º Ano') || serie.includes('2º Ano')) return 'Sala 103';
    if (serie.includes('5º Ano')) return 'Sala 104';
    return '';
};
export const generateToken = (length: number = 6) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars like O, 0, I, 1
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

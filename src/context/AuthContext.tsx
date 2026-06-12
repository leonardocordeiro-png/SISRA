import { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/audit';

type AuthContextType = {
    user: User | null;
    session: Session | null;
    loading: boolean;
    role: string | null;
    escolaId: string | null;
    active: boolean;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    role: null,
    escolaId: null,
    active: false,
    signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<string | null>(null);
    const [escolaId, setEscolaId] = useState<string | null>(null);
    const [active, setActive] = useState(false);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchUserProfile(session.user.id);
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                setLoading(true);
                setRole(null);
                setEscolaId(null);
                setActive(false);
                fetchUserProfile(session.user.id);
            } else {
                setRole(null);
                setEscolaId(null);
                setActive(false);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function fetchUserProfile(userId: string) {
        try {
            const { data, error } = await supabase
                .from('usuarios')
                .select('tipo_usuario, escola_id, ativo')
                .eq('id', userId)
                .is('excluido_em', null)
                .maybeSingle();

            if (error) {
                console.error('Error fetching user profile:', error);
                setRole(null);
                setEscolaId(null);
                setActive(false);
                await supabase.auth.signOut();
            } else if (!data || data.ativo === false) {
                setRole(null);
                setEscolaId(null);
                setActive(false);
                await supabase.auth.signOut();
            } else {
                setRole(data.tipo_usuario);
                setEscolaId(data.escola_id);
                setActive(true);
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
        } finally {
            setLoading(false);
        }
    }

    const signOut = async () => {
        const currentUserId = user?.id;
        const currentEmail = user?.email;
        const currentEscolaId = escolaId;

        await supabase.auth.signOut();

        if (currentUserId) {
            await logAudit('SISTEMA_LOGOUT', 'usuarios', currentUserId, { email: currentEmail }, currentUserId, currentEscolaId || undefined);
        }

        setRole(null);
        setEscolaId(null);
        setActive(false);
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, role, escolaId, active, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};


import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

type ProtectedRouteProps = {
    children: React.ReactNode;
    allowedRoles: string[];
    loginPath?: string;
};

export default function ProtectedRoute({ children, allowedRoles, loginPath = '/' }: ProtectedRouteProps) {
    const { user, role, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
                    <p className="text-slate-500 font-medium text-sm">Verificando acesso...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to={loginPath} replace />;
    }

    // role === null means the user exists in Supabase Auth but has no profile
    // in the `usuarios` table (or the profile fetch failed). Never grant access
    // in this state — redirect to login so the issue surfaces cleanly.
    if (!role || !allowedRoles.includes(role)) {
        return <Navigate to={loginPath} replace />;
    }

    return <>{children}</>;
}

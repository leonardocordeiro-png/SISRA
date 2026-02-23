import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Package } from 'lucide-react';

type LostFoundItem = {
    id: string;
    item_description: string;
    found_date: string;
    status: string;
    image_url: string | null;
};

export default function LostAndFoundBoard() {
    const [items, setItems] = useState<LostFoundItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        try {
            const { data, error } = await supabase
                .from('lost_and_found')
                .select('*')
                .eq('status', 'active')
                .order('found_date', { ascending: false });

            if (error) throw error;
            setItems(data || []);
        } catch (err) {
            console.error('Error fetching lost & found:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = items.filter(item =>
        item.item_description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return <div className="p-8 text-center">Carregando...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Package className="w-8 h-8 text-emerald-600" />
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900">Achados e Perdidos</h1>
                            <p className="text-slate-600">Confira se algum item seu foi encontrado</p>
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="mb-6">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar item..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-lg"
                        />
                    </div>
                </div>

                {/* Items Grid */}
                {filteredItems.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                        <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Nenhum item encontrado</h3>
                        <p className="text-slate-600">Não há itens correspondentes à sua busca</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredItems.map((item) => (
                            <div
                                key={item.id}
                                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
                            >
                                {/* Image */}
                                <div className="h-48 bg-gradient-to-br from-emerald-100 to-blue-100 flex items-center justify-center">
                                    {item.image_url ? (
                                        <img
                                            src={item.image_url}
                                            alt={item.item_description}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <Package className="w-16 h-16 text-emerald-600" />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-4">
                                    <h3 className="text-lg font-bold text-slate-900 mb-2">{item.item_description}</h3>
                                    <p className="text-sm text-slate-600">
                                        Encontrado em {new Date(item.found_date).toLocaleDateString('pt-BR')}
                                    </p>

                                    <button className="mt-4 w-full px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700">
                                        Solicitar Retirada
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Info */}
                <div className="mt-8 bg-blue-50 rounded-xl p-6">
                    <h3 className="text-sm font-bold text-blue-900 mb-2">ℹ️ Como funciona</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Itens encontrados ficam disponíveis por 30 dias</li>
                        <li>• Para retirar, clique em "Solicitar Retirada" e apresente-se na secretaria</li>
                        <li>• Você precisará apresentar documento e descrever o item</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

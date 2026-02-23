import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Navigation } from 'lucide-react';

// Coordinates of the school (Example: LaSalle)
// TODO: Move to database/settings
const SCHOOL_COORDS = {
    latitude: -29.916892, // Replace with actual school coords
    longitude: -51.179836
};

// Haversine formula to calculate distance in meters
function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d * 1000; // Meters
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

export default function GeoTracker({ pickupId }: { pickupId: string }) {
    const [tracking, setTracking] = useState(false);
    const [distance, setDistance] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let watchId: number;

        if (tracking) {
            if (!navigator.geolocation) {
                setError('Geolocalização não suportada');
                return;
            }

            setError(null); // Clear previous errors
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const dist = getDistanceFromLatLonInMeters(
                        latitude,
                        longitude,
                        SCHOOL_COORDS.latitude,
                        SCHOOL_COORDS.longitude
                    );

                    setDistance(Math.round(dist));
                    updateStatus(pickupId, dist, latitude, longitude);
                },
                (err) => setError(err.message),
                {
                    enableHighAccuracy: false, // Standard accuracy is more reliable for testing
                    timeout: 15000,           // Increased to 15 seconds
                    maximumAge: 5000          // Accept a 5-second old position
                }
            );
        }

        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, [tracking, pickupId]);

    const updateStatus = async (id: string, dist: number, lat: number, lng: number) => {
        let statusGeofence = 'LONGE';
        if (dist < 50) statusGeofence = 'CHEGOU';
        else if (dist < 500) statusGeofence = 'PERTO';

        // Update database
        // Debounce this in real production to save writes
        await supabase
            .from('solicitacoes_retirada')
            .update({
                latitude: lat,
                longitude: lng,
                distancia_estimada_metros: dist,
                status_geofence: statusGeofence
            })
            .eq('id', id);

        // If "CHEGOU", we can also auto-update the main status if business logic requires
    };

    return (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mt-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tracking ? 'bg-emerald-100 text-emerald-600 animate-pulse' : 'bg-slate-200 text-slate-400'}`}>
                        <Navigation className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-700 text-sm">Modo "Estou Chegando"</p>
                        <p className="text-xs text-slate-500">
                            {tracking
                                ? distance
                                    ? `Distância: ${distance}m`
                                    : 'Calculando...'
                                : 'Ative para avisar automaticamente'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setTracking(!tracking)}
                    className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${tracking
                        ? 'bg-red-100 text-red-600 hover:bg-red-200'
                        : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20'
                        }`}
                >
                    {tracking ? 'Parar' : 'Ativar'}
                </button>
            </div>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
    );
}

export async function getRoute(start, end) {
    try {
        // OSRM expects: lon,lat;lon,lat
        const startStr = `${start[1]},${start[0]}`;
        const endStr = `${end[1]},${end[0]}`;

        const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${startStr};${endStr}?overview=full&geometries=geojson`
        );

        if (!response.ok) {
            throw new Error('Rota servisine erişilemedi');
        }

        const data = await response.json();

        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            throw new Error('Rota bulunamadı');
        }

        const route = data.routes[0];

        // Convert GeoJSON [lon, lat] to Leaflet [lat, lon]
        const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);

        // Simulate traffic condition (randomly)
        const trafficLevel = Math.random();
        let color = 'green'; // Low traffic
        let trafficStatus = 'Akıcı';

        if (trafficLevel > 0.7) {
            color = 'red'; // Heavy traffic
            trafficStatus = 'Yoğun';
        } else if (trafficLevel > 0.4) {
            color = 'orange'; // Moderate traffic
            trafficStatus = 'Orta';
        }

        return {
            coordinates,
            distance: (route.distance / 1000).toFixed(1), // km
            duration: (route.duration / 60).toFixed(0), // min
            color,
            trafficStatus
        };

    } catch (error) {
        console.error('Routing error:', error);
        // Fallback to straight line if API fails
        return {
            coordinates: [start, end],
            distance: '?',
            duration: '?',
            color: 'gray',
            trafficStatus: 'Bilinmiyor'
        };
    }
}

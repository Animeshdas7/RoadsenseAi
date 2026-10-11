import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { getReports } from './api';
const DEFAULT_POSITION = [22.8721, 88.4169];
const HAZARD_RADIUS_METRES = 100;
const WEATHER_REFRESH_MS = 15 * 60 * 1000;
const emergencyIcon = L.divIcon({ className: 'emergency-service-marker', html: '<div style="width:30px;height:30px;border-radius:50%;background:#f8fafc;border:3px solid #dc2626;color:#dc2626;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;box-shadow:0 2px 8px #0008">+</div>', iconSize: [30,30], iconAnchor: [15,15] });

const hazardIcon = L.divIcon({
  className: 'hazard-marker-wrapper',
  html: `
    <div style="
      width:32px;height:32px;background:#dc2626;border:3px solid white;
      border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      box-shadow:0 2px 8px rgba(0,0,0,.45);
      display:flex;align-items:center;justify-content:center">
      <span style="color:white;font-size:18px;font-weight:bold;transform:rotate(45deg)">!</span>
    </div>
  `,

  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -30],
});

function MapClickHandler({ onChoose }) {
  useMapEvents({
    click(event) {
      onChoose([event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
}

function MapFocus({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 15, { duration: 0.8 });
    }
  }, [map, position]);
  return null;
}

function HazardMapAutoFit({ reports }) {
  const map = useMap();
  const positionsKey = JSON.stringify(
    reports.map((report) => [
      report.id,
      Number(report.latitude),
      Number(report.longitude),
    ])
  );

  useEffect(() => {
    if (!reports.length) return;
    const positions = reports.map((report) => [
      Number(report.latitude),
      Number(report.longitude),
    ]);

    if (positions.length === 1) {
      map.setView(positions[0], 13, { animate: true });
      return;
    }

    const bounds = L.latLngBounds(positions);
    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [35, 35],
        maxZoom: 12,
        animate: true,
      });
    }
  }, [map, positionsKey]);
  return null;
}

function distanceFromPointToSegment(point, start, end) {
  const latitudeScale = 111320;
  const longitudeScale =
    111320 * Math.cos((point[0] * Math.PI) / 180);
  const px = (point[1] - start[1]) * longitudeScale;
  const py = (point[0] - start[0]) * latitudeScale;
  const ex = (end[1] - start[1]) * longitudeScale;
  const ey = (end[0] - start[0]) * latitudeScale;
  const lengthSquared = ex * ex + ey * ey;
  if (lengthSquared === 0) {
    return Math.hypot(px, py);
  }
  const t = Math.max(
    0,
    Math.min(1, (px * ex + py * ey) / lengthSquared),
  );
  return Math.hypot(px - t * ex, py - t * ey);
}

function findNearbyHazards(routeCoordinates, hazardList) {
  if (!routeCoordinates || routeCoordinates.length < 2) {
    return [];
  }
  const nearbyHazards = hazardList.filter((hazard) => {
    const latitude = Number(hazard.latitude);
    const longitude = Number(hazard.longitude);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return false;
    }

    const point = [latitude, longitude];
    for (
      let index = 0;
      index < routeCoordinates.length - 1;
      index += 1
    ) {
      const start = [
        routeCoordinates[index].lat,
        routeCoordinates[index].lng,
      ];
      const end = [
        routeCoordinates[index + 1].lat,
        routeCoordinates[index + 1].lng,
      ];
      if (
        distanceFromPointToSegment(point, start, end) <=
        HAZARD_RADIUS_METRES
      ) {
        return true;
      }
    }
    return false;
  });

  const severityRank = { low: 1, medium: 2, high: 3 };
  const uniqueHazards = [];
  for (const hazard of nearbyHazards) {
    const type = String(hazard.type || "").trim().toLowerCase();
    const lat = Number(hazard.latitude);
    const lng = Number(hazard.longitude);
    const duplicateIndex = uniqueHazards.findIndex((existing) => {
      const existingType = String(existing.type || "")
        .trim()
        .toLowerCase();
      const lat1 = (Number(existing.latitude) * Math.PI) / 180;
      const lat2 = (lat * Math.PI) / 180;
      const dLat = lat2 - lat1;
      const dLng =
        ((lng - Number(existing.longitude)) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) *
          Math.cos(lat2) *
          Math.sin(dLng / 2) ** 2;
      const distance = 6371000 * 2 *
        Math.asin(Math.sqrt(Math.min(1, a)));
      if (!type || !existingType) {
  return false;
}

if (type !== existingType) {
  return false;
}
return distance <= 30;
    });
    if (duplicateIndex === -1) {
      uniqueHazards.push(hazard);
    } else {
      const existing = uniqueHazards[duplicateIndex];
      if (
        (severityRank[String(hazard.severity).toLowerCase()] || 0) >
        (severityRank[String(existing.severity).toLowerCase()] || 0)
      ) {
        uniqueHazards[duplicateIndex] = hazard;
      }
    }
  }
  return uniqueHazards;
}

function getRiskLevel(riskPoints) {
  if (riskPoints >= 8) {
    return { label: 'High', color: '#dc2626' };
  }

  if (riskPoints >= 3) {
    return { label: 'Medium', color: '#d97706' };
  }
  return { label: 'Low', color: '#16a34a' };
}

function getRouteScore(route) {
  return (
    route.riskPoints * 10 +
    (route.distance / 1000) * 0.5 +
    (route.duration / 60) * 0.2
  );
}

function formatDistance(metres) {
  return metres >= 1000
    ? `${(metres / 1000).toFixed(2)} km`
    : `${Math.round(metres)} m`;
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours
    ? `${hours} hr ${remaining} min`
    : `${remaining} min`;
}

function describeWeatherCode(code) {
  if (code === 0) return 'Clear sky';
  if ([1, 2, 3].includes(code)) return 'Partly cloudy';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67].includes(code)) return 'Rain';
  if ([71, 73, 75, 77].includes(code)) return 'Snow';
  if ([80, 81, 82].includes(code)) return 'Rain showers';
  if ([85, 86].includes(code)) return 'Snow showers';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Weather unavailable';
}

function isRainyWeather(weather) {
  if (!weather) return false;
  const rainyCodes = [
    51, 53, 55, 56, 57,
    61, 63, 65, 66, 67,
    80, 81, 82, 95, 96, 99,
  ];
  return (
    Number(weather.rain) > 0 ||
    Number(weather.precipitation) > 0 ||
    rainyCodes.includes(Number(weather.weather_code))
  );
}

function RouteControl({
  start,
  destination,
  hazards,
  onRoutes,
  onMessage,
}) {
  const map = useMap();
  useEffect(() => {
    if (!start || !destination) return undefined;
    let active = true;
    onRoutes([]);
    onMessage('Calculating routes...');
    const control = L.Routing.control({
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        routingOptions: {
          alternatives: 3,
          steps: true,
          overview: 'full',
        },
      }),
      waypoints: [
        L.latLng(start[0], start[1]),
        L.latLng(destination[0], destination[1]),
      ],
      routeWhileDragging: false,
      showAlternatives: true,
      show: true,
      addWaypoints: false,
      createMarker: () => null,
      lineOptions: {
        styles: [
          { color: '#0d9488', opacity: 0.9, weight: 6 },
        ],
      },
      altLineOptions: {
        styles: [
          { color: '#64748b', opacity: 0.75, weight: 5 },
        ],
      },
    });
    control.on('routesfound', (event) => {
      if (!active) return;
      const results = event.routes.map((route, index) => {
        const nearbyHazards = findNearbyHazards(
          route.coordinates,
          hazards,
        );
        const severityPoints = {
          low: 1,
          medium: 3,
          high: 5,
        };
        const riskPoints = nearbyHazards.reduce(
          (total, hazard) =>
            total + (severityPoints[String(hazard.severity || '').toLowerCase()] || 0),
          0,
        );
        return {
          id: index,
          distance: route.summary.totalDistance,
          duration: route.summary.totalTime,
          nearbyHazards,
          hazardCount: nearbyHazards.length,
          riskPoints,
        };
      });

      onRoutes(results);
      onMessage(
        results.length > 1
          ? `${results.length} routes found. Comparing distance, estimated time and verified database hazards.`
          : 'One route found. The routing service returned no alternatives.',
      );
    });

    control.on('routingerror', () => {
      if (!active) return;
      onRoutes([]);
      onMessage(
        'Route calculation failed. Check your internet connection and try again.',
      );
    });

    control.addTo(map);
    return () => {
      active = false;
      control.off('routesfound');
      control.off('routingerror');

      // Leaflet Routing Machine can throw while removing a route layer
      // that has already been cleared during a fast rerender/unmount.
      try {
        if (control._map) {
          map.removeControl(control);
        }
      } catch (cleanupError) {
        console.warn('Routing control cleanup warning:', cleanupError);
      }
    };
  }, [
    map,
    start,
    destination,
    hazards,
    onRoutes,
    onMessage,
  ]);
  return null;
}

function WeatherPanel({
  title,
  position,
  weather,
  loading,
  error,
  onRefresh,
}) {
  const rainy = isRainyWeather(weather);
  return (
    <section
      style={{
        margin: '16px 0',
        padding: '16px',
        borderRadius: '12px',

        border: '1px solid #334155',

        background: 'rgba(15, 23, 42, 0.75)',

        color: 'inherit',

      }}

    >

      <div

        style={{

          display: 'flex',

          alignItems: 'center',

          justifyContent: 'space-between',

          gap: '12px',

          flexWrap: 'wrap',

        }}

      >

        <div>

          <span className="card-kicker">WEATHER INTELLIGENCE</span>

          <h3 style={{ margin: '6px 0' }}>

            {title}

          </h3>

          <p style={{ fontSize: '12px', opacity: 0.7, margin: 0 }}>

            Coordinates: {position[0].toFixed(4)}, {position[1].toFixed(4)}

          </p>

        </div>

        <button

          type="button"

          className="secondary-button"

          onClick={onRefresh}

          disabled={loading}

        >

          {loading ? 'Updating...' : 'Refresh weather'}

        </button>

      </div>

      {loading && (

        <p style={{ marginTop: '14px' }}>

          Loading weather information...

        </p>

      )}

      {error && (

        <p style={{ color: '#fbbf24', marginTop: '14px' }}>

          Weather data unavailable. Check your internet connection and retry.

        </p>

      )}

      {!loading && !error && weather && (

        <>

          <div

            style={{

              display: 'grid',

              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',

              gap: '10px',

              marginTop: '16px',

            }}

          >

            {[

              {

                label: 'Conditions',

                value: describeWeatherCode(weather.weather_code),

              },

              {

                label: 'Temperature',

                value: `${weather.temperature_2m} ${weather.temperatureUnit}`,

              },

              {

                label: 'Rain',

                value: `${weather.rain ?? 0} ${weather.rainUnit}`,

              },

              {

                label: 'Precipitation',

                value: `${weather.precipitation ?? 0} mm`,

              },

              {

                label: 'Humidity',

                value: `${weather.relative_humidity_2m}%`,

              },

              {

                label: 'Wind',

                value: `${weather.wind_speed_10m} ${weather.windUnit}`,

              },

            ].map((item) => (

              <div

                key={item.label}

                style={{

                  padding: '12px',

                  borderRadius: '9px',

                  background: 'rgba(100, 116, 139, 0.12)',

                  border: '1px solid rgba(100, 116, 139, 0.25)',

                }}

              >

                <div style={{ fontSize: '12px', opacity: 0.7 }}>

                  {item.label}

                </div>

                <strong

                  style={{

                    display: 'block',

                    marginTop: '5px',

                    overflowWrap: 'anywhere',

                  }}

                >

                  {item.value}

                </strong>

              </div>

            ))}

          </div>

          {rainy && (

            <div

              role="alert"

              style={{

                marginTop: '14px',

                padding: '12px',

                borderRadius: '8px',

                background: 'rgba(217, 119, 6, 0.16)',

                border: '1px solid rgba(217, 119, 6, 0.5)',

                color: '#fbbf24',

              }}

            >

              <strong>Rain / adverse weather warning</strong>

              <p style={{ marginBottom: 0 }}>

                Wet roads may be slippery and visibility may be reduced.

                Travel carefully.

              </p>

            </div>

          )}

        </>

      )}

      <p

        style={{

          fontSize: '11px',

          opacity: 0.6,

          marginBottom: 0,

          marginTop: '14px',

        }}

      >

        Weather source: Open-Meteo. Data refreshes every 15 minutes.

        Weather observations are not a guarantee of local road conditions.

      </p>

    </section>

  );

}

function EmergencyPanel({ active, position, services, loading, error, onFind, onNavigate }) {

  if (!active) return null;

  return (

    <section style={{ margin: '16px 0', padding: 16, borderRadius: 12, border: '1px solid #ef4444', background: 'rgba(69,10,10,.20)' }}>

      <span className="card-kicker">LOCAL SERVICES & SAFETY</span>

      <h3 style={{ margin: '6px 0' }}>Nearby Places & Emergency Services</h3>

      <p style={{ marginTop: 0, fontSize: 13, opacity: .8 }}>

        Hospitals, police, ambulance, pharmacies, garages, markets, food and other mapped places near the selected location.

        {position ? ` Search centre: ${position[0].toFixed(4)}, ${position[1].toFixed(4)}` : ' Select a point on the map first.'}

      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>

        <button type="button" className="secondary-button" onClick={onFind} disabled={!position || loading}>

          {loading ? 'Finding nearby places…' : 'Refresh nearby places'}

        </button>

      </div>

      {active && <p role="alert" style={{ color: '#fca5a5', fontWeight: 700, marginBottom: 0 }}>Emergency panel is open. This demo does not contact or dispatch emergency services.</p>}

      {error && <p style={{ color: '#fbbf24' }}>Could not load nearby services. Try again shortly.</p>}

      {services.length > 0 && <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>

        {services.map((service) => <div key={service.id} style={{ padding: 10, borderRadius: 8, background: 'rgba(148,163,184,.12)' }}>

          <strong>{service.name}</strong><div style={{ fontSize: 12, opacity: .8 }}>{service.type} · {service.distanceKm.toFixed(1)} km away</div>

          {service.phone && <div style={{ fontSize: 12 }}>Phone: {service.phone}</div>}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>

            <button type="button" className="secondary-button" onClick={() => onNavigate(service)} style={{ fontSize: 12, padding: '7px 10px' }}>Navigate here</button>

            <a href={`https://www.openstreetmap.org/?mlat=${service.lat}&mlon=${service.lon}#map=17/${service.lat}/${service.lon}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, alignSelf: 'center' }}>Open location map</a>

          </div>

        </div>)}

      {services.length === 0 && !loading && !error && active && <p style={{ fontSize: 13, opacity: .8 }}>No mapped places loaded yet. Try Refresh nearby places or check your internet connection.</p>}

      </div>}

      <p style={{ fontSize: 11, opacity: .65, marginBottom: 0 }}>Data: OpenStreetMap community data. Always verify availability and contact local emergency services directly.</p>

    </section>

  );

}

export default function InteractiveMap({ emergencyActive = false, onEmergencyChange = () => {} }) {

  const [start, setStart] = useState(null);

  const [destination, setDestination] = useState(null);

  const [selection, setSelection] = useState('start');

  const [startSearch, setStartSearch] = useState('');

  const [destinationSearch, setDestinationSearch] = useState('');

  const [searchResults, setSearchResults] = useState([]);

  const [searchType, setSearchType] = useState(null);

  const [message, setMessage] = useState(

    'Search for a place or click the map to select locations.',

  );

  const [routes, setRoutes] = useState([]);

  const [selectedRoute, setSelectedRoute] = useState(null);

  const [reports, setReports] = useState([]);

  const [reportsError, setReportsError] = useState(false);

  const reportsSignatureRef = useRef('');

  const [weather, setWeather] = useState(null);

  const [weatherError, setWeatherError] = useState(false);

  const [weatherLoading, setWeatherLoading] = useState(false);

  const [weatherRefreshKey, setWeatherRefreshKey] = useState(0);

  const [emergencyPosition, setEmergencyPosition] = useState(null);

  const [emergencyServices, setEmergencyServices] = useState([]);

  const [emergencyLoading, setEmergencyLoading] = useState(false);

  const [emergencyError, setEmergencyError] = useState(false);

const loadReports = useCallback(async () => {

  try {

    const data = await getReports();

    console.log("TOTAL REPORTS FROM API:", data.length);

console.table(

  data.map((r) => ({

    id: r.id,

    title: r.title,

    status: r.verificationStatus,

    latitude: r.latitude,

    longitude: r.longitude,

  }))

);

    if (!Array.isArray(data)) {

      throw new Error("Invalid reports response");

    }

    const validReports = data.filter((report) => {

      const lat = Number(report.latitude);

      const lng = Number(report.longitude);

      return (

        report.id != null &&

        Number.isFinite(lat) &&

        Number.isFinite(lng) &&

        lat >= -90 &&

        lat <= 90 &&

        lng >= -180 &&

        lng <= 180

      );

    });

    const signature = JSON.stringify(validReports);

    if (signature !== reportsSignatureRef.current) {

      reportsSignatureRef.current = signature;

      setReports(validReports);

    }

    setReportsError(false);

  } catch (error) {

    console.error("Failed to refresh hazard reports:", error);

    setReportsError(true);

  }

}, []);

  // Refresh saved reports every 10 seconds.

  useEffect(() => {

    loadReports();

    const intervalId = window.setInterval(loadReports, 10000);

    return () => window.clearInterval(intervalId);

  }, [loadReports]);

  // Only active reports are displayed as map markers.

const visibleReports = useMemo(

  () =>

    reports.filter((report) => {

      const status = String(

        report.verificationStatus || ""

      ).trim().toLowerCase();

      const lat = Number(report.latitude);

      const lng = Number(report.longitude);

      return (

        status === "verified" &&

        Number.isFinite(lat) &&

        Number.isFinite(lng) &&

        lat >= -90 &&

        lat <= 90 &&

        lng >= -180 &&

        lng <= 180

      );

    }),

  [reports]

);

  // Only verified reports affect route-risk scores.

  const verifiedHazards = useMemo(

    () =>

      reports.filter(

        (report) =>

          report.verificationStatus === 'verified' &&

          Number.isFinite(Number(report.latitude)) &&

          Number.isFinite(Number(report.longitude)) &&

          ['low', 'medium', 'high'].includes(report.severity),

      ),

    [reports],

  );

  const handleRoutes = useCallback((results) => {

    setRoutes(results);

    setSelectedRoute(null);

  }, []);

  const handleMessage = useCallback((text) => {

    setMessage(text);

  }, []);

  const rankedRoutes = useMemo(

    () => [...routes].sort((a, b) => getRouteScore(a) - getRouteScore(b)),

    [routes],

  );

  const recommendedRouteId = rankedRoutes.length

    ? rankedRoutes[0].id

    : null;

  const highRiskRoute = rankedRoutes.some((route) => getRiskLevel(route.riskPoints).label === 'High');

  useEffect(() => {

    if (highRiskRoute) {

      onEmergencyChange(true);

      const point = destination || start || null;

      setEmergencyPosition(point);

      if (point) {

        // Automatically open the nearby-places panel and fetch results on high risk.

        setTimeout(() => { findEmergencyServices(point); }, 0);

      }

    }

  }, [highRiskRoute, onEmergencyChange, destination, start]);

  const weatherPosition = destination || start || DEFAULT_POSITION;

  const weatherTitle = destination

    ? 'Destination Weather & Rain Alert'

    : start

      ? 'Starting Point Weather & Rain Alert'

      : 'Weather & Rain Alert — Select a location';

  const weatherLatitude = weatherPosition[0];

  const weatherLongitude = weatherPosition[1];

  // Fetch weather for the destination when selected; otherwise use the starting point.

  useEffect(() => {

    let active = true;

    let controller;

    async function loadWeather() {

      const latitude = weatherLatitude;

      const longitude = weatherLongitude;

      controller?.abort();

      controller = new AbortController();

      setWeatherLoading(true);

      setWeatherError(false);

      try {

        const params = new URLSearchParams({

          latitude: String(latitude),

          longitude: String(longitude),

          current:

            'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m',

          timezone: 'auto',

        });

        const response = await fetch(

          `https://api.open-meteo.com/v1/forecast?${params.toString()}`,

          { signal: controller.signal },

        );

        if (!response.ok) {

          throw new Error('Weather service unavailable');

        }

        const data = await response.json();

        if (!data.current) {

          throw new Error('Current weather data is missing');

        }

        if (active) {

          setWeather({

            ...data.current,

            temperatureUnit:

              data.current_units?.temperature_2m || '°C',

            windUnit:

              data.current_units?.wind_speed_10m || 'km/h',

            rainUnit: data.current_units?.rain || 'mm',

          });

          setWeatherError(false);

        }

      } catch (error) {

        if (active && error.name !== 'AbortError') {

          setWeatherError(true);

        }

      } finally {

        if (active) setWeatherLoading(false);

      }

    }

    loadWeather();

    const intervalId = window.setInterval(

      loadWeather,

      WEATHER_REFRESH_MS,

    );

    return () => {

      active = false;

      controller?.abort();

      window.clearInterval(intervalId);

    };

  }, [weatherLatitude, weatherLongitude, weatherRefreshKey]);

  const emergencySearchPosition = emergencyPosition || destination || start;

  function navigateToEmergencyService(service) {

    const origin = emergencySearchPosition || start || destination;

    if (!origin) {

      setMessage('Select a starting point or map location before navigating to an emergency service.');

      return;

    }

    const target = [Number(service.lat), Number(service.lon)];

    setStart(origin);

    setDestination(target);

    setStartSearch(`Emergency origin: ${origin[0].toFixed(5)}, ${origin[1].toFixed(5)}`);

    setDestinationSearch(`${service.name} (${service.type})`);

    setSelection('start');

    setRoutes([]);

    setSelectedRoute(null);

    setEmergencyPosition(origin);

    setMessage(`Calculating route to ${service.name}. Check the route details before travelling.`);

  }

  async function findEmergencyServices(positionOverride = null) {

    const searchPosition = positionOverride || emergencySearchPosition;

    if (!searchPosition) {

      setEmergencyError(true);

      setMessage('Select a location on the map or choose a start/destination first.');

      return;

    }

    setEmergencyLoading(true);

    setEmergencyError(false);

    setEmergencyServices([]);

    try {

      const [lat, lon] = searchPosition;

      const query = `[out:json][timeout:25];(

        nwr(around:5000,${lat},${lon})[amenity\~"^(hospital|police|ambulance_station|clinic|doctors|pharmacy|marketplace|food_court|restaurant|fast_food|cafe|fuel|car_repair|car_rental|parking|bus_station|shelter|toilets|fire_station)$"];

        nwr(around:5000,${lat},${lon})[shop\~"^(chemist|pharmacy|car_repair|car|supermarket|convenience|mall|department_store|bakery|butcher|greengrocer|marketplace)$"];

        nwr(around:5000,${lat},${lon})[healthcare\~"^(hospital|clinic|doctor|pharmacy|emergency)$"];

      );out center tags;`;

      // Public Overpass instances may be busy. Try fallback instances with
      // a timeout so one unresponsive endpoint does not block the panel.
      const overpassEndpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://overpass.private.coffee/api/interpreter',
      ];
      let data = null;
      let lastError = null;

      for (const endpoint of overpassEndpoints) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 12000);
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: `data=${encodeURIComponent(query)}`,
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error(`Overpass returned HTTP ${response.status}`);
          }
          const responseData = await response.json();
          if (!Array.isArray(responseData.elements)) {
            throw new Error('Invalid Overpass response');
          }
          data = responseData;
          break;
        } catch (requestError) {
          lastError = requestError;
        } finally {
          window.clearTimeout(timeoutId);
        }
      }

      if (!data) {
        throw lastError || new Error('All nearby-place services are unavailable');
      }

      const distanceKm = (aLat, aLon) => {

        const rad = (v) => (v * Math.PI) / 180;

        const dLat = rad(aLat - lat), dLon = rad(aLon - lon);

        const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(aLat)) * Math.sin(dLon / 2) ** 2;

        return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

      };

      const normalized = (data.elements || []).map((item) => {

        const itemLat = item.lat ?? item.center?.lat;

        const itemLon = item.lon ?? item.center?.lon;

        if (!Number.isFinite(Number(itemLat)) || !Number.isFinite(Number(itemLon))) return null;

        const tags = item.tags || {};

        const amenity = tags.amenity || tags.healthcare || tags.shop || 'place';

        const typeMap = { hospital: 'Hospital', police: 'Police station', ambulance_station: 'Ambulance station', clinic: 'Clinic', doctors: 'Doctor / clinic', pharmacy: 'Pharmacy / medical shop', emergency: 'Emergency healthcare', fire_station: 'Fire station', marketplace: 'Market', food_court: 'Food court', restaurant: 'Restaurant', fast_food: 'Fast food', cafe: 'Cafe', fuel: 'Fuel station', car_repair: 'Car garage / repair', car_rental: 'Car rental', parking: 'Parking', bus_station: 'Bus station', shelter: 'Shelter', toilets: 'Public toilet', chemist: 'Medical shop', supermarket: 'Supermarket', convenience: 'Convenience store', mall: 'Shopping mall', department_store: 'Department store', bakery: 'Bakery', butcher: 'Butcher', greengrocer: 'Vegetable shop', doctor: 'Doctor / clinic', car: 'Automotive shop' };

        const type = typeMap[amenity] || 'Nearby place';

        return { id: `${item.type}-${item.id}`, lat: Number(itemLat), lon: Number(itemLon), name: tags.name || type, type, phone: tags.phone || tags['contact:phone'] || '', distanceKm: distanceKm(itemLat, itemLon) };

      }).filter(Boolean).sort((a, b) => a.distanceKm - b.distanceKm);

      const unique = [...new Map(normalized.map((item) => [`${item.name}-${item.lat.toFixed(4)}-${item.lon.toFixed(4)}`, item])).values()].slice(0, 20);

      setEmergencyServices(unique);

      setEmergencyError(false);

      if (!unique.length) setMessage('No mapped nearby places found within 5 km. Try another location.');

    } catch {

      setEmergencyError(true);

    } finally {

      setEmergencyLoading(false);

    }

  }

  async function searchPlace(query, type) {

    if (!query.trim()) {

      setMessage('Enter a place name first.');

      return;

    }

    setSearchResults([]);

    setSearchType(null);

    setMessage('Searching locations...');

    try {

      const cleanedQuery = query.trim();

      const fullQuery = /india|west bengal/i.test(cleanedQuery)

        ? cleanedQuery

        : `${cleanedQuery}, West Bengal, India`;

      const params = new URLSearchParams({

        q: fullQuery,

        format: 'jsonv2',

        limit: '5',

        countrycodes: 'in',

        addressdetails: '1',

        'accept-language': 'en',

      });

      const response = await fetch(

        `https://nominatim.openstreetmap.org/search?${params.toString()}`,

      );

      if (!response.ok) {

        throw new Error('Search service unavailable');

      }

      const results = await response.json();

      if (!results.length) {

        setMessage(

          'No matching place found. Try "Naihati Railway Station, West Bengal".',

        );

        return;

      }

      setSearchResults(results);

      setSearchType(type);

      setMessage(

        `Found ${results.length} possible result(s). Select the correct place below.`,

      );

    } catch {

      setMessage(

        'Location search failed. Check your internet connection and try again.',

      );

    }

  }

  function selectSearchResult(result) {

    const position = [Number(result.lat), Number(result.lon)];

    setEmergencyPosition(position);

    setEmergencyServices([]);

    if (searchType === 'start') {

      setStart(position);

      setStartSearch(result.display_name);

      setSelection('destination');

    } else {

      setDestination(position);

      setDestinationSearch(result.display_name);

      setSelection('start');

    }

    setSearchResults([]);

    setSearchType(null);

    setRoutes([]);

    setSelectedRoute(null);

    setMessage(`Selected: ${result.display_name}`);

  }

  function chooseLocation(position) {

    setEmergencyPosition(position);

    setEmergencyServices([]);

    if (selection === 'start') {

      setStart(position);

      setStartSearch(

        `${position[0].toFixed(5)}, ${position[1].toFixed(5)}`,

      );

      setSelection('destination');

      setMessage('Starting point selected. Now select your destination.');

    } else {

      setDestination(position);

      setDestinationSearch(

        `${position[0].toFixed(5)}, ${position[1].toFixed(5)}`,

      );

      setSelection('start');

      setMessage('Destination selected. Calculating route...');

    }

    setSearchResults([]);

    setSearchType(null);

    setRoutes([]);

    setSelectedRoute(null);

  }

  return (

    <section className="dashboard-panel map-panel">

      <div className="panel-heading">

        <div>

          <span className="card-kicker">INTERACTIVE NAVIGATION</span>

          <h2>Explore the roads</h2>

          <p>Search for locations and compare available routes.</p>

        </div>

        <span className="panel-icon">⌖</span>

      </div>

      <div className="location-searches">

        <form

          onSubmit={(event) => {

            event.preventDefault();

            searchPlace(startSearch, 'start');

          }}

        >

          <label>

            Starting point

            <input

              value={startSearch}

              onChange={(event) => setStartSearch(event.target.value)}

              placeholder="e.g. Naihati Station"

            />

          </label>

          <button className="secondary-button" type="submit">

            Search start

          </button>

        </form>

        <form

          onSubmit={(event) => {

            event.preventDefault();

            searchPlace(destinationSearch, 'destination');

          }}

        >

          <label>

            Destination

            <input

              value={destinationSearch}

              onChange={(event) =>

                setDestinationSearch(event.target.value)

              }

              placeholder="e.g. Jadavpur University"

            />

          </label>

          <button className="secondary-button" type="submit">

            Search destination

          </button>

        </form>

      </div>

      <p className="dashboard-message" role="status">

        {message}

      </p>

      {reportsError && (

        <p className="dashboard-message" role="status">

          Cannot load saved road reports. Check that the backend is running.

        </p>

      )}

      <p className="demo-note">

        Database reports: {reports.length} · Verified active hazards used for

        route scoring: {verifiedHazards.length}

      </p>

      {highRiskRoute && (

        <div role="alert" style={{ margin: '12px 0', padding: 14, borderRadius: 10, border: '1px solid #dc2626', background: 'rgba(220,38,38,.12)' }}>

          <strong style={{ color: '#f87171' }}>⚠ High-risk route warning</strong>

          <p style={{ margin: '6px 0 10px' }}>At least one calculated route has a high database hazard score. Review alternatives and consider Emergency Mode if assistance is needed.</p>

        </div>

      )}

      {searchResults.length > 0 && (

        <div className="search-results">

          <h3>Select the correct location</h3>

          {searchResults.map((result) => (

            <button

              type="button"

              key={`${result.osm_type}-${result.osm_id}`}

              onClick={() => selectSearchResult(result)}

              style={{

                display: 'block',

                width: '100%',

                textAlign: 'left',

                padding: '12px',

                marginBottom: '8px',

                borderRadius: '8px',

                cursor: 'pointer',

              }}

            >

              <strong>{result.name || result.display_name}</strong>

              <br />

              <small>{result.display_name}</small>

            </button>

          ))}

          <button

            type="button"

            className="secondary-button"

            onClick={() => {

              setSearchResults([]);

              setSearchType(null);

              setMessage(

                'Choose a more specific place name and search again.',

              );

            }}

          >

            Cancel results

          </button>

        </div>

      )}

      <EmergencyPanel

        active={emergencyActive}

        position={emergencySearchPosition}

        services={emergencyServices}

        loading={emergencyLoading}

        error={emergencyError}

        onFind={findEmergencyServices}

        onNavigate={navigateToEmergencyService}

      />

      <WeatherPanel

        title={weatherTitle}

        position={weatherPosition}

        weather={weather}

        loading={weatherLoading}

        error={weatherError}

        onRefresh={() =>

          setWeatherRefreshKey((previous) => previous + 1)

        }

      />

      <div className="map-selection-actions">

        <button

          type="button"

          className={selection === 'start' ? 'map-choice active' : 'map-choice'}

          onClick={() => {

            setSelection('start');

            setMessage('Click the map to choose the starting point.');

          }}

        >

          Select start on map

        </button>

        <button

          type="button"

          className={

            selection === 'destination'

              ? 'map-choice active'

              : 'map-choice'

          }

          onClick={() => {

            setSelection('destination');

            setMessage('Click the map to choose the destination.');

          }}

        >

          Select destination on map

        </button>

      </div>

      <div className="real-map">

        <MapContainer

          center={DEFAULT_POSITION}

          zoom={12}

          scrollWheelZoom

          style={{ height: '400px', width: '100%' }}

        >

          <TileLayer

            attribution='&copy; <a href="https://www\.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"

          />

          <MapFocus position={start || destination || DEFAULT_POSITION} />

          <HazardMapAutoFit reports={visibleReports} />

          <MapClickHandler onChoose={chooseLocation} />

          {visibleReports.map((report) => (

            <Marker

              key={`report-${report.id}`}

              position={[

                Number(report.latitude),

                Number(report.longitude),

              ]}

              icon={hazardIcon}

            >

              <Popup>

                <strong>{report.title}</strong>

                <br />

                Type: {report.type}

                <br />

                Severity: {report.severity}

                <br />

                Status: {report.verificationStatus}

                <br />

                Source: RoadSense AI database

                {report.verificationStatus !== 'verified' && (

                  <>

                    <br />

                    <strong>

                      Not yet included in route-risk scoring.

                    </strong>

                  </>

                )}

              </Popup>

            </Marker>

          ))}

          {start && (

            <Marker position={start}>

              <Popup>Starting point</Popup>

            </Marker>

          )}

          {destination && (

            <Marker position={destination}>

              <Popup>Destination</Popup>

            </Marker>

          )}

          {start && destination && (

            <RouteControl

              start={start}

              destination={destination}

              hazards={verifiedHazards}

              onRoutes={handleRoutes}

              onMessage={handleMessage}

            />

          )}

        </MapContainer>

      </div>

      {rankedRoutes.length > 0 && (

        <div className="route-comparison">

          <h3>Available Routes</h3>

          <p>

            Routes are ranked using verified, unresolved database reports near

            each route, along with distance and estimated duration.

          </p>

          {rankedRoutes.map((route, rankIndex) => {

            const risk = getRiskLevel(route.riskPoints);

            const isRecommended = route.id === recommendedRouteId;

            const isSelected = selectedRoute === route.id;

            return (

              <button

                type="button"

                key={route.id}

                onClick={() => setSelectedRoute(route.id)}

                aria-pressed={isSelected}

                style={{

                  display: 'block',

                  width: '100%',

                  textAlign: 'left',

                  marginBottom: '10px',

                  padding: '12px',

                  cursor: 'pointer',

                  borderRadius: '10px',

                  border: isSelected

                    ? '2px solid #0d9488'

                    : isRecommended

                      ? '2px solid #64748b'

                      : '1px solid #64748b',

                  background: isSelected

                    ? 'rgba(13,148,136,0.15)'

                    : 'transparent',

                  color: 'inherit',

                }}

              >

                <strong>Route {rankIndex + 1}</strong>

                {isSelected && <span> — Selected</span>}

                {isRecommended && (

                  <span

                    style={{

                      display: 'inline-block',

                      marginLeft: '8px',

                      padding: '4px 8px',

                      borderRadius: '6px',

                      background: '#0d9488',

                      color: '#ffffff',

                      fontSize: '12px',

                      fontWeight: 'bold',

                    }}

                  >

                    Best demo score

                  </span>

                )}

                <span

                  style={{

                    display: 'inline-block',

                    marginLeft: '8px',

                    padding: '4px 9px',

                    borderRadius: '6px',

                    background: risk.color,

                    color: '#ffffff',

                    fontSize: '12px',

                    fontWeight: 'bold',

                  }}

                >

                  {risk.label} estimated risk

                </span>

                <br />

                Distance: {formatDistance(route.distance)}

                {' | '}

                Estimated time: {formatDuration(route.duration)}

                <br />

                Nearby verified hazards: {route.hazardCount}

                <br />

                Risk points: {route.riskPoints}

{route.hazardCount > 0 && (

  <div

    style={{

      marginTop: '10px',

      padding: '10px',

      borderRadius: '8px',

      background: 'rgba(220, 38, 38, 0.08)',

      border: '1px solid rgba(220, 38, 38, 0.3)',

    }}

  >

    <strong>Hazards affecting this route</strong>

    {route.nearbyHazards.map((hazard) => (

      <div

        key={hazard.id}

        style={{

          marginTop: '8px',

          padding: '8px',

          borderRadius: '6px',

          background: 'rgba(148, 163, 184, 0.1)',

        }}

      >

        <strong>{hazard.title || hazard.type || 'Road hazard'}</strong>

        <div>

          Severity: {hazard.severity || 'Unknown'}

        </div>

        <div>

          Location: {Number(hazard.latitude).toFixed(5)},

          {' '}{Number(hazard.longitude).toFixed(5)}

        </div>

      </div>

    ))}

  </div>

)}

                {route.hazardCount > 0 && (

                  <span style={{ display: 'block', marginTop: '8px' }}>

                    <strong>Nearby hazard types:</strong>{' '}

                    {[

                      ...new Set(

                        route.nearbyHazards.map((hazard) => hazard.type),

                      ),

                    ].join(', ')}

                  </span>

                )}

              </button>

            );

          })}

          <p className="demo-note">

            These are preliminary estimates based only on reports in this

            database. They do not represent independently verified road safety,

            live traffic, or guaranteed safest routes. Weather is shown

            separately and is not yet included in route scores.

          </p>

        </div>

      )}

      <p className="demo-note">

        Search uses OpenStreetMap Nominatim. Routes use the public OSRM service.

        Alternative-route availability depends on that service. Hazard matching

        checks an approximate 100-metre corridor around each route.

      </p>

    </section>

  );

}

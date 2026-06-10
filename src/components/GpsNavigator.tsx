import React, { useState, useEffect, useRef, useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { OrdemServico, Cliente, Quadrante } from '../types';
import { 
  Navigation, 
  MapPin, 
  Play, 
  Pause, 
  RotateCcw, 
  Bike, 
  CheckCircle2, 
  ArrowLeft, 
  Settings, 
  Compass, 
  AlertTriangle,
  Route as RouteIcon
} from 'lucide-react';

// Expose environment variable as required by the platform and the google-maps skill guidelines
const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface GpsNavigatorProps {
  order: OrdemServico;
  client: Cliente | null;
  onBack: () => void;
  onDelivered: () => void;
}

// Deterministic LAT/LNG in Passos - MG for real maps routing
export function getRealLatLng(clientId: string, quadrant: Quadrante): { lat: number; lng: number } {
  const centroids = {
    A: { lat: -20.7025, lng: -46.6150 }, // North
    B: { lat: -20.7190, lng: -46.6290 }, // West
    C: { lat: -20.7140, lng: -46.5930 }, // East
    D: { lat: -20.7320, lng: -46.6080 }, // South
    E: { lat: -20.7208, lng: -46.6110 }, // Center Hub
    F: { lat: -20.7280, lng: -46.6210 }  // Southwest
  };
  const base = centroids[quadrant] || centroids.E;
  
  // Stable hash based scattering
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) {
    hash = clientId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const latOffset = (((hash % 30) - 15) / 10000); // values like -0.0015 to +0.0015
  const lngOffset = ((((hash >> 2) % 30) - 15) / 10000);
  return { lat: base.lat + latOffset, lng: base.lng + lngOffset };
}

// Centroid of TorqueLog base (Hub) in Passos - MG
const HUB_COORDS = { lat: -20.7208, lng: -46.6110 };

// Sub-component to perform real Google Maps route computation
function RouteDisplay({ origin, destination }: {
  origin: google.maps.LatLngLiteral;
  destination: google.maps.LatLngLiteral;
}) {
  const renderedMap = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !renderedMap) return;
    
    // Clear previous route polylines
    polylinesRef.current.forEach(p => p.setMap(null));

    routesLib.Route.computeRoutes({
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    }).then(({ routes }: any) => {
      if (routes?.[0]) {
        const newPolylines = routes[0].createPolylines();
        newPolylines.forEach((p: any) => p.setMap(renderedMap));
        polylinesRef.current = newPolylines;
        if (routes[0].viewport) renderedMap.fitBounds(routes[0].viewport);
      }
    }).catch((err: any) => {
      console.warn("Real maps route computing failed (verify your enabled API services):", err);
    });

    return () => polylinesRef.current.forEach(p => p.setMap(null));
  }, [routesLib, renderedMap, origin, destination]);

  return null;
}

export default function GpsNavigator({ order, client, onBack, onDelivered }: GpsNavigatorProps) {
  // Destination coordinates computation
  const destinationCoords = useMemo(() => {
    return getRealLatLng(order.clienteId, order.quadrante);
  }, [order.clienteId, order.quadrante]);

  // Simulation State
  const [progress, setProgress] = useState<number>(0); // 0 to 100
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(2); // 1x, 2x, 5x, 10x
  const [showConfigAlert, setShowConfigAlert] = useState<boolean>(false);
  const [animationTick, setAnimationTick] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationTick(prev => (prev + 1) % 100);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  // Auto progression effect
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          setIsPlaying(false);
          return 100;
        }
        return Math.min(100, prev + (0.5 * speedMultiplier));
      });
    }, 150);

    return () => clearInterval(interval);
  }, [isPlaying, speedMultiplier]);

  // Current GPS location along the linear segment (for simulation marker on Google Map or Vector SVG)
  const currentCoords = useMemo(() => {
    const t = progress / 100;
    const currentLat = HUB_COORDS.lat + (destinationCoords.lat - HUB_COORDS.lat) * t;
    const currentLng = HUB_COORDS.lng + (destinationCoords.lng - HUB_COORDS.lng) * t;
    return { lat: currentLat, lng: currentLng };
  }, [progress, destinationCoords]);

  // Turn-by-turn guidance and notifications generator based on progress
  const gpsInstruction = useMemo(() => {
    if (progress === 0) {
      return {
        step: 1,
        title: "Retirada no HUB",
        desc: `Retire a mercadoria para "${order.destinatarioNome || 'Oficina'}" no centro de Passos.`,
        distance: "Pronto para partida",
        icon: "🏢"
      };
    } else if (progress < 15) {
      return {
        step: 2,
        title: "Saída do Centro",
        desc: "Saia do HUB TorqueLog. Dirija-se à Avenida Principal.",
        distance: `${Math.round((1.5 - (1.5 * progress) / 100) * 1000)}m`,
        icon: "🚴"
      };
    } else if (progress < 50) {
      return {
        step: 3,
        title: "Cruzando Passos - MG",
        desc: `Siga em direção ao ${order.quadrante === 'A' ? 'Setor A (Norte)' : order.quadrante === 'B' ? 'Setor B (Oeste)' : order.quadrante === 'C' ? 'Setor C (Leste)' : order.quadrante === 'D' ? 'Setor D (Sul)' : order.quadrante === 'F' ? 'Setor F (Sudoeste)' : 'Setor E (Centro)'}. Mantenha velocidade constante.`,
        distance: `${Math.round((3.2 - (3.2 * progress) / 100) * 1000)}m`,
        icon: "⬆️"
      };
    } else if (progress < 85) {
      return {
        step: 4,
        title: `Curvando na Região de Destino`,
        desc: `Prepare-se para entrar na via de acesso rápida do Setor ${order.quadrante}.`,
        distance: `${Math.round((1.2 - (1.2 * progress) / 100) * 1000)}m`,
        icon: "↗️"
      };
    } else if (progress < 100) {
      return {
        step: 5,
        title: "Aproximação de Destino",
        desc: `Estacionando próximo ao endereço: ${order.enderecoEntrega || `Setor ${order.quadrante}`}.`,
        distance: "80m",
        icon: "🏁"
      };
    } else {
      return {
        step: 6,
        title: "Alcançamos o Destino!",
        desc: `Motorista na oficina "${order.destinatarioNome || 'Oficina'}". Entregue os itens com segurança.`,
        distance: "Chegamos!",
        icon: "✅"
      };
    }
  }, [progress, order]);

  // Clean values for visual styling
  const distanceRemaining = useMemo(() => {
    if (progress >= 100) return "0 km";
    const totalEst = 3.6; // average dispatch trip is 3.6km
    const remaining = totalEst - (totalEst * progress) / 100;
    return `${remaining.toFixed(1)} km`;
  }, [progress]);

  const timeRemaining = useMemo(() => {
    if (progress >= 100) return "0 min";
    const totalMin = 9; // average motorbike trip is 9 minutes
    const remaining = totalMin - (totalMin * progress) / 100;
    return `${Math.ceil(remaining)} min`;
  }, [progress]);

  return (
    <div className="bg-slate-950 text-white rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col min-h-[580px] w-full fn-gps-container" id="gps-navigator-hud">
      
      {/* HUD Header Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3.5 flex items-center justify-between gap-3 shrink-0">
        <button
          onClick={onBack}
          className="bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-2 rounded-xl transition flex items-center gap-1.5 text-xs font-mono font-bold cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar Painel
        </button>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-xs uppercase tracking-widest font-mono font-black text-slate-100">
            Navegação Assistida TorqueLog Premium
          </h2>
        </div>

        <button
          onClick={() => setShowConfigAlert(!showConfigAlert)}
          className="bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white p-2 rounded-xl transition cursor-pointer"
          title="Verificar Chave do Google Maps"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Google Maps setup alert box (collapsible) */}
      {(showConfigAlert || !hasValidKey) && (
        <div className="bg-orange-950/20 border-b border-orange-500/20 p-4 shrink-0 transition-all duration-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <h4 className="text-xs font-bold text-orange-200 uppercase font-mono tracking-wider">
                Google Maps Live API {hasValidKey ? "Ativado" : "Simulação Ativa"}
              </h4>
              <p className="text-[10px] text-slate-300 leading-normal font-sans">
                Para ligar a tela de mapas realista com trânsito vetorial de satélite, conecte sua chave de faturamento do Google Maps no menu de configurações do AI Studio.
              </p>
              
              {!hasValidKey && (
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-orange-500/10 text-[9px] font-mono leading-relaxed text-slate-400 mt-2">
                  <strong>Como ativar o verdadeiro mapa profissional:</strong>
                  <ol className="list-decimal list-inside space-y-1 mt-1">
                    <li>Obtenha umaz chave em: <a href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener" className="text-orange-400 hover:underline">Google Developers</a></li>
                    <li>Clique no ícone de <strong>Configurações (Engrenagem ⚙️)</strong> no canto superior direito do painel esquerdo.</li>
                    <li>Vá em <strong>Secrets</strong> e crie a variável <code>GOOGLE_MAPS_PLATFORM_KEY</code> colando o sua chave.</li>
                    <li>Após salvar o segredo, este painel detectará instantaneamente a rota baseada em vias públicas de Passos - MG!</li>
                  </ol>
                </div>
              )}
            </div>
            
            {hasValidKey && (
              <button 
                onClick={() => setShowConfigAlert(false)} 
                className="text-xs text-slate-500 hover:text-white cursor-pointer font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* TBT (Turn By Turn) Floating Green Banner */}
      <div className="bg-emerald-600 px-4 py-3 flex items-center justify-between gap-4 shrink-0 shadow-md border-b border-emerald-700/50 z-10 transition-all duration-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-700 font-mono text-xl flex items-center justify-center animate-bounce">
            {gpsInstruction.icon}
          </div>
          <div>
            <h3 className="text-sm font-black tracking-tight text-white">{gpsInstruction.title}</h3>
            <p className="text-[11px] text-emerald-100 font-sans leading-tight mt-0.5">{gpsInstruction.desc}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="block text-[8px] font-mono uppercase tracking-widest text-emerald-200">Em seguida</span>
          <span className="text-lg font-mono font-bold text-white tracking-tighter">{gpsInstruction.distance}</span>
        </div>
      </div>

      {/* Main Map Viewer / Simulation Screen */}
      <div className="flex-1 relative bg-slate-900 border-b border-slate-800 overflow-hidden min-h-[300px]">
        {hasValidKey ? (
          // REAL GOOGLE MAP WITH LIVE COOPILOT ROUTING
          <APIProvider apiKey={API_KEY} version="weekly">
            <Map
              defaultCenter={HUB_COORDS}
              defaultZoom={14.5}
              mapId="CO_PILOT_MAP_GPS"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%' }}
              className="absolute inset-0"
            >
              {/* HUB Base Pin */}
              <AdvancedMarker position={HUB_COORDS} title="HUB TorqueLog">
                <Pin background="#f97316" glyphColor="#fff" />
              </AdvancedMarker>

              {/* Destination Client Pin */}
              <AdvancedMarker position={destinationCoords} title={order.clienteNome}>
                <Pin background={order.retornoPeca ? "#ef4444" : "#10b981"} glyphColor="#fff" />
              </AdvancedMarker>

              {/* Real-time Rider Motorcicle Pin */}
              <AdvancedMarker position={currentCoords} title="Você (Simulação)">
                <div className="w-9 h-9 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg animate-pulse">
                  <Bike className="w-4 h-4 text-white" />
                </div>
              </AdvancedMarker>

              {/* Compute and draw official route via maps library */}
              <RouteDisplay origin={HUB_COORDS} destination={destinationCoords} />
            </Map>
          </APIProvider>
        ) : (
          // VISUALLY APPEALING VECTOR / SVG ACTIVE RADAR COMPASS SIMULATOR Map
          <div className="absolute inset-0 bg-slate-950 p-2 flex flex-col justify-between">
            {/* Dynamic Coordinates HUD Overlay */}
            <div className="absolute top-2 left-2 bg-slate-900/90 border border-slate-800 p-2 rounded-lg text-[9px] font-mono space-y-1.5 leading-none z-10 shadow-lg shrink-0 pointer-events-none select-none">
              <p className="text-orange-400 font-bold">📡 SAT_GPS: CONECTADO</p>
              <p className="text-slate-400">LAT: {currentCoords.lat.toFixed(6)}</p>
              <p className="text-slate-400">LNG: {currentCoords.lng.toFixed(6)}</p>
              <p className="text-slate-400">PRECISÃO: +/- 3 metros</p>
              <p className={`text-xs font-bold ${progress >= 100 ? "text-emerald-400" : "text-amber-400 animate-pulse"}`}>
                ESTADO: {progress >= 100 ? "ALCANÇOU" : "NAVEGANDO"}
              </p>
            </div>

            {/* Simulated Speed Compass Widget */}
            <div className="absolute top-2 right-2 bg-slate-900/90 border border-slate-800 p-2 rounded-lg text-center font-mono z-10 shadow-lg shrink-0 pointer-events-none select-none w-20">
              <Compass className="w-6 h-6 text-orange-400 mx-auto animate-[spin_10s_linear_infinite]" />
              <span className="block text-[8px] uppercase tracking-wider text-slate-500 mt-1">Velocidade</span>
              <span className="text-xs font-black text-white">{progress >= 100 ? 0 : Math.round(40 + Math.sin(progress) * 5)} km/h</span>
            </div>

            {/* Main Visual Vector GPS Route Canvas */}
            <svg 
              viewBox="0 0 600 350" 
              className="w-full h-full select-none mt-2"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Radar Grid circles */}
              <circle cx="300" cy="175" r="140" fill="none" stroke="rgba(249, 115, 22, 0.04)" strokeWidth="1" />
              <circle cx="300" cy="175" r="80" fill="none" stroke="rgba(249, 115, 22, 0.02)" strokeWidth="1" />
              <circle cx="300" cy="175" r="200" fill="none" stroke="rgba(249, 115, 22, 0.01)" strokeWidth="1" />

              {/* Grid cross lines background */}
              <line x1="160" y1="175" x2="440" y2="175" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="300" y1="35" x2="300" y2="315" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" strokeDasharray="3 3" />

              {/* Vector City Roads representation */}
              <g opacity="0.15">
                <rect x="0" y="0" width="600" height="350" fill="rgba(15, 23, 42, 0.95)" />
                {/* Horizontal beltway street */}
                <path d="M 20 175 L 580 175" stroke="#94a3b8" strokeWidth="6" strokeDasharray="8 5" fill="none" />
                <path d="M 300 20 L 300 330" stroke="#94a3b8" strokeWidth="6" strokeDasharray="8 5" fill="none" />
                {/* Diagonal shortcut bypass streets */}
                <line x1="50" y1="40" x2="550" y2="310" stroke="#64748b" strokeWidth="3" strokeDasharray="5 3" />
                <line x1="550" y1="40" x2="50" y2="310" stroke="#64748b" strokeWidth="3" strokeDasharray="5 3" />
                {/* Boundary rivers or express rails */}
                <path d="M 50 80 Q 300 120 550 50" stroke="#3b82f6" strokeWidth="2.5" fill="none" opacity="0.3" />
              </g>

              {/* SVG Origin coordinates */}
              const startX = 220;
              const startY = 240;

              {/* SVG Destination coordinates mapping based on sector quadrant centroids */}
              {(() => {
                const centroids = {
                  A: { x: 260, y: 80 },
                  B: { x: 140, y: 170 },
                  C: { x: 440, y: 130 },
                  D: { x: 200, y: 280 },
                  E: { x: 300, y: 175 },
                  F: { x: 420, y: 260 }
                };
                const dest = centroids[order.quadrante] || centroids.E;
                const src = centroids.E; // Origin from Central HUB

                // Animated Motorcycle path vector
                const currentPos = {
                  x: src.x + (dest.x - src.x) * (progress / 100),
                  y: src.y + (dest.y - src.y) * (progress / 100)
                };

                return (
                  <g>
                    {/* Simulated Path Line */}
                    <path 
                      d={`M ${src.x} ${src.y} L ${dest.x} ${dest.y}`} 
                      stroke="#475569" 
                      strokeWidth="5" 
                      strokeLinecap="round" 
                      fill="none" 
                    />
                    
                    {/* Sinuously computed trace highlight route */}
                    <path 
                      d={`M ${src.x} ${src.y} L ${dest.x} ${dest.y}`} 
                      stroke="#f97316" 
                      strokeWidth="3" 
                      strokeLinecap="round" 
                      fill="none"
                      strokeDasharray="5 5"
                      className="animate-[dash_10s_linear_infinite]"
                      style={{
                        strokeDashoffset: -animationTick * 2
                      }}
                    />

                    {/* Start HUB Pin */}
                    <g>
                      <circle cx={src.x} cy={src.y} r="14" fill="rgba(249, 115, 22, 0.15)" className="animate-pulse" />
                      <circle cx={src.x} cy={src.y} r="6" fill="#f97316" stroke="#ffffff" strokeWidth="1.5" />
                      <text x={src.x} y={src.y+15} fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">HUB Torque</text>
                    </g>

                    {/* End workshop Destiny Pin */}
                    <g>
                      <circle cx={dest.x} cy={dest.y} r="16" fill={order.retornoPeca ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)"} className="animate-pulse" />
                      <circle cx={dest.x} cy={dest.y} r="7" fill={order.retornoPeca ? "#ef4444" : "#10b981"} stroke="#ffffff" strokeWidth="1.5" />
                      <text x={dest.x} y={dest.y - 12} fill="#ffffff" fontSize="9" fontWeight="black" fontFamily="monospace" textAnchor="middle">
                        🏁 {order.destinatarioNome || 'OFICINA'}
                      </text>
                      <text x={dest.x} y={dest.y + 16} fill="#94a3b8" fontSize="7" fontFamily="monospace" textAnchor="middle">
                        ({order.enderecoEntrega || `Setor ${order.quadrante}`})
                      </text>
                    </g>

                    {/* Moving Rider Simulation Vector Avatar */}
                    <g>
                      <circle cx={currentPos.x} cy={currentPos.y} r="12" fill="#ff7a1a" stroke="#fff" strokeWidth="1.5" className="shadow-lg shadow-orange-500/20" />
                      {/* Compass dynamic nose needle directed to target */}
                      <circle cx={currentPos.x} cy={currentPos.y} r="3" fill="#ffffff" />
                      <circle cx={currentPos.x} cy={currentPos.y} r="18" fill="none" stroke="#f97316" strokeWidth="1" opacity="0.4" className="animate-ping" />
                      
                      <text x={currentPos.x} y={currentPos.y - 15} fill="#fff" fontSize="8" fontWeight="bold" fontFamily="monospace" className="bg-slate-900 border px-1" textAnchor="middle">
                        SUA MOTO
                      </text>
                    </g>
                  </g>
                );
              })()}
            </svg>

            {/* Simulated Satellite Bottom Warning bar */}
            <div className="bg-slate-950/80 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between text-[10px] font-mono z-10 m-2 mt-auto">
              <span className="text-slate-400">🚨 CORRIDA EM CURSO</span>
              <span className="text-orange-400 font-bold uppercase">SETOR DESTINO: {order.quadrante} (Passos - MG)</span>
            </div>
          </div>
        )}

        {/* Reached Destination Confirmatory Popup Alert Overlay */}
        {progress >= 100 && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in z-30">
            <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 max-w-sm text-center space-y-4 shadow-2xl shadow-emerald-950/15">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 className="w-8 h-8 animate-bounce text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black tracking-tight">Destino Alcançado!</h3>
                <p className="text-xs text-slate-400 font-sans leading-relaxed">
                  Você concluiu o trajeto do GPS com sucesso até a oficina <strong>{order.destinatarioNome || 'Oficina'}</strong>. Colha a confirmação biometrizada do canhoto agora.
                </p>
              </div>

              {order.retornoPeca && (
                <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-xl space-y-1 text-left text-xs text-red-300">
                  <div className="flex items-center gap-1.5 font-bold font-mono">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    PESQUISAR REVERSA ATIVA
                  </div>
                  <p className="font-mono text-[10px] text-slate-300 leading-tight">
                    Colete a peça com erro de aplicação informada pelo cliente e traga de volta à base na devolução!
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={onDelivered}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold py-3 px-4 rounded-xl active:scale-[0.98] transition cursor-pointer text-xs uppercase tracking-wider"
                >
                  Confirmar Canhoto de Entrega ✍️
                </button>
                <button
                  type="button"
                  onClick={() => setProgress(0)}
                  className="w-full bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white font-mono font-bold py-2 px-4 rounded-xl active:scale-[0.98] transition cursor-pointer text-[10px]"
                >
                  Reiniciar Simulação GPS ↺
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controller Buttons / Navigation Dashboard Overlay footer */}
      <div className="bg-slate-900 border-t border-slate-850 px-5 py-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 shrink-0 font-mono">
        {/* Play/Pause/Progress stats bar */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={progress >= 100}
            className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition shadow ${
              progress >= 100 
                ? 'bg-slate-950 text-slate-600 cursor-not-allowed'
                : isPlaying 
                  ? 'bg-orange-650 hover:bg-orange-700 text-white' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
            title={isPlaying ? "Pausar GPS" : "Iniciar Movimento GPS"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            onClick={() => { setProgress(0); setIsPlaying(true); }}
            className="w-10 h-10 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer border border-slate-800"
            title="Resetar Trajeto GPS"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Quick Stats display values */}
          <div className="text-left text-xs leading-none space-y-1">
            <span className="text-slate-400 text-[9px] block uppercase tracking-wider">Tempo Estimado Restante</span>
            <span className="font-bold text-slate-100">{timeRemaining} • {distanceRemaining}</span>
          </div>
        </div>

        {/* Progress percentual bar */}
        <div className="flex-1 max-w-xs space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-slate-500">
            <span>Progresso da Rota</span>
            <span className="font-bold text-orange-405">{Math.floor(progress)}%</span>
          </div>
          <div className="w-full h-2 rounded bg-slate-950 overflow-hidden relative">
            <div 
              className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-r-none transition-all duration-150 relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-0 bottom-0 w-1 bg-white animate-pulse" />
            </div>
          </div>
        </div>

        {/* Speed simulations multiplier configuration */}
        <div className="flex items-center gap-1.5 shrink-0 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-850 text-xs">
          <span className="text-slate-500 uppercase tracking-widest text-[8px] font-bold block mr-1.5">Aceleração:</span>
          {[1, 2, 5, 10].map(s => (
            <button
              key={s}
              onClick={() => { setSpeedMultiplier(s); setIsPlaying(true); }}
              className={`w-7 py-1 text-[10px] font-bold font-mono rounded-lg transition-all capitalize select-none cursor-pointer ${
                speedMultiplier === s 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}

// Global animation timer provider simulation (matches existing interface style if needed)
let animLoopStarted = false;
let globalTick = 0;
export function useAnimationTimer() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(i);
  }, []);
  return tick;
}

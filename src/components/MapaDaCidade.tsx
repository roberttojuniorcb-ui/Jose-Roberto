import React, { useMemo, useState } from 'react';
import { Quadrante, Cliente, OrdemServico, Motoboy } from '../types';
import { MapPin, Navigation, Info, Bike } from 'lucide-react';

interface MapaDaCidadeProps {
  clientes: Cliente[];
  ordens: OrdemServico[];
  motoboys: Motoboy[];
  selectedMotoboyIdForTracking?: string | null;
  setSelectedMotoboyIdForTracking?: (id: string | null) => void;
  activeSessionRole?: string | null;
  activeClienteUser?: Cliente | null;
  selectedQuadrant?: Quadrante | null;
  setSelectedQuadrant?: (q: Quadrante) => void;
  animationTick: number;
}

// Deterministic coordinate scatter within the quadrant bounds for professional rendering
export function getClientCoordinate(clientId: string, quadrant: Quadrante) {
  const centroids = {
    A: { x: 130, y: 110 },
    B: { x: 120, y: 240 },
    C: { x: 470, y: 130 },
    D: { x: 190, y: 350 },
    E: { x: 300, y: 220 }, // Center Hub
    F: { x: 460, y: 330 }
  };
  const base = centroids[quadrant] || centroids.E;
  
  // Hash calculation to scatter points deterministically
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) {
    hash = clientId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const xOffset = ((hash % 36) + 36) % 36 - 18; // -18 to +18
  const yOffset = (((hash >> 2) % 36) + 36) % 36 - 18; // -18 to +18
  return { x: base.x + xOffset, y: base.y + yOffset };
}

export default function MapaDaCidade({
  clientes,
  ordens,
  motoboys,
  selectedMotoboyIdForTracking,
  setSelectedMotoboyIdForTracking,
  activeSessionRole,
  activeClienteUser,
  selectedQuadrant,
  setSelectedQuadrant,
  animationTick
}: MapaDaCidadeProps) {

  // Coordinates of central hub (TorqueLog Base in Setor E)
  const hubX = 300;
  const hubY = 220;

  const [zoomState, setZoomState] = useState<{ minX: number; minY: number; width: number; height: number } | null>(null);

  // Let's calculate the real-time positions of all motoboys based on active orders
  const simulatedMotoboysWithPositions = useMemo(() => {
    return motoboys.map((mb, idx) => {
      // Find if this motoboy has an active delivery (Moto a Caminho)
      const activeOrder = ordens.find(o => o.status === 'Moto a Caminho' && o.motoboyId === mb.id);
      
      let x = hubX;
      let y = hubY;
      let activeOrderInfo: OrdemServico | null = null;
      let tripProgressText = 'Aguardando na Base';
      let isMoving = false;
      let rawProgress = 0;
      let speed = 0;

      // Stable offset at the base if they are waiting
      const mbOffset = idx - 1; 

      if (activeOrder) {
        activeOrderInfo = activeOrder;
        isMoving = true;
        speed = 40 + (idx * 3) % 15; // Simulated realistic speed 40 - 55 km/h
        const destination = getClientCoordinate(activeOrder.clienteId, activeOrder.quadrante);
        
        // Use a stable offsets multiplier to simulate split trip cycles
        const seedValue = mb.id === 'MOTO-01' ? 8 : mb.id === 'MOTO-02' ? 38 : 68;
        rawProgress = ((animationTick + seedValue) % 100) / 100; // 0 to 1

        if (rawProgress < 0.42) {
          // Transit: Hub to client
          const t = rawProgress / 0.42;
          x = hubX + (destination.x - hubX) * t;
          y = hubY + (destination.y - hubY) * t;
          tripProgressText = 'Em rota de entrega';
        } else if (rawProgress >= 0.42 && rawProgress < 0.58) {
          // Delivered / signature event
          x = destination.x;
          y = destination.y;
          tripProgressText = 'Finalizando canhoto digital';
        } else {
          // Transit: client back to Hub
          const t = (rawProgress - 0.58) / 0.42;
          x = destination.x + (hubX - destination.x) * t;
          y = destination.y + (hubY - destination.y) * t;
          tripProgressText = 'Retornando à base';
        }
      } else {
        // Simple idle minor breathing flow at the base so they look active
        const breatheX = Math.sin(animationTick / 5 + idx) * 3;
        const breatheY = Math.cos(animationTick / 5 + idx) * 3;
        x = hubX + mbOffset * 22 + breatheX;
        y = hubY + 18 + breatheY;
        tripProgressText = 'Disponível na Loja';
        speed = 0;
      }

      return {
        ...mb,
        x,
        y,
        activeOrder: activeOrderInfo,
        telemetry: {
          tripProgressText,
          isMoving,
          speed,
          battery: 80 + (idx * 7) % 20,
          currentLocationQuadrant: x < 250 ? (y < 180 ? 'A' : 'B') : (x < 350 ? 'E' : (y < 220 ? 'C' : 'F'))
        }
      };
    });
  }, [motoboys, ordens, animationTick]);

  const handleCentralizar = () => {
    // Filter active motoboys (situacao is either 'Ativo' or undefined/blank)
    const activeRiders = simulatedMotoboysWithPositions.filter(
      m => !m.situacao || m.situacao.toLowerCase() === 'ativo'
    );

    if (activeRiders.length === 0) {
      setZoomState(null); // Reset to full view if no active motoboys are found
      return;
    }

    const xs = activeRiders.map(r => r.x);
    const ys = activeRiders.map(r => r.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Padding to ensure some space around the icons
    const padding = 55;
    let boundingWidth = (maxX - minX) + padding * 2;
    let boundingHeight = (maxY - minY) + padding * 2;

    // Minimum view boundary size to prevent extreme zoom-in
    const minSize = 200;
    if (boundingWidth < minSize) {
      boundingWidth = minSize;
    }
    if (boundingHeight < minSize) {
      boundingHeight = minSize;
    }

    // Keep aspect ratio 4:3 (600 / 450)
    const currentAspect = boundingWidth / boundingHeight;
    const targetAspect = 600 / 450; // 1.333
    if (currentAspect > targetAspect) {
      boundingHeight = boundingWidth / targetAspect;
    } else {
      boundingWidth = boundingHeight * targetAspect;
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    let newMinX = centerX - boundingWidth / 2;
    let newMinY = centerY - boundingHeight / 2;

    // Safety clamps relative to original "0 0 600 450"
    if (newMinX < -20) newMinX = -20;
    if (newMinY < -20) newMinY = -20;
    if (newMinX + boundingWidth > 620) {
      newMinX = 620 - boundingWidth;
    }
    if (newMinY + boundingHeight > 470) {
      newMinY = 470 - boundingHeight;
    }

    setZoomState({
      minX: Math.round(newMinX),
      minY: Math.round(newMinY),
      width: Math.round(boundingWidth),
      height: Math.round(boundingHeight)
    });
  };

  // Let's filter clients to show on the map
  const clientsWithCoords = useMemo(() => {
    // Only show the top 8 clients of each quadrant to avoid visual clutter, 
    // or if selectedQuadrant is active, show only those, or if activeClient session is active, highlight them
    const filtered = clientes.filter(c => {
      if (selectedQuadrant) {
        return c.quadrante === selectedQuadrant;
      }
      return true;
    });

    // Take a small sample of active clients to prevent performance spikes (e.g. 24 clients scattered)
    const sampled = filtered.slice(0, 36);

    // Ensure the logged in client is ALWAYS in the list
    if (activeClienteUser && !sampled.some(s => s.id === activeClienteUser.id)) {
      sampled.push(activeClienteUser);
    }

    return sampled.map(c => ({
      ...c,
      ...getClientCoordinate(c.id, c.quadrante)
    }));
  }, [clientes, selectedQuadrant, activeClienteUser]);

  // Get current tracked motoboy properties for UI Telemetry widget overlay
  const trackedMotoboyInfo = useMemo(() => {
    if (!selectedMotoboyIdForTracking) return null;
    return simulatedMotoboysWithPositions.find(m => m.id === selectedMotoboyIdForTracking);
  }, [selectedMotoboyIdForTracking, simulatedMotoboysWithPositions]);

  // Quadrant sectors geometric definitions for professional layouts
  const quadrantsBordersData = [
    { id: 'A', name: 'Setor A (Norte)', color: 'rgba(239, 68, 68, 0.08)', stroke: '#ef4444', textX: 130, textY: 60 },
    { id: 'B', name: 'Setor B (Oeste)', color: 'rgba(245, 158, 11, 0.08)', stroke: '#f59e0b', textX: 110, textY: 290 },
    { id: 'C', name: 'Setor C (Leste)', color: 'rgba(59, 130, 246, 0.08)', stroke: '#3b82f6', textX: 470, textY: 70 },
    { id: 'D', name: 'Setor D (Sul)', color: 'rgba(16, 185, 129, 0.08)', stroke: '#10b981', textX: 150, textY: 410 },
    { id: 'E', name: 'Setor E (Centro/Loja)', color: 'rgba(249, 115, 22, 0.08)', stroke: '#f97316', textX: 300, textY: 150 },
    { id: 'F', name: 'Setor F (Sudoeste)', color: 'rgba(139, 92, 246, 0.08)', stroke: '#8b5cf6', textX: 470, textY: 410 }
  ];

  return (
    <div className="bg-slate-950 text-slate-150 rounded-2xl border border-slate-800 p-4 font-sans relative overflow-hidden shadow-xl" id="div-mapa-central">
      
      {/* Background abstract elements */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl pointer-events-none" />
      
      {/* HUD Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-900 pb-3 mb-3">
        <div>
          <h4 className="text-xs font-bold font-mono text-orange-400 tracking-widest uppercase flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 animate-spin-slow text-orange-500" />
            Rastreamento Satélite TorqueLog: Passos - MG
          </h4>
          <p className="text-[10px] text-slate-400 font-mono">Compartimentação Regional de Baú MEI • Atualização em Tempo Real</p>
        </div>
        
        {/* Helper chips */}
        <div className="flex flex-wrap items-center gap-2 text-[9px] font-mono select-none">
          <span className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping"></span>
            Moto em Fluxo
          </span>
          <span className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Sua Oficina/B2B
          </span>
          <span className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            Outras Autopeças
          </span>
        </div>
      </div>

      {/* Graphical Map Canvas Container */}
      <div className="relative w-full aspect-[4/3] bg-slate-900/90 rounded-xl border border-slate-850 p-1">
        
        {/* Floating controls for Centralizar / Resetar */}
        <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-xs p-1 rounded-lg border border-slate-800">
          <button
            onClick={handleCentralizar}
            title="Centralizar nos motoboys ativos"
            className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-sans text-[10px] font-black px-2.5 py-1.5 rounded-md flex items-center gap-1 transition cursor-pointer"
          >
            🎯 Centralizar
          </button>
          {zoomState && (
            <button
              onClick={() => setZoomState(null)}
              title="Restaurar visualização completa"
              className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-sans text-[10px] font-bold px-2.5 py-1.5 rounded-md border border-slate-800 flex items-center gap-1 transition cursor-pointer"
            >
              🔄 Restaurar
            </button>
          )}
        </div>

        <svg 
          viewBox={zoomState ? `${zoomState.minX} ${zoomState.minY} ${zoomState.width} ${zoomState.height}` : "0 0 600 450"} 
          className="w-full h-full select-none"
          xmlns="http://www.w3.org/2000/svg"
          id="mapa-da-cidade"
        >
          {/* Futuristic HUD Grid Lines */}
          <defs>
            <pattern id="gridPattern" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="600" height="450" fill="url(#gridPattern)" rx="8" />

          {/* Boundaries Partition Areas (A, B, C, D, E, F Quadrants layout map) */}
          {/* North Setor A */}
          <polygon points="0,0 300,0 220,180 0,180" fill="rgba(239, 68, 68, 0.03)" stroke="rgba(239, 68, 68, 0.15)" strokeWidth="1.5" strokeDasharray="4 4" />
          {/* West Setor B */}
          <polygon points="0,180 220,180 180,310 0,310" fill="rgba(245, 158, 11, 0.03)" stroke="rgba(245, 158, 11, 0.15)" strokeWidth="1.5" strokeDasharray="4 4" />
          {/* East Setor C */}
          <polygon points="300,0 600,0 600,180 340,180" fill="rgba(59, 130, 246, 0.03)" stroke="rgba(59, 130, 246, 0.15)" strokeWidth="1.5" strokeDasharray="4 4" />
          {/* South Setor D */}
          <polygon points="0,310 180,310 260,450 0,450" fill="rgba(16, 185, 129, 0.03)" stroke="rgba(16, 185, 129, 0.15)" strokeWidth="1.5" strokeDasharray="4 4" />
          {/* Center Setor E */}
          <polygon points="220,180 340,180 400,310 180,310" fill="rgba(249, 115, 22, 0.04)" stroke="rgba(249, 115, 22, 0.2)" strokeWidth="1.5" />
          {/* Southeast Setor F */}
          <polygon points="340,180 600,180 600,450 260,450 180,310 400,310" fill="rgba(139, 92, 246, 0.03)" stroke="rgba(139, 92, 246, 0.15)" strokeWidth="1.5" strokeDasharray="4 4" />

          {/* Sectors human text markers */}
          {quadrantsBordersData.map(q => (
            <g key={q.id}>
              <text 
                x={q.textX} 
                y={q.textY} 
                fill={q.stroke}
                opacity="0.35"
                fontSize="11" 
                fontWeight="bold" 
                fontFamily="monospace" 
                textAnchor="middle"
              >
                {q.id}
              </text>
              <text 
                x={q.textX} 
                y={q.textY + 12} 
                fill="#ffffff"
                opacity="0.12"
                fontSize="8" 
                fontFamily="monospace" 
                textAnchor="middle"
              >
                {q.id === 'E' ? 'CENTRO BASE' : 'CONTRATO MEI'}
              </text>
            </g>
          ))}

          {/* Drawing Simulated Roads Blueprint */}
          <g opacity="0.15">
            {/* Horizontal express highway */}
            <path d="M 10 220 L 590 220" stroke="#94a3b8" strokeWidth="4" strokeDasharray="10 5" fill="none" />
            <path d="M 300 20 L 300 430" stroke="#94a3b8" strokeWidth="4" strokeDasharray="10 5" fill="none" />
            {/* Diagonal interconnecting routes */}
            <line x1="10" y1="10" x2="590" y2="440" stroke="#64748b" strokeWidth="2.5" strokeDasharray="6 4" />
            <line x1="590" y1="10" x2="10" y2="440" stroke="#64748b" strokeWidth="2.5" strokeDasharray="6 4" />
            {/* Circular Ring road around city center */}
            <circle cx="300" cy="220" r="100" stroke="#94a3b8" strokeWidth="3" strokeDasharray="5 5" fill="none" />
          </g>

          {/* Central HUB Base (TorqueLog HQ) Point */}
          <g>
            {/* Flash ring */}
            <circle cx={hubX} cy={hubY} r="18" fill="rgba(249, 115, 22, 0.15)" className="animate-pulse" />
            <circle cx={hubX} cy={hubY} r="7" fill="#f97316" stroke="#ffffff" strokeWidth="1.5" />
            
            <text x={hubX} y={hubY - 12} fill="#ff7a1a" fontSize="8" fontWeight="black" fontFamily="monospace" textAnchor="middle">
              🏢 LOJA CENTRO (HUB)
            </text>
          </g>

          {/* Rendering Client Spots (🔧 / 🏢 markers) */}
          {clientsWithCoords.map((client) => {
            const isSelf = activeClienteUser && activeClienteUser.id === client.id;
            const size = isSelf ? 8 : 4.5;
            const dotColor = isSelf ? '#10b981' : 'rgba(148, 163, 184, 0.7)';
            
            return (
              <g key={client.id} className="cursor-help group">
                {isSelf && (
                  <circle 
                    cx={client.x} 
                    cy={client.y} 
                    r="14" 
                    fill="none" 
                    stroke="#10b981" 
                    strokeWidth="1.5" 
                    className="animate-pulse" 
                  />
                )}
                <circle 
                  cx={client.x} 
                  cy={client.y} 
                  r={size} 
                  fill={dotColor} 
                  stroke={isSelf ? '#ffffff' : 'rgba(15, 23, 42, 0.8)'} 
                  strokeWidth="1" 
                />
                
                {/* Visual mouse tooltip representer */}
                <title>{`[Setor ${client.quadrante}] ${client.nome} (${client.cidade})`}</title>
              </g>
            );
          })}

          {/* Rendering Motoboy Riders Pins */}
          {simulatedMotoboysWithPositions.map((m) => {
            const isTracked = selectedMotoboyIdForTracking === m.id;
            const scaleSize = isTracked ? 1.4 : 1.0;
            
            return (
              <g 
                key={m.id} 
                className="cursor-pointer transition duration-300"
                onClick={() => setSelectedMotoboyIdForTracking && setSelectedMotoboyIdForTracking(isTracked ? null : m.id)}
              >
                {/* Highlight radar ripple if tracked */}
                {isTracked && (
                  <g>
                    <circle cx={m.x} cy={m.y} r="25" fill="none" stroke="#f97316" strokeWidth="1" opacity="0.5" className="animate-ping" />
                    <circle cx={m.x} cy={m.y} r="16" fill="rgba(249, 115, 22, 0.2)" />
                  </g>
                )}

                {/* Simulated heading pointer line to show direction of movement */}
                {m.telemetry.isMoving && m.activeOrder && (
                  <line 
                    x1={m.x} 
                    y1={m.y} 
                    x2={m.x + (m.x > hubX ? 12 : -12)} 
                    y2={m.y + (m.y > hubY ? 8 : -8)} 
                    stroke="#f97316" 
                    strokeWidth="1.5" 
                    strokeDasharray="2 2" 
                  />
                )}

                {/* Main Motoboy physical indicator */}
                <circle 
                  cx={m.x} 
                  cy={m.y} 
                  r="7.5" 
                  fill={isTracked ? '#f97316' : '#2563eb'} 
                  stroke="#ffffff" 
                  strokeWidth="1.5" 
                />

                {/* Standard tiny helmet look inside */}
                <circle 
                  cx={m.x} 
                  cy={m.y - 1} 
                  r="3.5" 
                  fill="#ffffff" 
                  opacity="0.9" 
                />

                {/* Small ID tag label above helmet */}
                <rect 
                  x={m.x - 14} 
                  y={m.y - 15} 
                  width="28" 
                  height="8" 
                  rx="2" 
                  fill="rgba(15, 23, 42, 0.85)" 
                  stroke={isTracked ? '#f97316' : '#475569'}
                  strokeWidth="0.5"
                />
                <text 
                  x={m.x} 
                  y={m.y - 9} 
                  fill="#ffffff" 
                  fontSize="6.5" 
                  fontWeight="bold" 
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {m.id.replace('MOTO-', 'M')}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Telemetry Screen Overlay for tracked deliverer */}
        {trackedMotoboyInfo && (
          <div className="absolute bottom-3 left-3 right-3 bg-slate-950/95 border border-orange-500/30 rounded-xl p-3 text-xs font-mono select-none backdrop-blur-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-2xl z-20">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Bike className="w-4 h-4 text-orange-400 shrink-0" />
                <span className="font-extrabold text-white text-[11px] uppercase tracking-wide">{trackedMotoboyInfo.nome}</span>
                <span className="text-[9px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1.5 py-0.2 rounded">ATIVO CONTROLE</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Status: <strong className="text-orange-400 lowercase">{trackedMotoboyInfo.telemetry.tripProgressText}</strong> 
                {trackedMotoboyInfo.activeOrder && ` (Pedido: ${trackedMotoboyInfo.activeOrder.id})`}
              </p>
            </div>

            <div className="flex gap-4 text-[10px] text-slate-300 border-t sm:border-t-0 border-slate-900 pt-1.5 sm:pt-0 w-full sm:w-auto">
              <div>
                <span className="text-slate-500 block text-[8px] uppercase">Velocidade</span>
                <span className="font-bold text-slate-100">{trackedMotoboyInfo.telemetry.speed} km/h</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[8px] uppercase">Bateria/Cel</span>
                <span className="font-bold text-slate-100">{trackedMotoboyInfo.telemetry.battery}%</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[8px] uppercase">Setor Atual</span>
                <span className="font-bold text-orange-400 font-black">Setor {trackedMotoboyInfo.telemetry.currentLocationQuadrant}</span>
              </div>
            </div>
            
            <button
              onClick={() => setSelectedMotoboyIdForTracking && setSelectedMotoboyIdForTracking(null)}
              className="text-[9px] bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white px-2 py-0.8 rounded border border-slate-800 absolute top-2 right-2"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Map legend HUD */}
        <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-sm border border-slate-850 p-2 rounded-lg text-[9px] font-mono leading-relaxed space-y-0.5 hidden sm:block">
          <span className="font-black text-slate-400 uppercase tracking-wider block mb-1">🗺️ Legenda de Setores:</span>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 opacity-50"></span><span>Setor A - Norte</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 opacity-50"></span><span>Setor B - Oeste</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 opacity-50"></span><span>Setor C - Leste</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 opacity-50"></span><span>Setor D - Sul</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500 opacity-70"></span><span>Setor E - Centro Hub</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500 opacity-50"></span><span>Setor F - Sudoeste</span></div>
        </div>

      </div>

    </div>
  );
}

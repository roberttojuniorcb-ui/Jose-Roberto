import { Quadrante, PecasItem, APIResponse, OrdemServico, Cliente } from '../types';

export const BAÚ_CAPACIDADE_MAXIMA = 80; // Volumetric rating capacity limit for motorcycle bock chest/bag

/**
 * Parses user-provided delivery item descriptions to calculate volume score
 * utilizing automotive jargon.
 */
export function analisarCubagemAutopeças(texto: string): { 
  itens: PecasItem[]; 
  scoreTotal: number; 
  status: 'Liberado - Cabe no Baú' | 'Bloqueado - Excesso de Volume' 
} {
  const norm = texto.toLowerCase();
  const itens: PecasItem[] = [];
  let scoreTotal = 0;

  // Search patterns: Match quantities followed by item names or vice-versa
  // Ex: "2x amortecedores", "3 filtros", "1 jg de pastilhas"
  
  // Set default scores for jargon categories
  const jargoes = [
    { 
      chave: 'amortecedor', 
      tipo: 'amortecedores' as const, 
      pesoScore: 35, // High weight & bulk
      rotulo: 'Amortecedor'
    },
    { 
      chave: 'radiador', 
      tipo: 'radiadores' as const, 
      pesoScore: 45, // High volume/surface
      rotulo: 'Radiador' 
    },
    { 
      chave: 'filtro', 
      tipo: 'filtros' as const, 
      pesoScore: 10, // Small, light
      rotulo: 'Filtro' 
    },
    { 
      chave: 'pastilha', 
      tipo: 'pastilhas' as const, 
      pesoScore: 10, // Small, heavy but compact
      rotulo: 'Pastilha de Freio' 
    },
    { 
      chave: 'cabo', 
      tipo: 'cabos' as const, 
      pesoScore: 5, 
      rotulo: 'Cabo de Vela/Transmissão' 
    }
  ];

  let detectadoQualquer = false;

  jargoes.forEach(jargao => {
    // Attempt to extract quantity multiplier
    // Regex for: "[qtd]x [item]" or "[qtd] [item]" or "[item]... [qtd]"
    // e.g. "2x amortecedores" or "4 filtros"
    const regex1 = new RegExp(`(\\d+)\\s*x?\\s*${jargao.chave}`, 'g');
    let match;
    let qtd = 0;

    while ((match = regex1.exec(norm)) !== null) {
      qtd += parseInt(match[1], 10);
    }

    // fallback check: simply finding matching words without explicit quantity assumes 1
    if (qtd === 0 && norm.includes(jargao.chave)) {
      qtd = 1;
    }

    if (qtd > 0) {
      detectadoQualquer = true;
      const score = jargao.pesoScore * qtd;
      scoreTotal += score;
      itens.push({
        descricao: `${qtd}x ${jargao.rotulo}${qtd > 1 ? 's' : ''}`,
        quantidade: qtd,
        tipo: jargao.tipo,
        cubagemPesoScore: score
      });
    }
  });

  // If we couldn't detect explicit known jargon, calculate a mock score based on overall complexity to prevent 0 scores from generic words
  if (!detectadoQualquer && texto.trim().length > 0) {
    // Look for numbers like "3 coxins"
    const generalNumMatch = texto.match(/(\d+)/);
    const multiplier = generalNumMatch ? Math.min(parseInt(generalNumMatch[1], 10), 10) : 1;
    const estimatedScore = multiplier * 15;
    scoreTotal += estimatedScore;
    itens.push({
      descricao: texto,
      quantidade: multiplier,
      tipo: 'outros',
      cubagemPesoScore: estimatedScore
    });
  }

  const status = scoreTotal <= BAÚ_CAPACIDADE_MAXIMA 
    ? 'Liberado - Cabe no Baú' 
    : 'Bloqueado - Excesso de Volume';

  return {
    itens,
    scoreTotal,
    status
  };
}

/**
 * Searches for pending orders in the same quadrant created in the last 15 minutes.
 * Satisfies the requirement: 15-minute sweep and automatic routing.
 */
export function executarVarreduraSweep(
  novoQuadrante: Quadrante,
  ordensExistentes: OrdemServico[],
  novoPedidoCriadoEm: string
): string[] {
  const novoTempo = new Date(novoPedidoCriadoEm).getTime();
  const QUINZE_MINUTOS_MS = 15 * 60 * 1000;

  return ordensExistentes
    .filter(ordem => {
      // Must be the same quadrant
      if (ordem.quadrante !== novoQuadrante) return false;
      // Must be pending and not already completed or locked
      if (ordem.status !== 'Pendente' && ordem.status !== 'Buscando Parceiro') return false;
      
      const ordemTempo = new Date(ordem.criadoEm).getTime();
      const diferenca = Math.abs(novoTempo - ordemTempo);
      
      // Within 15 minutes window
      return diferenca <= QUINZE_MINUTOS_MS;
    })
    .map(ordem => ordem.id);
}

/**
 * Generates TorqueLog B2B Compliance Text
 * Prohibits generating notifications, commands, or controls that suggest subordination or shifts.
 * Promotes independent B2B contractor relationship.
 */
export function gerarNotificacaoParaMotoboy(clienteNome: string, quadrante: Quadrante, isAgrupado: boolean): string {
  const intro = isAgrupado 
    ? `[OPORTUNIDADE DE ROTA AGRUPADA - QUADRANTE ${quadrante}]` 
    : `[PEDIDO DISPONÍVEL - QUADRANTE ${quadrante}]`;
    
  return `${intro} Olá, parceiro logístico! Uma nova oportunidade de prestação de serviços para ${clienteNome} no Setor ${quadrante} está ativa na plataforma. ` +
    `Como prestador de serviços MEI parceiro ou faturista independente, você tem total autonomia para aceitar ou declinar este frete avulso de acordo com sua disponibilidade e conveniência, sem qualquer vínculo subordinativo ou controle de horários. ` +
    `Consulte o aplicativo para verificar o baú e faturar o serviço.`;
}

/**
 * Compiles the strict API Output JSON requested by the core specification.
 */
export function compilarAPIResponse(
  cliente: Cliente,
  ordem: OrdemServico,
  pedidosNoMesmoQuadrante: string[],
  travaCubagem: 'Liberado - Cabe no Baú' | 'Bloqueado - Excesso de Volume'
): APIResponse {
  let statusDespacho: 'Buscando Parceiro' | 'Moto a Caminho' | 'Rota Agrupada' = 'Buscando Parceiro';
  
  if (travaCubagem === 'Liberado - Cabe no Baú') {
    if (pedidosNoMesmoQuadrante.length > 0) {
      statusDespacho = 'Rota Agrupada';
    } else {
      statusDespacho = 'Moto a Caminho';
    }
  }

  return {
    transporte: "Motocicleta Padrão",
    sincronizacao: {
      status: "Sucesso",
      atualizado_em_ambos_paineis: true
    },
    cliente_dados: {
      identificador: `${cliente.nome} (${cliente.id})`,
      quadrante_atribuido: cliente.quadrante
    },
    logistica_rota: {
      status_despacho: statusDespacho,
      pedidos_no_mesmo_quadrante: pedidosNoMesmoQuadrante,
      trava_cubagem_status: travaCubagem,
      canhoto_digital: "Aguardando Assinatura do Mecânico no Destino"
    }
  };
}

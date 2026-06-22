export type Quadrante = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface Cliente {
  id: string;
  nome: string;
  quadrante: Quadrante;
  endereco: string;
  telefone: string;
  cidade: string; // Ex: "Passos - MG" or "Franca - SP"
  cep?: string; // Postal code
  valorPagoMotoboy: number; // Ex: 4.00
  valorCobradoCliente: number; // Ex: 10.00
  senha?: string; // Password for Customer login
  email?: string; // Client's custom email
  emailConfirmado?: boolean; // Email confirmation status
  cadastroCompleto?: boolean; // True when client completed company info & set custom password
  cnpj?: string;
  inscricaoEstadual?: string;
  ramo?: string; // Business branch like "Farmácia", "Lanchonete", "Restaurante", "Oficina Mecânica", "Autopeças"
  criadoPor: 'Empresa' | 'Entregador' | 'Cliente';
  criadoPorClienteId?: string; // ID of the distributor who registered this sub-client
  criadoEm: string;
  isSelfRegistered?: boolean; // Highlight self-registered B2B clients in green
  motoboysAtivos?: number; // Quantidade de motoboys ativos cadastrados/viculados
  indicadoPorRepId?: string; // ID do representante comercial que indicou este parceiro
  primeiroAcessoPendente?: boolean; // Se True, força o parceiro a mudar a senha provisória no primeiro acesso
  notaAdmin?: string; // Observação privada que o parceiro não consegue editar ou ver
  adminBloqueado?: boolean; // Bloqueio de faturamento/despacho controlado pelo admin
}

export interface Representante {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  pix: string;
  criadoEm: string;
}

export interface Motoboy {
  id: string;
  nome: string;
  telefone: string;
  cidade: string;
  senha: string;
  valorRepasseFixo: number;
  criadoEm: string;
  situacao?: string; // Observação sobre a situação do motoboy (ex: ativo, faltou, mudou telefone)
  empresaExclusiva?: string; // Empresa/B2B Cliente exclusivo ao qual o motoboy presta serviços (ex: BARROS AUTOPEÇAS)
  veiculo?: string; // Vehicle like Moto, Carro, Van, Furgão
  tipoMoto?: 'alugada' | 'propria'; // 'alugada' triggers rent + odometro + fuel mechanics
  placaAtual?: string;
  kmEntrada?: number;
  fotoOdometroEntrada?: string;
  dataEntrada?: string;
  isTrabalhandoAtivo?: boolean; // if check-in was completed
  kmSaidaAcumuladaQuinzenal?: number; // total work kms within current 15 days
}

export interface RegistroOdometro {
  id: string;
  motoboyId: string;
  motoboyNome: string;
  placa: string;
  kmInicial: number;
  fotoInicial: string;
  dataEntrada: string;
  kmFinal?: number;
  fotoFinal?: string;
  dataSaida?: string;
  kmTrabalhado?: number;
}

export interface ExtratoQuinzenal {
  id: string;
  periodo?: string; // Ex: "01/06/2026 - 15/06/2026"
  createdAt?: string;
  tipo?: 'Parceiro' | 'Entregador';
  targetId?: string; // id do cliente ou motoboy
  targetNome?: string;
  brutoPlataforma?: number;
  deduzirImpostoGoverno?: boolean; // se aplica a dedução tributária de 6%
  valorImposto?: number;
  valorAluguelMotoDeducao?: number; // R$ 700.00 if applicable
  valorRetencaoCombustivel?: number; // R$ 0.50/KM if applicable
  totalKmsRodados?: number;
  saldoLiquido?: number;
  pago?: boolean; // marked paid by admin
  ordensIds?: string[];

  // Fields used in App.tsx consolidations
  motoboyId: string;
  motoboyNome: string;
  dataFechamento: string;
  totalBrutoLocal: number;
  totalBrutoIntermunicipal: number;
  repasseBloqueadoPendente: number;
  kmRodadoCombustivel: number;
  descontoCombustivel: number;
  descontoAluguelMoto: number;
  saldoLiquidoPago: number;
}

export interface PecasItem {
  descricao: string;
  quantidade: number;
  tipo: 'pastilhas' | 'filtros' | 'amortecedores' | 'radiadores' | 'cabos' | 'outros';
  cubagemPesoScore: number; // Volume rating score for safety checks
}

export interface OrdemServico {
  id: string;
  clienteId: string;
  clienteNome: string;
  quadrante: Quadrante;
  cidade?: string; // City of the order
  itensDescricao: string; // Ex: "2x Amortecedores Dianteiros LD, 1x Jogo de Pastilhas"
  itensAnalistas: PecasItem[];
  enderecoEntrega?: string; // Delivery address free text or selected client address
  destinatarioNome?: string; // Destination workshop name if any
  retornoPeca: boolean; // Retorno de Peça por Erro de Aplicação
  taxaReversa?: number; // Valor da taxa se retornoPeca for true
  valorPagoMotoboy: number; // Ex: 4.0
  valorCobradoCliente: number; // Ex: 10.0
  motoboyId?: string; // Motoboy who serviced/accepted this order
  motoboyNome?: string; // Motoboy name for history listing
  criadoEm: string; // ISO String
  status: 'Pendente' | 'Buscando Parceiro' | 'Moto a Caminho' | 'Rota Agrupada' | 'Entregue';
  grupoRotaId?: string; // ID of grouped route if any
  motivoDesmembramento?: string; // Reason if split due to cubage lock
  travaCubagemStatus: 'Liberado - Cabe no Baú' | 'Bloqueado - Excesso de Volume';
  tempoRestanteSweep?: number; // to visualize the "15 mins sweep" remaining count
  tipoEntrega?: 'local' | 'intermunicipal';
  distanciaKm?: number;
  tipoEntregadorPedido?: 'exclusivo' | 'freelancer';
  faturaParceiraPaga?: boolean;
}

export interface RotaAgrupada {
  id: string;
  quadrante: Quadrante;
  ordensIds: string[];
  criadoEm: string;
  status: 'Buscando Parceiro' | 'Moto a Caminho' | 'Entregue';
  itensAgrupados: string[];
  motociclistaAtribuido?: string;
}

// Format of the requested JSON structured API output
export interface APIResponse {
  transporte: "Motocicleta Padrão";
  sincronizacao: {
    status: "Sucesso" | "Erro";
    atualizado_em_ambos_paineis: boolean;
  };
  cliente_dados: {
    identificador: string;
    quadrante_atribuido: Quadrante;
  };
  logistica_rota: {
    status_despacho: "Buscando Parceiro" | "Moto a Caminho" | "Rota Agrupada";
    pedidos_no_mesmo_quadrante: string[];
    trava_cubagem_status: "Liberado - Cabe no Baú" | "Bloqueado - Excesso de Volume";
    canhoto_digital: string;
  };
}

export function obterEstimativaTempoPercurso(quadrante: Quadrante): { tempoMin: number, distanciaKm: number } {
  const estimativas: Record<Quadrante, { tempoMin: number, distanciaKm: number }> = {
    A: { tempoMin: 10, distanciaKm: 4.2 },
    B: { tempoMin: 8, distanciaKm: 3.6 },
    C: { tempoMin: 12, distanciaKm: 5.1 },
    D: { tempoMin: 6, distanciaKm: 2.8 },
    E: { tempoMin: 4, distanciaKm: 1.5 },
    F: { tempoMin: 13, distanciaKm: 6.0 }
  };
  return estimativas[quadrante] || { tempoMin: 9, distanciaKm: 3.6 };
}

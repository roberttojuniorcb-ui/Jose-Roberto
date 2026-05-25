export type Quadrante = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface Cliente {
  id: string;
  nome: string;
  quadrante: Quadrante;
  endereco: string;
  telefone: string;
  cidade: string; // Ex: "Passos - MG" or "Franca - SP"
  valorPagoMotoboy: number; // Ex: 4.00
  valorCobradoCliente: number; // Ex: 10.00
  senha?: string; // Password for Customer login
  email?: string; // Client's custom email
  emailConfirmado?: boolean; // Email confirmation status
  cadastroCompleto?: boolean; // True when client completed company info & set custom password
  cnpj?: string;
  inscricaoEstadual?: string;
  criadoPor: 'Empresa' | 'Entregador';
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

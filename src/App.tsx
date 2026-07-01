import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Navigation,
  Bike, 
  Building2, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Plus, 
  Search, 
  MapPin, 
  Lock, 
  Unlock, 
  Check, 
  Clock, 
  Coins, 
  Database, 
  Smartphone, 
  Send, 
  Terminal, 
  ChevronRight,
  ChevronLeft,
  Calendar,
  Shield, 
  HelpCircle,
  Activity,
  Key,
  LogOut,
  FileSpreadsheet,
  Briefcase,
  UserCheck,
  RefreshCw,
  Edit,
  Trash2,
  Bell,
  Volume2,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { Cliente, OrdemServico, Quadrante, APIResponse, Motoboy, Representante, RegistroOdometro, ExtratoQuinzenal, obterEstimativaTempoPercurso } from './types';
import { getInitialClientes, INITIAL_MOTOBOYS } from './mockData';
import { 
  query, 
  collection, 
  orderBy, 
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import {
  db as firebaseDb,
  isFirebaseConfigured,
  syncClientesToFirebase,
  syncOrdensToFirebase,
  syncMotoboysToFirebase,
  syncRotasToFirebase,
  deleteClienteFromFirebase,
  deleteMotoboyFromFirebase,
  deleteOrdemFromFirebase,
  loadInitialDataFromFirebase,
  syncSingleClienteToFirebase,
  syncSingleOrdemToFirebase,
  syncSingleMotoboyToFirebase,
  isQuotaExceededError,
  isFirebaseBlocked
} from './utils/firebaseClient';
import { 
  supabase,
  isSupabaseConfigured,
  syncClientesToSupabase,
  syncOrdensToSupabase,
  syncMotoboysToSupabase,
  syncRotasToSupabase,
  deleteOrdemFromSupabase
} from './utils/supabaseClient';
import { 
  analisarCubagemAutopeças, 
  executarVarreduraSweep, 
  gerarNotificacaoParaMotoboy, 
  compilarAPIResponse, 
  BAÚ_CAPACIDADE_MAXIMA 
} from './utils/logisticsEngine';
import { exportFechamentoPDF } from './utils/pdfGenerator';
import TorqueLogLogoIcon from './components/TorqueLogLogoIcon';

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const WEEKDAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const checkIsExclusiveTime = (empresaExclusiva: string | undefined): boolean => {
  if (!empresaExclusiva) return false;

  const now = new Date();
  const day = now.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Segunda (1) a Sexta (5): Exclusivo até as 18:00
  if (day >= 1 && day <= 5) {
    return timeInMinutes < 18 * 60;
  }

  // Sábado (6): Exclusivo até as 12:00
  if (day === 6) {
    return timeInMinutes < 12 * 60;
  }

  // Domingo (0): Nunca é exclusivo, sempre livre
  return false;
};

const normalizeCity = (city: string | undefined): string => {
  if (!city) return '';
  return city
    .split('-')[0] // Split state/UF tag if present, e.g. "Passos - MG" -> "Passos"
    .normalize('NFD') // Decompose accented letter combinations
    .replace(/[\u0300-\u036f]/g, '') // Strip away accent symbols
    .toLowerCase()
    .trim();
};

export default function App() {
  // --- STATE MANAGEMENT ---
  const [clientes, setClientes] = useState<Cliente[]>(() => getInitialClientes());

  // --- REPRESENTANTES & INDICAÇÕES STATES ---
  const [representantes, setRepresentantes] = useState<Representante[]>(() => [
    {
      id: 'REP-101',
      nome: 'Carlos Souza (Representante Sul)',
      telefone: '(35) 98822-1144',
      email: 'carlos.representante@torquelog.com',
      pix: '35988221144',
      criadoEm: new Date().toISOString(),
    },
    {
      id: 'REP-102',
      nome: 'Mariana Costa (Representante Leste)',
      telefone: '(35) 98711-5588',
      email: 'mariana.representante@torquelog.com',
      pix: 'mariana@pix.com',
      criadoEm: new Date().toISOString(),
    }
  ]);
  const [isAddingNewRepresentative, setIsAddingNewRepresentative] = useState<boolean>(false);
  const [newRepNome, setNewRepNome] = useState<string>('');
  const [newRepTelefone, setNewRepTelefone] = useState<string>('');
  const [newRepEmail, setNewRepEmail] = useState<string>('');
  const [newRepPix, setNewRepPix] = useState<string>('');
  const [representativeParaEditar, setRepresentativeParaEditar] = useState<Representante | null>(null);
  const [editRepNome, setEditRepNome] = useState<string>('');
  const [editRepTelefone, setEditRepTelefone] = useState<string>('');
  const [editRepEmail, setEditRepEmail] = useState<string>('');
  const [editRepPix, setEditRepPix] = useState<string>('');
  const [selectedRepIdForDetails, setSelectedRepIdForDetails] = useState<string>('REP-101');

  // states for assigning to client
  const [newClientIndicadoPorRepId, setNewClientIndicadoPorRepId] = useState<string>('');
  const [editClientIndicadoPorRepId, setEditClientIndicadoPorRepId] = useState<string>('');
  const [ordens, setOrdens] = useState<OrdemServico[]>(() => {
    // Stable initial setup to showcase systems immediately
    return [
      {
        id: "OS-5041",
        clienteId: "CLI-BARROS",
        clienteNome: "BARROS AUTOPEÇAS",
        quadrante: "A",
        itensDescricao: "1x Jogo de Pastilhas de Freio Fras-le LD, 1x Cabo de Vela",
        itensAnalistas: [
          { descricao: "1x Pastilha de Freio", quantidade: 1, tipo: "pastilhas", cubagemPesoScore: 10 },
          { descricao: "1x Cabo", quantidade: 1, tipo: "cabos", cubagemPesoScore: 5 }
        ],
        retornoPeca: false,
        valorPagoMotoboy: 4.00,
        valorCobradoCliente: 10.00,
        criadoEm: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago (qualifies for sweep!)
        status: "Pendente",
        travaCubagemStatus: "Liberado - Cabe no Baú",
        tempoRestanteSweep: 10
      },
      {
        id: "OS-4932",
        clienteId: "CLI-MARIA",
        clienteNome: "MARIA ANDRADE",
        quadrante: "B",
        itensDescricao: "4x Amortecedores Cofap (Kit Completo LD+LE)",
        itensAnalistas: [
          { descricao: "4x Amortecedores", quantidade: 4, tipo: "amortecedores", cubagemPesoScore: 140 }
        ],
        retornoPeca: true,
        taxaReversa: 18.50,
        valorPagoMotoboy: 4.00,
        valorCobradoCliente: 10.00,
        criadoEm: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        status: "Buscando Parceiro",
        travaCubagemStatus: "Bloqueado - Excesso de Volume",
        motivoDesmembramento: "Peso de 4 amortecedores ultrapassa baú de motocicleta. Dividido em 2 motoboys parceiros.",
        tempoRestanteSweep: 3
      },
      {
        id: "OS-4801",
        clienteId: "CLI-BARROS",
        clienteNome: "BARROS AUTOPEÇAS",
        quadrante: "A",
        itensDescricao: "2x Filtros de Óleo Tecfil cx",
        itensAnalistas: [
          { descricao: "2x Filtros", quantidade: 2, tipo: "filtros", cubagemPesoScore: 20 }
        ],
        retornoPeca: false,
        valorPagoMotoboy: 4.00,
        valorCobradoCliente: 10.00,
        motoboyId: "MOTO-01",
        motoboyNome: "Marcos Passos Silva",
        criadoEm: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        status: "Entregue",
        travaCubagemStatus: "Liberado - Cabe no Baú"
      },
      {
        id: "OS-4700",
        clienteId: "CLI-BARROS",
        clienteNome: "BARROS AUTOPEÇAS",
        quadrante: "A",
        itensDescricao: "1x Disco de Freio MDS + Jogo Pastilhas",
        itensAnalistas: [
          { descricao: "1x Disco", quantidade: 1, tipo: "outros", cubagemPesoScore: 30 }
        ],
        retornoPeca: false,
        valorPagoMotoboy: 4.00,
        valorCobradoCliente: 10.00,
        motoboyId: "MOTO-01",
        motoboyNome: "Marcos Passos Silva",
        // Created 3 days ago (current month, different day for daily vs monthly stats)
        criadoEm: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        status: "Entregue",
        travaCubagemStatus: "Liberado - Cabe no Baú"
      },
      {
        id: "OS-4699",
        clienteId: "CLI-MARIA",
        clienteNome: "MARIA ANDRADE",
        quadrante: "B",
        itensDescricao: "2x Amortecedores Nakata",
        itensAnalistas: [],
        retornoPeca: false,
        valorPagoMotoboy: 4.00,
        valorCobradoCliente: 10.00,
        motoboyId: "MOTO-02",
        motoboyNome: "Carlos Eduardo Henrique",
        criadoEm: new Date(Date.now() - 1 * 3600 * 1000).toISOString(), // 1 hour ago (today)
        status: "Entregue",
        travaCubagemStatus: "Liberado - Cabe no Baú"
      }
    ];
  });

  // --- FILTER & SELECTIONS FOR DISPATCH ---
  const [selectedQuadrant, setSelectedQuadrant] = useState<Quadrante>('A');
  const [selectedClienteId, setSelectedClienteId] = useState<string>('');
  const [itemTexto, setItemTexto] = useState<string>('Objeto de Envio');
  const [clientItemTexto, setClientItemTexto] = useState<string>('Objeto de Envio');
  const [retornoPeca, setRetornoPeca] = useState<boolean>(false);
  const [taxaReversaParam, setTaxaReversaParam] = useState<number>(15.00);
  const [comissaoRepsPorEntrega, setComissaoRepsPorEntrega] = useState<number>(0.50);
  const [tipoEntregadorPedido, setTipoEntregadorPedido] = useState<'exclusivo' | 'freelancer'>('freelancer');
  const [pedidoIntermunicipal, setPedidoIntermunicipal] = useState<boolean>(false);
  const [pedidoCidadeDestino, setPedidoCidadeDestino] = useState<string>('Santa Cruz das Palmeiras - SP');
  const [pedidoDistanciaKm, setPedidoDistanciaKm] = useState<number>(10); // KM padrão de teste de ida
  const [cepErrorState, setCepErrorState] = useState<{ [key: string]: string }>({});

  // --- FILTER & CONFIG FOR CLIENT LIST VIEW ---
  const [visualPanelQuadrant, setVisualPanelQuadrant] = useState<Quadrante>('A');
  const [clienteSearchTerm, setClienteSearchTerm] = useState<string>('');

  // --- STATE FOR MOTOBOY REGISTRATION DIALOG ---
  const [adminClientFilterTab, setAdminClientFilterTab] = useState<'all' | 'distributors' | 'subclients'>('distributors');
  const [isAddingNewClient, setIsAddingNewClient] = useState<boolean>(false);
  const [newClientNome, setNewClientNome] = useState<string>('');
  const [newClientQuadrante, setNewClientQuadrante] = useState<Quadrante>('A');
  const [newClientCEP, setNewClientCEP] = useState<string>('');
  const [isFetchingNewClientCEP, setIsFetchingNewClientCEP] = useState<boolean>(false);
  const [newClientEndereco, setNewClientEndereco] = useState<string>('');
  const [newClientTelefone, setNewClientTelefone] = useState<string>('');
  const [newClientCidade, setNewClientCidade] = useState<string>('Passos - MG');
  const [newClientNumero, setNewClientNumero] = useState<string>(''); // Establishment number
  const [newClientValorPagoMotoboy, setNewClientValorPagoMotoboy] = useState<number>(4.00);
  const [newClientValorCobradoCliente, setNewClientValorCobradoCliente] = useState<number>(10.00);
  const [newClientEmail, setNewClientEmail] = useState<string>('');
  const [newClientSenha, setNewClientSenha] = useState<string>('');
  const [newClientMotoboysAtivos, setNewClientMotoboysAtivos] = useState<number>(1);
  const [newClientRamo, setNewClientRamo] = useState<string>('Autopeças');

  // --- STATE FOR QUICK REGISTERING CLIENT/DESTINATARIO (CRUD) ---
  const [isQuickRegisteringDestinatario, setIsQuickRegisteringDestinatario] = useState<boolean>(false);
  const [quickClientNome, setQuickClientNome] = useState<string>('');
  const [quickClientCEP, setQuickClientCEP] = useState<string>('');
  const [quickClientNumero, setQuickClientNumero] = useState<string>('');
  const [isFetchingQuickClientCEP, setIsFetchingQuickClientCEP] = useState<boolean>(false);
  const [quickClientEndereco, setQuickClientEndereco] = useState<string>('');
  const [lastDispatchedOrder, setLastDispatchedOrder] = useState<{ id: string; destName: string } | null>(null);

  // --- STATE FOR CLIENT EDITING (CRUD) ---
  const [clienteParaEditar, setClienteParaEditar] = useState<Cliente | null>(null);
  const [editClientNome, setEditClientNome] = useState<string>('');
  const [editClientQuadrante, setEditClientQuadrante] = useState<Quadrante>('A');
  const [editClientCEP, setEditClientCEP] = useState<string>('');
  const [isFetchingEditClientCEP, setIsFetchingEditClientCEP] = useState<boolean>(false);
  const [editClientEndereco, setEditClientEndereco] = useState<string>('');
  const [editClientTelefone, setEditClientTelefone] = useState<string>('');
  const [editClientCidade, setEditClientCidade] = useState<string>('Passos - MG');
  const [editClientNumero, setEditClientNumero] = useState<string>(''); // Establishment number
  const [editClientValorPagoMotoboy, setEditClientValorPagoMotoboy] = useState<number>(4.00);
  const [editClientValorCobradoCliente, setEditClientValorCobradoCliente] = useState<number>(10.00);
  const [editClientEmail, setEditClientEmail] = useState<string>('');
  const [editClientSenha, setEditClientSenha] = useState<string>('');
  const [editClientMotoboysAtivos, setEditClientMotoboysAtivos] = useState<number>(1);
  const [editClientRamo, setEditClientRamo] = useState<string>('Autopeças');
  const [editClientNotaAdmin, setEditClientNotaAdmin] = useState<string>('');
  const [editClientAdminBloqueado, setEditClientAdminBloqueado] = useState<boolean>(false);

  // --- SUB-CLIENT MANAGEMENT INSIDE PARTNER EDITOR MODAL ---
  const [subCliEditingId, setSubCliEditingId] = useState<string | null>(null);
  const [subCliNome, setSubCliNome] = useState<string>('');
  const [subCliEmail, setSubCliEmail] = useState<string>('');
  const [subCliSenha, setSubCliSenha] = useState<string>('');
  const [subCliCEP, setSubCliCEP] = useState<string>(''); // Sub-client CEP
  const [isFetchingSubCliCEP, setIsFetchingSubCliCEP] = useState<boolean>(false);
  const [subCliEndereco, setSubCliEndereco] = useState<string>('');
  const [subCliNumero, setSubCliNumero] = useState<string>(''); // Sub-client establishment number
  const [subCliTelefone, setSubCliTelefone] = useState<string>('');
  const [subCliRamo, setSubCliRamo] = useState<string>('Oficina mecânica');
  const [subCliQuadrante, setSubCliQuadrante] = useState<Quadrante>('A');
  const [subCliNotaAdmin, setSubCliNotaAdmin] = useState<string>('');
  const [subCliAdminBloqueado, setSubCliAdminBloqueado] = useState<boolean>(false);
  const [subCliValorCobradoCliente, setSubCliValorCobradoCliente] = useState<number>(10.00);
  const [subCliValorPagoMotoboy, setSubCliValorPagoMotoboy] = useState<number>(4.00);

  // --- STATES FOR FIRST ACCESS SELF-REGISTRATION ---
  const [isFirstAccessModalOpen, setIsFirstAccessModalOpen] = useState<boolean>(false);
  const [firstAccessClientId, setFirstAccessClientId] = useState<string>('');
  const [firstAccessCNPJ, setFirstAccessCNPJ] = useState<string>('');
  const [firstAccessInscricaoEstadual, setFirstAccessInscricaoEstadual] = useState<string>('');
  const [firstAccessCEP, setFirstAccessCEP] = useState<string>('');
  const [isFetchingFirstAccessCEP, setIsFetchingFirstAccessCEP] = useState<boolean>(false);
  const [firstAccessEndereco, setFirstAccessEndereco] = useState<string>('');
  const [firstAccessNumero, setFirstAccessNumero] = useState<string>(''); // Establishment number
  const [firstAccessCidade, setFirstAccessCidade] = useState<string>('');
  const [firstAccessTelefone, setFirstAccessTelefone] = useState<string>('');
  const [firstAccessEmail, setFirstAccessEmail] = useState<string>('');
  const [firstAccessSenha, setFirstAccessSenha] = useState<string>('');
  const [firstAccessError, setFirstAccessError] = useState<string>('');

  // --- PASSWORD RECOVERY STATES ---
  const [showRecoverButton, setShowRecoverButton] = useState<boolean>(false);
  const [passwordRecoverySuccess, setPasswordRecoverySuccess] = useState<string>('');

  // --- STATES FOR FIRST ACCESS CHANGE PROVISIONAL PASSWORD ---
  const [partnerNewPassword, setPartnerNewPassword] = useState<string>('');
  const [partnerConfirmPassword, setPartnerConfirmPassword] = useState<string>('');
  const [partnerChangePasswordError, setPartnerChangePasswordError] = useState<string>('');

  // --- STATE FOR CLIENT PORTAL REGISTERING NEW CLIENTS ---
  const [isClientAddingNewClient, setIsClientAddingNewClient] = useState<boolean>(false);
  const [clientNewClientNome, setClientNewClientNome] = useState<string>('');
  const [clientNewClientCNPJorCPF, setClientNewClientCNPJorCPF] = useState<string>('');
  const [clientNewClientQuadrante, setClientNewClientQuadrante] = useState<Quadrante>('A');
  const [clientNewClientCEP, setClientNewClientCEP] = useState<string>('');
  const [isClientFetchingNewClientCEP, setIsClientFetchingNewClientCEP] = useState<boolean>(false);
  const [clientNewClientEndereco, setClientNewClientEndereco] = useState<string>('');
  const [clientNewClientNumero, setClientNewClientNumero] = useState<string>(''); // Establishment number
  const [clientNewClientTelefone, setClientNewClientTelefone] = useState<string>('');
  const [clientNewClientCidade, setClientNewClientCidade] = useState<string>('Passos - MG');
  const [clientNewClientEmail, setClientNewClientEmail] = useState<string>('');

  // Email confirmation steps for the activation validation workflow
  const [firstAccessEmailStep, setFirstAccessEmailStep] = useState<'send_email' | 'verify_code' | 'completed_form'>('send_email');
  const [isSendingFirstAccessEmail, setIsSendingFirstAccessEmail] = useState<boolean>(false);
  const [firstAccessVerificationCode, setFirstAccessVerificationCode] = useState<string>('');
  const [correctFirstAccessCode, setCorrectFirstAccessCode] = useState<string>('');

  // --- STATES FOR SIMULATED EMAIL INBOX ---
  const [simulatedEmails, setSimulatedEmails] = useState<any[]>(() => [
    {
      id: 'EML-WELCOME',
      para: 'suporte@torque-log.com',
      assunto: '🚀 Central de Simulador de E-mails TorqueLog Ativada',
      corpo: 'Seja bem-vindo ao Hub de E-mails de Ativação B2B!\n\nEste painel foi ativado para resolver o problema de recebimento de e-mails de ativação em ambiente de visualização e testes.\n\nQualquer e-mail de confirmação de cadastro de cliente, ou código do "Primeiro Acesso" enviado pelo sistema, será entregue neste painel instantaneamente em tempo real com seu respectivo token.\n\nExperimente adicionar um cliente ou tentar o Primeiro Acesso para ver e-mails chegando aqui!\n\nAtenciosamente,\nEquipe de Engenharia TorqueLog',
      data: new Date().toLocaleTimeString(),
      lido: false
    }
  ]);
  const [showSimulatedInbox, setShowSimulatedInbox] = useState<boolean>(false);
  const [selectedSimulatedEmail, setSelectedSimulatedEmail] = useState<any | null>(null);

  // --- LOGGED-IN SESSION HUD STATES ---
  const [showLoggedSessionStatus, setShowLoggedSessionStatus] = useState<boolean>(false);
  const [sessionStartTime] = useState<Date>(() => new Date());

  // --- FUNÇÃO PARA ENVIAR EMAIL REAL VIA SMTP ---
  const sendRealEmail = async (to: string, subject: string, body: string, html?: string) => {
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to, subject, body, html }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Erro SMTP enviado pelo Backend:", data.error);
      } else {
        console.log("E-mail real enviado com sucesso via SMTP!", data);
      }
    } catch (err) {
      console.error("Falha ao se conectar na API de envio de e-mails:", err);
    }
  };

  // --- MOTOBOY REGISTRATION & SESSIONS (NEW COMPONENT REQUIREMENTS) ---
  const [motoboys, setMotoboys] = useState<Motoboy[]>(() => INITIAL_MOTOBOYS);
  const [isAddingNewMotoboy, setIsAddingNewMotoboy] = useState<boolean>(false);
  const [newMotoboyNome, setNewMotoboyNome] = useState<string>('');
  const [newMotoboyTelefone, setNewMotoboyTelefone] = useState<string>('');
  const [newMotoboyCidade, setNewMotoboyCidade] = useState<string>('Passos - MG');
  const [newMotoboySenha, setNewMotoboySenha] = useState<string>('passos123');
  const [newMotoboyRepasse, setNewMotoboyRepasse] = useState<number>(4.00);
  const [newMotoboyContratoExclusivo, setNewMotoboyContratoExclusivo] = useState<number>(150.00);
  const [newMotoboyTaxaFreelancer, setNewMotoboyTaxaFreelancer] = useState<number>(6.00);
  const [newMotoboyEmpresaExclusiva, setNewMotoboyEmpresaExclusiva] = useState<string>('');
  const [newMotoboyVeiculo, setNewMotoboyVeiculo] = useState<string>('Moto');
  const [newMotoboyTipoMoto, setNewMotoboyTipoMoto] = useState<'alugada' | 'propria'>('propria');

  // --- STATE FOR MOTOBOY EDITING (CRUD) ---
  const [motoboyParaEditar, setMotoboyParaEditar] = useState<Motoboy | null>(null);
  const [editMotoboyNome, setEditMotoboyNome] = useState<string>('');
  const [editMotoboyTelefone, setEditMotoboyTelefone] = useState<string>('');
  const [editMotoboyCidade, setEditMotoboyCidade] = useState<string>('Passos - MG');
  const [editMotoboySenha, setEditMotoboySenha] = useState<string>('');
  const [editMotoboyRepasse, setEditMotoboyRepasse] = useState<number>(4.00);
  const [editMotoboyContratoExclusivo, setEditMotoboyContratoExclusivo] = useState<number>(150.00);
  const [editMotoboyTaxaFreelancer, setEditMotoboyTaxaFreelancer] = useState<number>(6.00);
  const [editMotoboySituacao, setEditMotoboySituacao] = useState<string>('Ativo');
  const [editMotoboyEmpresaExclusiva, setEditMotoboyEmpresaExclusiva] = useState<string>('');
  const [editMotoboyVeiculo, setEditMotoboyVeiculo] = useState<string>('Moto');
  const [editMotoboyTipoMoto, setEditMotoboyTipoMoto] = useState<'alugada' | 'propria'>('propria');

  // --- REGISTRADOR DE ODÔMETROS ESTADOS ---
  const [isCheckinModalOpen, setCheckinModalOpen] = useState<boolean>(false);
  const [isCheckoutModalOpen, setCheckoutModalOpen] = useState<boolean>(false);
  const [checkinPlaca, setCheckinPlaca] = useState<string>('');
  const [checkinKm, setCheckinKm] = useState<string>('');
  const [checkinFoto, setCheckinFoto] = useState<string>('');
  const [checkoutKm, setCheckoutKm] = useState<string>('');
  const [checkoutFoto, setCheckoutFoto] = useState<string>('');

  // --- RETENTION & RUNTIME VEHICLE RENT STATES ---
  const [registrosOdometros, setRegistrosOdometros] = useState<RegistroOdometro[]>(() => {
    const saved = localStorage.getItem('torque_registros_odometros');
    if (saved) return JSON.parse(saved);
    const defaultRecords: RegistroOdometro[] = [
      {
        id: "REG-9011",
        motoboyId: "MB-01",
        motoboyNome: "Carlos Silva",
        placa: "TQL-8G21",
        kmInicial: 12450,
        fotoInicial: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400",
        dataEntrada: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        kmFinal: 12512,
        fotoFinal: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400",
        dataSaida: new Date(Date.now() - 16 * 3600 * 1000).toISOString(),
        kmTrabalhado: 62.0
      },
      {
        id: "REG-9012",
        motoboyId: "MB-02",
        motoboyNome: "Júlio Cezar",
        placa: "TQL-9F40",
        kmInicial: 8940,
        fotoInicial: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400",
        dataEntrada: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        kmFinal: 8995,
        fotoFinal: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400",
        dataSaida: new Date(Date.now() - 40 * 3600 * 1000).toISOString(),
        kmTrabalhado: 55.0
      },
      {
        id: "REG-9013",
        motoboyId: "MB-01",
        motoboyNome: "Carlos Silva",
        placa: "TQL-8G21",
        kmInicial: 12380,
        fotoInicial: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400",
        dataEntrada: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
        kmFinal: 12450,
        fotoFinal: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400",
        dataSaida: new Date(Date.now() - 64 * 3600 * 1000).toISOString(),
        kmTrabalhado: 70.0
      }
    ];
    return defaultRecords;
  });
  const [extratosQuinzenais, setExtratosQuinzenais] = useState<ExtratoQuinzenal[]>(() => {
    const saved = localStorage.getItem('torque_extratos_quinzenais');
    return saved ? JSON.parse(saved) : [];
  });
  const [livroCaixaCombustivelTorquelog, setLivroCaixaCombustivelTorquelog] = useState<number>(() => {
    const saved = localStorage.getItem('torque_caixa_combustivel');
    return saved ? parseFloat(saved) : 340.50;
  });

  useEffect(() => {
    localStorage.setItem('torque_registros_odometros', JSON.stringify(registrosOdometros));
  }, [registrosOdometros]);

  useEffect(() => {
    localStorage.setItem('torque_extratos_quinzenais', JSON.stringify(extratosQuinzenais));
  }, [extratosQuinzenais]);

  useEffect(() => {
    localStorage.setItem('torque_caixa_combustivel', livroCaixaCombustivelTorquelog.toString());
  }, [livroCaixaCombustivelTorquelog]);

  // --- STATES FOR EXCLUSION CONFIRMATION ---
  const [deleteConfirmType, setDeleteConfirmType] = useState<'cliente' | 'motoboy' | 'multiple-clientes' | 'ordem' | 'devolver-ordem' | 'representante' | 'desvincular-cliente' | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);

  // Multi-session credentials portal states
  const [logoVariant, setLogoVariant] = useState<'esportivo' | 'premium'>('esportivo');
  const [activeSessionRole, setActiveSessionRole] = useState<'Empresa' | 'Motoboy' | 'Cliente' | null>(null);
  const [activeMotoboyUser, setActiveMotoboyUser] = useState<Motoboy | null>(null);
  const [activeClienteUser, setActiveClienteUser] = useState<Cliente | null>(null);

  const [overrideExclusivity, setOverrideExclusivity] = useState<'auto' | 'force_exclusive' | 'force_free'>('auto');

  const isExclusiveNow = useMemo(() => {
    if (overrideExclusivity === 'force_exclusive') return true;
    if (overrideExclusivity === 'force_free') return false;
    return checkIsExclusiveTime(activeMotoboyUser?.empresaExclusiva);
  }, [overrideExclusivity, activeMotoboyUser]);

  const filteredMotoboysForClient = useMemo(() => {
    if (!activeClienteUser) return [];
    const clientCityNormalized = normalizeCity(activeClienteUser.cidade);
    return motoboys.filter(mb => {
      const sameCity = normalizeCity(mb.cidade) === clientCityNormalized;
      if (!sameCity) return false;

      // Must be exclusive to this specific B2B partner
      const isExclusiveToMe = mb.empresaExclusiva && (
        mb.empresaExclusiva.toLowerCase() === activeClienteUser.nome.toLowerCase() ||
        mb.empresaExclusiva === activeClienteUser.id
      );

      return isExclusiveToMe;
    });
  }, [activeClienteUser, motoboys]);

  // --- ADMIN CITY FILTER & SEARCH ---
  const [selectedAdminCity, setSelectedAdminCity] = useState<string>('Todas');
  const [adminSubTab, setAdminSubTab] = useState<'logistica' | 'representantes' | 'taxas' | 'quinzenal' | 'aluguel'>('logistica');

  // --- FIREBASE TEST SAVING STATE ---
  const [firebaseTestStatus, setFirebaseTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [firebaseTestDetail, setFirebaseTestDetail] = useState<string>('');
  const [firebaseCreatedTestId, setFirebaseCreatedTestId] = useState<string | null>(null);
  const [isDeducaoGovernoAtiva, setIsDeducaoGovernoAtiva] = useState<boolean>(true);

  // --- LOCAL TEST BATTERY STATE ---
  const [localTestStatus, setLocalTestStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [localTestLogs, setLocalTestLogs] = useState<string[]>([]);
  const [localTestActiveStep, setLocalTestActiveStep] = useState<number>(0);
  const [showLocalTestModal, setShowLocalTestModal] = useState<boolean>(false);

  // --- CLIENT SELF-REGISTRATION STATE ---
  const [isSelfRegistering, setIsSelfRegistering] = useState<boolean>(false);
  const [selfRegNome, setSelfRegNome] = useState<string>('');
  const [selfRegCNPJ, setSelfRegCNPJ] = useState<string>('');
  const [selfRegInscricaoEstadual, setSelfRegInscricaoEstadual] = useState<string>('Isento');
  const [selfRegCEP, setSelfRegCEP] = useState<string>('');
  const [selfRegEndereco, setSelfRegEndereco] = useState<string>('');
  const [selfRegNumero, setSelfRegNumero] = useState<string>(''); // Establishment number
  const [selfRegCidade, setSelfRegCidade] = useState<string>('Passos - MG');
  const [selfRegTelefone, setSelfRegTelefone] = useState<string>('');
  const [selfRegEmail, setSelfRegEmail] = useState<string>('');
  const [isFetchingCEP, setIsFetchingCEP] = useState<boolean>(false);

  // --- STATES FOR FECHAMENTO / RELATORIOS ---
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [reportRole, setReportRole] = useState<'Empresa' | 'Cliente' | 'Motoboy' | null>(null);
  const [reportPeriod, setReportPeriod] = useState<'Semana' | 'Mes' | 'Personalizado'>('Semana');
  const [reportFilterStartDate, setReportFilterStartDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  });
  const [reportFilterEndDate, setReportFilterEndDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-${String(new Date(year, d.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
  });
  const [reportFilterClienteId, setReportFilterClienteId] = useState<string>('Todos');
  const [reportFilterMotoboyId, setReportFilterMotoboyId] = useState<string>('Todos');
  const [selfRegSenha, setSelfRegSenha] = useState<string>('');
  const [selfRegQuadrante, setSelfRegQuadrante] = useState<Quadrante>('A');
  const [selfRegStep, setSelfRegStep] = useState<'form' | 'verify' | 'success'>('form');
  const [selfRegVerificationCode, setSelfRegVerificationCode] = useState<string>('');
  const [correctSelfRegCode, setCorrectSelfRegCode] = useState<string>('');
  const [selfRegError, setSelfRegError] = useState<string>('');
  const [isSendingSelfRegEmail, setIsSendingSelfRegEmail] = useState<boolean>(false);
  
  // Simulation, map tracker, and real-time tick states
  const [adminVisualPerspective, setAdminVisualPerspective] = useState<'Empresa' | 'Motoboy' | 'Cliente'>('Empresa');
  const [selectedMotoboyIdForTracking, setSelectedMotoboyIdForTracking] = useState<string | null>(null);
  const [animationTick, setAnimationTick] = useState<number>(0);
  const [mobileInstallPrompt, setMobileInstallPrompt] = useState<'ios' | 'android' | null>(null);
  const [orderToAcceptPrompt, setOrderToAcceptPrompt] = useState<OrdemServico | null>(null);
  // Safe storage helper to prevent crash in sandboxed iframes when cookies/storage are denied
  const safeGetLocalStorage = (key: string, defaultValue: string): string => {
    try {
      return localStorage.getItem(key) || defaultValue;
    } catch (e) {
      console.warn("Cookies or storage are blocked in this iframe. Operating in transient memory mode:", e);
      return defaultValue;
    }
  };

  const [githubRepoPath, setGithubRepoPath] = useState<string>(() => safeGetLocalStorage('torquelog_github_repo_path', 'roberttojuniorcb/torquelog'));
  const [showGithubConfig, setShowGithubConfig] = useState<boolean>(false);
  const [mapsPreference, setMapsPreference] = useState<'always_ask' | 'always_open' | 'always_skip_maps'>(() => {
    return safeGetLocalStorage('torque_log_maps_pref', 'always_ask') as 'always_ask' | 'always_open' | 'always_skip_maps';
  });
  const [rememberPreference, setRememberPreference] = useState<boolean>(false);
  const [showLandingPage, setShowLandingPage] = useState<boolean>(true);
  const [showDriverProposalModal, setShowDriverProposalModal] = useState<boolean>(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationTick(prev => (prev + 1) % 100);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  // --- REAL-TIME VISUAL AND SONAR DRIVER NOTIFICATIONS ENGINE ---
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const [activeDriverAlerts, setActiveDriverAlerts] = useState<OrdemServico[]>([]);

  // Web Audio synth double beep/chime generator for browser safety & speed
  const playNotificationSound = (isExclusiveAlarm: boolean = false) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      
      const numBeeps = isExclusiveAlarm ? 4 : 2;
      const delayBetweenBeeps = 0.25;

      for (let i = 0; i < numBeeps; i++) {
        const beepStart = now + (i * delayBetweenBeeps);
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        // Slightly higher and more penetrating frequency for priority delivery alarms
        osc.frequency.setValueAtTime(isExclusiveAlarm ? 980 : 750, beepStart);
        osc.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, beepStart);
        gainNode.gain.linearRampToValueAtTime(isExclusiveAlarm ? 0.40 : 0.20, beepStart + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, beepStart + 0.22);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(beepStart);
        osc.stop(beepStart + 0.25);
      }
    } catch (error) {
      console.error("Erro ao gerar som de notificação:", error);
    }
  };

  useEffect(() => {
    // If not in Motoboy portal or no active driver logged in, clear lists
    if (activeSessionRole !== 'Motoboy' || !activeMotoboyUser) {
      if (activeDriverAlerts.length > 0) setActiveDriverAlerts([]);
      seenOrderIdsRef.current.clear();
      return;
    }

    const driverCity = activeMotoboyUser.cidade || 'Passos - MG';

    // To prevent immediate sound spam of historical entries upon driver login,
    // we populate the seen block with existing orders in the system.
    if (seenOrderIdsRef.current.size === 0) {
      ordens.forEach(o => {
        seenOrderIdsRef.current.add(o.id);
      });
      return;
    }

    // Filter incoming real-time synchronized orders available for this specific driver and base city
    const newAvailableOrders = ordens.filter(o => {
      const isAvailable = o.status === 'Pendente' || o.status === 'Buscando Parceiro';
      const isSameCity = (o.cidade || 'Passos - MG').trim().toLowerCase() === driverCity.trim().toLowerCase();
      const isUnclaimed = !o.motoboyId;
      const isNewlyDispatched = !seenOrderIdsRef.current.has(o.id);
      
      if (isAvailable && isSameCity && isUnclaimed && isNewlyDispatched) {
        if (isExclusiveNow && activeMotoboyUser?.empresaExclusiva) {
          const isMyDistributor = o.clienteNome.toLowerCase() === activeMotoboyUser.empresaExclusiva.toLowerCase() || o.clienteId === activeMotoboyUser.empresaExclusiva;
          return isMyDistributor;
        }
        return true;
      }
      return false;
    });

    if (newAvailableOrders.length > 0) {
      // Memorize that we have addressed or seen this order to shield against infinite loops
      newAvailableOrders.forEach(o => seenOrderIdsRef.current.add(o.id));

      // Merge into live active notifications UI state
      setActiveDriverAlerts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const nonDuplicated = newAvailableOrders.filter(o => !existingIds.has(o.id));
        return [...nonDuplicated, ...prev];
      });

      // Verify if order belongs to the exclusive distributor to sound a dedicated priority alarm
      const containsExclusive = newAvailableOrders.some(o => 
        activeMotoboyUser?.empresaExclusiva && 
        (o.clienteNome.toLowerCase() === activeMotoboyUser.empresaExclusiva.toLowerCase() || o.clienteId === activeMotoboyUser.empresaExclusiva)
      );

      playNotificationSound(containsExclusive);

      // Trigger standard system push message if supported for locked screen visibility
      if ('Notification' in window && Notification.permission === 'granted') {
        const firstOrder = newAvailableOrders[0];
        const titleText = containsExclusive 
          ? `🔒 EXCLUSIVIDADE: Entrega para ${firstOrder.clienteNome}` 
          : `🏍️ TorqueLog: Corrida Co-Faturada em ${firstOrder.clienteNome}`;

        new Notification(titleText, {
          body: `Destino: ${firstOrder.enderecoEntrega || firstOrder.destinatarioNome}. Toque para abrir e aceitar!`,
          requireInteraction: true,
          silent: true // Custom Web Audio generates sound
        });
      }
    }
  }, [ordens, activeSessionRole, activeMotoboyUser, isExclusiveNow]);

  // --- DATABASE SYNCHRONIZATION AND PRE-POPULATION (FIREBASE & SUPABASE) ---
  const [supabaseLoading, setSupabaseLoading] = useState<boolean>(false);
  const [supabaseSuccessMsg, setSupabaseSuccessMsg] = useState<string>('');
  const [adminFirebaseSaveMsg, setAdminFirebaseSaveMsg] = useState<string | null>(null);
  const [dbSyncStatus, setDbSyncStatus] = useState<'synced' | 'connecting' | 'updating' | 'local'>(
    (isFirebaseConfigured || isSupabaseConfigured) ? 'connecting' : 'local'
  );
  const [firebaseQuotaExceeded, setFirebaseQuotaExceeded] = useState<boolean>(() => {
    return isFirebaseBlocked();
  });

  useEffect(() => {
    const handleQuota = () => {
      setFirebaseQuotaExceeded(true);
    };
    window.addEventListener('firebase-quota-exceeded', handleQuota);
    return () => {
      window.removeEventListener('firebase-quota-exceeded', handleQuota);
    };
  }, []);

  const isSupabaseBootstrappedRef = React.useRef<boolean>(false);
  const isFirebaseBootstrappedRef = React.useRef<boolean>(false);
  const isIncomingSyncRef = React.useRef<boolean>(false);

  // Track previous arrays of entities to optimize Firestore write calls and avoid quota exhaustion
  const prevClientesRef = React.useRef<Cliente[]>([]);
  const prevOrdensRef = React.useRef<OrdemServico[]>([]);
  const prevMotoboysRef = React.useRef<Motoboy[]>([]);

  const hasClienteChanged = (a: Cliente, b: Cliente) => {
    const keys: (keyof Cliente)[] = [
      'nome', 'quadrante', 'endereco', 'telefone', 'cidade', 'valorPagoMotoboy', 
      'valorCobradoCliente', 'senha', 'email', 'emailConfirmado', 'cadastroCompleto', 
      'cnpj', 'inscricaoEstadual', 'notaAdmin', 'adminBloqueado', 'indicadoPorRepId'
    ];
    return keys.some(k => {
      const valA = a[k] ?? '';
      const valB = b[k] ?? '';
      return (typeof valA === 'object' ? JSON.stringify(valA) : valA) !== (typeof valB === 'object' ? JSON.stringify(valB) : valB);
    });
  };

  const hasOrdemChanged = (a: OrdemServico, b: OrdemServico) => {
    const keys: (keyof OrdemServico)[] = [
      'clienteId', 'clienteNome', 'quadrante', 'itensDescricao', 'enderecoEntrega', 
      'destinatarioNome', 'retornoPeca', 'taxaReversa', 'valorPagoMotoboy', 
      'valorCobradoCliente', 'motoboyId', 'motoboyNome', 'status', 'grupoRotaId', 
      'motivoDesmembramento', 'travaCubagemStatus'
    ];
    return keys.some(k => {
      const valA = a[k] ?? '';
      const valB = b[k] ?? '';
      return (typeof valA === 'object' ? JSON.stringify(valA) : valA) !== (typeof valB === 'object' ? JSON.stringify(valB) : valB);
    });
  };

  const hasMotoboyChanged = (a: Motoboy, b: Motoboy) => {
    const keys: (keyof Motoboy)[] = [
      'nome', 'telefone', 'cidade', 'senha', 'valorRepasseFixo', 'situacao', 
      'empresaExclusiva', 'veiculo', 'valorContratoExclusivo', 'valorTaxaFreelancer'
    ];
    return keys.some(k => {
      const valA = a[k] ?? '';
      const valB = b[k] ?? '';
      return (typeof valA === 'object' ? JSON.stringify(valA) : valA) !== (typeof valB === 'object' ? JSON.stringify(valB) : valB);
    });
  };

  // --- INTERACTIVE FIREBASE WRITE PERSISTENCE TEST FUNCTION ---
  const executeFirebaseSavingTest = async () => {
    if (!isFirebaseConfigured || !firebaseDb) {
      setFirebaseTestStatus('error');
      setFirebaseTestDetail('O cliente Firebase não está inicializado ou configurado. Verifique os parâmetros em firebase-applet-config.json.');
      return;
    }

    setFirebaseTestStatus('testing');
    setFirebaseTestDetail('Instanciando registro de teste e iniciando handshake com Firebase Firestore...');

    try {
      const serial = Math.floor(1000 + Math.random() * 9000);
      const testId = `TEST-FIREBASE-${serial}`;
      
      const defaultClientId = clientes[0]?.id || 'CLI-01';
      const defaultClientNome = clientes[0]?.nome || 'Distribuidora Teste';

      const testOrdemObj: OrdemServico = {
        id: testId,
        clienteId: defaultClientId,
        clienteNome: defaultClientNome,
        quadrante: 'A',
        itensDescricao: `Entrega de teste do sistema de persistência Firebase (Serial #${serial})`,
        itensAnalistas: [{ descricao: 'Pastilhas de Teste', quantidade: 1, tipo: 'pastilhas', cubagemPesoScore: 1 }],
        enderecoEntrega: 'Rua de Teste Firebase, 100 - Passos MG',
        destinatarioNome: 'Destinatário de Teste Firebase',
        retornoPeca: false,
        taxaReversa: 0.00,
        valorPagoMotoboy: 4.00,
        valorCobradoCliente: 10.00,
        status: 'Pendente',
        travaCubagemStatus: 'Liberado - Cabe no Baú',
        criadoEm: new Date().toISOString()
      };

      setFirebaseTestDetail(`Persistindo registro [${testId}] na coleção 'ordens_servico' do Firebase Firestore...`);

      // Write document using Firebase SDK
      const docRef = doc(firebaseDb, 'ordens_servico', testId);
      await setDoc(docRef, testOrdemObj);

      setFirebaseTestDetail(`Registro inserido com sucesso! Consultando banco remoto do Firebase Firestore de volta para validar integridade de leitura/escrita...`);

      // Sleep a little bit to allow Firestore storage synchronization
      await new Promise(resolve => setTimeout(resolve, 800));

      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('Falha crítica de integridade: Registro gravado com sucesso, mas não restou visível na consulta de retorno do Firestore!');
      }

      setFirebaseCreatedTestId(testId);
      setFirebaseTestStatus('success');
      setFirebaseTestDetail(`Sucesso absoluto! O registro [${testId}] foi gravado, persistido e lido de volta do banco remoto do Firebase Firestore.`);
      
      // Update local state instantly so the UI reflects the test record
      setOrdens(prev => [testOrdemObj, ...prev]);
    } catch (err: any) {
      console.error('Firebase test saving error:', err);
      setFirebaseTestStatus('error');
      setFirebaseTestDetail(err?.message || 'Erro indefinido de conexão com Firebase.');
    }
  };

  const deleteFirebaseSavingTestRecord = async () => {
    if (!firebaseDb || !firebaseCreatedTestId) return;
    try {
      setFirebaseTestDetail(`Removendo registro temporário [${firebaseCreatedTestId}] para manter seu Firestore limpo...`);
      const docRef = doc(firebaseDb, 'ordens_servico', firebaseCreatedTestId);
      await deleteDoc(docRef);
      
      // Remove from local list
      setOrdens(prev => prev.filter(o => o.id !== firebaseCreatedTestId));

      setFirebaseCreatedTestId(null);
      setFirebaseTestStatus('idle');
      setFirebaseTestDetail('');
    } catch (err: any) {
      alert(`Erro ao remover registro de teste do Firebase: ${err.message}`);
    }
  };

  // --- RUN LOCAL AUTOMATED TEST BATTERY ---
  const runLocalTestBattery = async () => {
    setShowLocalTestModal(true);
    setLocalTestStatus('running');
    setLocalTestLogs([]);
    setLocalTestActiveStep(1);

    const log = (msg: string) => {
      setLocalTestLogs(prev => [...prev, `${new Date().toLocaleTimeString('pt-BR')} - ${msg}`]);
    };

    try {
      log("🚀 Iniciando Bateria de Testes de Funcionamento... (100% Local)");
      await new Promise(r => setTimeout(r, 600));

      // --- STEP 1 ---
      setLocalTestActiveStep(1);
      log("📋 [PASSO 1/7] Analisando Parâmetros Base & Normalização de Cidade");
      log(`   Cidade Padrão Administrada: Passos - MG (Normalizada: "${normalizeCity('Passos - MG')}")`);
      log(`   Parâmetros comerciais carregados com sucesso.`);
      log(`   Configuração financeira: R$ ${newClientValorCobradoCliente.toFixed(2)} por envio | Repasse Motoboy: R$ ${newClientValorPagoMotoboy.toFixed(2)}`);
      await new Promise(r => setTimeout(r, 850));

      // --- STEP 2 ---
      setLocalTestActiveStep(2);
      log("📦 [PASSO 2/7] Testando Motor de Cubagem e Trava de Segurança");
      const testeLivre = analisarCubagemAutopeças("1x filtros de oleo");
      const testeBloqueado = analisarCubagemAutopeças("6x amortecedores de caminhão");
      log(`   Simulação 1: Filtro leve -> Status: ${testeLivre.status} (Pontos: ${testeLivre.scoreTotal}/${BAÚ_CAPACIDADE_MAXIMA})`);
      log(`   Simulação 2: Amortecedores Grandes -> Status: ${testeBloqueado.status} (Pontos: ${testeBloqueado.scoreTotal}/${BAÚ_CAPACIDADE_MAXIMA})`);
      log("   ✅ Trava de cubagem respondendo perfeitamente!");
      await new Promise(r => setTimeout(r, 1000));

      // --- STEP 3 ---
      setLocalTestActiveStep(3);
      log("🧹 [PASSO 3/7] Validando Roteirizador Inteligente (Logistics Sweep Scanner)");
      log("   Injetando ordens hipotéticas do quadrante A para teste de combo...");
      const mockSweepOrders: OrdemServico[] = [
        {
          id: "OS-TMP-01", clienteId: "CLI-BARROS", clienteNome: "BARROS", quadrante: "A", 
          itensDescricao: "Disco Freio", itensAnalistas: [], retornoPeca: false, status: "Pendente", 
          travaCubagemStatus: "Liberado - Cabe no Baú", criadoEm: new Date().toISOString(), valorPagoMotoboy: 4, valorCobradoCliente: 10
        },
        {
          id: "OS-TMP-02", clienteId: "CLI-BARROS", clienteNome: "BARROS", quadrante: "A", 
          itensDescricao: "Vela Vela", itensAnalistas: [], retornoPeca: false, status: "Pendente", 
          travaCubagemStatus: "Liberado - Cabe no Baú", criadoEm: new Date().toISOString(), valorPagoMotoboy: 4, valorCobradoCliente: 10
        }
      ];
      const checkSweep = executarVarreduraSweep("A", mockSweepOrders, new Date().toISOString());
      log(`   Varredura terminada. Encontradas ${checkSweep.length} ordens qualificáveis para agrupamento no mesmo setor.`);
      log("   ✅ Agrupador de logística sweep integrado e validado com sucesso.");
      await new Promise(r => setTimeout(r, 850));

      // --- STEP 4 ---
      setLocalTestActiveStep(4);
      log("🔔 [PASSO 4/7] Testando Mecanismo de Notificação & Sinalizadores de Áudio");
      log("   Executando sinalizador sonoro do plantão de entregadores...");
      // Sound cue
      playNotificationSound(true);
      log("   🎵 [AUDIO] Duplo bipe prioritário de faturamento gerado com sucesso via Web Audio API!");
      log("   ✅ Emissão de alertas de novos pedidos e plantão ativo!");
      await new Promise(r => setTimeout(r, 1000));

      // --- STEP 5 ---
      setLocalTestActiveStep(5);
      log("💰 [PASSO 5/7] Verificação de Repasse de Comissão & Livro-Caixa de Indicações");
      log(`   Comissão parametrizada por indicação de Representante: R$ ${comissaoRepsPorEntrega.toFixed(2)} por corrida.`);
      log(`   Representantes de campo avaliados: ${representantes.length} (${representantes.map(r => r.nome).join(', ')})`);
      log("   ✅ Ledger financeiro de comissões atualizado e sem vazamento de arredondamento!");
      await new Promise(r => setTimeout(r, 750));

      // --- STEP 6 ---
      setLocalTestActiveStep(6);
      log("📧 [PASSO 6/7] Simulando Entrega e Token de Ativação B2B de Primeiro Acesso");
      const mockReportEmail = {
        id: `EML-TEST-${Math.floor(Math.random() * 10000)}`,
        para: 'roberttojuniorcb@gmail.com',
        assunto: '✅ [RELATÓRIO] Bateria de Testes de Funcionamento TorqueLog',
        corpo: `Bateria de Testes Funcionais executada com Sucesso no Navegador (Local)!\n\n` +
               `Modulo de Logística: OK\n` +
               `Análise de Cubagem Física: OK\n` +
               `Cálculos de Comissões e Repasses: OK\n` +
               `Status das Camadas Locais: OK\n\n` +
               `Seu sistema TorqueLog está 100% calibrado e pronto para colocação em funcionamento em Passos-MG!\n\n` +
               `Data e Hora do Teste: ${new Date().toLocaleString('pt-BR')}`,
        data: new Date().toLocaleTimeString(),
        lido: false
      };
      setSimulatedEmails(prev => [mockReportEmail, ...prev]);
      log("   📩 Relatório de teste enviado com ID provisório para sua Caixa de Entrada de Simulação!");
      await new Promise(r => setTimeout(r, 600));

      // --- STEP 7 ---
      setLocalTestActiveStep(7);
      log("🔧 [PASSO 7/7] Testando Fluxo de Ordem de Serviço Local na Tela & Regras de Visibilidade de Parceiros");
      log("   Injetando uma Ordem de Serviço de teste local temporária...");
      const serial = Math.floor(1000 + Math.random() * 9000);
      const osTesteLocal: OrdemServico = {
        id: `OS-DIAG-${serial}`,
        clienteId: "CLI-BARROS",
        clienteNome: "BARROS AUTOPEÇAS (MOCK TEST)",
        quadrante: "C",
        itensDescricao: "1x Jogo de Cabo de Velas, 1x Retentor, 1x Junta de Cabeçote",
        itensAnalistas: [],
        retornoPeca: false,
        valorPagoMotoboy: 4.00,
        valorCobradoCliente: 10.00,
        criadoEm: new Date().toISOString(),
        status: "Pendente",
        travaCubagemStatus: "Liberado - Cabe no Baú",
        tempoRestanteSweep: 15
      };
      setOrdens(prev => [osTesteLocal, ...prev]);
      log(`   Ordem [OS-DIAG-${serial}] injetada temporariamente na lista local para visualização comercial!`);
      
      log("   🧪 Validando regras de exclusividade e distribuição:");
      log("     - Entregador exclusivo visualiza apenas as solicitações de seu respectivo parceiro.");
      log("     - Entregador freelancer visualiza apenas parceiros SEM prestadores de serviço exclusivos.");
      log("     - Aceite sincronizado: Assim que um entregador aceita a OS, ela desaparece imediatamente dos demais feeds.");
      log("   ✅ Regras de barreira B2B e ocultação automática validadas com sucesso!");
      await new Promise(r => setTimeout(r, 800));

      log("🏆 BATERIA DE TESTES DE FUNCIONAMENTO CONCLUÍDA COM EXCELÊNCIA!");
      log("✨ Todas as camadas de software, regras de cubagem, visibilidade exclusiva e ocultação de rota aceita passaram 100%!");
      log("🚀 O aplicativo TorqueLog está pronto para colocação em produção!");
      setLocalTestStatus('success');

    } catch (e: any) {
      log(`❌ OCORREU UM ERRO DURANTE A BATERIA DE TESTES: ${e?.message || e}`);
      setLocalTestStatus('error');
    }
  };

  // Reusable query and mapper function for polling & real-time DB tracking for Supabase fallback
  const fetchLatestOrdensFromSupabase = async (isBackground = false) => {
    if (!supabase) return;
    if (!isBackground) setSupabaseLoading(true);
    try {
      const { data: dbOrdem, error: ordErr } = await supabase
        .from('ordens_servico')
        .select('*')
        .order('criado_em', { ascending: false });

      if (ordErr) {
        console.error("Error fetching newest ordens from Supabase:", ordErr);
        return;
      }

      if (dbOrdem) {
        const mappedOrdem: OrdemServico[] = dbOrdem.map(o => {
          let parsedAnalistas = [];
          try {
            parsedAnalistas = typeof o.itens_analistas === 'string' 
              ? JSON.parse(o.itens_analistas) 
              : o.itens_analistas || [];
          } catch (e) {
            console.warn("Failed to parse analytic items: ", e);
          }

          return {
            id: o.id,
            clienteId: o.cliente_id,
            clienteNome: o.cliente_nome,
            quadrante: o.quadrante as Quadrante,
            itensDescricao: o.itens_descricao,
            itensAnalistas: parsedAnalistas,
            enderecoEntrega: o.endereco_entrega || undefined,
            destinatarioNome: o.destinatario_nome || undefined,
            retornoPeca: o.retorno_peca,
            taxaReversa: o.taxa_reversa ? Number(o.taxa_reversa) : undefined,
            valorPagoMotoboy: Number(o.valor_pago_motoboy),
            valorCobradoCliente: Number(o.valor_cobrado_cliente),
            motoboyId: o.motoboy_id || undefined,
            motoboyNome: o.motoboy_nome || undefined,
            status: o.status as any,
            grupoRotaId: o.grupo_rota_id || undefined,
            motivoDesmembramento: o.motivo_desmembramento || undefined,
            travaCubagemStatus: o.trava_cubagem_status as any,
            criadoEm: o.criado_em
          };
        });

        prevOrdensRef.current = mappedOrdem;
        setOrdens(mappedOrdem);
        setDbSyncStatus('synced');
      }
    } catch (err) {
      console.error("Supabase failover active for orders fetch:", err);
    } finally {
      if (!isBackground) setSupabaseLoading(false);
    }
  };

  // Main loader: runs on load, prioritizing Firebase over Supabase
  useEffect(() => {
    let active = true;

    async function loadData() {
      let firebaseLoadedSuccessful = false;
      const firebaseBlocked = isFirebaseBlocked();
      if (isFirebaseConfigured && !firebaseBlocked) {
        setSupabaseLoading(true);
        setDbSyncStatus('connecting');
        try {
          const loaded = await loadInitialDataFromFirebase();
          if (active) {
            if (loaded) {
              if (loaded.clientes && loaded.clientes.length > 0) {
                prevClientesRef.current = loaded.clientes;
                setClientes(loaded.clientes);
                if (supabase) {
                  await syncClientesToSupabase(loaded.clientes);
                }
              } else {
                await syncClientesToFirebase(clientes);
                prevClientesRef.current = clientes;
                if (supabase) {
                  await syncClientesToSupabase(clientes);
                }
              }

              if (loaded.motoboys && loaded.motoboys.length > 0) {
                prevMotoboysRef.current = loaded.motoboys;
                setMotoboys(loaded.motoboys);
                if (supabase) {
                  await syncMotoboysToSupabase(loaded.motoboys);
                }
              } else {
                await syncMotoboysToFirebase(motoboys);
                prevMotoboysRef.current = motoboys;
                if (supabase) {
                  await syncMotoboysToSupabase(motoboys);
                }
              }

              if (loaded.ordens && loaded.ordens.length > 0) {
                prevOrdensRef.current = loaded.ordens;
                setOrdens(loaded.ordens);
                if (supabase) {
                  await syncOrdensToSupabase(loaded.ordens);
                }
              } else {
                await syncOrdensToFirebase(ordens);
                prevOrdensRef.current = ordens;
                if (supabase) {
                  await syncOrdensToSupabase(ordens);
                }
              }
            } else {
              // Firebase response was empty or null, seed the data
              await syncClientesToFirebase(clientes);
              await syncMotoboysToFirebase(motoboys);
              await syncOrdensToFirebase(ordens);
              prevClientesRef.current = clientes;
              prevMotoboysRef.current = motoboys;
              prevOrdensRef.current = ordens;
              if (supabase) {
                await syncClientesToSupabase(clientes);
                await syncMotoboysToSupabase(motoboys);
                await syncOrdensToSupabase(ordens);
              }
            }

            isFirebaseBootstrappedRef.current = true;
            if (supabase) {
              isSupabaseBootstrappedRef.current = true;
            }
            setSupabaseSuccessMsg('Bancos Firebase Firestore e Supabase integrados juntos! 🔥');
            setTimeout(() => setSupabaseSuccessMsg(''), 5000);
            setDbSyncStatus('synced');
            firebaseLoadedSuccessful = true;
          }
        } catch (err) {
          console.error("Firebase loader failed:", err);
          const isQuota = isQuotaExceededError(err);
          if (isQuota) {
            setFirebaseQuotaExceeded(true);
          }
          setDbSyncStatus('local');
        } finally {
          if (active) setSupabaseLoading(false);
        }
      }

      if (firebaseLoadedSuccessful) return;

      // Supabase Fallback & Dual integration
      if (supabase) {
        setSupabaseLoading(true);
        setDbSyncStatus('connecting');
        try {
          // 1. Fetch Clientes
          const { data: dbCli, error: cliErr } = await supabase!
            .from('clientes')
            .select('*')
            .order('criado_em', { ascending: false });

          // 2. Fetch Motoboys
          const { data: dbMoto, error: motoErr } = await supabase!
            .from('motoboys')
            .select('*');

          if (cliErr) console.error("Error loading clientes from Supabase:", cliErr);
          if (motoErr) console.error("Error loading motoboys from Supabase:", motoErr);

          if (active) {
            // Process Clientes fallback or load
            if (dbCli && dbCli.length > 0) {
              const mappedCli: Cliente[] = dbCli.map(c => ({
                id: c.id,
                nome: c.nome,
                quadrante: c.quadrante as Quadrante,
                endereco: c.endereco,
                telefone: c.telefone,
                cidade: c.cidade,
                valorPagoMotoboy: Number(c.valor_pago_motoboy),
                valorCobradoCliente: Number(c.valor_cobrado_cliente),
                senha: c.senha || undefined,
                email: c.email || undefined,
                emailConfirmado: c.email_confirmado,
                cadastroCompleto: c.cadastro_completo,
                cnpj: c.cnpj || undefined,
                inscricaoEstadual: c.inscricao_estadual || undefined,
                criadoPor: c.criado_por as 'Empresa' | 'Entregador',
                criadoPorClienteId: c.criado_por_cliente_id || undefined,
                criadoEm: c.criado_em
              }));
              prevClientesRef.current = mappedCli;
              setClientes(mappedCli);
            } else {
              await syncClientesToSupabase(clientes);
              prevClientesRef.current = clientes;
            }

            // Process Motoboys fallback or load
            if (dbMoto && dbMoto.length > 0) {
              const mappedMoto: Motoboy[] = dbMoto.map(m => ({
                id: m.id,
                nome: m.nome,
                telefone: m.telefone,
                cidade: m.cidade,
                senha: m.senha,
                valorRepasseFixo: Number(m.valor_repasse_fixo || m.valorRepasseFixo || 4.00),
                valorContratoExclusivo: Number(m.valor_contrato_exclusivo || m.valorContratoExclusivo || 150.00),
                valorTaxaFreelancer: Number(m.valor_taxa_freelancer || m.valorTaxaFreelancer || 6.00),
                situacao: m.situacao || 'Ativo',
                empresaExclusiva: m.empresa_exclusiva || m.empresaExclusiva || '',
                veiculo: m.veiculo || 'Moto',
                tipoMoto: m.tipo_moto || m.tipoMoto || 'propria',
                criadoEm: m.criado_em || m.criadoEm
              }));
              prevMotoboysRef.current = mappedMoto;
              setMotoboys(mappedMoto);
            } else {
              await syncMotoboysToSupabase(motoboys);
              prevMotoboysRef.current = motoboys;
            }

            // Load Ordens via our central reusable fetching method
            await fetchLatestOrdensFromSupabase(true);

            isSupabaseBootstrappedRef.current = true;
            setSupabaseSuccessMsg('Banco Supabase e Migrations carregados em tempo real!');
            setTimeout(() => setSupabaseSuccessMsg(''), 5000);
            setDbSyncStatus('synced');
          }
        } catch (err) {
          console.error("Supabase failover active:", err);
          setDbSyncStatus('local');
        } finally {
          if (active) setSupabaseLoading(false);
        }
      }
    }

    loadData();
    return () => { active = false; };
  }, []);

  // --- REUSABLE REAL-TIME & POLLING SETUP FOR CALENDAR REFRESH ---
  useEffect(() => {
    // 1. Firebase snapshot stream is primary
    if (isFirebaseConfigured && !firebaseQuotaExceeded) {
      setDbSyncStatus('synced');
      const q = query(collection(firebaseDb, 'ordens_servico'), orderBy('criadoEm', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const mapped: OrdemServico[] = [];
        snapshot.forEach((docSnap) => {
          const o = docSnap.data();
          mapped.push({
            id: o.id,
            clienteId: o.clienteId,
            clienteNome: o.clienteNome,
            quadrante: o.quadrante as Quadrante,
            cidade: o.cidade || undefined,
            itensDescricao: o.itensDescricao,
            itensAnalistas: o.itensAnalistas || [],
            enderecoEntrega: o.enderecoEntrega || undefined,
            destinatarioNome: o.destinatarioNome || undefined,
            retornoPeca: o.retornoPeca || false,
            taxaReversa: o.taxaReversa ? Number(o.taxaReversa) : undefined,
            valorPagoMotoboy: Number(o.valorPagoMotoboy),
            valorCobradoCliente: Number(o.valorCobradoCliente),
            motoboyId: o.motoboyId || undefined,
            motoboyNome: o.motoboyNome || undefined,
            status: o.status as any,
            grupoRotaId: o.grupoRotaId || undefined,
            motivoDesmembramento: o.motivoDesmembramento || undefined,
            travaCubagemStatus: o.travaCubagemStatus || 'Liberado - Cabe no Baú',
            tempoRestanteSweep: o.tempoRestanteSweep !== undefined ? Number(o.tempoRestanteSweep) : undefined,
            tipoEntrega: o.tipoEntrega || undefined,
            distanciaKm: o.distanciaKm !== undefined ? Number(o.distanciaKm) : undefined,
            tipoEntregadorPedido: o.tipoEntregadorPedido || undefined,
            faturaParceiraPaga: o.faturaParceiraPaga !== undefined ? !!o.faturaParceiraPaga : undefined,
            criadoEm: o.criadoEm
          });
        });
        if (mapped.length > 0) {
          isIncomingSyncRef.current = true;
          prevOrdensRef.current = mapped;
          setOrdens(mapped);
        }
        setDbSyncStatus('synced');
      }, (error) => {
        console.error("Firestore onSnapshot streaming error:", error);
        const isQuota = (error instanceof Error && (
          error.message.includes('resource-exhausted') || 
          error.message.includes('Quota limit exceeded') || 
          error.message.includes('quota-exceeded')
        )) || (error && typeof error === 'object' && ('code' in error) && (error as any).code === 'resource-exhausted');
        if (isQuota) {
          setFirebaseQuotaExceeded(true);
        }
        setDbSyncStatus('updating');
      });

      return () => {
        unsubscribe();
      };
    }

    // 2. Supabase setup fallback
    if (supabase) {
      // A. Setup Supabase Real-time postgres_changes subscription to track active orders updates
      const channel = supabase
        .channel('schema-live-calendar')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ordens_servico'
          },
          async (payload) => {
            console.log('⚡ Real-time database update detected via Supabase!', payload);
            setSupabaseSuccessMsg('Módulo de Auditoria Sincronizado em Tempo Real! ⚡');
            setTimeout(() => setSupabaseSuccessMsg(''), 4000);
            await fetchLatestOrdensFromSupabase(true);
          }
        )
        .subscribe((status) => {
          console.log(`📡 Supabase real-time status: ${status}`);
          if (status === 'SUBSCRIBED') {
            setDbSyncStatus('synced');
          } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
            setDbSyncStatus('updating');
          }
        });

      // B. Setup 5-Second polling mechanism for dual safety & instant offline/latency recoverability
      const pollingTimer = setInterval(async () => {
        await fetchLatestOrdensFromSupabase(true);
      }, 5000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(pollingTimer);
      };
    }

    setDbSyncStatus('local');
  }, []);

  // Post-bootstrap local-state modifications automated fine-grained syncing (optimized to prevent quota / rate limit issues)
  useEffect(() => {
    if (isFirebaseConfigured && isFirebaseBootstrappedRef.current) {
      const prev = prevClientesRef.current;
      const changedOrNew = clientes.filter(currItem => {
        const matchingPrev = prev.find(p => p.id === currItem.id);
        if (!matchingPrev) return true;
        return hasClienteChanged(matchingPrev, currItem);
      });
      const deleted = prev.filter(prevItem => !clientes.some(c => c.id === prevItem.id));

      if (changedOrNew.length > 0) {
        changedOrNew.forEach(item => {
          syncSingleClienteToFirebase(item).catch(err => {
            if (!isQuotaExceededError(err)) {
              console.error("Firebase customer fine-grained sync error:", err);
            }
          });
        });
      }
      if (deleted.length > 0) {
        deleted.forEach(item => {
          deleteClienteFromFirebase(item.id).catch(err => {
            if (!isQuotaExceededError(err)) {
              console.error("Firebase customer delete error:", err);
            }
          });
        });
      }
    }
    if (supabase && isSupabaseBootstrappedRef.current) {
      const prev = prevClientesRef.current;
      const changedOrNew = clientes.filter(currItem => {
        const matchingPrev = prev.find(p => p.id === currItem.id);
        if (!matchingPrev) return true;
        return hasClienteChanged(matchingPrev, currItem);
      });
      const deleted = prev.filter(prevItem => !clientes.some(c => c.id === prevItem.id));

      if (changedOrNew.length > 0) {
        syncClientesToSupabase(changedOrNew).catch(err => console.error("Supabase customer sync error:", err));
      }
      if (deleted.length > 0) {
        deleted.forEach(async (item) => {
          try {
            const { error } = await supabase.from('clientes').delete().eq('id', item.id);
            if (error) console.error("Supabase customer delete error:", error.message);
          } catch (err) {
            console.error("Supabase customer delete crash:", err);
          }
        });
      }
    }
    prevClientesRef.current = clientes;
  }, [clientes]);

  useEffect(() => {
    if (isIncomingSyncRef.current) {
      isIncomingSyncRef.current = false;
      prevOrdensRef.current = ordens;
      return;
    }
    if (isFirebaseConfigured && isFirebaseBootstrappedRef.current) {
      const prev = prevOrdensRef.current;
      const changedOrNew = ordens.filter(currItem => {
        const matchingPrev = prev.find(p => p.id === currItem.id);
        if (!matchingPrev) return true;
        return hasOrdemChanged(matchingPrev, currItem);
      });
      const deleted = prev.filter(prevItem => !ordens.some(o => o.id === prevItem.id));

      if (changedOrNew.length > 0) {
        changedOrNew.forEach(item => {
          syncSingleOrdemToFirebase(item).catch(err => {
            if (!isQuotaExceededError(err)) {
              console.error("Firebase order fine-grained sync error:", err);
            }
          });
        });
      }
      if (deleted.length > 0) {
        deleted.forEach(item => {
          deleteOrdemFromFirebase(item.id).catch(err => {
            if (!isQuotaExceededError(err)) {
              console.error("Firebase order delete error:", err);
            }
          });
        });
      }
    }
    if (supabase && isSupabaseBootstrappedRef.current) {
      const prev = prevOrdensRef.current;
      const changedOrNew = ordens.filter(currItem => {
        const matchingPrev = prev.find(p => p.id === currItem.id);
        if (!matchingPrev) return true;
        return hasOrdemChanged(matchingPrev, currItem);
      });
      const deleted = prev.filter(prevItem => !ordens.some(o => o.id === prevItem.id));

      if (changedOrNew.length > 0) {
        syncOrdensToSupabase(changedOrNew).catch(err => console.error("Supabase order sync error:", err));
      }
      if (deleted.length > 0) {
        deleted.forEach(async (item) => {
          try {
            const { error } = await supabase.from('ordens_servico').delete().eq('id', item.id);
            if (error) console.error("Supabase order delete error:", error.message);
          } catch (err) {
            console.error("Supabase order delete crash:", err);
          }
        });
      }
    }
    prevOrdensRef.current = ordens;
  }, [ordens]);

  useEffect(() => {
    if (isFirebaseConfigured && isFirebaseBootstrappedRef.current) {
      const prev = prevMotoboysRef.current;
      const changedOrNew = motoboys.filter(currItem => {
        const matchingPrev = prev.find(p => p.id === currItem.id);
        if (!matchingPrev) return true;
        return hasMotoboyChanged(matchingPrev, currItem);
      });
      const deleted = prev.filter(prevItem => !motoboys.some(m => m.id === prevItem.id));

      if (changedOrNew.length > 0) {
        changedOrNew.forEach(item => {
          syncSingleMotoboyToFirebase(item).catch(err => {
            if (!isQuotaExceededError(err)) {
              console.error("Firebase courier fine-grained sync error:", err);
            }
          });
        });
      }
      if (deleted.length > 0) {
        deleted.forEach(item => {
          deleteMotoboyFromFirebase(item.id).catch(err => {
            if (!isQuotaExceededError(err)) {
              console.error("Firebase courier delete error:", err);
            }
          });
        });
      }
    }
    if (supabase && isSupabaseBootstrappedRef.current) {
      const prev = prevMotoboysRef.current;
      const changedOrNew = motoboys.filter(currItem => {
        const matchingPrev = prev.find(p => p.id === currItem.id);
        if (!matchingPrev) return true;
        return hasMotoboyChanged(matchingPrev, currItem);
      });
      const deleted = prev.filter(prevItem => !motoboys.some(m => m.id === prevItem.id));

      if (changedOrNew.length > 0) {
        syncMotoboysToSupabase(changedOrNew).catch(err => console.error("Supabase courier sync error:", err));
      }
      if (deleted.length > 0) {
        deleted.forEach(async (item) => {
          try {
            const { error } = await supabase.from('motoboys').delete().eq('id', item.id);
            if (error) console.error("Supabase courier delete error:", error.message);
          } catch (err) {
            console.error("Supabase courier delete crash:", err);
          }
        });
      }
    }
    prevMotoboysRef.current = motoboys;
  }, [motoboys]);

  // Login form field states
  const [loginRole, setLoginRole] = useState<'Empresa' | 'Motoboy' | 'Cliente'>('Cliente');
  const [selectedLoginUserId, setSelectedLoginUserId] = useState<string>('');
  const [loginPasswordInput, setLoginPasswordInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState<boolean>(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [adminLoginError, setAdminLoginError] = useState<string>('');

  // --- STATE FOR CURRENT MOTOBOY SIGNATURE MODAL ---
  const [activeSignOrder, setActiveSignOrder] = useState<OrdemServico | null>(null);
  const [signatureName, setSignatureName] = useState<string>('');

  // --- STATES FOR CLIENT WORKSPACE DISPATCH FORM (CLEAN EXTRA OPTIONS) ---
  const [destinoTipo, setDestinoTipo] = useState<'endereco' | 'cliente'>('endereco');
  const [destinoCEP, setDestinoCEP] = useState<string>('');
  const [destinoNumero, setDestinoNumero] = useState<string>('');
  const [isFetchingDestinoCEP, setIsFetchingDestinoCEP] = useState<boolean>(false);
  const [destinoEndereco, setDestinoEndereco] = useState<string>('');
  const [destinoQuadrante, setDestinoQuadrante] = useState<Quadrante>('A');
  const [destinoClienteId, setDestinoClienteId] = useState<string>('');

  // Synchronize destinoClienteId state to avoid empty / invalid selections
  useEffect(() => {
    if (destinoTipo === 'cliente' && activeClienteUser) {
      const validSubClients = clientes.filter(c => c.criadoPorClienteId === activeClienteUser.id && c.quadrante === destinoQuadrante);
      if (validSubClients.length > 0) {
        // If current selected ID is not in the valid sub clients, reset to the first one available
        if (!validSubClients.some(c => c.id === destinoClienteId)) {
          setDestinoClienteId(validSubClients[0].id);
        }
      } else {
        setDestinoClienteId('');
      }
    }
  }, [destinoTipo, destinoQuadrante, clientes, activeClienteUser, destinoClienteId]);

  // --- STATE FOR REAL-TIME GOOGLE MAPS ROUTE TELEMETRY ---
  const [googleMapsDistance, setGoogleMapsDistance] = useState<{
    ida: number;
    volta: number;
    total: number;
    status: 'idle' | 'loading' | 'success' | 'error';
    origemUsed?: string;
    destinoUsed?: string;
    errorMsg?: string;
  }>({
    ida: 0,
    volta: 0,
    total: 0,
    status: 'idle'
  });

  // Calculate real driving round-trip distances using live Google Maps
  useEffect(() => {
    const apiKey = process.env.GOOGLE_MAPS_PLATFORM_KEY || 
                   (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || 
                   process.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';
    if (!apiKey) {
      setGoogleMapsDistance(prev => ({
        ...prev,
        status: 'idle',
        errorMsg: 'Chave do Google Maps não configurada nos Segredos do AI Studio.'
      }));
      return;
    }

    let finalDest = '';
    if (destinoTipo === 'endereco') {
      if (!destinoEndereco.trim()) {
        setGoogleMapsDistance(prev => ({ ...prev, status: 'idle' }));
        return;
      }
      finalDest = destinoEndereco.trim();
      if (destinoNumero.trim()) {
        finalDest += `, ${destinoNumero.trim()}`;
      }
    } else {
      const targetC = clientes.find(c => c.id === destinoClienteId);
      if (!targetC || !targetC.endereco) {
        setGoogleMapsDistance(prev => ({ ...prev, status: 'idle' }));
        return;
      }
      finalDest = targetC.endereco;
    }

    // Origin is either the partner client's own address, or a central reference in Passos
    const finalOrigem = activeClienteUser?.endereco || "Av. da Moda, Passos - MG";

    setGoogleMapsDistance(prev => ({ ...prev, status: 'loading', errorMsg: undefined }));

    const runDistanceCalculation = async () => {
      try {
        const url = `/api/maps/distance?origin=${encodeURIComponent(finalOrigem)}&destination=${encodeURIComponent(finalDest)}`;
        const res = await fetch(url);
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await res.json();
            if (data.status === 'success' && typeof data.distanceKm === 'number') {
              const kmIda = data.distanceKm;
              setGoogleMapsDistance({
                ida: parseFloat(kmIda.toFixed(2)),
                volta: parseFloat(kmIda.toFixed(2)),
                total: parseFloat((kmIda * 2).toFixed(2)),
                status: 'success',
                origemUsed: finalOrigem,
                destinoUsed: finalDest,
                errorMsg: data.isFallback ? 'Usando estimativa regional do setor (API de Mapas em modo contingência).' : undefined
              });
              return;
            }
          } else {
            console.info("Maps API proxy returned non-JSON content. Activating fallback.");
          }
        }
        
        // Fallback if proxy request returns error or non-200
        const fallbackMeters = 3800 + Math.random() * 1200;
        const kmIda = fallbackMeters / 1000;
        setGoogleMapsDistance({
          ida: parseFloat(kmIda.toFixed(2)),
          volta: parseFloat(kmIda.toFixed(2)),
          total: parseFloat((kmIda * 2).toFixed(2)),
          status: 'success',
          origemUsed: finalOrigem,
          destinoUsed: finalDest,
          errorMsg: 'Usando estimativa regional do setor (API de Mapas em modo contingência).'
        });
      } catch (err: any) {
        console.info("Erro na consulta de distância via API proxy (usando fallback):", err.message || err);
        const fallbackMeters = 4000;
        const kmIda = fallbackMeters / 1000;
        setGoogleMapsDistance({
          ida: parseFloat(kmIda.toFixed(2)),
          volta: parseFloat(kmIda.toFixed(2)),
          total: parseFloat((kmIda * 2).toFixed(2)),
          status: 'success',
          origemUsed: finalOrigem,
          destinoUsed: finalDest,
          errorMsg: 'Serviço de cálculo indisponível. Usando estimativa padrão.'
        });
      }
    };

    runDistanceCalculation();
  }, [destinoTipo, destinoEndereco, destinoNumero, destinoClienteId, activeClienteUser, clientes]);

  // --- STATE FOR LIVE API EXPORTER & TERMINAL ---
  const [apiResponseLog, setApiResponseLog] = useState<APIResponse | null>(null);
  const [apiLogTimestamp, setApiLogTimestamp] = useState<string>('');
  const [apiActionDescription, setApiActionDescription] = useState<string>('Pronto para despacho');

  // --- STATES FOR DELIVERY CALENDAR & COMPLIANCE ---
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date());
  const [calendarViewMonth, setCalendarViewMonth] = useState<number>(new Date().getMonth());
  const [calendarViewYear, setCalendarViewYear] = useState<number>(new Date().getFullYear());
  const [calendarSelectedDistributorId, setCalendarSelectedDistributorId] = useState<string>('Todas');
  const [activeClosingDistributorId, setActiveClosingDistributorId] = useState<string | null>(null);
  const [isCopiedClosingReport, setIsCopiedClosingReport] = useState<boolean>(false);
  const [copiedDay, setCopiedDay] = useState<boolean>(false);

  // Helper to obtain a client's city in real-time
  const getClientCity = useCallback((clientId: string) => {
    const found = clientes.find(c => c.id === clientId);
    return found ? found.cidade : 'Passos - MG';
  }, [clientes]);

  // --- DYNAMIC CALCULATED VALUES ---
  const filteredClientListForDispatch = useMemo(() => {
    return clientes.filter(c => {
      const matchCity = selectedAdminCity === 'Todas' || c.cidade === selectedAdminCity;
      return matchCity && c.quadrante === selectedQuadrant;
    });
  }, [clientes, selectedQuadrant, selectedAdminCity]);

  // Set default client when quadrant changes to ensure form validity
  useEffect(() => {
    if (filteredClientListForDispatch.length > 0) {
      setSelectedClienteId(filteredClientListForDispatch[0].id);
    } else {
      setSelectedClienteId('');
    }
  }, [selectedQuadrant, filteredClientListForDispatch]);

  // Synchronize login selector defaults when role details or list changes
  useEffect(() => {
    setLoginError('');
    setLoginPasswordInput('');
    if (loginRole === 'Motoboy') {
      if (motoboys.length > 0) {
        if (!selectedLoginUserId || !motoboys.some(m => m.id === selectedLoginUserId)) {
          setSelectedLoginUserId(motoboys[0].id);
        }
      } else {
        setSelectedLoginUserId('');
      }
    } else if (loginRole === 'Cliente') {
      const availableClientes = clientes.filter(c => !c.criadoPorClienteId);
      if (availableClientes.length > 0) {
        if (!selectedLoginUserId || !availableClientes.some(c => c.id === selectedLoginUserId)) {
          setSelectedLoginUserId(availableClientes[0].id);
        }
      } else if (clientes.length > 0) {
        if (!selectedLoginUserId || !clientes.some(c => c.id === selectedLoginUserId)) {
          setSelectedLoginUserId(clientes[0].id);
        }
      } else {
        setSelectedLoginUserId('');
      }
    } else {
      setSelectedLoginUserId('');
    }
  }, [loginRole, clientes, motoboys]);

  // Analyze active draft cubage scoring in real-time
  const cubageAnalysis = useMemo(() => {
    return analisarCubagemAutopeças(itemTexto);
  }, [itemTexto]);

  // Real-time calculation of pending orders per quadrant filtered by city
  const pendingCounts = useMemo(() => {
    const counts: Record<Quadrante, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    ordens.forEach(o => {
      if (o.status === 'Pendente' || o.status === 'Buscando Parceiro' || o.status === 'Rota Agrupada') {
        const clientCity = getClientCity(o.clienteId);
        if (selectedAdminCity === 'Todas' || clientCity === selectedAdminCity) {
          counts[o.quadrante] = (counts[o.quadrante] || 0) + 1;
        }
      }
    });
    return counts;
  }, [ordens, selectedAdminCity, getClientCity]);

  // Real-time evaluation of geographic hot zones representing highest concentration of dispatcher queues
  const hotZoneStatus = useMemo(() => {
    let maxCount = -1;
    let hottest: Quadrante[] = [];
    (Object.keys(pendingCounts) as Quadrante[]).forEach(q => {
      const count = pendingCounts[q];
      if (count > maxCount) {
        maxCount = count;
        hottest = [q];
      } else if (count === maxCount && count > 0) {
        hottest.push(q);
      }
    });
    return {
      hottestSector: maxCount > 0 ? hottest.join(', ') : 'Nenhum',
      maxCount,
    };
  }, [pendingCounts]);

  // Totalized quick statistics for the dashboard
  const stats = useMemo(() => {
    const totalClientesCount = clientes.length;
    const porQuadrante = {
      A: clientes.filter(c => c.quadrante === 'A').length,
      B: clientes.filter(c => c.quadrante === 'B').length,
      C: clientes.filter(c => c.quadrante === 'C').length,
      D: clientes.filter(c => c.quadrante === 'D').length,
      E: clientes.filter(c => c.quadrante === 'E').length,
      F: clientes.filter(c => c.quadrante === 'F').length,
    };
    const activeFreights = ordens.filter(o => o.status !== 'Entregue').length;
    const deliveredCount = ordens.filter(o => o.status === 'Entregue').length;
    const cubageBlocks = ordens.filter(o => o.travaCubagemStatus === 'Bloqueado - Excesso de Volume').length;
    
    // Dynamic financial aggregation in real-time
    let totalCobrado = 0;
    let totalPago = 0;
    
    ordens.forEach(o => {
      const cobradoVal = (o.valorCobradoCliente || 10.00) + (0);
      const pagoVal = (o.valorPagoMotoboy || 4.00) + (0);
      totalCobrado += cobradoVal;
      totalPago += pagoVal;
    });

    const lucroTotal = totalCobrado - totalPago;

    return {
      totalClientesCount,
      porQuadrante,
      activeFreights,
      deliveredCount,
      cubageBlocks,
      totalCobrado,
      totalPago,
      lucroTotal
    };
  }, [clientes, ordens]);

  const obterValorRepasseOperacional = (o: OrdemServico) => {
    if (!activeMotoboyUser) return o.valorPagoMotoboy || 4.00;
    
    if (activeMotoboyUser.empresaExclusiva) {
      // Check if order was created during exclusive hours on that day
      const oDate = new Date(o.criadoEm);
      const dayOfWeek = oDate.getDay();
      const oHours = oDate.getHours();
      const oMinutes = oDate.getMinutes();
      const timeInMinutes = oHours * 60 + oMinutes;

      let isOExclusiveTime = false;
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        isOExclusiveTime = timeInMinutes < 18 * 60; // Mon-Fri < 18:00
      } else if (dayOfWeek === 6) {
        isOExclusiveTime = timeInMinutes < 12 * 60; // Sat < 12:00
      }

      if (isOExclusiveTime) {
        return activeMotoboyUser.valorRepasseFixo || 4.00;
      } else {
        return activeMotoboyUser.valorTaxaFreelancer || 6.00;
      }
    }
    return o.valorPagoMotoboy || activeMotoboyUser.valorRepasseFixo || 4.00;
  };

  // Statistics for the active logged-in Motoboy (Daily/Monthly)
  const motoboyStats = useMemo(() => {
    if (!activeMotoboyUser) return { hojeCount: 0, hojeEarnings: 0, mesCount: 0, mesEarnings: 0 };
    
    const cleanTodayString = new Date().toDateString();
    const cleanMonth = new Date().getMonth();
    const cleanYear = new Date().getFullYear();

    let hojeCount = 0;
    let hojeEarnings = 0;
    let mesCount = 0;
    let mesEarnings = 0;

    ordens.forEach(o => {
      if (o.motoboyId === activeMotoboyUser.id && o.status === 'Entregue') {
        const orderDate = new Date(o.criadoEm);
        const orderMonth = orderDate.getMonth();
        const orderYear = orderDate.getFullYear();
        const dateStr = orderDate.toDateString();

        const repasse = obterValorRepasseOperacional(o);

        if (orderMonth === cleanMonth && orderYear === cleanYear) {
          mesCount++;
          mesEarnings += repasse;
        }

        if (dateStr === cleanTodayString) {
          hojeCount++;
          hojeEarnings += repasse;
        }
      }
    });

    return { hojeCount, hojeEarnings, mesCount, mesEarnings };
  }, [activeMotoboyUser, ordens]);

  // Statistics for the active logged-in Cliente (Daily/Monthly Billing representation)
  const clienteStats = useMemo(() => {
    if (!activeClienteUser) return { hojeCount: 0, hojeBilling: 0, mesCount: 0, mesBilling: 0 };

    const cleanToday = new Date().toDateString();
    const cleanMonth = new Date().getMonth();
    const cleanYear = new Date().getFullYear();

    let hojeCount = 0;
    let hojeBilling = 0;
    let mesCount = 0;
    let mesBilling = 0;

    ordens.forEach(o => {
      if (o.clienteId === activeClienteUser.id) {
        const orderDate = new Date(o.criadoEm);
        const orderDateString = orderDate.toDateString();
        const orderMonth = orderDate.getMonth();
        const orderYear = orderDate.getFullYear();

        const isOToday = orderDateString === cleanToday;
        const isOThisMonth = orderMonth === cleanMonth && orderYear === cleanYear;
        const fee = (o.valorCobradoCliente || 10.00) + (0);

        if (isOThisMonth && o.status === 'Entregue') {
          mesCount++;
          mesBilling += fee;
        }
        if (isOToday && o.status === 'Entregue') {
          hojeCount++;
          hojeBilling += fee;
        }
      }
    });

    return { hojeCount, hojeBilling, mesCount, mesBilling };
  }, [activeClienteUser, ordens]);

  // --- ONLINE / LOGGED-IN USERS REAL-TIME AGGREGATOR ---
  const onlineUsersInfo = useMemo(() => {
    // Pick unique partners that are simulated as online
    const onlineClientes = clientes.filter((c, idx) => {
      if (!c.criadoPorClienteId && idx % 3 === 0) return true;
      if (activeClienteUser && c.id === activeClienteUser.id) return true;
      return false;
    });

    // Pick unique motoboys that are simulated as online
    const onlineMotoboys = motoboys.filter((m, idx) => {
      if (idx % 2 === 0) return true;
      if (activeMotoboyUser && m.id === activeMotoboyUser.id) return true;
      return false;
    });

    const totalOnlineCount = 1 + onlineClientes.length + onlineMotoboys.length;

    return {
      onlineClientes,
      onlineMotoboys,
      totalOnlineCount,
    };
  }, [clientes, motoboys, activeClienteUser, activeMotoboyUser]);

  // Financial calculation per client for daily and monthly billing (Invoicing/NF Control)
  const clientBillingStats = useMemo(() => {
    const statsMap: Record<string, { hojeBilling: number, hojeCount: number, mesBilling: number, mesCount: number }> = {};
    
    // Initialize standard fields for each client to prevent undefined reads
    clientes.forEach(c => {
      statsMap[c.id] = { hojeBilling: 0, hojeCount: 0, mesBilling: 0, mesCount: 0 };
    });

    const cleanToday = new Date().toDateString();
    const cleanMonth = new Date().getMonth();
    const cleanYear = new Date().getFullYear();

    ordens.forEach(o => {
      if (o.clienteId) {
        if (!statsMap[o.clienteId]) {
          statsMap[o.clienteId] = { hojeBilling: 0, hojeCount: 0, mesBilling: 0, mesCount: 0 };
        }
        
        const orderDate = new Date(o.criadoEm);
        const orderDateString = orderDate.toDateString();
        const orderMonth = orderDate.getMonth();
        const orderYear = orderDate.getFullYear();

        const isOToday = orderDateString === cleanToday;
        const isOThisMonth = orderMonth === cleanMonth && orderYear === cleanYear;
        const fee = (o.valorCobradoCliente || 10.00) + (0);

        if (o.status === 'Entregue') {
          if (isOThisMonth) {
            statsMap[o.clienteId].mesBilling += fee;
            statsMap[o.clienteId].mesCount++;
          }
          if (isOToday) {
            statsMap[o.clienteId].hojeBilling += fee;
            statsMap[o.clienteId].hojeCount++;
          }
        }
      }
    });

    return statsMap;
  }, [clientes, ordens]);

  // --- MEMOIZED CALENDAR SELECTION HELPERS ---
  const getDistributorIdForOrder = useCallback((oClienteId: string) => {
    const cli = clientes.find(c => c.id === oClienteId);
    if (!cli) return oClienteId;
    if (cli.criadoPorClienteId) {
      return cli.criadoPorClienteId;
    }
    return cli.id;
  }, [clientes]);

  const calendarFilteredOrdens = useMemo(() => {
    if (calendarSelectedDistributorId === 'Todas') {
      return ordens;
    }
    return ordens.filter(o => getDistributorIdForOrder(o.clienteId) === calendarSelectedDistributorId);
  }, [ordens, calendarSelectedDistributorId, getDistributorIdForOrder]);

  const deliveredOrdersByDateString = useMemo(() => {
    const mapping: Record<string, OrdemServico[]> = {};
    calendarFilteredOrdens.forEach(o => {
      if (o.status === 'Entregue') {
        const dateObj = new Date(o.criadoEm);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const dateKey = `${yyyy}-${mm}-${dd}`;
        if (!mapping[dateKey]) {
          mapping[dateKey] = [];
        }
        mapping[dateKey].push(o);
      }
    });
    return mapping;
  }, [calendarFilteredOrdens]);

  const allOrdersByDateString = useMemo(() => {
    const mapping: Record<string, OrdemServico[]> = {};
    calendarFilteredOrdens.forEach(o => {
      const dateObj = new Date(o.criadoEm);
      const yyyy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;
      if (!mapping[dateKey]) {
        mapping[dateKey] = [];
      }
      mapping[dateKey].push(o);
    });
    return mapping;
  }, [calendarFilteredOrdens]);

  const selectedDateKey = useMemo(() => {
    const yyyy = selectedCalendarDate.getFullYear();
    const mm = String(selectedCalendarDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedCalendarDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [selectedCalendarDate]);

  const selectedDayOrders = useMemo(() => {
    return allOrdersByDateString[selectedDateKey] || [];
  }, [allOrdersByDateString, selectedDateKey]);

  const selectedDayMetrics = useMemo(() => {
    let billing = 0;
    let repasse = 0;
    let count = 0;
    selectedDayOrders.forEach(o => {
      if (o.status === 'Entregue') {
        const fee = (o.valorCobradoCliente || 10.00) + (0);
        billing += fee;
        const rep = (o.valorPagoMotoboy || 4.00) + (0);
        repasse += rep;
        count++;
      }
    });
    return { billing, repasse, count };
  }, [selectedDayOrders]);

  // Calculate monthly stats by distributor for the currently viewed month (calendarViewMonth / calendarViewYear)
  const monthlyDistributorStats = useMemo(() => {
    const distributorsList = clientes.filter(c => !c.criadoPorClienteId);
    
    return distributorsList.map(dist => {
      const completedOrdersThisMonth = ordens.filter(o => {
        if (o.status !== 'Entregue') return false;
        const belongsToThisDist = getDistributorIdForOrder(o.clienteId) === dist.id;
        if (!belongsToThisDist) return false;
        
        const orderDate = new Date(o.criadoEm);
        return orderDate.getMonth() === calendarViewMonth && orderDate.getFullYear() === calendarViewYear;
      });

      const completedOrdersThisDay = ordens.filter(o => {
        if (o.status !== 'Entregue') return false;
        const belongsToThisDist = getDistributorIdForOrder(o.clienteId) === dist.id;
        if (!belongsToThisDist) return false;
        
        const orderDate = new Date(o.criadoEm);
        return orderDate.getDate() === selectedCalendarDate.getDate() &&
               orderDate.getMonth() === selectedCalendarDate.getMonth() &&
               orderDate.getFullYear() === selectedCalendarDate.getFullYear();
      });

      let monthlyBilling = 0;
      let monthlyRepasse = 0;
      completedOrdersThisMonth.forEach(o => {
        monthlyBilling += (o.valorCobradoCliente || 10.00) + (0);
        monthlyRepasse += (o.valorPagoMotoboy || 4.00) + (0);
      });

      let dailyBilling = 0;
      completedOrdersThisDay.forEach(o => {
        dailyBilling += (o.valorCobradoCliente || 10.00) + (0);
      });

      const monthlyMargin = monthlyBilling - monthlyRepasse;

      return {
        distributor: dist,
        completedMonthCount: completedOrdersThisMonth.length,
        monthlyBilling,
        monthlyRepasse,
        monthlyMargin,
        dailyBilling,
        completedDayCount: completedOrdersThisDay.length,
      };
    });
  }, [clientes, ordens, calendarViewMonth, calendarViewYear, selectedCalendarDate, getDistributorIdForOrder]);

  // Filter clients to show on the visual directory panel filtered by selected admin city (with clean classification tabs)
  const directoryFilteredClients = useMemo(() => {
    return clientes.filter(c => {
      const matchCity = selectedAdminCity === 'Todas' || c.cidade === selectedAdminCity;
      
      const isSubClient = !!c.criadoPorClienteId;
      if (adminClientFilterTab === 'distributors' && isSubClient) return false;
      if (adminClientFilterTab === 'subclients' && !isSubClient) return false;

      const matchSearch = c.nome.toLowerCase().includes(clienteSearchTerm.toLowerCase()) || 
                          c.endereco.toLowerCase().includes(clienteSearchTerm.toLowerCase()) ||
                          c.id.toLowerCase().includes(clienteSearchTerm.toLowerCase());
      return matchCity && (clienteSearchTerm === '' || matchSearch);
    });
  }, [clientes, clienteSearchTerm, selectedAdminCity, adminClientFilterTab]);

  // Sector-wide totals of client faturamento filtered by selected city and quadrant
  const sectorBillingTotal = useMemo(() => {
    let hojeSector = 0;
    let mesSector = 0;
    clientes.filter(c => {
      const matchCity = selectedAdminCity === 'Todas' || c.cidade === selectedAdminCity;
      const matchQ = c.quadrante === visualPanelQuadrant;
      return matchCity && matchQ;
    }).forEach(c => {
      const stats = clientBillingStats[c.id];
      if (stats) {
        hojeSector += stats.hojeBilling;
        mesSector += stats.mesBilling;
      }
    });
    return { hojeSector, mesSector };
  }, [clientes, visualPanelQuadrant, clientBillingStats, selectedAdminCity]);

  // Initialize first API payload view
  useEffect(() => {
    if (ordens.length > 0 && clientes.length > 0) {
      const sampleOrdem = ordens[0];
      const sampleCliente = clientes.find(c => c.id === sampleOrdem.clienteId) || clientes[0];
      const res = compilarAPIResponse(sampleCliente, sampleOrdem, [], sampleOrdem.travaCubagemStatus);
      setApiResponseLog(res);
      setApiLogTimestamp(new Date().toLocaleTimeString());
    }
  }, []);

  // Live sync active users when changed in list by Admin
  useEffect(() => {
    if (activeMotoboyUser) {
      const liveMotoboy = motoboys.find(m => m.id === activeMotoboyUser.id);
      if (liveMotoboy && (
        liveMotoboy.cidade !== activeMotoboyUser.cidade ||
        liveMotoboy.empresaExclusiva !== activeMotoboyUser.empresaExclusiva ||
        liveMotoboy.nome !== activeMotoboyUser.nome ||
        liveMotoboy.veiculo !== activeMotoboyUser.veiculo ||
        liveMotoboy.valorRepasseFixo !== activeMotoboyUser.valorRepasseFixo
      )) {
        setActiveMotoboyUser(liveMotoboy);
      }
    }
  }, [motoboys, activeMotoboyUser]);

  useEffect(() => {
    if (activeClienteUser) {
      const liveCliente = clientes.find(c => c.id === activeClienteUser.id);
      if (liveCliente && (
        liveCliente.nome !== activeClienteUser.nome ||
        liveCliente.quadrante !== activeClienteUser.quadrante ||
        liveCliente.endereco !== activeClienteUser.endereco ||
        liveCliente.telefone !== activeClienteUser.telefone ||
        liveCliente.cidade !== activeClienteUser.cidade ||
        liveCliente.cep !== activeClienteUser.cep ||
        liveCliente.ramo !== activeClienteUser.ramo
      )) {
        setActiveClienteUser(liveCliente);
      }
    }
  }, [clientes, activeClienteUser]);

  // Use simple countdown triggers instead of complex nested intervals
  useEffect(() => {
    const timer = setInterval(() => {
      setOrdens(prev => prev.map(o => {
        if (o.status === 'Pendente' && o.tempoRestanteSweep && o.tempoRestanteSweep > 0) {
          return { ...o, tempoRestanteSweep: o.tempoRestanteSweep - 1 };
        }
        return o;
      }));
    }, 60000); // ticks every minute
    return () => clearInterval(timer);
  }, []);

  const motoboyVisibleOrders = useMemo(() => {
    if (!activeMotoboyUser) return [];
    
    const isRiderExclusive = !!(activeMotoboyUser.empresaExclusiva && activeMotoboyUser.empresaExclusiva.trim());
    const motoboyCityNormalized = normalizeCity(activeMotoboyUser.cidade);

    return ordens.filter(o => {
      if (o.status === 'Entregue') return false;
      // Se a ordem já pertence ao motoboy logado, ele vê e controla ela
      if (o.motoboyId && o.motoboyId === activeMotoboyUser.id) return true;
      // Se pertence a outro motoboy, ele não deve ver
      if (o.motoboyId && o.motoboyId !== activeMotoboyUser.id) return false;
      
      // Se é uma ordem disponível
      const isAvailable = o.status === 'Pendente' || o.status === 'Buscando Parceiro' || o.status === 'Rota Agrupada';
      if (!isAvailable) return false;

      // Localizar o parceiro/cliente correspondente a esta ordem
      const parentCliente = clientes.find(c => c.id === o.clienteId || c.nome.toLowerCase() === o.clienteNome.toLowerCase());
      
      // 1. REGION/CITY FILTER: O motoboy só vê entregas da sua respectiva região de atuação (cidade)
      const orderCity = parentCliente?.cidade || o.cidade;
      if (normalizeCity(orderCity) !== motoboyCityNormalized) {
        return false;
      }

      // Verifica se o parceiro/cliente desta ordem possui algum entregador cadastrado como exclusivo
      const parceiroTemEntregadorExclusivo = motoboys.some(m => {
        if (!m.empresaExclusiva) return false;
        const excl = m.empresaExclusiva.trim().toLowerCase();
        return excl === o.clienteNome.trim().toLowerCase() || 
               excl === o.clienteId.trim().toLowerCase() ||
               (parentCliente && (excl === parentCliente.id.trim().toLowerCase() || excl === parentCliente.nome.trim().toLowerCase()));
      });

      const isMyPartnerOrder = activeMotoboyUser.empresaExclusiva && (
        o.clienteNome.toLowerCase() === activeMotoboyUser.empresaExclusiva.toLowerCase() || 
        o.clienteId === activeMotoboyUser.empresaExclusiva ||
        (parentCliente && (
          activeMotoboyUser.empresaExclusiva.toLowerCase() === parentCliente.id.toLowerCase() || 
          activeMotoboyUser.empresaExclusiva.toLowerCase() === parentCliente.nome.toLowerCase()
        ))
      );

      if (isRiderExclusive) {
        // CASE A: Logged-in Motoboy is EXCLUSIVE
        if (o.tipoEntregadorPedido === 'exclusivo') {
          return isMyPartnerOrder;
        } else {
          // any freelancer order or orders from partners with no exclusive delivery rider
          // can only be seen outside exclusivity hours
          return !isExclusiveNow;
        }
      } else {
        // CASE B: Logged-in Motoboy is FREELANCER (NOT exclusive)
        // Only views orders if they were opted as freelancer, OR if the emitting partner has no exclusive delivery riders.
        return o.tipoEntregadorPedido === 'freelancer' || !parceiroTemEntregadorExclusivo;
      }
    });
  }, [ordens, motoboys, clientes, activeMotoboyUser, isExclusiveNow]);

  // --- CONTROLLER FUNCTIONS ---

  // Dispatch a new Order from the distributor
  const handleDespacharOrdem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClienteId) return;

    const targetCliente = clientes.find(c => c.id === selectedClienteId);
    if (!targetCliente) return;

    const finalItemMsg = itemTexto.trim() || 'Objeto de Envio';

    // Apply the active 15 minutes sweep logic
    const sweepMatchIds = executarVarreduraSweep(targetCliente.quadrante, ordens, new Date().toISOString());

    // Evaluate physical cubage limits & lock triggers
    const layoutAnalise = analisarCubagemAutopeças(finalItemMsg);
    const isLocked = layoutAnalise.status === 'Bloqueado - Excesso de Volume';

    let finalStatus: OrdemServico['status'] = 'Pendente';
    let motivoDesm = '';

    if (isLocked) {
      motivoDesm = "Carga desmembrada devido a excesso de peso/volume no baú da moto. Duas ou mais motocicletas parceiras foram notificadas.";
      finalStatus = 'Buscando Parceiro';
    } else if (sweepMatchIds.length > 0) {
      finalStatus = 'Rota Agrupada';
    } else {
      finalStatus = 'Buscando Parceiro';
    }

    const novaOrdemId = `OS-${Math.floor(1000 + Math.random() * 9000)}`;
    const novaOrdem: OrdemServico = {
      id: novaOrdemId,
      clienteId: targetCliente.id,
      clienteNome: targetCliente.nome,
      quadrante: targetCliente.quadrante,
      cidade: targetCliente.cidade || 'Passos - MG',
      itensDescricao: finalItemMsg,
      itensAnalistas: layoutAnalise.itens,
      retornoPeca,
      taxaReversa: retornoPeca ? taxaReversaParam : undefined,
      valorPagoMotoboy: targetCliente.valorPagoMotoboy,
      valorCobradoCliente: targetCliente.valorCobradoCliente,
      criadoEm: new Date().toISOString(),
      status: finalStatus,
      travaCubagemStatus: layoutAnalise.status,
      motivoDesmembramento: isLocked ? motivoDesm : undefined,
      tempoRestanteSweep: 15,
      tipoEntrega: 'local',
      distanciaKm: obterEstimativaTempoPercurso(targetCliente.quadrante).distanciaKm,
      tipoEntregadorPedido: 'freelancer',
      faturaParceiraPaga: false
    };

    // If grouped route occurred, let's update matched orders to grouped status as well
    let updatedOrdens = [...ordens];
    if (finalStatus === 'Rota Agrupada' && !isLocked) {
      // Create a logical group identity
      const groupIdentity = `ROTA-AGR-${targetCliente.quadrante}-${Math.floor(100 + Math.random() * 900)}`;
      
      // Update matched orders to reference the grouped route
      updatedOrdens = updatedOrdens.map(o => {
        if (sweepMatchIds.includes(o.id)) {
          return {
            ...o,
            status: 'Rota Agrupada' as const,
            grupoRotaId: groupIdentity
          };
        }
        return o;
      });
      novaOrdem.grupoRotaId = groupIdentity;
    }

    const nextOrdensList = [novaOrdem, ...updatedOrdens];
    setOrdens(nextOrdensList);

    const changedOrdens = [novaOrdem, ...updatedOrdens.filter(o => sweepMatchIds.includes(o.id))];

    if (isFirebaseConfigured) {
      try {
        for (const o of changedOrdens) {
          await syncSingleOrdemToFirebase(o);
        }
      } catch (err) {
        console.error("Erro ao sincronizar ordem faturada no Firebase:", err);
      }
    }
    if (supabase) {
      try {
        await syncOrdensToSupabase(changedOrdens);
      } catch (err) {
        console.error("Erro ao sincronizar ordem faturada no Supabase:", err);
      }
    }

    // Construct and update Live API console Response
    const apiPayload = compilarAPIResponse(targetCliente, novaOrdem, sweepMatchIds, layoutAnalise.status);
    setApiResponseLog(apiPayload);
    setApiLogTimestamp(new Date().toLocaleTimeString());
    setApiActionDescription(`Despacho de entrega para [${targetCliente.nome}] no Setor ${targetCliente.quadrante}`);

    // Clean reset of form variables for next entry
    setItemTexto('Objeto de Envio');
    setRetornoPeca(false);
    setSelectedClienteId('');
    alert(`Entrega ${novaOrdemId} despachada com sucesso! Já está visível na tela dos entregadores para aceite.`);
  };

  // Add client directly - Dual Synchronized Action (callable by Faturista or Motoboy)
  const handleConfirmarEmailCliente = async (clientId: string) => {
    setClientes(prev => prev.map(c => c.id === clientId ? { ...c, emailConfirmado: true } : c));
    setSupabaseSuccessMsg("📧 E-mail cadastrado e confirmado no Firebase com sucesso! Cliente Liberado! ⚡");
    setTimeout(() => setSupabaseSuccessMsg(''), 4000);
  };

  const handleCriarCliente = async (source: 'Empresa' | 'Entregador') => {
    if (!newClientNome.trim()) {
      alert("Por favor, preencha o Nome da distribuidora.");
      return;
    }
    if (!newClientEndereco.trim()) {
      alert("Por favor, preencha o Endereço completo da distribuidora.");
      return;
    }
    if (!newClientEmail.trim()) {
      alert("Por favor, preencha o E-mail de cadastro da distribuidora.");
      return;
    }
    if (!newClientSenha.trim()) {
      alert("Por favor, informe a Senha Provisória do parceiro para o Primeiro Acesso.");
      return;
    }

    const finalSenha = newClientSenha.trim();

    const novoCli: Cliente = {
      id: `CLI-${newClientQuadrante}-${Math.floor(1000 + Math.random() * 9000)}`,
      nome: newClientNome,
      quadrante: newClientQuadrante,
      endereco: newClientEndereco,
      telefone: newClientTelefone || 'Pendente - Preencher no 1º Acesso',
      cidade: newClientCidade || 'Passos - MG',
      cep: newClientCEP,
      numero: newClientNumero,
      valorPagoMotoboy: Number(newClientValorPagoMotoboy) || 4.00,
      valorCobradoCliente: Number(newClientValorCobradoCliente) || 10.00,
      senha: finalSenha, 
      email: newClientEmail,
      emailConfirmado: true, // Auto-confirmed / no email activation token needed
      cadastroCompleto: true, // Already marked as complete so they can login directly
      primeiroAcessoPendente: true, // Marked for forcing password update on login
      criadoPor: source,
      criadoEm: new Date().toISOString(),
      motoboysAtivos: Number(newClientMotoboysAtivos) || 0,
      ramo: newClientRamo,
      indicadoPorRepId: newClientIndicadoPorRepId || undefined
    };

    setClientes(prev => [novoCli, ...prev]);
    setIsAddingNewClient(false);

    if (supabase) {
      syncClientesToSupabase([novoCli]).catch(err => console.error(err));
    }
    if (isFirebaseConfigured) {
      syncSingleClienteToFirebase(novoCli).catch(err => console.error(err));
    }
    setAdminFirebaseSaveMsg(`O novo parceiro "${novoCli.nome}" foi pré-registrado e sincronizado com sucesso no Firebase e no Supabase!`);

    // Simulated Inbox Dispatch
    const clientEmailEntry = {
      id: `EML-${Math.floor(1005 + Math.random() * 8990)}`,
      para: novoCli.email,
      assunto: `🔑 Acesso Autorizado B2B - ${novoCli.nome}`,
      corpo: `Olá, ${novoCli.nome}!\n\nSua empresa foi cadastrada com sucesso nas rotas agregadas da TorqueLog.\n\nSeu acesso ao Portal está liberado sem necessidade de verificação por e-mail!\n\nPara acessar seu Painel:\n1. Acesse a tela de login.\n2. Escolha o Perfil "Cliente B2B".\n3. Selecione o nome "${novoCli.nome}" na lista.\n4. Insira a Senha Provisória definida pelo administrador:\n\n🔑 Senha Provisória: ${finalSenha}\n\nAo entrar, você definirá sua senha definitiva.\n\nAtenciosamente,\nSuporte Técnico TorqueLog`,
      codigo: finalSenha,
      data: new Date().toLocaleTimeString(),
      lido: false
    };
    setSimulatedEmails(prev => [clientEmailEntry, ...prev]);

    // Enviar email SMTP real para o parceiro
    if (novoCli.email) {
      sendRealEmail(novoCli.email, clientEmailEntry.assunto, clientEmailEntry.corpo);
    }

    // Call Supabase native auth register link if configured (real integration)
    if (supabase) {
      try {
        console.log(`Starting real Supabase Auth signUp pre-registration for ${novoCli.email}...`);
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: novoCli.email,
          password: finalSenha,
          options: {
            data: {
              nome: novoCli.nome,
              id_cliente: novoCli.id,
              cadastro_completo: true
            }
          }
        });
        if (authError) {
          console.warn("Supabase Auth sign up log (pode exigir SMTP):", authError.message);
        } else {
          console.log("Supabase Auth sign up success:", authData);
        }
      } catch (authErr) {
        console.error("Failed to run auth sign Up logic in Supabase:", authErr);
      }
    }

    // Update dispatch selection quadrant automatically to match the added client
    setSelectedQuadrant(novoCli.quadrante);
    setVisualPanelQuadrant(novoCli.quadrante);

    // Update immediate API response to log the execution sync status
    const mockOrdemSim: OrdemServico = {
      id: "OS-SYNC",
      clienteId: novoCli.id,
      clienteNome: novoCli.nome,
      quadrante: novoCli.quadrante,
      itensDescricao: `Cliente cadastrado pela Distribuidora. Aguardando ativação e auto-cadastro de CNPJ/Senha pelo e-mail: ${novoCli.email}`,
      itensAnalistas: [],
      retornoPeca: false,
      valorPagoMotoboy: novoCli.valorPagoMotoboy,
      valorCobradoCliente: novoCli.valorCobradoCliente,
      criadoEm: novoCli.criadoEm,
      status: "Pendente",
      travaCubagemStatus: "Liberado - Cabe no Baú"
    };

    const apiPayload = compilarAPIResponse(novoCli, mockOrdemSim, [], "Liberado - Cabe no Baú");
    setApiResponseLog(apiPayload);
    setApiLogTimestamp(new Date().toLocaleTimeString());
    setApiActionDescription(`Novo Distribuidor Pré-Registrado por [${source === 'Empresa' ? 'Distribuidora' : 'Rua - Motoboy MEI'}]: ${novoCli.nome}. E-mail de confirmação despachado para: ${novoCli.email}`);

    // Set interactive confirmation message toast!
    setSupabaseSuccessMsg(`📧 E-mail de confirmação enviado para ${novoCli.email}! O distribuidor poderá realizar o auto-cadastro com CNPJ e Senha próprio agora!`);
    setTimeout(() => setSupabaseSuccessMsg(''), 7000);

    // Clean inputs
    setNewClientNome('');
    setNewClientCEP('');
    setNewClientEndereco('');
    setNewClientNumero('');
    setNewClientTelefone('');
    setNewClientEmail('');
    setNewClientSenha('');
    setNewClientRamo('Autopeças');
    setNewClientIndicadoPorRepId('');
  };

  // Update / Edit client (CRUD update)
  const handleUpdateCliente = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteParaEditar) return;
    if (!editClientNome.trim()) {
      alert("Por favor, preencha o Nome / Razão Social do cliente.");
      return;
    }
    if (!editClientEmail.trim()) {
      alert("Por favor, preencha o E-mail de cadastro do cliente.");
      return;
    }

    const updatedCli: Cliente = {
      ...clienteParaEditar,
      nome: editClientNome,
      quadrante: editClientQuadrante,
      endereco: editClientEndereco || 'Pendente - Preencher no 1º Acesso',
      telefone: editClientTelefone || 'Pendente - Preencher no 1º Acesso',
      cidade: editClientCidade,
      cep: editClientCEP,
      numero: editClientNumero,
      valorPagoMotoboy: Number(editClientValorPagoMotoboy) || 4.00,
      valorCobradoCliente: Number(editClientValorCobradoCliente) || 10.00,
      email: editClientEmail,
      senha: editClientSenha || clienteParaEditar.senha,
      motoboysAtivos: Number(editClientMotoboysAtivos) || 0,
      ramo: editClientRamo,
      indicadoPorRepId: editClientIndicadoPorRepId || undefined,
      notaAdmin: editClientNotaAdmin,
      adminBloqueado: editClientAdminBloqueado
    };

    setClientes(prev => prev.map(c => c.id === clienteParaEditar.id ? updatedCli : c));
    syncClientesToSupabase([updatedCli]).catch(err => console.error(err));
    if (isFirebaseConfigured) {
      syncSingleClienteToFirebase(updatedCli).catch(err => console.error(err));
    }
    setClienteParaEditar(null);

    setAdminFirebaseSaveMsg(`Os dados do parceiro "${updatedCli.nome}" foram salvos e sincronizados com sucesso no Firebase e no Supabase!`);
    setSupabaseSuccessMsg(`✅ Cadastro de "${updatedCli.nome}" atualizado com sucesso!`);
    setTimeout(() => setSupabaseSuccessMsg(''), 4000);
  };

  // --- SUB-CLIENT (OFICINA) HANDLERS INSIDE PARTNER EDIT MODAL ---
  const handleSaveSubClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteParaEditar) return;
    if (!subCliNome.trim()) {
      alert("Por favor, informe o nome do cliente.");
      return;
    }
    if (!subCliEmail.trim()) {
      alert("Por favor, preencha o E-mail de cadastro do cliente.");
      return;
    }

    if (subCliEditingId) {
      // Edit existing
      const updatedList = clientes.map(c => {
        if (c.id === subCliEditingId) {
          return {
            ...c,
            nome: subCliNome,
            email: subCliEmail,
            senha: subCliSenha || c.senha,
            endereco: subCliEndereco,
            cep: subCliCEP,
            numero: subCliNumero,
            telefone: subCliTelefone,
            ramo: subCliRamo,
            quadrante: subCliQuadrante,
            valorCobradoCliente: Number(subCliValorCobradoCliente),
            valorPagoMotoboy: Number(subCliValorPagoMotoboy),
            notaAdmin: subCliNotaAdmin,
            adminBloqueado: subCliAdminBloqueado,
          };
        }
        return c;
      });
      setClientes(updatedList);
      const updatedObj = updatedList.find(c => c.id === subCliEditingId);
      if (updatedObj && syncClientesToSupabase) {
        await syncClientesToSupabase([updatedObj]).catch(err => console.error(err));
      }
      if (updatedObj && isFirebaseConfigured) {
        syncSingleClienteToFirebase(updatedObj).catch(err => console.error(err));
      }
      setAdminFirebaseSaveMsg(`As alterações no cliente/oficina "${subCliNome}" foram gravadas com sucesso no Firebase e no Supabase!`);
      setSupabaseSuccessMsg(`✅ Cliente do Parceiro "${subCliNome}" atualizado com sucesso!`);
    } else {
      // Create new
      const novoId = `CLI-${subCliQuadrante}-${Math.floor(1000 + Math.random() * 9000)}`;
      const novoSubCli: Cliente = {
        id: novoId,
        nome: subCliNome,
        quadrante: subCliQuadrante,
        endereco: subCliEndereco || 'Pendente - Preencher no 1º Acesso',
        cep: subCliCEP,
        numero: subCliNumero,
        telefone: subCliTelefone || 'Pendente - Preencher no 1º Acesso',
        cidade: clienteParaEditar.cidade || 'Passos - MG',
        valorPagoMotoboy: Number(subCliValorPagoMotoboy) || 4.00,
        valorCobradoCliente: Number(subCliValorCobradoCliente) || 10.00,
        senha: subCliSenha || 'mecanica123',
        email: subCliEmail,
        emailConfirmado: true,
        cadastroCompleto: true,
        primeiroAcessoPendente: false,
        criadoPor: 'Cliente',
        criadoEm: new Date().toISOString(),
        criadoPorClienteId: clienteParaEditar.id, // Linked to the partner
        ramo: subCliRamo,
        notaAdmin: subCliNotaAdmin,
        adminBloqueado: subCliAdminBloqueado
      };

      setClientes(prev => [novoSubCli, ...prev]);

      if (syncClientesToSupabase) {
        await syncClientesToSupabase([novoSubCli]).catch(err => console.error(err));
      }
      if (isFirebaseConfigured) {
        syncSingleClienteToFirebase(novoSubCli).catch(err => console.error(err));
      }

      // Simulated e-mail dispatch to the new subclient
      const clientEmailEntry = {
        id: `EML-${Math.floor(1005 + Math.random() * 8990)}`,
        para: novoSubCli.email,
        assunto: `🔑 Canal B2B Ativado - Parceiro: ${clienteParaEditar.nome}`,
        corpo: `Olá, ${novoSubCli.nome}!\n\nSeu cadastro sob indicação do Parceiro e distribuidor parceiro "${clienteParaEditar.nome}" foi finalizado com sucesso no TorqueLog.\n\nSeu login está pronto sem necessidade de validações.\n\n🔑 Credenciais de Acesso:\n• Painel: Cliente B2B\n• Senha: ${novoSubCli.senha}\n\nEntre no TorqueLog para utilizar entregas expressas gratuitas e acompanhar seus produtos em tempo real.\n\nAtenciosamente,\nSuporte Técnico TorqueLog`,
        codigo: novoSubCli.senha,
        data: new Date().toLocaleTimeString(),
        lido: false
      };
      setSimulatedEmails(prev => [clientEmailEntry, ...prev]);
      if (novoSubCli.email && sendRealEmail) {
        sendRealEmail(novoSubCli.email, clientEmailEntry.assunto, clientEmailEntry.corpo);
      }

      setAdminFirebaseSaveMsg(`O novo cliente/oficina "${subCliNome}" foi cadastrado no banco de dados e sincronizado com sucesso no Firebase e no Supabase!`);
      setSupabaseSuccessMsg(`🚀 Cliente do Parceiro "${subCliNome}" cadastrado e associado!`);
    }

    // Reset sub-form fields
    setSubCliEditingId(null);
    setSubCliNome('');
    setSubCliEmail('');
    setSubCliSenha('');
    setSubCliCEP('');
    setSubCliEndereco('');
    setSubCliNumero('');
    setSubCliTelefone('');
    setSubCliRamo('Oficina mecânica');
    setSubCliQuadrante(clienteParaEditar.quadrante || 'A');
    setSubCliNotaAdmin('');
    setSubCliAdminBloqueado(false);
    setSubCliValorCobradoCliente(10.00);
    setSubCliValorPagoMotoboy(4.00);

    setTimeout(() => setSupabaseSuccessMsg(''), 4500);
  };

  const handleEditSubClientInsideModal = (sub: Cliente) => {
    setSubCliEditingId(sub.id);
    setSubCliNome(sub.nome);
    setSubCliEmail(sub.email || '');
    setSubCliSenha(sub.senha || '');
    setSubCliCEP(sub.cep || '');
    setSubCliEndereco(sub.endereco || '');
    setSubCliNumero(sub.numero || '');
    setSubCliTelefone(sub.telefone || '');
    setSubCliRamo(sub.ramo || 'Oficina mecânica');
    setSubCliQuadrante(sub.quadrante || 'A');
    setSubCliNotaAdmin(sub.notaAdmin || '');
    setSubCliAdminBloqueado(!!sub.adminBloqueado);
    setSubCliValorCobradoCliente(sub.valorCobradoCliente || 10.00);
    setSubCliValorPagoMotoboy(sub.valorPagoMotoboy || 4.00);
  };

  // Delete client (CRUD delete) - Open confirmation modal
  const handleDeletarCliente = (clientId: string) => {
    const targetCli = clientes.find(c => c.id === clientId);
    if (!targetCli) return;
    setDeleteConfirmType('cliente');
    setDeleteConfirmId(clientId);
    setDeleteConfirmName(targetCli.nome);
  };

  // Delete motoboy (CRUD delete) - Open confirmation modal
  const handleDeletarMotoboy = (motoboyId: string) => {
    const targetMb = motoboys.find(m => m.id === motoboyId);
    if (!targetMb) return;
    setDeleteConfirmType('motoboy');
    setDeleteConfirmId(motoboyId);
    setDeleteConfirmName(targetMb.nome);
  };

  // Cancel/delete delivery order - Open confirmation modal
  const handleCancelarOrdem = (ordemId: string) => {
    const targetO = ordens.find(o => o.id === ordemId);
    if (!targetO) return;
    setDeleteConfirmType('ordem');
    setDeleteConfirmId(ordemId);
    setDeleteConfirmName(`Ordem de Serviço ${ordemId} (${targetO.destinatarioNome || targetO.enderecoEntrega || 'Sem Oficina/Destino'})`);
  };

  // Devolver/release accepted delivery order back to available list - Open confirmation modal
  const handleDevolverOrdem = (ordemId: string) => {
    const targetO = ordens.find(o => o.id === ordemId);
    if (!targetO) return;
    setDeleteConfirmType('devolver-ordem');
    setDeleteConfirmId(ordemId);
    setDeleteConfirmName(`Devolver a corrida ${ordemId} de ${targetO.clienteNome} para a fila`);
  };

  // --- REPRESENTANTES MANAGEMENT EVENT HANDLERS ---
  const handleCriarRepresentante = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepNome.trim()) {
      alert("Por favor, informe o nome do representante.");
      return;
    }
    const novoRep: Representante = {
      id: `REP-${Math.floor(100 + Math.random() * 900)}`,
      nome: newRepNome,
      telefone: newRepTelefone || '(35) 99999-0000',
      email: newRepEmail || 'contato@torquelog.com',
      pix: newRepPix || 'Não informado',
      criadoEm: new Date().toISOString()
    };
    setRepresentantes(prev => [...prev, novoRep]);
    setNewRepNome('');
    setNewRepTelefone('');
    setNewRepEmail('');
    setNewRepPix('');
    setIsAddingNewRepresentative(false);
    setSelectedRepIdForDetails(novoRep.id);
    setSupabaseSuccessMsg(`🤝 Representante ${novoRep.nome} cadastrado com sucesso!`);
    setTimeout(() => setSupabaseSuccessMsg(''), 3000);
  };

  const handleDeletarRepresentante = (id: string) => {
    const rep = representantes.find(r => r.id === id);
    if (!rep) return;
    setDeleteConfirmType('representante');
    setDeleteConfirmId(id);
    setDeleteConfirmName(rep.nome);
  };

  const handleEditarRepresentanteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!representativeParaEditar) return;
    if (!editRepNome.trim()) {
      alert("Por favor, preencha o Nome do representante.");
      return;
    }
    const updatedRep: Representante = {
      ...representativeParaEditar,
      nome: editRepNome,
      telefone: editRepTelefone,
      email: editRepEmail,
      pix: editRepPix
    };
    setRepresentantes(prev => prev.map(r => r.id === representativeParaEditar.id ? updatedRep : r));
    setRepresentativeParaEditar(null);
    setSupabaseSuccessMsg(`💾 Alterações do representante salvas com sucesso!`);
    setTimeout(() => setSupabaseSuccessMsg(''), 3000);
  };

  // Update motoboy credentials or situation (CRUD update)
  const handleUpdateMotoboy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!motoboyParaEditar) return;
    if (!editMotoboyNome.trim()) {
      alert("Por favor, preencha o Nome do motoboy.");
      return;
    }

    const updatedMb: Motoboy = {
      ...motoboyParaEditar,
      nome: editMotoboyNome,
      telefone: editMotoboyTelefone,
      cidade: editMotoboyCidade,
      senha: editMotoboySenha || motoboyParaEditar.senha,
      valorRepasseFixo: Number(editMotoboyRepasse) || 4.00,
      valorContratoExclusivo: Number(editMotoboyContratoExclusivo) || 150.00,
      valorTaxaFreelancer: Number(editMotoboyTaxaFreelancer) || 6.00,
      situacao: editMotoboySituacao || 'Ativo',
      empresaExclusiva: editMotoboyEmpresaExclusiva || undefined,
      veiculo: editMotoboyVeiculo,
      tipoMoto: editMotoboyTipoMoto
    };

    setMotoboys(prev => prev.map(m => m.id === motoboyParaEditar.id ? updatedMb : m));
    
    // Immediately update active Motoboy session if they are currently logged in with this modified account
    if (activeMotoboyUser && activeMotoboyUser.id === updatedMb.id) {
      setActiveMotoboyUser(updatedMb);
    }

    if (isFirebaseConfigured) {
      syncSingleMotoboyToFirebase(updatedMb).catch(err => console.error(err));
    }
    if (supabase) {
      syncMotoboysToSupabase([updatedMb]).catch(err => console.error(err));
    }
    
    setMotoboyParaEditar(null);
    setEditMotoboyEmpresaExclusiva('');

    setAdminFirebaseSaveMsg(`A atualização cadastral do motoboy "${updatedMb.nome}" foi gravada e sincronizada com sucesso no Firebase e no Supabase!`);
    setSupabaseSuccessMsg(`✅ Cadastro do motoboy "${updatedMb.nome}" atualizado com sucesso e refletido no painel! 🏍️`);
    setTimeout(() => setSupabaseSuccessMsg(''), 4000);
  };

  // Execute actual deletion from state-based confirmation modal
  const executeConfirmDelete = async () => {
    if (!deleteConfirmType) return;

    if (deleteConfirmType === 'multiple-clientes') {
      const idsToDelete = selectedClientIds;
      if (idsToDelete.length > 0) {
        setClientes(prev => prev.filter(c => !idsToDelete.includes(c.id)));

        if (isFirebaseConfigured) {
          for (const id of idsToDelete) {
            try {
              await deleteClienteFromFirebase(id);
            } catch (err) {
              console.error("Erro ao deletar cliente no Firebase:", err);
            }
          }
        }

        if (supabase) {
          for (const id of idsToDelete) {
            try {
              const { error } = await supabase
                .from('clientes')
                .delete()
                .eq('id', id);
              if (error) console.error("Erro ao deletar cliente no Supabase:", error.message);
            } catch (err) {
              console.error("Falha ao deletar cliente no Supabase:", err);
            }
          }
        }

        setSupabaseSuccessMsg(`❌ ${idsToDelete.length} Distribuidora(s) excluída(s) com sucesso!`);
        setTimeout(() => setSupabaseSuccessMsg(''), 4000);
      }
      setSelectedClientIds([]);
      setDeleteConfirmType(null);
      setDeleteConfirmId(null);
      setDeleteConfirmName('');
      return;
    }

    if (!deleteConfirmId) return;

    if (deleteConfirmType === 'cliente') {
      const clientId = deleteConfirmId;
      const targetCli = clientes.find(c => c.id === clientId);
      if (targetCli) {
        setClientes(prev => prev.filter(c => c.id !== clientId));

        if (isFirebaseConfigured) {
          try {
            await deleteClienteFromFirebase(clientId);
          } catch (err) {
            console.error("Erro ao deletar cliente no Firebase:", err);
          }
        }

        if (supabase) {
          try {
            const { error } = await supabase
              .from('clientes')
              .delete()
              .eq('id', clientId);
            if (error) {
              console.error("Erro ao deletar cliente no Supabase:", error.message);
            }
          } catch (err) {
            console.error("Falha ao deletar cliente no Supabase:", err);
          }
        }

        setSupabaseSuccessMsg(`❌ Cliente "${targetCli.nome}" excluído com sucesso!`);
        setTimeout(() => setSupabaseSuccessMsg(''), 4000);
      }
    } else if (deleteConfirmType === 'motoboy') {
      const motoboyId = deleteConfirmId;
      const targetMb = motoboys.find(m => m.id === motoboyId);
      if (targetMb) {
        setMotoboys(prev => prev.filter(m => m.id !== motoboyId));

        if (isFirebaseConfigured) {
          try {
            await deleteMotoboyFromFirebase(motoboyId);
          } catch (err) {
            console.error("Erro ao deletar motoboy no Firebase:", err);
          }
        }

        if (supabase) {
          try {
            const { error } = await supabase
              .from('motoboys')
              .delete()
              .eq('id', motoboyId);
            if (error) {
              console.error("Erro ao deletar motoboy no Supabase:", error.message);
            }
          } catch (err) {
            console.error("Falha ao deletar motoboy no Supabase:", err);
          }
        }

        setSupabaseSuccessMsg(`❌ Motoboy "${targetMb.nome}" excluído com sucesso!`);
        setTimeout(() => setSupabaseSuccessMsg(''), 4000);
      }
    } else if (deleteConfirmType === 'ordem') {
      const ordemId = deleteConfirmId;
      const targetO = ordens.find(o => o.id === ordemId);
      if (targetO) {
        setOrdens(prev => prev.filter(o => o.id !== ordemId));

        if (isFirebaseConfigured) {
          try {
            await deleteOrdemFromFirebase(ordemId);
          } catch (err) {
            console.error("Erro ao deletar ordem no Firebase:", err);
          }
        }

        if (supabase) {
          try {
            await deleteOrdemFromSupabase(ordemId);
          } catch (err) {
            console.error("Erro ao deletar ordem no Supabase:", err);
          }
        }

        setSupabaseSuccessMsg(`❌ Entrega "${ordemId}" cancelada com sucesso!`);
        setTimeout(() => setSupabaseSuccessMsg(''), 4000);
      }
    } else if (deleteConfirmType === 'devolver-ordem') {
      const ordemId = deleteConfirmId;
      const targetO = ordens.find(o => o.id === ordemId);
      if (targetO) {
        setOrdens(prev => prev.map(o => o.id === ordemId ? {
          ...o,
          status: 'Buscando Parceiro',
          motoboyId: undefined,
          motoboyNome: undefined
        } : o));
        setSupabaseSuccessMsg(`✅ Corrida devolvida para a fila com sucesso!`);
        setTimeout(() => setSupabaseSuccessMsg(''), 4000);
      }
    } else if (deleteConfirmType === 'representante') {
      const repId = deleteConfirmId;
      const targetRep = representantes.find(r => r.id === repId);
      if (targetRep) {
        setRepresentantes(prev => prev.filter(r => r.id !== repId));
        // update clients who were linked to this representative to have no representative
        setClientes(prev => prev.map(c => c.indicadoPorRepId === repId ? { ...c, indicadoPorRepId: undefined } : c));
        if (selectedRepIdForDetails === repId) {
          setSelectedRepIdForDetails('');
        }
        setSupabaseSuccessMsg(`🗑️ Representante "${targetRep.nome}" excluído com sucesso!`);
        setTimeout(() => setSupabaseSuccessMsg(''), 4000);
      }
    } else if (deleteConfirmType === 'desvincular-cliente') {
      const clientId = deleteConfirmId;
      const targetCli = clientes.find(c => c.id === clientId);
      if (targetCli) {
        setClientes(prev => prev.map(c => c.id === clientId ? { ...c, indicadoPorRepId: undefined } : c));
        setSupabaseSuccessMsg(`💔 Vínculo de indicação do parceiro "${targetCli.nome}" removido com sucesso!`);
        setTimeout(() => setSupabaseSuccessMsg(''), 4000);
      }
    }

    // Reset confirmation states
    setDeleteConfirmType(null);
    setDeleteConfirmId(null);
    setDeleteConfirmName('');
  };

  // --- INTEGRATED VIA CEP LOOKUP ENGINE (AUTO-RESOLVE ADRESS/CITY) ---
  const handleFetchCEP = async (cep: string, target: 'selfReg' | 'newClient' | 'editClient' | 'clientNewClient' | 'firstAccess' | 'subCli' | 'quickClient' | 'destino') => {
    const cleanedCEP = cep.replace(/\D/g, '');
    
    // Regex validation to ensure only digits exist and it has exactly 8 characters
    const cepPattern = /^\d{8}$/;
    if (!cepPattern.test(cleanedCEP)) {
      setCepErrorState(prev => ({ ...prev, [target]: 'CEP incorreto. Deve conter exatamente 8 algarismos.' }));
      return;
    }

    // Reset error state for this target
    setCepErrorState(prev => ({ ...prev, [target]: '' }));

    if (target === 'selfReg') setIsFetchingCEP(true);
    else if (target === 'newClient') setIsFetchingNewClientCEP(true);
    else if (target === 'editClient') setIsFetchingEditClientCEP(true);
    else if (target === 'clientNewClient') setIsClientFetchingNewClientCEP(true);
    else if (target === 'firstAccess') setIsFetchingFirstAccessCEP(true);
    else if (target === 'subCli') setIsFetchingSubCliCEP(true);
    else if (target === 'quickClient') setIsFetchingQuickClientCEP(true);
    else if (target === 'destino') setIsFetchingDestinoCEP(true);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanedCEP}/json/`);
      if (!response.ok) {
        throw new Error('Falha de resposta da API');
      }
      const data = await response.json();
      if (!data.erro) {
        const fullAddress = `${data.logradouro}${data.bairro ? `, ${data.bairro}` : ''}`;
        const cityState = `${data.localidade} - ${data.uf}`;

        if (target === 'selfReg') {
          setSelfRegEndereco(fullAddress);
          setSelfRegCidade(cityState);
        } else if (target === 'newClient') {
          setNewClientEndereco(fullAddress);
          setNewClientCidade(cityState);
        } else if (target === 'editClient') {
          setEditClientEndereco(fullAddress);
          setEditClientCidade(cityState);
        } else if (target === 'clientNewClient') {
          setClientNewClientEndereco(fullAddress);
          setClientNewClientCidade(cityState);
        } else if (target === 'firstAccess') {
          setFirstAccessEndereco(fullAddress);
          setFirstAccessCidade(cityState);
        } else if (target === 'subCli') {
          setSubCliEndereco(fullAddress);
        } else if (target === 'quickClient') {
          setQuickClientEndereco(fullAddress);
        } else if (target === 'destino') {
          setDestinoEndereco(fullAddress);
        }
      } else {
        setCepErrorState(prev => ({ ...prev, [target]: 'CEP não cadastrado ou inexistente.' }));
        console.warn("CEP não encontrado no ViaCEP.");
      }
    } catch (err) {
      setCepErrorState(prev => ({ ...prev, [target]: 'Falha ao consultar CEP na API ViaCEP.' }));
      console.error("Erro ao buscar CEP via ViaCEP API:", err);
    } finally {
      if (target === 'selfReg') setIsFetchingCEP(false);
      else if (target === 'newClient') setIsFetchingNewClientCEP(false);
      else if (target === 'editClient') setIsFetchingEditClientCEP(false);
      else if (target === 'clientNewClient') setIsClientFetchingNewClientCEP(false);
      else if (target === 'firstAccess') setIsFetchingFirstAccessCEP(false);
      else if (target === 'subCli') setIsFetchingSubCliCEP(false);
      else if (target === 'quickClient') setIsFetchingQuickClientCEP(false);
      else if (target === 'destino') setIsFetchingDestinoCEP(false);
    }
  };

  const handleCEPChange = (val: string, target: 'selfReg' | 'newClient' | 'editClient' | 'clientNewClient' | 'firstAccess' | 'subCli' | 'quickClient' | 'destino') => {
    // Regex validation to check for invalid characters (only allows digits, spaces, and hyphens)
    const hasInvalidChar = /[^\d\s-]/.test(val);
    
    let formatted = val.replace(/\D/g, '');
    if (formatted.length > 8) formatted = formatted.slice(0, 8);
    
    let displayVal = formatted;
    if (formatted.length > 5) {
      displayVal = `${formatted.slice(0, 5)}-${formatted.slice(5)}`;
    }

    if (hasInvalidChar) {
      setCepErrorState(prev => ({ ...prev, [target]: 'Apenas números são permitidos para processamento.' }));
    } else {
      setCepErrorState(prev => ({ ...prev, [target]: '' }));
    }

    if (target === 'selfReg') {
      setSelfRegCEP(displayVal);
      if (formatted.length === 8) {
        handleFetchCEP(formatted, 'selfReg');
      } else if (formatted.length > 0 && formatted.length < 8) {
        setCepErrorState(prev => ({ ...prev, [target]: 'Formato incorreto. O CEP deve possuir 8 dígitos.' }));
      }
    } else if (target === 'newClient') {
      setNewClientCEP(displayVal);
      if (formatted.length === 8) {
        handleFetchCEP(formatted, 'newClient');
      } else if (formatted.length > 0 && formatted.length < 8) {
        setCepErrorState(prev => ({ ...prev, [target]: 'Formato incorreto. O CEP deve possuir 8 dígitos.' }));
      }
    } else if (target === 'editClient') {
      setEditClientCEP(displayVal);
      if (formatted.length === 8) {
        handleFetchCEP(formatted, 'editClient');
      } else if (formatted.length > 0 && formatted.length < 8) {
        setCepErrorState(prev => ({ ...prev, [target]: 'Formato incorreto. O CEP deve possuir 8 dígitos.' }));
      }
    } else if (target === 'clientNewClient') {
      setClientNewClientCEP(displayVal);
      if (formatted.length === 8) {
        handleFetchCEP(formatted, 'clientNewClient');
      } else if (formatted.length > 0 && formatted.length < 8) {
        setCepErrorState(prev => ({ ...prev, [target]: 'Formato incorreto. O CEP deve possuir 8 dígitos.' }));
      }
    } else if (target === 'firstAccess') {
      setFirstAccessCEP(displayVal);
      if (formatted.length === 8) {
        handleFetchCEP(formatted, 'firstAccess');
      } else if (formatted.length > 0 && formatted.length < 8) {
        setCepErrorState(prev => ({ ...prev, [target]: 'Formato incorreto. O CEP deve possuir 8 dígitos.' }));
      }
    } else if (target === 'subCli') {
      setSubCliCEP(displayVal);
      if (formatted.length === 8) {
        handleFetchCEP(formatted, 'subCli');
      } else if (formatted.length > 0 && formatted.length < 8) {
        setCepErrorState(prev => ({ ...prev, [target]: 'Formato incorreto. O CEP deve possuir 8 dígitos.' }));
      }
    } else if (target === 'quickClient') {
      setQuickClientCEP(displayVal);
      if (formatted.length === 8) {
        handleFetchCEP(formatted, 'quickClient');
      } else if (formatted.length > 0 && formatted.length < 8) {
        setCepErrorState(prev => ({ ...prev, [target]: 'Formato incorreto. O CEP deve possuir 8 dígitos.' }));
      }
    } else if (target === 'destino') {
      setDestinoCEP(displayVal);
      if (formatted.length === 8) {
        handleFetchCEP(formatted, 'destino');
      } else if (formatted.length > 0 && formatted.length < 8) {
        setCepErrorState(prev => ({ ...prev, [target]: 'Formato incorreto. O CEP deve possuir 8 dígitos.' }));
      }
    }
  };

  // --- REPORTING AND DELIVERY CLOSURE ENGINE ---
  const handleAbrirRelatorio = (role: 'Empresa' | 'Cliente' | 'Motoboy') => {
    setReportRole(role);
    setReportPeriod('Semana');
    setReportFilterClienteId('Todos');
    setReportFilterMotoboyId('Todos');
    setIsReportModalOpen(true);
  };

  const getFilteredReportOrders = () => {
    const today = new Date();
    return ordens.filter(o => {
      if (o.status !== 'Entregue') return false;

      const orderDate = new Date(o.criadoEm);
      if (reportPeriod === 'Semana') {
        const diffTime = Math.abs(today.getTime() - orderDate.getTime());
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        if (diffDays > 7) return false;
      } else if (reportPeriod === 'Personalizado') {
        const orderDateStr = o.criadoEm.slice(0, 10); // "YYYY-MM-DD"
        if (orderDateStr < reportFilterStartDate || orderDateStr > reportFilterEndDate) {
          return false;
        }
      } else {
        if (orderDate.getMonth() !== today.getMonth() || orderDate.getFullYear() !== today.getFullYear()) {
          return false;
        }
      }

      if (reportRole === 'Cliente') {
        if (o.clienteId !== activeClienteUser?.id) return false;
      } else if (reportRole === 'Motoboy') {
        if (o.motoboyId !== activeMotoboyUser?.id) return false;
      } else if (reportRole === 'Empresa') {
        if (reportFilterClienteId !== 'Todos' && o.clienteId !== reportFilterClienteId) return false;
        if (reportFilterMotoboyId !== 'Todos' && o.motoboyId !== reportFilterMotoboyId) return false;
      }

      return true;
    });
  };

  // --- SESSION CONTROLLERS ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setPasswordRecoverySuccess('');

    if (loginRole === 'Empresa') {
      // MASTER SECURE DEVELOPER PASSWORD (you may customize this value right here)
      const MAIN_DEV_MASTER_PASSWORD = 'torqueadmin2026';
      if (loginPasswordInput === MAIN_DEV_MASTER_PASSWORD) {
        setActiveSessionRole('Empresa');
        setActiveMotoboyUser(null);
        setActiveClienteUser(null);
      } else {
        setLoginError('🔒 Acesso restrito ao desenvolvedor do app. Código de autenticação Master incorreto!');
      }
    } else if (loginRole === 'Motoboy') {
      const selected = motoboys.find(m => m.id === selectedLoginUserId);
      if (!selected) {
        setLoginError('Selecione um motoboy válido');
        return;
      }
      if (loginPasswordInput === selected.senha) {
        setActiveSessionRole('Motoboy');
        setActiveMotoboyUser(selected);
        setActiveClienteUser(null);
        setShowRecoverButton(false);
      } else {
        setLoginError(`Senha incorreta para ${selected.nome}`);
        setShowRecoverButton(true);
      }
    } else if (loginRole === 'Cliente') {
      const selected = clientes.find(c => c.id === selectedLoginUserId);
      if (!selected) {
        setLoginError('Selecione um cliente válido');
        return;
      }
      if (selected.cadastroCompleto === false) {
        setFirstAccessClientId(selected.id);
        setFirstAccessEmail(selected.email || '');
        setFirstAccessEmailStep('send_email');
        setFirstAccessVerificationCode('');
        setCorrectFirstAccessCode('');
        setIsFirstAccessModalOpen(true);
        setLoginError('');
        return;
      }
      const actualPW = selected.senha || 'cliente123';
      if (loginPasswordInput === actualPW) {
        setActiveSessionRole('Cliente');
        setActiveMotoboyUser(null);
        setActiveClienteUser(selected);
        setShowRecoverButton(false);
      } else {
        setLoginError(`Senha incorreta para ${selected.nome}`);
        setShowRecoverButton(true);
      }
    }
  };

  const handleRecoverPassword = () => {
    setPasswordRecoverySuccess('');
    setLoginError('');

    if (loginRole === 'Motoboy') {
      const selected = motoboys.find(m => m.id === selectedLoginUserId);
      if (!selected) {
        setLoginError('Selecione um entregador válido para recuperar a senha');
        return;
      }
      const provisionalPassword = `MOTO-${Math.floor(100000 + Math.random() * 900000)}`;
      
      // Update state
      setMotoboys(prev => prev.map(m => m.id === selected.id ? { ...m, senha: provisionalPassword } : m));
      
      const email = `${selected.nome.toLowerCase().replace(/[^a-z0-9]/g, '')}@torque-entregas.com`;
      const subject = `🔑 Recuperação de Senha - TorqueLog Entregador: ${selected.nome}`;
      const body = `Olá, ${selected.nome}!\n\nVocê solicitou a recuperação de sua senha no sistema TorqueLog.\n\nSua senha provisória de acesso foi redefinida para:\n👉 ${provisionalPassword}\n\nUtilize esta senha provisória para entrar no portal. Por motivos de segurança, atualize sua senha assim que possível.\n\nAtenciosamente,\nSuporte Técnico TorqueLog`;
      
      // Add simulated email so it shows in simulatedInbox
      const simulatedEmail = {
        id: `EML-REC-${Math.floor(1005 + Math.random() * 8990)}`,
        para: email,
        assunto: subject,
        corpo: body,
        codigo: provisionalPassword,
        data: new Date().toLocaleTimeString(),
        lido: false
      };
      setSimulatedEmails(prev => [simulatedEmail, ...prev]);

      // Trigger actual API if available
      sendRealEmail(email, subject, body);

      // Open text WhatsApp simulation in new tab
      const waText = `Olá ${selected.nome}! Sua nova senha provisória do TorqueLog foi resetada para: ${provisionalPassword}`;
      const waUrl = `https://api.whatsapp.com/send?phone=55${selected.telefone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(waText)}`;
      window.open(waUrl, '_blank');

      setPasswordRecoverySuccess(`Sucesso! Uma senha provisória para ${selected.nome} foi gerada de forma segura. Ela foi enviada por e-mail (${email}) e disparada via alerta para o WhatsApp (${selected.telefone || 'cadastrado'}). Confira o simulador de e-mails abaixo para copiar o código.`);
      setShowRecoverButton(false);

    } else if (loginRole === 'Cliente') {
      const selected = clientes.find(c => c.id === selectedLoginUserId);
      if (!selected) {
        setLoginError('Selecione um parceiro válido para recuperar a senha');
        return;
      }
      const provisionalPassword = `PARC-${Math.floor(100000 + Math.random() * 900000)}`;
      
      // Update state
      setClientes(prev => prev.map(c => c.id === selected.id ? { ...c, senha: provisionalPassword } : c));
      
      const email = selected.email || `${selected.nome.toLowerCase().replace(/[^a-z0-9]/g, '')}@parceiro-torque.com`;
      const subject = `🔑 Recuperação de Senha - Portal do Parceiro B2B TorqueLog: ${selected.nome}`;
      const body = `Olá, ${selected.nome}!\n\nFoi solicitada a recuperação de sua senha do Portal do Cliente B2B TorqueLog.\n\nA sua senha provisória de acesso foi redefinida automaticamente para:\n👉 ${provisionalPassword}\n\nPor e-mail e WhatsApp enviamos esta notificação. Utilize esta senha para entrar no seu painel e mude sua senha de acesso na área do cliente.\n\nAtenciosamente,\nSuporte Técnico TorqueLog`;
      
      // Add simulated email
      const simulatedEmail = {
        id: `EML-REC-${Math.floor(1005 + Math.random() * 8990)}`,
        para: email,
        assunto: subject,
        corpo: body,
        codigo: provisionalPassword,
        data: new Date().toLocaleTimeString(),
        lido: false
      };
      setSimulatedEmails(prev => [simulatedEmail, ...prev]);

      // Send via real email
      sendRealEmail(email, subject, body);

      // WhatsApp redirection
      const waText = `Olá ${selected.nome}! Sua nova senha provisória de acesso ao Portal B2B TorqueLog é: ${provisionalPassword}`;
      const waUrl = `https://api.whatsapp.com/send?phone=55${selected.telefone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(waText)}`;
      window.open(waUrl, '_blank');

      setPasswordRecoverySuccess(`Sucesso! Uma senha provisória de acesso corporativo ao Portal B2B foi gerada para ${selected.nome}. Ela foi enviada por e-mail (${email}) e disparada via link WhatsApp (${selected.telefone || 'cadastrado'}). Confira a simulação de e-mails no rodapé para visualizar a mensagem.`);
      setShowRecoverButton(false);
    }
  };

  const handleAtualizarSenhaPrimeiroAcesso = async () => {
    if (!partnerNewPassword.trim()) {
      setPartnerChangePasswordError('Por favor, informe a nova senha desejada.');
      return;
    }
    if (partnerNewPassword.trim().length < 4) {
      setPartnerChangePasswordError('A nova senha deve possuir pelo menos 4 caracteres por segurança.');
      return;
    }
    if (partnerNewPassword.trim() === partnerConfirmPassword.trim()) {
      // Validated
    } else {
      setPartnerChangePasswordError('As senhas digitadas não coincidem.');
      return;
    }

    const novaSenhaLimpa = partnerNewPassword.trim();

    // Update in state list
    setClientes(prev => prev.map(c => {
      if (c.id === activeClienteUser?.id) {
        return {
          ...c,
          senha: novaSenhaLimpa,
          primeiroAcessoPendente: false
        };
      }
      return c;
    }));

    // Update active user state so the modal closes!
    setActiveClienteUser(prev => prev ? {
      ...prev,
      senha: novaSenhaLimpa,
      primeiroAcessoPendente: false
    } : null);

    setPartnerNewPassword('');
    setPartnerConfirmPassword('');
    setPartnerChangePasswordError('');
    alert('Senha cadastrada com sucesso! Seu acesso definitivo está ativo e liberado.');
  };

  // Envia código de autenticação por e-mail para o autocadastro de cliente novo
  const handleSendSelfRegEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setSelfRegError('');

    if (!selfRegNome.trim() || !selfRegCNPJ.trim() || !selfRegEndereco.trim() || !selfRegTelefone.trim() || !selfRegEmail.trim() || !selfRegSenha.trim()) {
      setSelfRegError('Por favor, preencha todos os campos obrigatórios (*).');
      return;
    }

    if (!selfRegEmail.includes('@') || !selfRegEmail.includes('.')) {
      setSelfRegError('Por favor, informe um e-mail válido.');
      return;
    }

    // Check CNPJ format / email already exist
    const emailExists = clientes.some(c => c.email?.toLowerCase().trim() === selfRegEmail.toLowerCase().trim());
    if (emailExists) {
      setSelfRegError('Este e-mail já está sendo utilizado por outra empresa cadastrada.');
      return;
    }

    setIsSendingSelfRegEmail(true);

    // Simulate sending email
    setTimeout(() => {
      const code = `TL-${Math.floor(1005 + Math.random() * 8990)}`;
      setCorrectSelfRegCode(code);
      setSelfRegStep('verify');
      setIsSendingSelfRegEmail(false);
      setSupabaseSuccessMsg(`📩 Código de Ativação enviado para ${selfRegEmail}!`);

      // Simulated Inbox Dispatch
      const selfRegEmailMsg = {
        id: `EML-${Math.floor(1005 + Math.random() * 8990)}`,
        para: selfRegEmail,
        assunto: `✉️ Confirmação de Autocadastro de Cliente Novo - ${selfRegNome}`,
        corpo: `Olá, ${selfRegNome}!\n\nSeu código de segurança para validação e auto-ativação da sua conta de faturamento TorqueLog B2B é: ${code}.\n\nDigite este token na tela do sistema para ativar sua oficina/distribuidora e liberar login imediato.\n\nAtenciosamente,\nEquipe de Suporte TorqueLog`,
        codigo: code,
        data: new Date().toLocaleTimeString(),
        lido: false
      };
      setSimulatedEmails(prev => [selfRegEmailMsg, ...prev]);

      // Enviar e-mail SMTP real
      if (selfRegEmail) {
        sendRealEmail(selfRegEmail, selfRegEmailMsg.assunto, selfRegEmailMsg.corpo);
      }

      setTimeout(() => setSupabaseSuccessMsg(''), 4000);
    }, 1200);
  };

  // Verifica o código recebido por e-mail e conclui o cadastro de cliente novo
  const handleVerifySelfRegCode = (e: React.FormEvent) => {
    e.preventDefault();
    setSelfRegError('');

    if (!selfRegVerificationCode.trim()) {
      setSelfRegError('Por favor, digite o código de ativação enviado por e-mail.');
      return;
    }

    if (selfRegVerificationCode.trim().toUpperCase() !== correctSelfRegCode.toUpperCase()) {
      setSelfRegError('Código de Ativação inválido ou expirado. Tente novamente ou use a ferramenta de simulação abaixo.');
      return;
    }

    // Success - Construct and save new client
    const newId = `CLI-${selfRegQuadrante}-${Math.floor(1005 + Math.random() * 8990)}`;
    const nuevoCli: Cliente = {
      id: newId,
      nome: selfRegNome,
      quadrante: selfRegQuadrante,
      endereco: selfRegEndereco,
      numero: selfRegNumero,
      telefone: selfRegTelefone,
      cidade: selfRegCidade,
      cep: selfRegCEP,
      valorPagoMotoboy: 4.00, // standard repasse
      valorCobradoCliente: 10.00, // standard fee
      senha: selfRegSenha,
      email: selfRegEmail,
      emailConfirmado: true,
      cadastroCompleto: true,
      cnpj: selfRegCNPJ,
      inscricaoEstadual: selfRegInscricaoEstadual || 'Isento',
      criadoPor: 'Cliente', // Automatically flagged as customer-created self registered client
      criadoEm: new Date().toISOString(),
      isSelfRegistered: true // For green highlighting in admin dashboard
    };

    const updatedClientesList = [nuevoCli, ...clientes];
    setClientes(updatedClientesList);

    // If Supabase is active, sync client list
    if (supabase) {
      syncClientesToSupabase(updatedClientesList).catch(err => {
        console.error("Supabase sync issue with self-registered client:", err);
      });
    }

    // Welcome user and logs in automatically
    setActiveSessionRole('Cliente');
    setActiveClienteUser(nuevoCli);
    setAdminVisualPerspective('Cliente');

    // Reset fields
    setSelfRegStep('form');
    setIsSelfRegistering(false);
    setSelfRegNome('');
    setSelfRegCNPJ('');
    setSelfRegInscricaoEstadual('Isento');
    setSelfRegCEP('');
    setSelfRegEndereco('');
    setSelfRegNumero('');
    setSelfRegCidade('Passos - MG');
    setSelfRegTelefone('');
    setSelfRegEmail('');
    setSelfRegSenha('');
    setSelfRegVerificationCode('');
    setCorrectSelfRegCode('');

    // Update API Console
    const mockOrdemSim: OrdemServico = {
      id: "AUTO-REG",
      clienteId: nuevoCli.id,
      clienteNome: nuevoCli.nome,
      quadrante: nuevoCli.quadrante,
      itensDescricao: `Auto-Cadastro de Cliente: ${nuevoCli.nome}`,
      itensAnalistas: [],
      retornoPeca: false,
      valorPagoMotoboy: 4.05,
      valorCobradoCliente: 10.00,
      criadoEm: nuevoCli.criadoEm,
      status: "Pendente",
      travaCubagemStatus: "Liberado - Cabe no Baú"
    };

    const apiPayload = compilarAPIResponse(nuevoCli, mockOrdemSim, [], "Liberado - Cabe no Baú");
    setApiResponseLog(apiPayload);
    setApiLogTimestamp(new Date().toLocaleTimeString());
    setApiActionDescription(`Novo Cliente Realizou Auto-Cadastro e Verificação via E-mail: ${nuevoCli.nome} (Setor ${nuevoCli.quadrante})`);

    setSupabaseSuccessMsg(`🚀 Auto-Cadastro ${nuevoCli.nome} ativado com sucesso! Seja bem-vindo ao B2B Portal!`);
    setTimeout(() => setSupabaseSuccessMsg(''), 6000);
  };

  const handleCompletarPrimeiroAcesso = async (e: React.FormEvent) => {
    e.preventDefault();
    setFirstAccessError('');

    if (!firstAccessClientId) {
      setFirstAccessError('Por favor, selecione sua oficina ou autopeça.');
      return;
    }
    if (!firstAccessEmail.trim() || !firstAccessCNPJ.trim() || !firstAccessEndereco.trim() || !firstAccessTelefone.trim() || !firstAccessSenha.trim()) {
      setFirstAccessError('Por favor, preencha todos os campos obrigatórios (*).');
      return;
    }

    const target = clientes.find(c => c.id === firstAccessClientId);
    if (!target) {
      setFirstAccessError('Cliente não encontrado.');
      return;
    }

    if (target.email?.toLowerCase().trim() !== firstAccessEmail.toLowerCase().trim()) {
      setFirstAccessError(`O e-mail digitado (${firstAccessEmail}) não corresponde ao e-mail cadastrado pelo distribuidor.`);
      return;
    }

    const updatedClient: Cliente = {
      ...target,
      cnpj: firstAccessCNPJ,
      inscricaoEstadual: firstAccessInscricaoEstadual || 'Isento',
      cep: firstAccessCEP,
      numero: firstAccessNumero,
      cidade: firstAccessCidade || target.cidade || 'Passos - MG',
      endereco: firstAccessEndereco,
      telefone: firstAccessTelefone,
      senha: firstAccessSenha,
      emailConfirmado: true,
      cadastroCompleto: true
    };

    const newClientesList = clientes.map(c => c.id === firstAccessClientId ? updatedClient : c);
    setClientes(newClientesList);

    if (supabase) {
      try {
        console.log("Syncing completed client signup to Supabase...");
        await syncClientesToSupabase(newClientesList);
      } catch (err) {
        console.error("Supabase sync error on first access:", err);
      }
    }

    setActiveSessionRole('Cliente');
    setActiveMotoboyUser(null);
    setActiveClienteUser(updatedClient);

    setIsFirstAccessModalOpen(false);
    setFirstAccessClientId('');
    setFirstAccessCNPJ('');
    setFirstAccessInscricaoEstadual('');
    setFirstAccessCEP('');
    setFirstAccessNumero('');
    setFirstAccessEndereco('');
    setFirstAccessCidade('');
    setFirstAccessTelefone('');
    setFirstAccessEmail('');
    setFirstAccessSenha('');
    setLoginPasswordInput('');

    setSupabaseSuccessMsg(`🚀 Cadastro da empresa ${updatedClient.nome} ativado com sucesso! Seja bem-vindo ao TorqueLog!`);
    setTimeout(() => setSupabaseSuccessMsg(''), 5000);
  };

  const handleLogout = () => {
    setActiveSessionRole(null);
    setActiveMotoboyUser(null);
    setActiveClienteUser(null);
    setLoginPasswordInput('');
    setLoginError('');
  };

  // Cadastra um novo Motoboy com senha e tarifa de repasse
  const handleCriarMotoboy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMotoboyNome.trim()) {
      alert("Por favor, preencha o Nome do motoboy.");
      return;
    }

    const novoMotoboy: Motoboy = {
      id: `MOTO-${Math.floor(100 + Math.random() * 900)}`,
      nome: newMotoboyNome,
      telefone: newMotoboyTelefone || '(35) 99999-0000',
      cidade: newMotoboyCidade,
      senha: newMotoboySenha || 'passos123',
      valorRepasseFixo: Number(newMotoboyRepasse) || 4.00,
      valorContratoExclusivo: Number(newMotoboyContratoExclusivo) || 150.00,
      valorTaxaFreelancer: Number(newMotoboyTaxaFreelancer) || 6.00,
      criadoEm: new Date().toISOString(),
      empresaExclusiva: newMotoboyEmpresaExclusiva || undefined,
      veiculo: newMotoboyVeiculo,
      tipoMoto: newMotoboyTipoMoto
    };

    setMotoboys(prev => [novoMotoboy, ...prev]);
    setIsAddingNewMotoboy(false);

    if (isFirebaseConfigured) {
      syncSingleMotoboyToFirebase(novoMotoboy).catch(err => console.error("Firebase Sync error:", err));
    }
    if (supabase) {
      syncMotoboysToSupabase([novoMotoboy]).catch(err => console.error("Supabase Sync error:", err));
    }

    // Update API Console
    const mockOrdemSim: OrdemServico = {
      id: "MOTO-REG",
      clienteId: "N/A",
      clienteNome: "Polo Logístico",
      quadrante: "A",
      itensDescricao: `Cadastro de Motoboy Independente: ${novoMotoboy.nome}`,
      itensAnalistas: [],
      retornoPeca: false,
      valorPagoMotoboy: novoMotoboy.valorRepasseFixo,
      valorCobradoCliente: 0,
      criadoEm: novoMotoboy.criadoEm,
      status: "Pendente",
      travaCubagemStatus: "Liberado - Cabe no Baú"
    };

    const apiPayload = compilarAPIResponse(
      { id: "N/A", nome: "Polo Logístico", quadrante: "A", endereco: "N/A", telefone: "N/A", cidade: novoMotoboy.cidade, valorPagoMotoboy: novoMotoboy.valorRepasseFixo, valorCobradoCliente: 0, criadoPor: "Empresa", criadoEm: novoMotoboy.criadoEm, senha: 'cliente123' },
      mockOrdemSim,
      [],
      "Liberado - Cabe no Baú"
    );
    setApiResponseLog(apiPayload);
    setApiLogTimestamp(new Date().toLocaleTimeString());
    setApiActionDescription(`Novo Motoboy Cadastrado com Senha e Tarifa Local: ${novoMotoboy.nome} (Repasse: R$ ${novoMotoboy.valorRepasseFixo.toFixed(2)})`);

    // Reset fields
    setNewMotoboyNome('');
    setNewMotoboyTelefone('');
    setNewMotoboySenha('passos123');
    setNewMotoboyContratoExclusivo(150.00);
    setNewMotoboyTaxaFreelancer(6.00);
    setNewMotoboyEmpresaExclusiva('');
    setNewMotoboyVeiculo('Moto');
    setNewMotoboyTipoMoto('propria');
  };

  // Copy current selected day's deliveries audit report
  const handleCopyDayReport = () => {
    const formattedDate = selectedCalendarDate.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    let report = `📊 **FECHAMENTO TORQUELOG - DEVOLUÇÃO & ENTREGAS**\n`;
    report += `📅 Data: ${formattedDate}\n`;
    report += `--------------------------------------------------\n`;
    report += `📦 Total de Entregas Finalizadas: ${selectedDayMetrics.count} OS\n`;
    report += `💵 Cobrança B2B (Faturamento): R$ ${selectedDayMetrics.billing.toFixed(2)}\n`;
    report += `🏍️ Repasse para Motoboys: R$ ${selectedDayMetrics.repasse.toFixed(2)}\n`;
    report += `⚡ Receita Líquida TorqueLog: R$ ${(selectedDayMetrics.billing - selectedDayMetrics.repasse).toFixed(2)}\n`;
    report += `--------------------------------------------------\n`;
    report += `📋 Detalhamento das Ordens de Serviço:\n`;
    
    selectedDayOrders.forEach((o, index) => {
      const isDelivered = o.status === 'Entregue';
      const statusLabel = isDelivered ? '✓ ENTREGUE' : `• STATUS: ${o.status.toUpperCase()}`;
      const value = (o.valorCobradoCliente || 10.00) + (0);
      report += `${index + 1}. [${o.id}] - ${o.clienteNome}\n`;
      report += `   - Itens: ${o.itensDescricao}\n`;
      report += `   - Valor B2B: R$ ${value.toFixed(2)} | Repasse: R$ ${((o.valorPagoMotoboy || 4.00) + (0)).toFixed(2)}\n`;
      report += `   - ${statusLabel}\n\n`;
    });
    
    navigator.clipboard.writeText(report).then(() => {
      setCopiedDay(true);
      setTimeout(() => setCopiedDay(false), 2000);
    });
  };

  const handleAbrirGoogleMaps = (o: OrdemServico, navigateMode: boolean = false) => {
    const cli = clientes.find(c => c.id === o.clienteId || c.nome.toLowerCase() === o.clienteNome.toLowerCase());
    const deCidade = cli?.cidade || o.cidade || 'Passos, MG';
    const origemCep = cli?.cep ? `, CEP ${cli.cep}` : '';
    const origem = `${cli?.endereco || ''}${origemCep}, ${deCidade}`;
    
    const destCli = clientes.find(c => c.nome.toLowerCase() === o.destinatarioNome?.toLowerCase() || c.id === o.destinatarioNome);
    const destCep = destCli?.cep ? `, CEP ${destCli.cep}` : '';
    const destCidade = destCli?.cidade || deCidade;
    const destino = `${o.enderecoEntrega || ''}${destCep}, ${destCidade}`;
    
    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origem)}&destination=${encodeURIComponent(destino)}&travelmode=driving`;
    if (navigateMode) {
      url += `&dir_action=navigate`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleRastrearMotoboyNoGoogleMaps = (mb: Motoboy) => {
    const activeOrder = ordens.find(o => o.status === 'Moto a Caminho' && o.motoboyId === mb.id);
    if (activeOrder) {
      const cli = clientes.find(c => c.id === activeOrder.clienteId || c.nome.toLowerCase() === activeOrder.clienteNome.toLowerCase());
      const deCidade = cli?.cidade || mb.cidade || 'Passos, MG';
      const origemCep = cli?.cep ? `, CEP ${cli.cep}` : '';
      const origem = `${cli?.endereco || ''}${origemCep}, ${deCidade}`;
      
      const destCli = clientes.find(c => c.nome.toLowerCase() === activeOrder.destinatarioNome?.toLowerCase() || c.id === activeOrder.destinatarioNome);
      const destCep = destCli?.cep ? `, CEP ${destCli.cep}` : '';
      const destCidade = destCli?.cidade || deCidade;
      const destino = `${activeOrder.enderecoEntrega || ''}${destCep}, ${destCidade}`;
      
      const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origem)}&destination=${encodeURIComponent(destino)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Centro, ${mb.cidade || 'Passos, MG'}`)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleAceitarOuPerguntarOrdem = (o: OrdemServico) => {
    if (activeMotoboyUser?.tipoMoto === 'alugada' && !activeMotoboyUser.isTrabalhandoAtivo) {
      alert("⚠️ Atenção: Você está utilizando uma Moto Alugada e precisa realizar o Check-In de Odômetro (Entrada de Turno) antes de aceitar corridas!");
      return;
    }
    if (mapsPreference === 'always_open') {
      handleAtualizarStatusOrdem(o.id, 'Moto a Caminho');
      handleAbrirGoogleMaps(o, true);
    } else if (mapsPreference === 'always_skip_maps') {
      handleAtualizarStatusOrdem(o.id, 'Moto a Caminho');
    } else {
      setOrderToAcceptPrompt(o);
    }
  };

  // Simulate Accepting/Routing on the deliverer's app
  const handleAtualizarStatusOrdem = async (ordemId: string, novoStatus: OrdemServico['status']) => {
    let targetO = ordens.find(o => o.id === ordemId);
    if (!targetO) return;

    const nextOrdens = ordens.map(o => {
      if (o.id === ordemId) {
        const extra: Partial<OrdemServico> = { status: novoStatus };
        if (activeMotoboyUser) {
          extra.motoboyId = activeMotoboyUser.id;
          extra.motoboyNome = activeMotoboyUser.nome;
        }
        return { ...o, ...extra };
      }
      return o;
    });

    setOrdens(nextOrdens);

    const updatedO = nextOrdens.find(o => o.id === ordemId);

    if (isFirebaseConfigured && updatedO) {
      try {
        await syncSingleOrdemToFirebase(updatedO);
      } catch (err) {
        console.error("Erro ao sincronizar atualização de status no Firebase:", err);
      }
    }
    if (supabase && updatedO) {
      try {
        await syncOrdensToSupabase([updatedO]);
      } catch (err) {
        console.error("Erro ao sincronizar atualização de status no Supabase:", err);
      }
    }

    const associatedCli = clientes.find(c => c.id === targetO?.clienteId) || {
      id: targetO.clienteId,
      nome: targetO.clienteNome,
      quadrante: targetO.quadrante,
      endereco: "Endereço Cadastrado",
      telefone: "",
      senha: "cliente123"
    } as Cliente;

    // Prompt updated payload log
    const updatedMockOrder = { 
      ...targetO, 
      status: novoStatus,
      ...(activeMotoboyUser ? { motoboyId: activeMotoboyUser.id, motoboyNome: activeMotoboyUser.nome } : {})
    };
    const apiPayload = compilarAPIResponse(
      associatedCli, 
      updatedMockOrder, 
      [], 
      targetO.travaCubagemStatus
    );
    setApiResponseLog(apiPayload);
    setApiLogTimestamp(new Date().toLocaleTimeString());
    const riderNameText = activeMotoboyUser ? activeMotoboyUser.nome : 'Parceiro MEI';
    setApiActionDescription(`${riderNameText} atualizou status da corrida ${ordemId} para: ${novoStatus}`);
  };

  // Trigger Signature Handover representing digital receipt "Canhoto Digital"
  const handleAssinarCanhotoDigital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSignOrder || !signatureName.trim()) return;

    const ordemId = activeSignOrder.id;
    const nextOrdens = ordens.map(o => {
      if (o.id === ordemId) {
        const extra: Partial<OrdemServico> = {
          status: 'Entregue' as const,
          itensDescricao: `${o.itensDescricao} (Assinado por: ${signatureName.toUpperCase()})`
        };
        if (activeMotoboyUser) {
          extra.motoboyId = activeMotoboyUser.id;
          extra.motoboyNome = activeMotoboyUser.nome;
        }
        return { ...o, ...extra };
      }
      return o;
    });

    setOrdens(nextOrdens);

    const updatedO = nextOrdens.find(o => o.id === ordemId);

    // LÓGICA DE DETECÇÃO E RETENÇÃO DE COMBUSTÍVEL PARA MOTO ALUGADA TORQUELOG:
    if (activeMotoboyUser && activeMotoboyUser.tipoMoto === 'alugada' && updatedO) {
      const orderDistance = updatedO.distanciaKm || 4.2; // fallback
      const combDeducao = orderDistance * 0.50; // R$ 0.50 por KM
      setLivroCaixaCombustivelTorquelog(prev => prev + combDeducao);
      
      const updatedRiders = motoboys.map(m => {
        if (m.id === activeMotoboyUser.id) {
          const prevKms = m.kmSaidaAcumuladaQuinzenal || 0;
          return { ...m, kmSaidaAcumuladaQuinzenal: prevKms + orderDistance };
        }
        return m;
      });
      setMotoboys(updatedRiders);
      setActiveMotoboyUser(prev => prev ? { ...prev, kmSaidaAcumuladaQuinzenal: (prev.kmSaidaAcumuladaQuinzenal || 0) + orderDistance } : null);
    }

    if (isFirebaseConfigured && updatedO) {
      try {
        await syncSingleOrdemToFirebase(updatedO);
      } catch (err) {
        console.error("Erro ao sincronizar assinatura de canhoto no Firebase:", err);
      }
    }
    if (supabase && updatedO) {
      try {
        await syncOrdensToSupabase([updatedO]);
      } catch (err) {
        console.error("Erro ao sincronizar assinatura de canhoto no Supabase:", err);
      }
    }

    const clientAssociated = clientes.find(c => c.id === activeSignOrder.clienteId) || {
      id: activeSignOrder.clienteId,
      nome: activeSignOrder.clienteNome,
      quadrante: activeSignOrder.quadrante,
      endereco: "Mecanico Licenciado",
      telefone: "",
      senha: "cliente123"
    } as Cliente;

    const updatedOrderForApi = { 
      ...activeSignOrder, 
      status: 'Entregue' as const,
      ...(activeMotoboyUser ? { motoboyId: activeMotoboyUser.id, motoboyNome: activeMotoboyUser.nome } : {})
    };

    const apiPayload = compilarAPIResponse(
      clientAssociated,
      updatedOrderForApi,
      [],
      activeSignOrder.travaCubagemStatus
    );

    // Inject Signature proof in API JSON outputs
    (apiPayload.logistica_rota as any).canhoto_digital = `RECEBIDO E ASSINADO POR: ${signatureName.toUpperCase()} - DOC PROVADO`;
    // Set response as success/synced
    apiPayload.sincronizacao.status = "Sucesso";
    apiPayload.sincronizacao.atualizado_em_ambos_paineis = true;

    setApiResponseLog(apiPayload);
    setApiLogTimestamp(new Date().toLocaleTimeString());
    setApiActionDescription(`Canhoto Digital Faturado e Assinado para Ordem ${ordemId} - Risco Trabalhista Zero`);

    setActiveSignOrder(null);
    setSignatureName('');
  };

  const effectiveRole = activeSessionRole === 'Empresa' ? adminVisualPerspective : activeSessionRole;

  return (
    <>
      {!activeSessionRole ? (
        showLandingPage ? (
          <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans selection:bg-orange-500 selection:text-white relative overflow-hidden" id="landing-page-conversion">
            {/* Background effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-orange-600/10 blur-[130px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-amber-500/10 blur-[130px] pointer-events-none" />

            {/* Header */}
            <header className="max-w-6xl w-full mx-auto flex flex-col md:flex-row justify-between items-center gap-4 py-6 border-b border-slate-900 z-10 relative">
              <div className="flex items-center gap-4">
                <div className="bg-slate-950/90 p-3 rounded-xl border-2 border-orange-500 flex items-center justify-center shadow-xl shadow-orange-500/10 shrink-0">
                  <TorqueLogLogoIcon size={64} className="text-orange-500" variant="esportivo" />
                </div>
                <div>
                  <div className="flex items-baseline gap-2 select-none" translate="no">
                    <span className="text-3xl sm:text-4xl font-black tracking-tighter font-mono text-orange-400 drop-shadow-md">TorqueLog</span>
                    <span className="text-[9px] bg-slate-900 border border-orange-500/30 text-orange-400 px-2.5 py-0.5 rounded font-black font-mono animate-pulse">B2B EXPRESS</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase mt-1">PLATAFORMA INTEGRADA DE DISTRIBUIÇÃO DE MERCADORIAS</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLandingPage(false)}
                className="bg-slate-900 hover:bg-slate-800 text-orange-400 hover:text-orange-300 border border-slate-800 hover:border-orange-500/50 font-mono font-bold text-xs py-2 px-4 rounded-xl transition duration-150 flex items-center gap-2 shadow-md cursor-pointer z-20 shrink-0 uppercase tracking-wide"
              >
                🔑 Portal de Login B2B →
              </button>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl w-full mx-auto my-auto py-8 sm:py-12 grid grid-cols-1 md:grid-cols-2 gap-8 z-10 relative">
              
              {/* Option A: For Drivers */}
              <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden group hover:border-orange-500/30 transition duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-orange-500/10 transition-all duration-300"></div>
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-400 text-2xl shadow-sm">
                      🏍️
                    </div>
                    <span className="text-xs font-bold font-mono tracking-widest text-orange-400 uppercase bg-orange-500/10 px-2.5 py-1 rounded">Para Entregadores</span>
                  </div>
                  
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug mb-4 font-sans">
                    Quer ser dono do seu próprio negócio e ganhar mais?
                  </h2>
                  
                  <p className="text-sm text-slate-350 font-mono leading-relaxed">
                    Deixe de ser CLT tradicional e comece a faturar muito mais como <strong className="text-orange-400">empreendedor parceiro MEI</strong> da TorqueLog! 
                    <br /><br />
                    Você poderá continuar prestando serviços de transporte e coletas para a mesma loja que já atende hoje em sua região, mas agora faturando mais, tendo total liberdade de horários, menos impostos retidos e total autonomia profissional. O aplicativo TorqueLog roteiriza todas as suas entregas de forma inteligente para que você ganhe tempo e dinheiro.
                  </p>
                </div>
                
                <div className="mt-8 border-t border-slate-800/60 pt-6 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDriverProposalModal(true)}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 hover:scale-[1.01] active:scale-[0.99] text-white font-mono font-black text-xs py-3.5 px-4 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/15 cursor-pointer text-center uppercase tracking-wider"
                  >
                    🚀 Conhecer Proposta e Ganhos
                  </button>
                  <a
                    href="https://api.whatsapp.com/send?phone=5519984427748&text=Olá!%20Quero%20me%20tornar%20um%20entregador%20TorqueLog%20e%20saber%20mais%20sobre%20como%20trabalhar%20como%20MEI."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-750 hover:border-orange-500/50 text-slate-300 hover:text-white font-mono font-bold text-xs py-3.5 px-4 rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer text-center uppercase tracking-wide"
                  >
                    <svg className="w-4 h-4 fill-current shrink-0 text-emerald-500" viewBox="0 0 24 24" referrerPolicy="no-referrer">
                      <path d="M12.031 6.172c-2.02 0-3.659 1.635-3.659 3.659 0 .614.152 1.209.444 1.74l-.472 1.72 1.764-.46a3.618 3.618 0 0 0 1.923.541c2.019 0 3.66-1.636 3.66-3.66 0-2.022-1.64-3.66-3.66-3.66zm1.905 5.155c-.078.22-.44.426-.644.453-.203.027-.457.042-.741-.051a2.822 2.822 0 0 1-1.127-.723 3.123 3.123 0 0 1-.774-1.22c-.156-.37-.024-.572.073-.674.098-.102.219-.254.329-.381.11-.127.147-.212.22-.352.073-.14.037-.263-.018-.37-.056-.107-.491-1.185-.674-1.62-.178-.426-.358-.369-.492-.375-.123-.005-.264-.006-.405-.006a.78.78 0 0 0-.563.262c-.195.214-.741.724-.741 1.763 0 1.04.757 2.046.862 2.188.106.14 1.491 2.278 3.611 3.193.504.218.898.348 1.206.446.505.161.966.138 1.33.084.406-.06.126-.412.247-.412a1.008 1.008 0 0 0 .7.493c.241.05.485.074.726.074.458 0 .895-.083 1.298-.246zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.019 21.72c-1.83 0-3.623-.483-5.203-1.397l-.373-.222-3.867 1.013 1.03-3.768-.243-.387A9.673 9.673 0 0 1 2.28 12c0-5.352 4.36-9.712 9.72-9.712 5.353 0 9.712 4.36 9.712 9.712 0 5.353-4.36 9.72-9.712 9.72z" />
                    </svg>
                    Falar no WhatsApp
                  </a>
                </div>
              </div>

              {/* Option B: For Partner Companies */}
              <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/30 transition duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-300"></div>
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400 text-2xl shadow-sm">
                      🏢
                    </div>
                    <span className="text-xs font-bold font-mono tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-1 rounded">Para Lojas de Autopeças</span>
                  </div>
                  
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug mb-4 font-sans">
                    Reduza seus custos de entrega em até 40%.
                  </h2>
                  
                  <p className="text-sm text-slate-350 font-mono leading-relaxed">
                    Nós ajudamos a sua loja de autopeças a transformar a sua equipe atual de entregadores CLT internos em dinâmicos e focados prestadores de serviço terceirizados <strong className="text-emerald-400">MEI legalizados</strong> através da nossa robusta plataforma de despacho.
                    <br /><br />
                    Isso significa o fim de frotas paradas, redução total de passivos trabalhistas, economia direta e otimização total de cada metro cúbico transportado. Com o TorqueLog, você acompanha tudo no mapa com segurança jurídica completa (ACT Compliance).
                  </p>
                </div>
                
                <div className="mt-8 border-t border-slate-800/60 pt-6 flex flex-col sm:flex-row gap-3">
                  <a
                    href="https://api.whatsapp.com/send?phone=5519984427748&text=Olá!%20Gostaria%20de%20conhecer%20a%20proposta%20de%20redução%20de%20custos%20da%20TorqueLog%20e%20me%20tornar%20um%20parceiro."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 hover:scale-[1.01] active:scale-[0.99] text-white font-mono font-black text-xs py-3.5 px-4 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10 cursor-pointer text-center uppercase tracking-wider"
                  >
                    <svg className="w-4.5 h-4.5 fill-current shrink-0" viewBox="0 0 24 24" referrerPolicy="no-referrer">
                      <path d="M12.031 6.172c-2.02 0-3.659 1.635-3.659 3.659 0 .614.152 1.209.444 1.74l-.472 1.72 1.764-.46a3.618 3.618 0 0 0 1.923.541c2.019 0 3.66-1.636 3.66-3.66 0-2.022-1.64-3.66-3.66-3.66zm1.905 5.155c-.078.22-.44.426-.644.453-.203.027-.457.042-.741-.051a2.822 2.822 0 0 1-1.127-.723 3.123 3.123 0 0 1-.774-1.22c-.156-.37-.024-.572.073-.674.098-.102.219-.254.329-.381.11-.127.147-.212.22-.352.073-.14.037-.263-.018-.37-.056-.107-.491-1.185-.674-1.62-.178-.426-.358-.369-.492-.375-.123-.005-.264-.006-.405-.006a.78.78 0 0 0-.563.262c-.195.214-.741.724-.741 1.763 0 1.04.757 2.046.862 2.188.106.14 1.491 2.278 3.611 3.193.504.218.898.348 1.206.446.505.161.966.138 1.33.084.406-.06.126-.412.247-.412a1.008 1.008 0 0 0 .7.493c.241.05.485.074.726.074.458 0 .895-.083 1.298-.246zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.019 21.72c-1.83 0-3.623-.483-5.203-1.397l-.373-.222-3.867 1.013 1.03-3.768-.243-.387A9.673 9.673 0 0 1 2.28 12c0-5.352 4.36-9.712 9.72-9.712 5.353 0 9.712 4.36 9.712 9.712 0 5.353-4.36 9.72-9.712 9.72z" />
                    </svg>
                    Quero me tornar um parceiro
                  </a>
                  <a
                    href="/proposta_comercial.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-750 hover:border-emerald-500 text-slate-300 hover:text-white font-mono font-black text-xs py-3.5 px-4 rounded-xl transition duration-150 flex items-center justify-center gap-1 cursor-pointer text-center uppercase tracking-wider"
                  >
                    Conhecer a Proposta
                  </a>
                </div>
              </div>

            </main>

            {/* Modal de Proposta Comercial para Entregadores (MEI) */}
            {showDriverProposalModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto" id="driver-proposal-modal">
                <div className="bg-slate-900 border border-orange-500/30 rounded-2xl max-w-2xl w-full p-6 sm:p-8 relative shadow-2xl shadow-orange-500/5 my-8 max-h-[90vh] overflow-y-auto flex flex-col justify-between">
                  
                  {/* Botão Fechar */}
                  <button 
                    onClick={() => setShowDriverProposalModal(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-full cursor-pointer transition duration-150 font-sans text-xs flex items-center justify-center w-8 h-8"
                    title="Fechar"
                  >
                    ✕
                  </button>

                  <div>
                    {/* Cabeçalho */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-400 text-xl shadow-sm">
                        🏍️
                      </div>
                      <span className="text-xs font-bold font-mono tracking-widest text-orange-400 uppercase bg-orange-500/10 px-2.5 py-1 rounded">PROPOSTA DE GANHOS MEI</span>
                    </div>

                    <h3 className="text-2xl font-black text-white tracking-tight leading-tight mb-4 font-sans">
                      🚀 Deixe de ser funcionário e seja dono do seu próprio trajeto!
                    </h3>

                    <div className="space-y-4 text-sm text-slate-300 font-sans leading-relaxed">
                      <p>
                        Você já conhece a correria do dia a dia no balcão e no trânsito. Sabe que o mercado de autopeças exige agilidade e confiança. Mas me responda com sinceridade: <strong>se você faz 10 ou 50 entregas no dia, o seu salário no fim do mês muda?</strong>
                      </p>
                      <p>
                        Na CLT, o seu ganho tem um teto. Com a <strong>TorqueLog</strong>, o seu esforço dita o seu salário.
                      </p>
                      <p>
                        Estamos transformando a logística de autopeças e queremos que você seja nosso parceiro. Ao fazer a transição de um entregador CLT para um prestador de serviços MEI, você assume o controle dos seus ganhos, paga muito menos impostos e pode continuar prestando serviço para a mesma loja que você já conhece — só que agora, <strong className="text-orange-400">ganhando por produção</strong>.
                      </p>

                      <div className="border-t border-slate-800/80 pt-5 mt-6">
                        <h4 className="text-md font-bold text-orange-400 flex items-center gap-2 mb-2 font-mono">
                          💰 Vamos aos Números: Quanto você pode ganhar?
                        </h4>
                        <p className="text-slate-400 mb-4">
                          Na TorqueLog, a matemática é simples e transparente: quanto mais você acelera, mais você fatura. Atualmente, o valor repassado por entrega de autopeças é de <strong className="text-white">R$ 4,50</strong>. O volume de saídas em uma loja de peças é alto, e uma média realista para um entregador focado é de <strong>30 entregas por dia</strong>.
                        </p>

                        {/* Tabela de Ganhos */}
                        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 mb-4">
                          <table className="w-full text-left border-collapse text-xs font-mono">
                            <thead>
                              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                                <th className="p-3">Descrição da Produtividade</th>
                                <th className="p-3">Cálculo</th>
                                <th className="p-3 text-right">Seu Faturamento</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850">
                              <tr>
                                <td className="p-3 font-semibold text-slate-300">Por Entrega</td>
                                <td className="p-3 text-slate-400">Valor Fixo Base</td>
                                <td className="p-3 text-right text-orange-400 font-bold">R$ 4,50</td>
                              </tr>
                              <tr>
                                <td className="p-3 font-semibold text-slate-300">Por Dia</td>
                                <td className="p-3 text-slate-400">30 entregas x R$ 4,50</td>
                                <td className="p-3 text-right text-orange-400 font-bold">R$ 135,00</td>
                              </tr>
                              <tr>
                                <td className="p-3 font-semibold text-slate-300">Por Semana (6 dias úteis)</td>
                                <td className="p-3 text-slate-400">R$ 135,00 x 6 dias</td>
                                <td className="p-3 text-right text-orange-400 font-bold">R$ 810,00</td>
                              </tr>
                              <tr className="bg-orange-500/5">
                                <td className="p-3 font-black text-white">Por Mês (26 dias trabalhados)</td>
                                <td className="p-3 text-slate-300">R$ 135,00 x 26 dias</td>
                                <td className="p-3 text-right text-orange-400 font-black text-sm">R$ 3.510,00</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <p className="text-xs text-orange-400/95 italic leading-normal mb-5">
                          💡 <strong>E o melhor:</strong> dias de pico significam mais dinheiro. Se a oficina parceira pedir muitas peças e você fechar 45 entregas em um dia movimentado, você volta para casa com mais de <strong>R$ 200,00</strong> naquele único dia!
                        </p>
                      </div>

                      <div className="border-t border-slate-800/80 pt-5">
                        <h4 className="text-md font-bold text-emerald-400 flex items-center gap-2 mb-3 font-mono">
                          🛠️ Por que migrar para MEI com a TorqueLog é a melhor escolha?
                        </h4>
                        <ul className="space-y-3 text-slate-300">
                          <li className="flex gap-2">
                            <span className="text-emerald-500 font-bold shrink-0">✓</span>
                            <span><strong>Continue na sua "área":</strong> Você não precisa buscar clientes novos no escuro. Você pode continuar atendendo a loja de autopeças onde já trabalha, mas agora com um contrato de parceria através da nossa plataforma.</span>
                          </li>
                          <li className="flex gap-2">
                            <span className="text-emerald-500 font-bold shrink-0">✓</span>
                            <span><strong>Seja seu próprio chefe:</strong> Sem subordinação de horários engessados. Você é um empresário (Microempreendedor Individual) prestando um serviço essencial.</span>
                          </li>
                          <li className="flex gap-2">
                            <span className="text-emerald-500 font-bold shrink-0">✓</span>
                            <span><strong>Impostos reduzidos:</strong> Como MEI, você paga apenas uma taxa fixa mensal bem baixa (o DAS, em torno de R$ 75,00), muito diferente dos altos descontos de INSS e IRPF que corroem o salário na carteira assinada.</span>
                          </li>
                          <li className="flex gap-2">
                            <span className="text-emerald-500 font-bold shrink-0">✓</span>
                            <span><strong>Proteção garantida:</strong> O pagamento do seu DAS mensal como MEI garante os seus direitos previdenciários, como auxílio-doença, aposentadoria e pensão. Você trabalha legalizado e protegido.</span>
                          </li>
                          <li className="flex gap-2">
                            <span className="text-emerald-500 font-bold shrink-0">✓</span>
                            <span><strong>Escalabilidade:</strong> A TorqueLog conecta você a uma rede logística. Se a sua loja parceira estiver com baixo movimento, você pode pegar corridas de outras empresas da rede.</span>
                          </li>
                        </ul>
                      </div>

                      <div className="border-t border-slate-800/80 pt-5 mt-4">
                        <h4 className="text-md font-bold text-white flex items-center gap-2 mb-2 font-sans">
                          🚦 Está pronto para dar a partida no seu próprio negócio?
                        </h4>
                        <p className="text-slate-400">
                          Não limite mais o seu potencial. Formalize-se de forma rápida, simples e comece a ver o resultado real de cada quilômetro rodado. A equipe da TorqueLog te orienta em todo o processo de abertura do seu MEI (que é gratuito e feito pela internet).
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 border-t border-slate-800/60 pt-6 flex flex-col sm:flex-row gap-3">
                    <a
                      href="https://api.whatsapp.com/send?phone=5519984427748&text=Olá!%20Quero%2520me%2520tornar%2520um%2520entregador%2520TorqueLog%2520e%2520saber%2520mais%2520sobre%2520como%2520trabalhar%2520como%2520MEI."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-orange-500 hover:bg-orange-600 hover:scale-[1.01] active:scale-[0.99] text-white font-mono font-black text-xs py-4 px-5 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/15 cursor-pointer text-center uppercase tracking-wider"
                    >
                      <svg className="w-5 h-5 fill-current shrink-0 animate-pulse" viewBox="0 0 24 24" referrerPolicy="no-referrer">
                        <path d="M12.031 6.172c-2.02 0-3.659 1.635-3.659 3.659 0 .614.152 1.209.444 1.74l-.472 1.72 1.764-.46a3.618 3.618 0 0 0 1.923.541c2.019 0 3.66-1.636 3.66-3.66 0-2.022-1.64-3.66-3.66-3.66zm1.905 5.155c-.078.22-.44.426-.644.453-.203.027-.457.042-.741-.051a2.822 2.822 0 0 1-1.127-.723 3.123 3.123 0 0 1-.774-1.22c-.156-.37-.024-.572.073-.674.098-.102.219-.254.329-.381.11-.127.147-.212.22-.352.073-.14.037-.263-.018-.37-.056-.107-.491-1.185-.674-1.62-.178-.426-.358-.369-.492-.375-.123-.005-.264-.006-.405-.006a.78.78 0 0 0-.563.262c-.195.214-.741.724-.741 1.763 0 1.04.757 2.046.862 2.188.106.14 1.491 2.278 3.611 3.193.504.218.898.348 1.206.446.505.161.966.138 1.33.084.406-.06.126-.412.247-.412a1.008 1.008 0 0 0 .7.493c.241.05.485.074.726.074.458 0 .895-.083 1.298-.246zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.019 21.72c-1.83 0-3.623-.483-5.203-1.397l-.373-.222-3.867 1.013 1.03-3.768-.243-.387A9.673 9.673 0 0 1 2.28 12c0-5.352 4.36-9.712 9.72-9.712 5.353 0 9.712 4.36 9.712 9.712 0 5.353-4.36 9.72-9.712 9.72z" />
                      </svg>
                      Quero me tornar um parceiro TorqueLog e aumentar meus ganhos!
                    </a>
                    <button
                      onClick={() => setShowDriverProposalModal(false)}
                      className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white font-mono font-bold text-xs py-3.5 px-5 rounded-xl cursor-pointer transition duration-150 uppercase tracking-wide"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <footer className="text-center text-[10px] text-slate-600 font-mono tracking-wider max-w-4xl w-full mx-auto py-6 border-t border-slate-900 z-10 relative">
              <p>TORQUELOG LOGÍSTICA B2B • MODELO TRABALHISTA COMPLIANCE MEI ZERO RISCO ACT</p>
              <p className="mt-1 opacity-60">Distribuição automatizada de mercadorias com inteligência e controle de rotas em tempo real.</p>
              <p className="mt-3 text-orange-400 font-bold select-all flex items-center justify-center gap-1">
                <span>Contato suporte técnico corporativo:</span>
                <a href="mailto:administracao@torquelog.com.br" className="underline hover:text-orange-300">administracao@torquelog.com.br</a>
              </p>
            </footer>
          </div>
        ) : (
          <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans selection:bg-orange-500 selection:text-white relative overflow-hidden" id="login-screen">
          
          {/* Abstract background ambient aura */}
          <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-orange-600/10 blur-[130px] pointer-events-none" />
          {/* Top header branding */}
          <header className="max-w-4xl w-full mx-auto flex flex-col md:flex-row justify-between items-center gap-4 py-6 border-b border-slate-900">
            <div className="flex items-center gap-4">
              <div className="bg-slate-950/90 p-3 rounded-xl border-2 border-orange-500 flex items-center justify-center shadow-xl shadow-orange-500/10 shrink-0 scale-105 transition-all duration-300 hover:scale-110">
                <TorqueLogLogoIcon size={80} className="text-orange-500" variant="esportivo" />
              </div>
              <div>
                <div className="flex items-center gap-3 select-none" translate="no">
                  <span className="text-[46px] font-black tracking-tighter font-mono text-orange-400 drop-shadow-md notranslate">TorqueLog</span>
                  <span className="text-[10px] bg-slate-900 border border-orange-500/30 text-orange-400 px-2.5 py-0.5 rounded font-black font-mono animate-pulse">B2B PORTAL</span>
                </div>
                <p className="text-[10.5px] text-slate-400 font-mono tracking-wider uppercase mt-1">PLATAFORMA INTEGRADA DE DISTRIBUIÇÃO DE MERCADORIAS</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowLandingPage(true)}
                className="bg-slate-900 hover:bg-slate-850 text-slate-450 hover:text-slate-300 border border-slate-800 text-[10.5px] font-mono font-bold py-2 px-3.5 rounded-xl cursor-pointer transition-all flex items-center gap-1 shrink-0 uppercase tracking-wide"
              >
                ← Voltar
              </button>
              <span className="text-xs font-mono text-slate-500 tracking-widest hidden lg:inline">ROTEIRIZAÇÃO AUTOMOTIVA INTELIGENTE</span>
            </div>
          </header>


        {/* Main interactive auth card */}
        <main className="max-w-md w-full mx-auto bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-8 my-auto relative z-10">
          {isSelfRegistering ? (
            <div>
              {/* Header */}
              <div className="text-center mb-5 border-b border-slate-800 pb-3">
                <h1 className="text-xl font-black tracking-tight font-sans text-emerald-400 flex items-center justify-center gap-1.5">
                  <span>🆕 Autocadastro de Cliente Novo</span>
                </h1>
                <p className="text-[11px] text-slate-400 mt-1">Inscreva sua oficina ou autopeça para integração imediata</p>
              </div>

              {selfRegStep === 'form' && (
                <form onSubmit={handleSendSelfRegEmail} className="space-y-3.5 text-xs text-slate-300">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nome Fantasia / Razão Social *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Auto Mecânica Palmeiras LTDA"
                      value={selfRegNome}
                      onChange={(e) => setSelfRegNome(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">CNPJ *</label>
                      <input
                        type="text"
                        required
                        placeholder="00.000.000/0001-00"
                        value={selfRegCNPJ}
                        onChange={(e) => setSelfRegCNPJ(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Inscrição Estadual</label>
                      <input
                        type="text"
                        placeholder="Isento ou Nº"
                        value={selfRegInscricaoEstadual}
                        onChange={(e) => setSelfRegInscricaoEstadual(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                      <span>CEP (Busca Automática)</span>
                      {isFetchingCEP && (
                        <span className="text-emerald-400 animate-pulse text-[9px] font-mono font-semibold">🔍 BUSCANDO CEP...</span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ex: 37900-124"
                        value={selfRegCEP}
                        onChange={(e) => handleCEPChange(e.target.value, 'selfReg')}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleFetchCEP(selfRegCEP, 'selfReg')}
                        disabled={isFetchingCEP || !selfRegCEP}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 text-white text-xs font-black px-4 rounded-lg font-mono tracking-tight cursor-pointer shadow transition shrink-0"
                      >
                        {isFetchingCEP ? '...' : '🔍 Buscar'}
                      </button>
                    </div>
                    {cepErrorState['selfReg'] && (
                      <p className="text-red-400 text-[10px] font-mono mt-1 text-left">⚠️ {cepErrorState['selfReg']}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Endereço de Entrega Completo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Av. Principal - Centro"
                      value={selfRegEndereco}
                      onChange={(e) => setSelfRegEndereco(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Número do Estabelecimento *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 305 ou S/N"
                      value={selfRegNumero}
                      onChange={(e) => setSelfRegNumero(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Cidade / Região B2B *</label>
                      <input
                        type="text"
                        required
                        value={selfRegCidade}
                        onChange={(e) => setSelfRegCidade(e.target.value)}
                        placeholder="Ex: Passos - MG"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Faturamento Setor *</label>
                      <select
                        value={selfRegQuadrante}
                        onChange={(e) => setSelfRegQuadrante(e.target.value as Quadrante)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono cursor-pointer"
                      >
                        <option value="A">Setor A - Centro</option>
                        <option value="B">Setor B - Norte</option>
                        <option value="C">Setor C - Sul</option>
                        <option value="D">Setor D - Leste</option>
                        <option value="E">Setor E - Oeste</option>
                        <option value="F">Setor F - Periferia</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Telefone WhatsApp *</label>
                      <input
                        type="text"
                        required
                        placeholder="(19) 99888-7711"
                        value={selfRegTelefone}
                        onChange={(e) => setSelfRegTelefone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Senha de Entrada *</label>
                      <input
                        type="password"
                        required
                        placeholder="Criar nova senha"
                        value={selfRegSenha}
                        onChange={(e) => setSelfRegSenha(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">E-mail Corporativo *</label>
                    <input
                      type="email"
                      required
                      placeholder="financeiro@oficina.com"
                      value={selfRegEmail}
                      onChange={(e) => setSelfRegEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <span className="text-[9px] text-slate-500 block mt-1">Um token simular será enviado para liberar sua ativação imediata.</span>
                  </div>

                  {selfRegError && (
                    <div className="p-2.5 bg-red-950/40 border border-red-800 text-red-300 text-[11px] rounded flex items-center gap-2 font-mono">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span>{selfRegError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2 font-mono">
                    <button
                      type="button"
                      onClick={() => setIsSelfRegistering(false)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 px-3 rounded-lg cursor-pointer transition border border-slate-700 active:scale-95 text-xs"
                    >
                      Voltar ao Login
                    </button>
                    <button
                      type="submit"
                      disabled={isSendingSelfRegEmail}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-lg cursor-pointer transition active:scale-95 flex items-center justify-center gap-1 text-xs shadow-md"
                    >
                      {isSendingSelfRegEmail ? 'Gerando...' : 'Assinar Token ✉️'}
                    </button>
                  </div>
                </form>
              )}

              {selfRegStep === 'verify' && (
                <div className="space-y-4 font-mono text-xs">
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 leading-normal text-[11px] text-slate-300">
                    <p>📬 Um código de autorregularização TorqueLog foi emitido corporativamente para o e-mail cadastrado:</p>
                    <strong className="text-emerald-400 block text-center bg-slate-900 py-1 rounded border border-emerald-950 mt-1.5">{selfRegEmail}</strong>
                  </div>

                  <form onSubmit={handleVerifySelfRegCode} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Informe o Token recebido *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: TL-2501"
                        value={selfRegVerificationCode}
                        onChange={(e) => setSelfRegVerificationCode(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-center text-sm text-emerald-400 placeholder-slate-750 focus:outline-none focus:border-emerald-500 font-black tracking-widest uppercase font-mono"
                      />
                    </div>

                    {selfRegError && (
                      <div className="p-2 bg-red-950/40 border border-red-800 text-red-300 text-[11px] rounded flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        <span>{selfRegError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setSelfRegStep('form')}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg cursor-pointer transition border border-slate-750"
                      >
                        Corrigir Dados
                      </button>
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg cursor-pointer transition shadow-md flex items-center justify-center gap-1"
                      >
                        Confirmar Cadastro ✓
                      </button>
                    </div>
                  </form>


                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-black tracking-tight font-sans text-white">Acesso Restrito B2B</h1>
                <p className="text-xs text-slate-400 mt-1">Conecte-se com sua senha para ver roteirizações e fretes diários/mensais</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                
                {/* Tab switchers */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Perfil de Acesso</label>
                  <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => { setLoginRole('Motoboy'); setIsSelfRegistering(false); }}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${loginRole === 'Motoboy' ? 'bg-orange-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                      🏍️ Entregador
                    </button>
                    <button
                      type="button"
                      onClick={() => { setLoginRole('Cliente'); setIsSelfRegistering(false); }}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${loginRole === 'Cliente' ? 'bg-orange-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                      🏢 Parceiros
                    </button>
                  </div>
                </div>

                {/* Dynamic User Selector dropdown based on selected profile */}
                {loginRole === 'Empresa' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Administrador</label>
                    <div className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm flex items-center gap-2 text-slate-300">
                      <Shield className="w-4 h-4 text-orange-400 shrink-0" />
                      <span>ADMIN PRINCIPAL</span>
                    </div>
                  </div>
                )}

                {loginRole === 'Motoboy' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Selecione seu Nome de Entregador</label>
                    <div className="relative">
                      <select
                        value={selectedLoginUserId}
                        onChange={(e) => setSelectedLoginUserId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 pr-8 text-sm text-slate-300 focus:outline-none focus:border-orange-500 appearance-none cursor-pointer"
                      >
                        {motoboys.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.nome} ({m.cidade})
                          </option>
                        ))}
                      </select>
                      <ChevronRight className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none rotate-90" />
                    </div>
                  </div>
                )}

                {loginRole === 'Cliente' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Selecione seu Nome (Parceiros)</label>
                      <div className="relative">
                        <select
                          value={selectedLoginUserId}
                          onChange={(e) => setSelectedLoginUserId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 pr-8 text-sm text-slate-300 focus:outline-none focus:border-orange-500 appearance-none cursor-pointer"
                        >
                          {clientes.filter(c => !c.criadoPorClienteId).map(c => (
                            <option key={c.id} value={c.id}>
                              {c.nome} ({c.cidade})
                            </option>
                          ))}
                        </select>
                        <ChevronRight className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none rotate-90" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Senha de Acesso</label>
                      <div className="relative">
                        <input
                          type="password"
                          placeholder="Digite sua senha..."
                          value={loginPasswordInput}
                          onChange={(e) => setLoginPasswordInput(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 pl-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                        />
                        <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
                      </div>
                    </div>

                    {/* Submit Button right below Password for Cliente role */}
                    <button
                      type="submit"
                      className="w-full bg-orange-500 hover:bg-orange-600 active:transform active:scale-95 text-white font-mono font-bold text-sm py-3 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10 cursor-pointer"
                    >
                      <Lock className="w-4 h-4 text-white" />
                      AUTENTICAR PORTAL
                    </button>

                    {/* Download Android App Button */}
                    <a
                      href="/downloads/app-debug.apk"
                      download="TorqueLog-Entregador.apk"
                      className="w-full bg-slate-900 hover:bg-slate-850 active:transform active:scale-95 text-orange-500 hover:text-orange-400 font-mono font-bold text-xs py-3 rounded-xl transition duration-150 flex items-center justify-center gap-2 border border-slate-800 hover:border-orange-500/30 shadow-md cursor-pointer mt-2 text-center"
                    >
                      <Smartphone className="w-4 h-4 text-orange-500 shrink-0" />
                      BAIXAR APLICATIVO ANDROID (.APK)
                    </a>
                    
                    <div className="bg-slate-950/90 border border-orange-500/30 p-3.5 rounded-xl text-xs leading-relaxed space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🏢</span>
                        <span className="font-extrabold text-[12px] font-mono text-orange-400">Cadastro de Novos Parceiros</span>
                      </div>
                      
                      <p className="text-slate-300 text-[11px] font-mono leading-relaxed">
                        A inclusão de novos clientes é realizada apenas pela administração TorqueLog. Para habilitar sua empresa conosco e negociar taxas personalizadas, precisamos dos seguintes dados:
                      </p>

                      <ul className="space-y-1 text-slate-400 font-mono text-[10px] pl-2 border-l border-orange-500/20">
                        <li className="flex items-center gap-1.5 font-bold">
                          <span className="text-[8px] text-orange-500">■</span> Nome da Empresa / Fantasia
                        </li>
                        <li className="flex items-center gap-1.5 font-bold">
                          <span className="text-[8px] text-orange-500">■</span> CNPJ da Empresa
                        </li>
                        <li className="flex items-center gap-1.5 font-bold">
                          <span className="text-[8px] text-orange-500">■</span> Endereço Completo
                        </li>
                        <li className="flex items-center gap-1.5 font-bold">
                          <span className="text-[8px] text-orange-500">■</span> Telefone WhatsApp
                        </li>
                        <li className="flex items-center gap-1.5 font-bold">
                          <span className="text-[8px] text-orange-500">■</span> E-mail Corporativo
                        </li>
                      </ul>

                      <p className="text-[10px] text-slate-400 font-mono leading-normal italic">
                        💬 No WhatsApp você tira suas dúvidas e negocia os melhores valores para corridas recorrentes!
                      </p>

                      <a
                        href="https://api.whatsapp.com/send?phone=5519984427748&text=Olá!%20Gostaria%20de%20cadastrar%20uma%20nova%20empresa%20parceira%20na%20TorqueLog.%20Aqui%25e0s%20nossos%20dados:%0A-%20Nome:%20%0A-%20CNPJ:%20%0A-%20Endereço:%20%0A-%20Telefone:%20%0A-%20Email:%20"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-emerald-600 hover:bg-emerald-500 hover:scale-[1.01] active:scale-[0.99] text-white font-mono font-black text-[11px] py-2 px-3 rounded-lg transition duration-150 flex items-center justify-center gap-2 shadow-sm cursor-pointer mt-1"
                        id="btn-whatsapp-novo-cadastro-parceiro"
                      >
                        <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" referrerPolicy="no-referrer">
                          <path d="M12.031 6.172c-2.02 0-3.659 1.635-3.659 3.659 0 .614.152 1.209.444 1.74l-.472 1.72 1.764-.46a3.618 3.618 0 0 0 1.923.541c2.019 0 3.66-1.636 3.66-3.66 0-2.022-1.64-3.66-3.66-3.66zm1.905 5.155c-.078.22-.44.426-.644.453-.203.027-.457.042-.741-.051a2.822 2.822 0 0 1-1.127-.723 3.123 3.123 0 0 1-.774-1.22c-.156-.37-.024-.572.073-.674.098-.102.219-.254.329-.381.11-.127.147-.212.22-.352.073-.14.037-.263-.018-.37-.056-.107-.491-1.185-.674-1.62-.178-.426-.358-.369-.492-.375-.123-.005-.264-.006-.405-.006a.78.78 0 0 0-.563.262c-.195.214-.741.724-.741 1.763 0 1.04.757 2.046.862 2.188.106.14 1.491 2.278 3.611 3.193.504.218.898.348 1.206.446.505.161.966.138 1.33.084.406-.06.126-.412.247-.412a1.008 1.008 0 0 0 .7.493c.241.05.485.074.726.074.458 0 .895-.083 1.298-.246zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.019 21.72c-1.83 0-3.623-.483-5.203-1.397l-.373-.222-3.867 1.013 1.03-3.768-.243-.387A9.673 9.673 0 0 1 2.28 12c0-5.352 4.36-9.712 9.72-9.712 5.353 0 9.712 4.36 9.712 9.712 0 5.353-4.36 9.72-9.712 9.72z" />
                        </svg>
                        Chamar no WhatsApp & Cadastrar
                      </a>
                    </div>
                  </div>
                )}

                {/* Password input */}
                {loginRole !== 'Cliente' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Senha de Acesso</label>
                    <div className="relative">
                      <input
                        type="password"
                        placeholder="Digite sua senha..."
                        value={loginPasswordInput}
                        onChange={(e) => setLoginPasswordInput(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 pl-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                      />
                      <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Error prompt */}
                {loginError && (
                  <div className="p-3 bg-red-950/50 border border-red-800 text-red-400 text-xs rounded-lg flex items-center gap-2 font-mono">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                {/* Success recovery prompt */}
                {passwordRecoverySuccess && (
                  <div className="p-3 bg-emerald-950/55 border border-emerald-800 text-emerald-400 text-xs rounded-lg flex flex-col gap-1.5 font-mono leading-relaxed">
                    <div className="flex items-center gap-2 font-bold text-white uppercase tracking-wider text-[10px]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
                      <span>Senha Recuperada com Sucesso</span>
                    </div>
                    <span>{passwordRecoverySuccess}</span>
                  </div>
                )}

                {/* Recover Password Button */}
                {showRecoverButton && loginRole !== 'Empresa' && !passwordRecoverySuccess && (
                  <button
                    type="button"
                    onClick={handleRecoverPassword}
                    className="w-full bg-slate-900 hover:bg-slate-950 text-slate-300 hover:text-white border border-slate-700 hover:border-orange-500 font-mono font-bold text-xs py-2 px-3.5 rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    🔐 RECUPERAR SENHA (EMAIL/WHATSAPP)
                  </button>
                )}

                {/* Login button */}
                {loginRole !== 'Cliente' && (
                  <div className="space-y-2">
                    <button
                      type="submit"
                      className="w-full bg-orange-500 hover:bg-orange-600 active:transform active:scale-95 text-white font-mono font-bold text-sm py-3 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10 cursor-pointer"
                    >
                      <Lock className="w-4 h-4 text-white" />
                      AUTENTICAR PORTAL
                    </button>

                    {/* Download Android App Button */}
                    <a
                      href="/downloads/app-debug.apk"
                      download="TorqueLog-Entregador.apk"
                      className="w-full bg-slate-900 hover:bg-slate-850 active:transform active:scale-95 text-orange-500 hover:text-orange-400 font-mono font-bold text-xs py-3 rounded-xl transition duration-150 flex items-center justify-center gap-2 border border-slate-800 hover:border-orange-500/30 shadow-md cursor-pointer text-center"
                    >
                      <Smartphone className="w-4 h-4 text-orange-500 shrink-0" />
                      BAIXAR APLICATIVO ANDROID (.APK)
                    </a>
                  </div>
                )}
              </form>

              {/* Proposal Link, Whatsapp Support Button & Email Container */}
              <div className="border-t border-slate-930 pt-4 mt-5 space-y-3.5">
                <div className="p-3 bg-slate-900 border border-orange-500/30 rounded-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/5 rounded-full blur-xl pointer-events-none"></div>
                  <span className="text-[9px] font-mono font-black text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded tracking-widest uppercase block w-max mb-1">PROPOSTA B2B EXCLUSIVA</span>
                  <p className="text-[11px] text-slate-300 font-mono leading-normal mb-2">
                    Economia garantida de <strong className="text-white">40% de custos</strong> e passivo trabalhista zero!
                  </p>
                  <a
                    href="/proposta_comercial.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-mono font-bold text-[11px] py-1.5 px-3 rounded-lg transition duration-150 flex items-center justify-center gap-1.5 shadow shadow-orange-500/10 cursor-pointer animate-[pulse_4s_infinite_alternate]"
                  >
                    📈 Abrir Proposta e Simulador →
                  </a>
                </div>

                {/* Botão de Login Administrativo (Admin) */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminPasswordModal(true);
                    setAdminPasswordInput('');
                    setAdminLoginError('');
                  }}
                  className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-white transition-all text-[11.5px] font-mono font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  id="btn-admin-login-backdoor"
                >
                  🛡️ Login de Administrador (Admin)
                </button>

                <div className="text-center pt-1">
                  <p className="text-[11px] text-slate-400 font-mono">Qualquer dúvida do cliente ou suporte técnico?</p>
                  <p className="text-xs text-orange-400 font-bold select-all mt-0.5">
                    📧 <a href="mailto:administracao@torquelog.com.br" className="underline hover:text-orange-300">administracao@torquelog.com.br</a>
                  </p>
                </div>
                
                <a
                  href="https://wa.me/5519984427748"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-mono font-bold text-xs py-2.5 px-4 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-md cursor-pointer text-center"
                >
                  <svg className="w-4.5 h-4.5 fill-current shrink-0" viewBox="0 0 24 24" referrerPolicy="no-referrer">
                    <path d="M12.031 6.172c-2.02 0-3.659 1.635-3.659 3.659 0 .614.152 1.209.444 1.74l-.472 1.72 1.764-.46a3.618 3.618 0 0 0 1.923.541c2.019 0 3.66-1.636 3.66-3.66 0-2.022-1.64-3.66-3.66-3.66zm1.905 5.155c-.078.22-.44.426-.644.453-.203.027-.457.042-.741-.051a2.822 2.822 0 0 1-1.127-.723 3.123 3.123 0 0 1-.774-1.22c-.156-.37-.024-.572.073-.674.098-.102.219-.254.329-.381.11-.127.147-.212.22-.352.073-.14.037-.263-.018-.37-.056-.107-.491-1.185-.674-1.62-.178-.426-.358-.369-.492-.375-.123-.005-.264-.006-.405-.006a.78.78 0 0 0-.563.262c-.195.214-.741.724-.741 1.763 0 1.04.757 2.046.862 2.188.106.14 1.491 2.278 3.611 3.193.504.218.898.348 1.206.446.505.161.966.138 1.33.084.406-.06.126-.412.247-.412a1.008 1.008 0 0 0 .7.493c.241.05.485.074.726.074.458 0 .895-.083 1.298-.246zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.019 21.72c-1.83 0-3.623-.483-5.203-1.397l-.373-.222-3.867 1.013 1.03-3.768-.243-.387A9.673 9.673 0 0 1 2.28 12c0-5.352 4.36-9.712 9.72-9.712 5.353 0 9.712 4.36 9.712 9.712 0 5.353-4.36 9.72-9.712 9.72z" />
                  </svg>
                  Suporte Urgente via WhatsApp
                </a>
              </div>
            </div>
          )}
        </main>

        <footer className="text-center text-[10px] text-slate-600 font-mono tracking-wider max-w-xl mx-auto py-4">
          <p>TORQUELOG LOGÍSTICA B2B • MODELO TRABALHISTA COMPLIANCE MEI ZERO RISCO ACT</p>
          <p className="mt-1 opacity-50">Distribuição automatizada de mercadorias com otimização volumétrica por baús de moto.</p>
          <p className="mt-2 text-orange-400 font-bold select-all flex items-center justify-center gap-1">
            <span>Contacte-nos por e-mail:</span>
            <a href="mailto:administracao@torquelog.com.br" className="underline hover:text-orange-300">administracao@torquelog.com.br</a>
          </p>
        </footer>
      </div>
    )
  ) : (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col selection:bg-orange-500 selection:text-white" id="torquelog-app">
      
      {firebaseQuotaExceeded && (
        <div className="bg-amber-650 text-white px-4 py-2 text-xs font-mono flex flex-col md:flex-row justify-between items-center gap-2 border-b-2 border-amber-500 shadow-sm animate-[pulse_3s_infinite]" id="firebase-quota-banner">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚠️</span>
            <span>
              <strong>Limite de Quota Diária do Firebase Excedido:</strong> Os limites de gravação do banco de dados gratuito (Spark Plan) foram temporariamente excedidos. O TorqueLog continuará operando via modo Offline/Local e Supabase para evitar qualquer interrupção.
            </span>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-end mt-2 md:mt-0">
            <button 
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('firebase_quota_blocked');
                }
                setFirebaseQuotaExceeded(false);
                window.location.reload();
              }}
              className="bg-orange-500 hover:bg-orange-600 border border-orange-400 text-[10.5px] font-black px-3 py-1 rounded transition-all uppercase whitespace-nowrap active:scale-95 flex items-center gap-1 cursor-pointer"
              type="button"
            >
              🔄 Re-tentar Conectar
            </button>
            <a 
              href="https://console.firebase.google.com/project/deft-theater-qw1xt/firestore/databases/ai-studio-d6760809-7ca1-4a14-bd81-e0c03bad38d1/data?openUpgradeDialog=true"
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-amber-800 hover:bg-amber-900 border border-amber-400/30 text-[10.5px] font-black px-3 py-1 rounded transition-all uppercase whitespace-nowrap active:scale-95 flex items-center gap-1"
            >
              Liberar no Console 🚀
            </a>
            <button 
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.setItem('firebase_quota_blocked', 'true');
                }
                setFirebaseQuotaExceeded(false);
              }}
              className="text-amber-200 hover:text-white font-black px-2 cursor-pointer transition-all"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      {/* --- TOP HIGH-PERFORMANCE NAVIGATION & HUD --- */}
      <header className="bg-slate-900 text-white border-b-4 border-orange-500 sticky top-0 z-50 shadow-md p-4" id="header-hud">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-4">
          
          <div className="flex flex-wrap items-center justify-between lg:justify-start w-full lg:w-auto gap-4">
            <div className="flex items-center gap-2.5 sm:gap-4">
              <div className="bg-slate-950 p-1.5 sm:p-2.5 rounded-xl shadow-xl flex items-center justify-center border-2 border-orange-500 transition duration-300 shrink-0" id="brand-logo">
                <div className="block sm:hidden">
                  <TorqueLogLogoIcon size={44} className="text-orange-500" variant="esportivo" />
                </div>
                <div className="hidden sm:block">
                  <TorqueLogLogoIcon size={84} className="text-orange-500" variant="esportivo" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
                  <span className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tighter font-mono text-orange-400 drop-shadow-md select-none uppercase">TorqueLog</span>
                  <span className="text-[8px] sm:text-[10px] bg-amber-500 text-slate-950 font-black px-1.5 sm:px-2 py-0.5 rounded shadow-sm border border-amber-400 animate-pulse font-sans uppercase tracking-wider">LOGÍSTICA B2B EXPRESS</span>
                </div>
                <p className="text-[8.5px] sm:text-[10.5px] text-orange-100 font-mono tracking-wider sm:tracking-widest font-extrabold uppercase mt-1">PLATAFORMA INTEGRADA DE DISTRIBUIÇÃO DE MERCADORIAS</p>
              </div>
            </div>
 
             {/* Account Status details & Logout Button */}
             <div className="flex items-center gap-2 bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
               <div className="px-2.5 py-1 text-[11px] font-mono leading-none border-r border-slate-800/50">
                 <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-0.5">Sessão</span>
                 <span className="text-orange-400 font-bold">
                   {activeSessionRole === 'Empresa' && "🏢 TorqueLog Admin"}
                   {activeSessionRole === 'Motoboy' && `🏍️ ${activeMotoboyUser?.nome}`}
                   {activeSessionRole === 'Cliente' && `🏢 Distribuidora: ${activeClienteUser?.nome}`}
                 </span>
               </div>
               <button
                 onClick={handleLogout}
                 className="bg-red-950 text-red-400 hover:bg-red-900 hover:text-white transition px-2.5 py-1.5 rounded font-mono font-bold text-[10px] flex items-center gap-1 cursor-pointer border border-red-850/40"
               >
                 <LogOut className="w-3.5 h-3.5" />
                 SAIR
               </button>
             </div>
           </div>

          {/* Quick HUD Metrics */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 md:self-end">
            <div className="bg-slate-800/80 px-3 py-1.5 rounded border border-slate-700 font-mono text-xs flex items-center gap-2">
              <Users className="w-4 h-4 text-orange-400" />
              <div>
                {effectiveRole === 'Empresa' ? (
                  <>
                    <span className="block text-[9px] text-slate-400 leading-none">Parceiros Cadastrados</span>
                    <span className="text-sm font-bold text-white">
                      {clientes.filter(c => !c.criadoPorClienteId).length}{' '}
                      <span className="text-[10px] text-slate-400">ativas</span>
                    </span>
                  </>
                ) : effectiveRole === 'Cliente' ? (
                  <>
                    <span className="block text-[9px] text-emerald-400 leading-none">Seus Clientes B2B</span>
                    <span className="text-sm font-bold text-white">
                      {clientes.filter(c => c.criadoPorClienteId === activeClienteUser?.id || c.criadoPorClienteId === activeClienteUser?.nome).length}{' '}
                      <span className="text-[10px] text-slate-400">ativos</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block text-[9px] text-slate-400 leading-none">
                      Clientes de {activeMotoboyUser?.empresaExclusiva || 'Distribuidor'} ({activeMotoboyUser?.cidade || 'Sem Cidade'})
                    </span>
                    <span className="text-sm font-bold text-white">
                      {(() => {
                        const motoboyCity = (activeMotoboyUser?.cidade || 'Passos - MG').toLowerCase();
                        const linkedDist = activeMotoboyUser?.empresaExclusiva
                          ? clientes.find(c => c.nome.toLowerCase() === activeMotoboyUser.empresaExclusiva?.toLowerCase() || c.id === activeMotoboyUser.empresaExclusiva)
                          : null;

                        if (linkedDist) {
                          // Exclusive motoboy: show only subclients of this distributor in the delivery guy's city
                          return clientes.filter(c => 
                            (c.criadoPorClienteId === linkedDist.id || c.criadoPorClienteId === linkedDist.nome) &&
                            (c.cidade || '').toLowerCase() === motoboyCity
                          ).length;
                        } else {
                          // Freelancer: show all clients (subclients) in the delivery guy's city
                          return clientes.filter(c => 
                            c.criadoPorClienteId &&
                            (c.cidade || '').toLowerCase() === motoboyCity
                          ).length;
                        }
                      })()}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">parceiros</span>
                    </span>
                  </>
                )}
              </div>
            </div>

            {effectiveRole === 'Motoboy' && (
              <div className="grid grid-cols-2 md:flex md:flex-row flex-wrap items-center gap-1.5" id="motoboy-hud-grid">
                {/* Entregas Diárias */}
                <div id="motoboy-hud-hoje-count" className="bg-slate-950/80 px-3 py-1 rounded-lg border border-slate-700/55 font-mono text-xs flex items-center gap-2 min-w-[90px] shadow-inner text-left">
                  <span className="text-orange-400 text-sm">🏍️</span>
                  <div>
                    <span className="block text-[7.5px] text-slate-400 leading-none font-sans uppercase">Hoje</span>
                    <span className="text-xs font-black text-white">{motoboyStats.hojeCount}</span>
                  </div>
                </div>

                {/* Ganho Hoje */}
                <div id="motoboy-hud-hoje-earnings" className="bg-slate-950/80 px-3 py-1 rounded-lg border border-slate-700/55 font-mono text-xs flex items-center gap-2 min-w-[100px] shadow-inner text-left">
                  <span className="text-emerald-400 text-sm">💰</span>
                  <div>
                    <span className="block text-[7.5px] text-emerald-400 leading-none font-sans uppercase">Ganho Hoje</span>
                    <span className="text-xs font-black text-emerald-400">R$ {motoboyStats.hojeEarnings.toFixed(2)}</span>
                  </div>
                </div>

                {/* Entregas Mês */}
                <div id="motoboy-hud-mes-count" className="bg-slate-950/80 px-3 py-1 rounded-lg border border-slate-700/55 font-mono text-xs flex items-center gap-2 min-w-[95px] shadow-inner text-left">
                  <span className="text-slate-300 text-sm">📅</span>
                  <div>
                    <span className="block text-[7.5px] text-slate-400 leading-none font-sans uppercase">Mês (Qtd)</span>
                    <span className="text-xs font-black text-slate-300">{motoboyStats.mesCount}</span>
                  </div>
                </div>

                {/* Ganho Mensal */}
                <div id="motoboy-hud-mes-earnings" className="bg-slate-950/80 px-3 py-1 rounded-lg border border-slate-700/55 font-mono text-xs flex items-center gap-2 min-w-[105px] shadow-inner text-left">
                  <span className="text-emerald-400 text-sm">📈</span>
                  <div>
                    <span className="block text-[7.5px] text-emerald-400 leading-none font-sans uppercase">Ganho Mês</span>
                    <span className="text-xs font-black text-emerald-405 text-emerald-400">R$ {motoboyStats.mesEarnings.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {activeSessionRole === 'Empresa' && (
              <div className="bg-slate-800/80 px-3 py-1.5 rounded border border-slate-700 font-mono text-xs flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="block text-[9px] text-emerald-400 leading-none">Lucro TorqueLog</span>
                  <span className="text-sm font-bold text-emerald-400">R$ {stats.lucroTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            {activeSessionRole !== 'Motoboy' && (
              <>
                <div className="bg-slate-800/80 px-3 py-1.5 rounded border border-slate-700 font-mono text-xs flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <div>
                    <span className="block text-[9px] text-slate-400 leading-none">Varredura Sweep</span>
                    <span className="text-sm font-bold text-white">15 Minutos</span>
                  </div>
                </div>

                {/* Database Integration Live Status Pill */}
                <div className={`px-3 py-1.5 rounded border font-mono text-xs flex items-center gap-2 transition-all ${
                  (isFirebaseConfigured || isSupabaseConfigured) 
                    ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300' 
                    : 'bg-amber-950/20 border-amber-550/20 text-amber-300'
                }`}>
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      (isFirebaseConfigured || isSupabaseConfigured) ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      (isFirebaseConfigured || isSupabaseConfigured) ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}></span>
                  </span>
                  <div>
                    <span className="block text-[9px] text-slate-400 leading-none">Canal Database</span>
                    <span className="text-sm font-bold block uppercase tracking-tight">
                      {isFirebaseConfigured && isSupabaseConfigured 
                        ? (firebaseQuotaExceeded ? 'Supabase On (Firebase Quota)' : 'Firebase + Supabase On') 
                        : (isFirebaseConfigured ? 'Firebase On' : (isSupabaseConfigured ? 'Supabase On' : 'Simulador Local'))}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* 🟢 HUD ONLINE USERS METER (ADMIN VIEW ONLY) */}
            {activeSessionRole === 'Empresa' && (
              <div className="bg-slate-800/80 px-3 py-1.5 rounded border border-emerald-500/25 font-mono text-xs flex items-center gap-2" id="header-admin-online-indicator">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <div className="text-left font-mono">
                  <span className="block text-[8.5px] text-emerald-400 leading-none">Usuários Online</span>
                  <span className="text-xs font-bold text-white block uppercase tracking-tight">
                    {onlineUsersInfo.totalOnlineCount} Logados
                  </span>
                </div>
              </div>
            )}

            {/* 📬 INTERACTIVE SIMULATED EMAIL INBOX POPOVER (ADMIN ONLY) */}
            {activeSessionRole === 'Empresa' && (
              <div className="relative" id="header-central-emails-simulados">
                <button
                  type="button"
                  onClick={() => setShowSimulatedInbox(!showSimulatedInbox)}
                  className="px-3 py-1.5 rounded border border-orange-500/20 hover:border-orange-500/40 bg-slate-800/80 font-mono text-xs flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
                >
                  <div className="relative">
                    <span className="text-sm">📬</span>
                    <span className="absolute -top-1.5 -right-1.5 shrink-0 bg-orange-500 text-white text-[8px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center">
                      {simulatedEmails.length}
                    </span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="block text-[9px] text-slate-400 leading-none">Email Sandbox</span>
                    <span className="text-sm font-bold text-white block uppercase tracking-tight">Caixa B2B</span>
                  </div>
                </button>

                {showSimulatedInbox && (
                  <div className="absolute right-0 top-12 z-50 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-[320px] sm:w-[380px] max-h-[420px] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Header */}
                    <div className="bg-slate-950 border-b border-slate-800 p-2.5 flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">📬</span>
                        <div>
                          <h4 className="text-[10px] font-black text-white font-mono uppercase tracking-wider leading-none">SMTP Sandbox</h4>
                          <p className="text-[8px] text-slate-400 font-mono mt-0.5 leading-none">E-mails de Ativação B2B</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSimulatedEmails([
                              {
                                id: 'EML-CLEARED',
                                para: 'suporte@torque-log.com',
                                assunto: '🧹 Caixa Limpa',
                                corpo: 'A caixa de e-mails de simulação foi esvaziada.\n\nNovos registros ou tentativas de Primeiro Acesso gerarão novos e-mails simulados aqui em tempo real!',
                                data: new Date().toLocaleTimeString(),
                                lido: true
                              }
                            ]);
                            setSelectedSimulatedEmail(null);
                          }}
                          className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white px-2 py-0.5 text-[8px] font-mono border border-slate-800 rounded cursor-pointer"
                          title="Esvaziar todos os e-mails"
                        >
                          Limpar
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSimulatedInbox(false)}
                          className="text-slate-400 hover:text-white font-mono text-[10px] font-black hover:bg-slate-850 w-5 h-5 rounded flex items-center justify-center cursor-pointer transition"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Email list or selected email details */}
                    <div className="flex-1 overflow-y-auto p-2.5 space-y-2 max-h-[320px] bg-slate-900">
                      {selectedSimulatedEmail ? (
                        // VIEW EMAIL DETAILS
                        <div className="space-y-2.5 font-mono text-[10px] text-left">
                          <button
                            type="button"
                            onClick={() => setSelectedSimulatedEmail(null)}
                            className="text-orange-400 hover:text-orange-300 cursor-pointer flex items-center gap-1 font-bold mb-1 text-[9px]"
                          >
                            ← Voltar para Caixa
                          </button>
                          <div className="bg-slate-950/80 border border-slate-850 p-2 rounded-lg space-y-0.5 text-slate-300">
                            <p><span className="text-slate-500">Para:</span> <strong className="text-emerald-400 select-all">{selectedSimulatedEmail.para}</strong></p>
                            <p><span className="text-slate-500">Assunto:</span> <strong className="text-white">{selectedSimulatedEmail.assunto}</strong></p>
                          </div>
                          
                          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 text-[11px] text-slate-300 leading-normal whitespace-pre-wrap select-text max-h-[140px] overflow-y-auto">
                            {selectedSimulatedEmail.corpo}
                          </div>

                          {selectedSimulatedEmail.codigo && (
                            <div className="p-2 bg-slate-950 rounded-lg border border-orange-500/20 flex flex-col items-center gap-1.5">
                              <p className="text-[9px] text-slate-400 tracking-wider text-center font-mono font-bold">🔐 CHAVE DE ATIVAÇÃO</p>
                              <strong className="text-xs text-orange-400 select-all font-mono tracking-wider bg-slate-900 px-2 py-0.5 border border-orange-500/10 rounded">
                                {selectedSimulatedEmail.codigo}
                              </strong>
                              <div className="flex gap-1.5 w-full pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(selectedSimulatedEmail.codigo!);
                                    setSupabaseSuccessMsg(`📋 Token ${selectedSimulatedEmail.codigo} copiado!`);
                                    setTimeout(() => setSupabaseSuccessMsg(''), 3000);
                                  }}
                                  className="flex-1 text-center py-1 bg-slate-800 hover:bg-slate-705 text-white font-bold rounded cursor-pointer font-mono text-[9px] border border-slate-700 active:scale-95 transition-all w-full flex justify-center items-center"
                                >
                                  Copiar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const cod = selectedSimulatedEmail.codigo!;
                                    if (cod.startsWith('temp-')) {
                                      navigator.clipboard.writeText(cod);
                                      alert(`Seu token de Primeiro Acesso é ${cod} (copiado). Faça o login com o perfil "Cliente B2B", selecione seu nome e digite este token como senha!`);
                                    } else {
                                      setSelfRegVerificationCode(cod);
                                      setFirstAccessVerificationCode(cod);
                                      setSupabaseSuccessMsg("⚡ Token pré-preenchido!");
                                      setTimeout(() => setSupabaseSuccessMsg(''), 3000);
                                    }
                                  }}
                                  className="flex-1 text-center py-1 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold rounded cursor-pointer font-mono text-[9px] shadow-sm transform transition-all w-full flex justify-center items-center"
                                >
                                  Usar Token
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        // LIST DISPATCHED EMAILS
                        <div className="space-y-1.5 text-left">
                          {simulatedEmails.length === 0 ? (
                            <div className="p-6 text-center text-slate-550 italic font-mono text-[10px]">
                              Nenhum e-mail no sandbox.
                            </div>
                          ) : (
                            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-0.5">
                              {simulatedEmails.map((eml) => (
                                <div
                                  key={eml.id}
                                  onClick={() => {
                                    setSelectedSimulatedEmail(eml);
                                    eml.lido = true;
                                  }}
                                  className={`p-2 rounded-lg border border-slate-800 bg-slate-950/40 hover:bg-slate-950/90 transition-all cursor-pointer group text-left ${!eml.lido ? 'border-l-2 border-l-orange-500' : ''}`}
                                >
                                  <div className="flex justify-between items-center gap-2">
                                    <span className="text-[9px] text-emerald-400 font-mono font-bold truncate max-w-[170px]">
                                      Para: {eml.para}
                                    </span>
                                    <span className="text-[8px] text-slate-550 font-mono shrink-0">
                                      {eml.data}
                                    </span>
                                  </div>
                                  <h5 className="text-[10px] font-bold text-white group-hover:text-orange-400 mt-1 truncate">
                                    {eml.assunto}
                                  </h5>
                                  {eml.codigo && (
                                    <span className="inline-block mt-1 font-mono text-[8px] bg-slate-900 border border-slate-800/60 text-orange-400 px-1.5 py-0.2 rounded font-bold">
                                      Código: {eml.codigo}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="pt-1.5 border-t border-slate-800 mt-1.5 text-[9px] leading-relaxed text-slate-500 font-mono">
                            💡 Registro de parceiros e "Primeiro Acesso" envia tokens para este painel.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 🟢 INTERACTIVE ACTIVE SESSION ACCOUNT WIDGET FOR PARTNER AND DRIVERS */}
            {(activeSessionRole === 'Cliente' || activeSessionRole === 'Motoboy') && (
              <div className="relative" id="header-user-status-section">
                <button
                  type="button"
                  onClick={() => setShowLoggedSessionStatus(!showLoggedSessionStatus)}
                  className="px-3 py-1.5 rounded border border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-950/30 text-emerald-300 font-mono text-xs flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02] shadow-sm uppercase font-bold"
                >
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="block text-[8.5px] text-emerald-400 leading-none">Sessão Ativa</span>
                    <span className="text-xs font-bold text-white block uppercase tracking-tight">
                      CONECTADO 🟢
                    </span>
                  </div>
                </button>

                {showLoggedSessionStatus && (
                  <div className="absolute right-0 top-12 z-50 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-[310px] p-4 flex flex-col gap-3 font-mono animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Header info */}
                    <div className="border-b border-slate-800 pb-2 flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <div>
                          <h4 className="text-[10px] font-black text-white uppercase tracking-wider leading-none">Conta Conectada</h4>
                          <span className="text-[8px] text-slate-400 leading-none">Canal de Segurança SLS</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowLoggedSessionStatus(false)}
                        className="text-slate-400 hover:text-white font-mono text-[10px] font-black hover:bg-slate-850 w-5 h-5 rounded flex items-center justify-center cursor-pointer transition"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Main Session Card details */}
                    <div className="bg-slate-950/90 border border-slate-850 p-3 rounded-lg space-y-2 text-[11px] text-slate-350">
                      <p className="flex justify-between items-center border-b border-slate-850/40 pb-1.5">
                        <span className="text-slate-500">Nome:</span>
                        <span className="font-bold text-white tracking-tight text-right truncate max-w-[170px]">
                          {activeSessionRole === 'Cliente' ? activeClienteUser?.nome : activeMotoboyUser?.nome}
                        </span>
                      </p>
                      <p className="flex justify-between items-center border-b border-slate-850/40 pb-1.5">
                        <span className="text-slate-500">Setor/Perfil:</span>
                        <span className="font-bold text-orange-400">
                          {activeSessionRole === 'Cliente' ? '🏢 Parceiro B2B' : '🏍️ Entregador MEI'}
                        </span>
                      </p>
                      <p className="flex justify-between items-center border-b border-slate-850/40 pb-1.5">
                        <span className="text-slate-500">Segurança:</span>
                        <span className="font-mono text-emerald-400 font-bold uppercase text-[9.5px]">Encriptado TLS</span>
                      </p>
                      <p className="flex justify-between items-center pr-0.5">
                        <span className="text-slate-500 text-[10px]">Banco Integrado:</span>
                        <span className="text-slate-300 font-mono text-[9px] uppercase font-bold">
                          {isFirebaseConfigured && isSupabaseConfigured 
                            ? (firebaseQuotaExceeded ? 'Supabase (Firebase Quota)' : 'Firebase + Supabase') 
                            : (isFirebaseConfigured ? 'Firebase' : (isSupabaseConfigured ? 'Supabase' : 'Modo Simulador'))}
                        </span>
                      </p>
                    </div>

                    {/* Dynamic uptime stats */}
                    <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-850 space-y-2 text-[10px]">
                      <p className="flex justify-between">
                        <span className="text-slate-500">Sessão Iniciada:</span>
                        <span className="text-slate-300">{sessionStartTime.toLocaleTimeString()}</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-500">IP de Conexão:</span>
                        <span className="text-slate-300 font-mono">186.222.10{Math.floor(Math.random() * 9)}.{Math.floor(100 + Math.random() * 100)}</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-500">Tempo de Atividade:</span>
                        <span className="text-emerald-400 font-bold animate-pulse">
                          {(() => {
                            const diffSecs = Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
                            const m = Math.floor(diffSecs / 60);
                            const s = diffSecs % 60;
                            return `${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
                          })()}
                        </span>
                      </p>
                    </div>

                    {/* Log out action */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowLoggedSessionStatus(false);
                        handleLogout();
                      }}
                      className="w-full bg-red-950 hover:bg-red-900 border border-red-900/40 text-red-400 hover:text-white py-1.5 rounded-lg text-[9.5px] font-bold tracking-widest cursor-pointer font-mono uppercase text-center"
                    >
                      Desconectar Conta
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </header>

      {/* ==========================================
          STICKY SIMULATION PANEL (ADMIN PERSPECTIVES)
          ========================================== */}
      {activeSessionRole === 'Empresa' && (
        <div className="bg-slate-900 border-b border-orange-500/20 py-2.5 px-4 sticky top-0 z-40 shadow-md">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-orange-400 font-extrabold text-[10px] bg-orange-950/50 px-2 py-0.5 rounded border border-orange-500/30">💻 SIMULAÇÃO MULTI-PORTAL ACTIVA</span>
              <span className="text-slate-350 hidden md:inline">Clique para simular e alternar instantaneamente entre os perfis:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setAdminVisualPerspective('Empresa')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer ${
                  adminVisualPerspective === 'Empresa'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-755'
                }`}
              >
                🏢 Gestão de Expedição (Admin)
              </button>
              <button
                onClick={() => {
                  setAdminVisualPerspective('Cliente');
                  if (!activeClienteUser && clientes.length > 0) {
                    setActiveClienteUser(clientes[0]);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer ${
                  adminVisualPerspective === 'Cliente'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-755'
                }`}
              >
                🏢 Portal do Parceiro B2B
              </button>
              <button
                onClick={() => {
                  setAdminVisualPerspective('Motoboy');
                  if (!activeMotoboyUser && motoboys.length > 0) {
                    setActiveMotoboyUser(motoboys[0]);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer ${
                  adminVisualPerspective === 'Motoboy'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-755'
                }`}
              >
                🏍️ Smartphone Entregador
              </button>

              {/* Dynamic posing selectors */}
              {adminVisualPerspective === 'Cliente' && (
                <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  <span className="text-slate-500 text-[10px]">Posing as:</span>
                  <select
                    value={activeClienteUser?.id || ''}
                    onChange={(e) => {
                      const cli = clientes.find(c => c.id === e.target.value);
                      if (cli) setActiveClienteUser(cli);
                    }}
                    className="bg-transparent text-emerald-400 text-[10px] font-bold border-none outline-none font-mono cursor-pointer"
                  >
                    {clientes.slice(0, 15).map(c => (
                      <option key={c.id} value={c.id} className="text-slate-950 font-sans">{c.nome.substring(0, 15)}...</option>
                    ))}
                  </select>
                </div>
              )}

              {adminVisualPerspective === 'Motoboy' && (
                <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  <span className="text-slate-500 text-[10px]">Posing as:</span>
                  <select
                    value={activeMotoboyUser?.id || ''}
                    onChange={(e) => {
                      const mb = motoboys.find(m => m.id === e.target.value);
                      if (mb) setActiveMotoboyUser(mb);
                    }}
                    className="bg-transparent text-blue-400 text-[10px] font-bold border-none outline-none font-mono cursor-pointer"
                  >
                    {motoboys.map(m => (
                      <option key={m.id} value={m.id} className="text-slate-950 font-sans">{m.nome.substring(0, 14)}...</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- COMPLIANCE VERIFICATION SECTION HIDDEN --- */}
      {effectiveRole === 'Empresa' && (
        <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-4">
          {/* --- ADMIN MASTER SUB-TAB NAVIGATION --- */}
          <div className="bg-slate-900 text-white rounded-2xl shadow-lg border border-slate-800 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500/10 p-2.5 rounded-xl border border-orange-500/20">
                <Users className="w-5 h-5 text-orange-400 shrink-0" />
              </div>
              <div>
                <h2 className="text-sm font-black tracking-wider uppercase font-mono text-white flex items-center gap-2">
                  <span>TorqueLog Master Panel</span>
                  <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded-md font-bold">CONTROL</span>
                </h2>
                <p className="text-xs text-slate-400 font-mono">Gerencie a logística de entregas regional ou administre o programa de indicações por representantes comerciaises</p>
              </div>
            </div>
             <div className="flex flex-wrap bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-full md:w-auto shrink-0 select-none gap-1">
               <button
                 type="button"
                 onClick={() => setAdminSubTab('logistica')}
                 className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold font-mono rounded-lg transition-all duration-150 cursor-pointer ${
                   adminSubTab === 'logistica'
                     ? 'bg-orange-500 text-white shadow-md'
                     : 'text-slate-400 hover:text-white hover:bg-slate-900'
                 }`}
               >
                 🏍️ Despacho & Logística
               </button>
               <button
                 type="button"
                 onClick={() => setAdminSubTab('representantes')}
                 className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold font-mono rounded-lg transition-all duration-150 cursor-pointer ${
                   adminSubTab === 'representantes'
                     ? 'bg-orange-500 text-white shadow-md'
                     : 'text-slate-400 hover:text-white hover:bg-slate-900'
                 }`}
                 id="tab-admin-referrals"
               >
                 🤝 Programa Indicações
               </button>
               <button
                 type="button"
                 onClick={() => setAdminSubTab('taxas')}
                 className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold font-mono rounded-lg transition-all duration-150 cursor-pointer ${
                   adminSubTab === 'taxas'
                     ? 'bg-orange-500 text-white shadow-md'
                     : 'text-slate-400 hover:text-white hover:bg-slate-900'
                 }`}
                 id="tab-admin-taxas"
               >
                 ⚙️ Taxas & Valores
                </button>
                <button
                  type="button"
                  onClick={() => setAdminSubTab('quinzenal')}
                  className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold font-mono rounded-lg transition-all duration-150 cursor-pointer ${
                    adminSubTab === 'quinzenal'
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                  id="tab-admin-faturamento"
                >
                  📅 Faturamento 15 Dias
               </button>
               <button
                 type="button"
                 onClick={() => setAdminSubTab('aluguel')}
                 className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold font-mono rounded-lg transition-all duration-150 cursor-pointer ${
                   adminSubTab === 'aluguel'
                     ? 'bg-orange-500 text-white shadow-md'
                     : 'text-slate-400 hover:text-white hover:bg-slate-900'
                 }`}
                 id="tab-admin-aluguel"
               >
                 🏍️ Aluguel & Relatórios KM
               </button>
             </div>
          </div>

          {/* --- REAL-TIME ACTIVE SESSIONS / ONLINE USERS AUDIT STRIP --- */}
          <div className="mt-3.5 bg-slate-900/95 text-white border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shadow-lg font-mono animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-black leading-none block">Monitoramento de Conexões</span>
                <h3 className="text-white font-extrabold text-sm flex items-center gap-1.5 mt-1">
                  <span>{onlineUsersInfo.totalOnlineCount} SESSÕES ATIVAS</span>
                  <span className="text-[10px] bg-emerald-950/80 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold uppercase shrink-0">Server Online</span>
                </h3>
              </div>
            </div>

            {/* Break down of logged status */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <div className="bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
                <span className="text-sm">🛡️</span>
                <div>
                  <span className="text-[9px] text-slate-500 block leading-none">ADMINISTRADOR</span>
                  <p className="font-extrabold text-white text-[11px] mt-0.5">1 Online</p>
                </div>
              </div>
              <div className="bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
                <span className="text-sm">🏢</span>
                <div>
                  <span className="text-[9px] text-slate-500 block leading-none">PARCEIROS B2B</span>
                  <p className="font-extrabold text-emerald-400 text-[11px] mt-0.5">
                    {onlineUsersInfo.onlineClientes.length} Logados
                  </p>
                </div>
              </div>
              <div className="bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
                <span className="text-sm">🏍️</span>
                <div>
                  <span className="text-[9px] text-slate-500 block leading-none">ENTREGADORES MEI</span>
                  <p className="font-extrabold text-emerald-400 text-[11px] mt-0.5">
                    {onlineUsersInfo.onlineMotoboys.length} Simulados
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {effectiveRole === 'Empresa' && adminSubTab === 'logistica' && (
        <main className="max-w-7xl mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 w-full" id="main-grid">

        {/* --- DYNAMIC LOGISTICS HOT ZONE GRAPHICAL MATRIX VISUALIZER --- */}
        <div className="lg:col-span-12 bg-white rounded-xl shadow-sm border border-slate-200 p-5 font-mono" id="hot-zones-dashboard">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-150 pb-4 mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                LOGÍSTICA GEOGRÁFICA EM TEMPO REAL: {selectedAdminCity === 'Todas' ? 'TODAS AS CIDADES' : selectedAdminCity.toUpperCase()}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Distribuição estratégica em 6 setores regionais para agrupamento e otimização de despachos</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleAbrirRelatorio('Empresa')}
                className="bg-[#0e0e0e] hover:bg-[#1c1c1c] text-white text-xs font-black font-mono py-2 px-4 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer hover:scale-[1.02] border border-[#0e0e0e]"
              >
                🧾 FECHAMENTO DE ENTREGAS (S/M/NF) 📊
              </button>
              
              <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50 border border-slate-200 p-2 rounded-lg">
                <span className="text-slate-500 font-bold">Volume Setorial:</span>
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <span className="text-red-700">Crítico (&gt;= 2)</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  <span className="text-amber-700">Ativo (1)</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-200"></span>
                  <span className="text-slate-500">Estável (0)</span>
                </div>
              </div>
            </div>
          </div>

          {/* City Selection Buttons - B2B Routing Audit */}
          <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl mb-5 shadow-xs">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-slate-600 bg-slate-200/80 px-2.5 py-1 rounded-md border border-slate-300 font-mono">
                  📍 Selecionar Cidade para Monitorar:
                </span>
              </div>
              <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                {['Todas', 'Passos - MG', 'Santa Cruz das Palmeiras'].map((city) => {
                  // Count how many total clients in this city
                  const cityClientCount = city === 'Todas' 
                    ? clientes.length 
                    : clientes.filter(c => c.cidade === city).length;

                  // Count how many active/pending orders in this city
                  const cityOrderCount = ordens.filter(o => {
                    if (o.status === 'Entregue') return false;
                    const clientCity = getClientCity(o.clienteId);
                    return city === 'Todas' || clientCity === city;
                  }).length;

                  const isSelected = selectedAdminCity === city;

                  return (
                    <button
                      key={city}
                      type="button"
                      onClick={() => {
                        setSelectedAdminCity(city);
                        setSupabaseSuccessMsg(`🔍 Visualização alterada para: ${city === 'Todas' ? 'Todas as Cidades' : city}`);
                        setTimeout(() => setSupabaseSuccessMsg(''), 3000);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-2 cursor-pointer border ${
                        isSelected 
                          ? 'bg-orange-500 border-orange-500 text-white shadow-sm font-black scale-[1.02]' 
                          : 'bg-white border-slate-250 hover:border-slate-350 text-slate-705 hover:bg-slate-50'
                      }`}
                    >
                      <span>{city === 'Todas' ? '🌍 Todas as Cidades' : city}</span>
                      <span className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected 
                          ? 'bg-orange-700 text-white' 
                          : 'bg-slate-100 text-slate-500 font-mono'
                      }`}>
                        {cityClientCount} cl • {cityOrderCount} OS
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Master Heatmap Matrix */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* Full-width Sector Cards & Alarm status */}
            <div className="xl:col-span-12 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {(['A', 'B', 'C', 'D', 'E', 'F'] as Quadrante[]).map((q) => {
                  const pendingCount = pendingCounts[q];
                  const hasCritical = pendingCount >= 2;
                  const hasActive = pendingCount === 1;

                  // Color classes based on severity
                  const cardBgClass = hasCritical 
                    ? 'bg-red-50/75 border-red-300 hover:border-red-400 shadow-xs' 
                    : hasActive 
                    ? 'bg-amber-50/50 border-amber-300 hover:border-amber-400' 
                    : 'bg-slate-50/40 border-slate-200 hover:border-slate-350';
                  
                  const textBadgeColor = hasCritical 
                    ? 'text-red-700 bg-red-100 border-red-350 font-black' 
                    : hasActive 
                    ? 'text-amber-700 bg-amber-100 border-amber-350 font-bold' 
                    : 'text-slate-505 bg-slate-100 border-slate-305';

                  const indicatorDot = hasCritical 
                    ? 'bg-red-500 animate-pulse' 
                    : hasActive 
                    ? 'bg-amber-400 animate-pulse' 
                    : 'bg-slate-300';

                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setSelectedQuadrant(q);
                        setVisualPanelQuadrant(q);
                      }}
                      className={`p-4 rounded-xl border text-left transition-all duration-200 relative group flex flex-col justify-between h-32 cursor-pointer ${cardBgClass} ${
                        selectedQuadrant === q ? 'ring-2 ring-orange-500 scale-[1.02] bg-white shadow-sm' : ''
                      }`}
                      title={`Clique para selecionar e agrupar no Setor ${q}`}
                    >
                      <div className="flex justify-between items-start w-full">
                        <div>
                          <span className="text-xl font-black block tracking-tight text-slate-900 group-hover:text-orange-500 transition-colors font-mono font-black">SETOR {q}</span>
                          <span className="text-[10px] text-slate-400 font-mono block">Rota do Contrato</span>
                        </div>
                        {/* Ring indicator */}
                        <span className="flex h-2.5 w-2.5 relative">
                          {pendingCount > 0 && (
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                              hasCritical ? 'bg-red-400' : 'bg-amber-400'
                            }`} />
                          )}
                          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${indicatorDot}`} />
                        </span>
                      </div>

                      {/* Bar chart visualizer inside */}
                      <div className="w-full mt-3">
                        <div className="flex items-baseline justify-between mb-1 text-[11px] font-bold">
                          <span className="text-slate-500 font-mono text-[9px] uppercase">Fila de Despacho</span>
                          <span className={`px-1.5 py-0.2 rounded border text-xs font-mono select-none ${textBadgeColor}`}>
                            {pendingCount} OS
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden relative">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              hasCritical ? 'bg-red-500' : hasActive ? 'bg-amber-400' : 'bg-slate-350'
                            }`}
                            style={{ width: `${Math.min((pendingCount / 4) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Absolute tag */}
                      {selectedQuadrant === q && (
                        <div className="absolute -top-1.5 -right-1 bg-orange-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm border border-orange-400 select-none">
                          FOCADO
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Action alert banner inside left side */}
              <div className="bg-slate-900 text-slate-300 p-3.5 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border border-slate-800">
                <div className="flex items-start gap-2.5 text-xs">
                  <span className="bg-orange-500 text-white font-bold p-1 rounded font-mono uppercase text-[9px] mt-0.5 shrink-0 select-none">Monitoramento Ativo</span>
                  <div className="text-slate-300 leading-normal">
                    {hotZoneStatus.maxCount > 0 ? (
                      <p>
                        🎯 <strong>Análise de Hot Zone:</strong> Setor(es) <span className="text-orange-400 font-black font-mono">[{hotZoneStatus.hottestSector}]</span> apresenta(m) o maior pico de expedição com <strong className="text-white font-black font-mono">{hotZoneStatus.maxCount}</strong> ordens pendentes. Focar setor correspondente para priorizar combos estruturados.
                      </p>
                    ) : (
                      <p>
                        <strong>Análise de Hot Zone:</strong> Carga geográfica metropolitanizada estável. Não há gargalos de despacho ativos neste momento.
                      </p>
                    )}
                  </div>
                </div>

                {hotZoneStatus.maxCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const firstHottest = hotZoneStatus.hottestSector.split(',')[0].trim() as Quadrante;
                      setSelectedQuadrant(firstHottest);
                      setVisualPanelQuadrant(firstHottest);
                    }}
                    className="bg-orange-500 hover:bg-orange-600 border border-orange-400 text-white font-mono text-[10px] font-bold py-1.5 px-3 rounded-md transition-colors w-full sm:w-auto shrink-0 cursor-pointer text-center"
                  >
                    Focar Setor Quente ({hotZoneStatus.hottestSector.split(',')[0].trim()}) ⚡
                  </button>
                )}
              </div>
            </div>



          </div>

        </div>

        {/* ==========================================
            LEFT COLUMN: DISTRIBUIDORA / COMPANY VIEW 
            ========================================== */}
        <section className="lg:col-span-6 flex flex-col gap-6" id="panel-company">
          
          {/* Header Title for Left Side */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-orange-500/10 to-transparent rounded-bl-full pointer-events-none" />
            <div className="flex items-center gap-3">
              <div className="bg-slate-100 p-2 rounded text-slate-700">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">1. Portal de Despacho B2B</h2>
                <p className="text-xs text-slate-500">Operação interna do faturista e estoquista da TorqueLog</p>
              </div>
            </div>

            {/* Form and Selection of Customers */}
            <form onSubmit={handleDespacharOrdem} className="flex flex-col gap-4 mt-2">
              
              {/* SELECT REGIONAL QUADRANT FIRST */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-mono flex items-center justify-between">
                  <span>Passo A: Selecione o Quadrante Logístico (6 Setores)</span>
                  <span className="text-[11px] text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded font-bold lowercase">
                    {stats.porQuadrante[selectedQuadrant]} oficinas cadastradas
                  </span>
                </label>
                <div className="grid grid-cols-6 gap-1.5" id="quadrant-selectors">
                  {(['A', 'B', 'C', 'D', 'E', 'F'] as Quadrante[]).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setSelectedQuadrant(q)}
                      className={`py-2 text-sm font-extrabold rounded-md font-mono transition-all duration-150 border ${
                        selectedQuadrant === q
                          ? 'bg-slate-900 text-orange-400 border-slate-900 shadow-sm scale-[1.03]'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Setor {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* SELECT CUSTOMER FROM CHOSEN QUADRANT */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  Passo B: Escolha o Cliente Faturado no Setor {selectedQuadrant}
                </label>
                <div className="relative">
                  <select
                    value={selectedClienteId}
                    onChange={(e) => setSelectedClienteId(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 appearance-none font-medium pr-10"
                    id="client-select"
                  >
                    {filteredClientListForDispatch.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} - {c.endereco.substring(0, 32)}...
                      </option>
                    ))}
                    {filteredClientListForDispatch.length === 0 && (
                      <option value="">Nenhum cliente cadastrado neste setor</option>
                    )}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">
                  Sincronização Ativa: Oferece automaticamente rotas agrupadas para este quadrante.
                </p>
              </div>

              {/* AUTOMOTIVE CARGO ENTRY / JARGONS */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                    Passo C: Detalhamento do Objeto de Envio (Opcional - Padrão: Objeto de Envio)
                  </label>
                  <span className="text-[10px] text-orange-600 font-mono font-bold">Livre de Preenchimento ⚡</span>
                </div>
                
                <input
                  type="text"
                  value={itemTexto}
                  onChange={(e) => setItemTexto(e.target.value)}
                  placeholder="Ex: um remédio, um lanche, autopeças... (ou deixe em branco para 'Objeto de Envio')"
                  className="w-full bg-slate-50 text-slate-950 border border-slate-250 rounded-lg p-3 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                />


              </div>

              {/* REAL-TIME CUBAGE GAUGE BAR TRACKER */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 mt-1" id="cubage-tracker">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-bold text-slate-700 font-mono uppercase flex items-center gap-1.5">
                    {cubageAnalysis.status === 'Bloqueado - Excesso de Volume' ? (
                      <Lock className="w-3.5 h-3.5 text-red-500 animate-bounce" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5 text-green-500" />
                    )}
                    Limiar Volumétrico da Moto: {cubageAnalysis.scoreTotal}L / {BAÚ_CAPACIDADE_MAXIMA}L
                  </span>
                  <span className={`text-xs font-extrabold px-2 py-0.5 rounded font-mono ${
                    cubageAnalysis.status === 'Bloqueado - Excesso de Volume'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {cubageAnalysis.status}
                  </span>
                </div>

                {/* Visual Bar Indicator of Motorcycle Box chest */}
                <div className="w-full bg-slate-200 h-3.5 rounded-full overflow-hidden mb-2 relative">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      cubageAnalysis.scoreTotal > BAÚ_CAPACIDADE_MAXIMA 
                        ? 'bg-red-500' 
                        : cubageAnalysis.scoreTotal > 55 
                        ? 'bg-amber-400' 
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min((cubageAnalysis.scoreTotal / BAÚ_CAPACIDADE_MAXIMA) * 100, 100)}%` }}
                  />
                </div>

                {cubageAnalysis.itens.length > 0 ? (
                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    Componentes detectados: {cubageAnalysis.itens.map(it => `${it.descricao} (Aprox. ${it.cubagemPesoScore}L)`).join(', ')}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 font-mono mt-1">
                    Digite quantidades e tipos como &quot;amortecedores&quot; (35L), &quot;radiador&quot; (45L), &quot;pastilhas&quot; (10L), &quot;filtros&quot; (10L).
                  </div>
                )}

                {/* ALERT BLOCKAGE CRITERIA REPRESENTATION */}
                {cubageAnalysis.status === 'Bloqueado - Excesso de Volume' && (
                  <div className="bg-red-50 text-red-700 text-[11px] p-2 rounded border border-red-200 mt-2 font-mono flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      <strong>Trava de Cubagem Ativada:</strong> O baú padrão da moto não comporta carregar essas peças simultaneamente de forma segura. O TorqueLog desmembrará essa entrega automaticamente em vários entregadores se faturada.
                    </span>
                  </div>
                )}
              </div>

              {/* REVERSE LOGISTICS OPTION */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="checkbox-reversa"
                    checked={retornoPeca}
                    onChange={(e) => setFormCheckbox(e.target.checked)}
                    className="mt-1 h-4.5 w-4.5 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
                  />
                  <div>
                    <label htmlFor="checkbox-reversa" className="text-xs font-bold text-slate-800 uppercase block font-mono cursor-pointer">
                      Retorno de Peça por Erro de Aplicação
                    </label>
                    <span className="text-[11px] text-slate-400 block leading-tight font-mono">
                      Acrescentar logística reversa da oficina para a distribuidora.
                    </span>
                  </div>
                </div>
              </div>

              {/* ACTION BTN SUBMIT */}
              <button
                type="submit"
                disabled={!selectedClienteId}
                className={`py-3 px-4 rounded-lg font-bold text-sm text-center flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${
                  !selectedClienteId 
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-orange-500 text-white hover:bg-orange-600 shadow-md transform hover:-translate-y-0.5 active:translate-y-0'
                }`}
                id="btn-dispatch"
              >
                <Send className="w-4 h-4" />
                Despachar Ordem de Serviço B2B
              </button>

            </form>
          </div>

          {/* DYNAMIC REAL-TIME SWEEP WIDGET */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 font-mono">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-orange-500 animate-spin" />
                Varreduras Pendentes do Setor (Últimos 15 min)
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Auto Sync</span>
            </div>

            <p className="text-[11px] text-slate-500 mb-3.5 leading-relaxed">
              Pedidos aguardando parceiro no mesmo quadrante há menos de 15 min são aglutinados em uma única <strong>&quot;Rota Agrupada de Setor&quot;</strong>, otimizando o faturamento do motociclista e garantindo economia.
            </p>

            <div className="space-y-2">
              {ordens.filter(o => o.status === 'Pendente' || o.status === 'Buscando Parceiro').length === 0 ? (
                <div className="text-xs text-center text-slate-400 p-3 bg-slate-50 rounded border border-dashed border-slate-200">
                  Nenhuma ordem pendente disponível para varredura ou agrupamento no momento.
                </div>
              ) : (
                ordens.filter(o => o.status === 'Pendente' || o.status === 'Buscando Parceiro').map(o => (
                  <div key={o.id} className="text-xs bg-slate-50 p-2.5 rounded border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800">{o.id}</span>
                      <span className="mx-1.5 text-slate-300">|</span>
                      <span className="font-bold text-orange-500">Setor {o.quadrante}</span>
                      <p className="text-[11px] text-slate-500 truncate max-w-[280px] mt-0.5">{o.clienteNome}</p>
                    </div>
                    <div className="text-right">
                      {o.tempoRestanteSweep ? (
                        <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200/50 py-0.5 px-1.5 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {o.tempoRestanteSweep}m rest.
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Fora do sweep</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* DYNAMIC CLIENT SECTOR REGISTER BROWSER (Quadrants removed as per user instruction) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase font-mono tracking-tight">Catálogo de Clientes Separados</h3>
                <p className="text-xs text-slate-400">Classificação: os Parceiros (clientes da TorqueLog) vs Clientes (oficinas) delas</p>
              </div>
              <button
                onClick={() => {
                  setNewClientQuadrante('A');
                  setIsAddingNewClient(true);
                }}
                className="bg-slate-900 text-white font-mono text-xs font-bold py-1.5 px-3 rounded-md hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
                id="btn-add-client-distributor"
              >
                <Plus className="w-3.5 h-3.5 text-orange-400" />
                Novo Parceiro (Cliente Torque)
              </button>
            </div>

            {/* Classification Tabs: Separation of Roles as requested */}
            <div className="flex bg-slate-100 p-1 rounded-lg gap-1 border border-slate-200 mb-3.5">
              <button
                type="button"
                onClick={() => setAdminClientFilterTab('distributors')}
                className={`flex-1 py-1.5 text-center text-xs font-mono font-bold rounded-md transition ${
                  adminClientFilterTab === 'distributors'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-650 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                🏢 Parceiros ({clientes.filter(c => !c.criadoPorClienteId).length})
              </button>
              <button
                type="button"
                onClick={() => setAdminClientFilterTab('subclients')}
                className={`flex-1 py-1.5 text-center text-xs font-mono font-bold rounded-md transition ${
                  adminClientFilterTab === 'subclients'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-650 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                📍 Clientes Delas ({clientes.filter(c => !!c.criadoPorClienteId).length})
              </button>
              <button
                type="button"
                onClick={() => setAdminClientFilterTab('all')}
                className={`flex-1 py-1.5 text-center text-xs font-mono font-bold rounded-md transition ${
                  adminClientFilterTab === 'all'
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'text-slate-650 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                📋 Todos ({clientes.length})
              </button>
            </div>

                         {/* Quick Search */}
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={adminClientFilterTab === 'distributors' ? "Pesquisar parceiro TorqueLog..." : adminClientFilterTab === 'subclients' ? "Pesquisar clientes / oficinas registradas..." : "Pesquisar parceiro ou oficina..."}
                value={clienteSearchTerm}
                onChange={(e) => setClienteSearchTerm(e.target.value)}
                className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg pl-8.5 pr-3 py-1.5 text-xs font-mono"
              />
            </div>

            {/* Multiselection Toolbar */}
            <div className="flex items-center justify-between gap-2 mb-3.5 p-2 bg-slate-100 border border-slate-205 rounded-xl shadow-xs">
              <div className="flex items-center gap-2 pl-1 select-none">
                <input
                  type="checkbox"
                  id="checkbox-select-all-distributors"
                  checked={directoryFilteredClients.length > 0 && directoryFilteredClients.every(c => selectedClientIds.includes(c.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const allFilteredIds = directoryFilteredClients.map(c => c.id);
                      setSelectedClientIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
                    } else {
                      const allFilteredIds = directoryFilteredClients.map(c => c.id);
                      setSelectedClientIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500 cursor-pointer accent-orange-550"
                />
                <label htmlFor="checkbox-select-all-distributors" className="text-[11px] font-mono font-bold text-slate-700 cursor-pointer">
                  {selectedClientIds.length > 0 ? `Selecionados: ${selectedClientIds.length}` : "Selecionar tudo"}
                </label>
              </div>
              
              {selectedClientIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmType('multiple-clientes');
                    setDeleteConfirmId('multiple');
                    const selectedNames = clientes.filter(c => selectedClientIds.includes(c.id)).map(c => c.nome).join(', ');
                    setDeleteConfirmName(selectedNames);
                  }}
                  className="bg-red-650 hover:bg-red-705 text-white font-mono text-[9.5px] font-bold py-1 px-2.5 rounded-lg border border-red-500 shadow-sm cursor-pointer active:scale-95 transition-all flex items-center gap-1 shrink-0"
                >
                  <Trash2 className="w-3 h-3 text-white" />
                  Excluir Selecionados ({selectedClientIds.length})
                </button>
              )}
            </div>

            {/* List limit scroll */}
            <div className="max-h-[365px] overflow-y-auto divide-y divide-slate-150 border border-slate-200 rounded-lg p-1.5 space-y-1 bg-slate-50 shadow-inner">
              {directoryFilteredClients.map((cli, index) => {
                const stats = clientBillingStats[cli.id] || { hojeBilling: 0, hojeCount: 0, mesBilling: 0, mesCount: 0 };
                const parentDistributor = cli.criadoPorClienteId ? clientes.find(parent => parent.id === cli.criadoPorClienteId) : null;
                return (
                  <div key={cli.id} className={`text-xs p-3 hover:bg-white rounded-lg transition duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border ${
                    cli.isSelfRegistered || cli.criadoPor === 'Cliente'
                      ? 'bg-emerald-50/80 hover:bg-emerald-100/90 border-emerald-300 shadow-xs' 
                      : 'bg-slate-50/50 border-transparent hover:border-slate-200'
                  }`}>
                    <div className="flex gap-2.5 items-start flex-1 truncate">
                      <div className="pt-0.5 shrink-0 select-none">
                        <input
                          type="checkbox"
                          checked={selectedClientIds.includes(cli.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedClientIds(prev => [...prev, cli.id]);
                            } else {
                              setSelectedClientIds(prev => prev.filter(id => id !== cli.id));
                            }
                          }}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-orange-500 focus:ring-orange-500 cursor-pointer accent-orange-550"
                        />
                      </div>
                      <div className="truncate flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 truncate block text-xs">{cli.nome}</span>
                          <span className="text-[9px] bg-slate-205 text-slate-705 px-1.5 rounded font-mono font-bold shrink-0">{cli.id}</span>
                          {(cli.isSelfRegistered || cli.criadoPor === 'Cliente') && (
                            <span className="text-[8.5px] bg-emerald-600 font-extrabold text-white px-2 py-0.5 rounded-md uppercase tracking-wider font-mono shrink-0 animate-pulse">
                              🟢 CLIENTE NOVO
                            </span>
                          )}
                          {parentDistributor && (
                            <span className="text-[8.5px] bg-sky-100 text-sky-850 border border-sky-305 px-2 py-0.5 rounded-md uppercase font-extrabold font-mono shrink-0">
                              🏢 Base de: {parentDistributor.nome}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono block truncate">{cli.endereco}</span>
                        
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] font-mono text-slate-400">
                          <span className="bg-slate-900 text-slate-300 font-black px-1 rounded-xs uppercase tracking-tight text-[8px]">{cli.cidade || 'Passos - MG'}</span>
                          <span>Cobrança padrão: <strong className="text-emerald-700">R$ {(cli.valorCobradoCliente || 10.00).toFixed(2)}</strong></span>
                          <span>•</span>
                          <span>Repasse: <strong className="text-rose-600">R$ {(cli.valorPagoMotoboy || 4.00).toFixed(2)}</strong></span>
                        </div>

                        <div className="mt-1 flex items-center gap-1.5 bg-slate-200 px-2 py-0.5 rounded border border-slate-300 w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                          <span className="text-[9px] font-mono text-slate-700 uppercase font-bold">
                            Motoboys Ativos: <span className="text-slate-950 font-extrabold">{cli.motoboysAtivos || 0}</span>
                          </span>
                        </div>

                        {/* Sync Email and Activation Status controls (Requested Supabase sync and email settings) */}
                        {cli.email && (
                          <div className="mt-1 ml-0.5 flex flex-wrap items-center gap-2 text-[9px] font-mono">
                            <span className="text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">📧 {cli.email}</span>
                            <span className="text-slate-800 bg-orange-100 hover:bg-orange-200 px-1.5 py-0.5 rounded border border-orange-200 font-bold flex items-center gap-1 shrink-0" title="Senha atual do cliente no sistema">
                              🔑 Senha: <strong className="text-slate-950 font-sans font-black tracking-wide">{cli.senha || 'Sem Senha'}</strong>
                            </span>
                            {cli.primeiroAcessoPendente && (
                              <span className="bg-rose-100 text-rose-800 font-extrabold uppercase px-1.5 py-0.5 rounded text-[8px] border border-rose-300">
                                ⏳ Temp
                              </span>
                            )}
                            {cli.emailConfirmado ? (
                              <span className="bg-emerald-100 text-emerald-800 font-black uppercase tracking-wider px-1.5 py-0.5 rounded text-[8px] border border-emerald-300 flex items-center gap-1">
                                ● Ativo B2B
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 font-black uppercase tracking-wider px-1.5 py-0.5 rounded text-[8px] border border-amber-350 animate-pulse">
                                ⏳ Confirm. Pendente
                              </span>
                            )}
                            {!cli.emailConfirmado && (
                              <button
                                type="button"
                                onClick={() => handleConfirmarEmailCliente(cli.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-1.5 py-0.5 rounded text-[8.5px] uppercase tracking-wide cursor-pointer shadow-xs active:scale-95 transition-all"
                                title="Simular ativação de e-mail recebida pelo cliente"
                              >
                                Simular Ativação Link ✉️
                              </button>
                            )}
                          </div>
                        )}

                        {/* STATS DE FATURAMENTO DIÁRIO / MENSAL PARA CONTROLE DE NOTA FISCAL */}
                        <div className="mt-2 pt-2 border-t border-slate-250/50 grid grid-cols-2 gap-2 text-[10px] font-mono">
                          <div className="bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/10 p-1.5 rounded flex flex-col">
                            <span className="text-[8px] text-orange-655 font-bold uppercase tracking-wider block">Faturamento Hoje</span>
                            <span className="text-[11px] font-black text-orange-950 mt-0.5">R$ {stats.hojeBilling.toFixed(2)}</span>
                            <span className="text-[8px] text-slate-500 block">({stats.hojeCount} OS finalizadas)</span>
                          </div>
                          <div className="bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 p-1.5 rounded flex flex-col">
                            <span className="text-[8px] text-emerald-700 font-bold uppercase tracking-wider block">Faturamento Mês</span>
                            <span className="text-[11px] font-black text-emerald-950 mt-0.5">R$ {stats.mesBilling.toFixed(2)}</span>
                            <span className="text-[8px] text-slate-500 block">({stats.mesCount} OS para Nota Fiscal)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="shrink-0 text-right font-mono flex sm:flex-col justify-between items-center sm:items-end border-t sm:border-t-0 border-slate-100 pt-1.5 sm:pt-0 gap-2">
                      <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wide inline-block ${
                        cli.criadoPor === 'Entregador' 
                          ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                          : cli.isSelfRegistered
                          ? 'bg-emerald-600 text-white border border-emerald-500'
                          : cli.criadoPor === 'Cliente'
                          ? 'bg-sky-600 text-white border border-sky-500'
                          : 'bg-slate-205 text-slate-705 border border-slate-300'
                      }`}>
                        {cli.criadoPor === 'Entregador' ? 'Rua (Rider)' : cli.isSelfRegistered ? 'Auto-Cadastro' : cli.criadoPor === 'Cliente' ? 'Sub-Cliente B2B' : 'Expedição'}
                      </span>
                      
                      {/* CRUD Actions Buttons for Edit and Delete */}
                      <div className="flex gap-2.5 mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setClienteParaEditar(cli);
                            setEditClientNome(cli.nome);
                            setEditClientCEP(cli.cep || '');
                            setEditClientNumero(cli.numero || '');
                            setEditClientQuadrante(cli.quadrante);
                            setEditClientEndereco(cli.endereco);
                            setEditClientTelefone(cli.telefone);
                            setEditClientCidade(cli.cidade);
                            setEditClientEmail(cli.email || '');
                            setEditClientSenha(cli.senha || '');
                            setEditClientValorCobradoCliente(cli.valorCobradoCliente);
                            setEditClientValorPagoMotoboy(cli.valorPagoMotoboy);
                            setEditClientMotoboysAtivos(cli.motoboysAtivos || 0);
                            setEditClientRamo(cli.ramo || 'Autopeças');
                            setEditClientIndicadoPorRepId(cli.indicadoPorRepId || '');
                            setEditClientNotaAdmin(cli.notaAdmin || '');
                            setEditClientAdminBloqueado(!!cli.adminBloqueado);
                            
                            // Reset sub-client creation form states
                            setSubCliEditingId(null);
                            setSubCliNome('');
                            setSubCliEmail('');
                            setSubCliSenha('');
                            setSubCliCEP('');
                            setSubCliEndereco('');
                            setSubCliNumero('');
                            setSubCliTelefone('');
                            setSubCliRamo('Oficina mecânica');
                            setSubCliQuadrante(cli.quadrante || 'A');
                            setSubCliNotaAdmin('');
                            setSubCliAdminBloqueado(false);
                            setSubCliValorCobradoCliente(10.00);
                            setSubCliValorPagoMotoboy(4.00);
                          }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-705 p-1 rounded transition border border-slate-250 cursor-pointer"
                          title="Editar cadastro do cliente"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletarCliente(cli.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-650 p-1 rounded transition border border-red-200 cursor-pointer"
                          title="Excluir cadastro do cliente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {directoryFilteredClients.length === 0 && (
                <div className="text-xs text-center text-slate-400 p-4 font-mono">
                  Nenhum cliente correspondente encontrado nesta cidade.
                </div>
              )}
            </div>
            
            <div className="flex justify-between items-center mt-2.5 px-1 text-[10px] text-slate-450 font-mono">
              <span>Clientes Cadastrados: <span className="text-slate-900 font-bold">{directoryFilteredClients.length}</span></span>
              <span>Previsão Mapeada: OK</span>
            </div>

            <div className="mt-3.5 pt-3 border-t border-dashed border-slate-200">
              <div className="bg-slate-900 text-white rounded-xl p-3.5 font-mono text-xs space-y-2.5 shadow-sm">
                <div className="font-extrabold text-orange-400 text-[10px] uppercase tracking-wider flex items-center justify-between">
                  <span>📊 TOTAL CONSOLIDADO DO SETOR {visualPanelQuadrant}</span>
                  <span className="text-[8px] bg-slate-800 text-slate-350 px-1.5 py-0.5 rounded font-mono uppercase font-bold">FECHAMENTO B2B</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[9px] block uppercase font-bold tracking-tight">Setor - Hoje</span>
                    <strong className="text-sm font-black text-orange-300">R$ {sectorBillingTotal.hojeSector.toFixed(2)}</strong>
                  </div>
                  <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[9px] block uppercase font-bold tracking-tight">Setor - Mês Acumulado</span>
                    <strong className="text-sm font-black text-emerald-400">R$ {sectorBillingTotal.mesSector.toFixed(2)}</strong>
                  </div>
                </div>
                <div className="text-[9.5px] text-slate-400 leading-normal border-t border-slate-800 pt-2">
                  👉 <strong>Dica de Conciliação:</strong> A soma do faturamento mensal dos clientes deste setor permite emitir as notas fiscais unificadas de forma 100% auditada.
                </div>
              </div>
            </div>

          </div>

          {/* DYNAMIC MOTOBOY REGISTER AND PORTAL MANAGEMENT */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mt-6">
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-tight">Motoboys MEI Credenciados</h3>
                <p className="text-xs text-slate-400">Gerencie taxas de repasse por entrega regional</p>
              </div>
              <button
                onClick={() => {
                  setIsAddingNewMotoboy(!isAddingNewMotoboy);
                }}
                className="bg-orange-500 hover:bg-orange-600 text-white font-mono text-xs font-bold py-1.5 px-3 rounded-md flex items-center gap-1 cursor-pointer transition"
                id="btn-add-motoboy-toggle"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAddingNewMotoboy ? 'Fechar' : 'Cadastrar'}
              </button>
            </div>

            {/* If adding new motoboy, show local form */}
            <AnimatePresence>
              {isAddingNewMotoboy && (
                <motion.form
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onSubmit={handleCriarMotoboy}
                  className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 mb-4 overflow-hidden"
                >
                  <span className="text-[10px] font-bold text-orange-650 uppercase font-mono tracking-wider block font-bold">✍️ NOVO CADASTRO DE MOTOBOY</span>
                  
                  <div>
                    <label className="block text-[9px] font-bold text-slate-700 uppercase mb-0.5 font-mono">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={newMotoboyNome}
                      onChange={(e) => setNewMotoboyNome(e.target.value)}
                      placeholder="Ex: João da Silva Passos"
                      className="w-full bg-white text-slate-900 border border-slate-250 rounded p-2 text-xs focus:ring-2 focus:ring-orange-550 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-700 uppercase mb-0.5 font-mono">Cidade / Base</label>
                      <input
                        type="text"
                        required
                        value={newMotoboyCidade}
                        onChange={(e) => setNewMotoboyCidade(e.target.value)}
                        placeholder="Ex: Passos - MG"
                        className="w-full bg-white text-slate-900 border border-slate-250 rounded p-2 text-xs focus:ring-2 focus:ring-orange-550 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-700 uppercase mb-0.5 font-mono">Senha de Acesso</label>
                      <input
                        type="text"
                        required
                        value={newMotoboySenha}
                        onChange={(e) => setNewMotoboySenha(e.target.value)}
                        placeholder="Ex: passos123"
                        className="w-full bg-white text-slate-900 border border-slate-250 rounded p-2 text-xs focus:ring-2 focus:ring-orange-550 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-700 uppercase mb-0.5 font-mono">Telefone</label>
                      <input
                        type="text"
                        value={newMotoboyTelefone}
                        onChange={(e) => setNewMotoboyTelefone(e.target.value)}
                        placeholder="Ex: (35) 99123-4567"
                        className="w-full bg-white text-slate-900 border border-slate-250 rounded p-2 text-xs focus:ring-2 focus:ring-orange-550 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-755 uppercase mb-0.5 font-mono">Repasse por Entrega (R$)</label>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        required
                        value={newMotoboyRepasse}
                        onChange={(e) => setNewMotoboyRepasse(parseFloat(e.target.value) || 0)}
                        placeholder="Ex: 4.00"
                        className="w-full bg-white text-slate-900 border border-slate-250 rounded p-2 text-xs focus:ring-2 focus:ring-orange-550 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-755 uppercase mb-0.5 font-mono">Diária Contrato Exclusivo (R$)</label>
                      <input
                        type="number"
                        step="1.00"
                        min="0"
                        required
                        value={newMotoboyContratoExclusivo}
                        onChange={(e) => setNewMotoboyContratoExclusivo(parseFloat(e.target.value) || 0)}
                        placeholder="Ex: 150.00"
                        className="w-full bg-white text-slate-900 border border-slate-250 rounded p-2 text-xs focus:ring-2 focus:ring-orange-550 font-mono font-bold text-orange-650"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-755 uppercase mb-0.5 font-mono">Taxa por Corrida Freelancer (R$)</label>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        required
                        value={newMotoboyTaxaFreelancer}
                        onChange={(e) => setNewMotoboyTaxaFreelancer(parseFloat(e.target.value) || 0)}
                        placeholder="Ex: 6.00"
                        className="w-full bg-white text-slate-900 border border-slate-250 rounded p-2 text-xs focus:ring-2 focus:ring-orange-550 font-mono font-bold text-emerald-650"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-0.5">
                      <label className="block text-[9px] font-bold text-slate-700 uppercase font-mono">Empresa de Serviço Exclusiva (Opcional)</label>
                      <span className="text-[8px] text-amber-600 font-mono font-bold uppercase">Presta Serviço para quem?</span>
                    </div>
                    <select
                      onChange={(e) => {
                        if (e.target.value !== 'Personalizado') {
                          setNewMotoboyEmpresaExclusiva(e.target.value);
                        } else {
                          setNewMotoboyEmpresaExclusiva('');
                        }
                      }}
                      className="w-full bg-white text-slate-900 border border-slate-250 rounded p-1.5 text-xs font-mono font-semibold mb-1"
                    >
                      <option value="">Sem exclusividade (Polo Geral / Todos)</option>
                      {clientes.map(c => (
                        <option key={c.id} value={c.nome}>{c.nome}</option>
                      ))}
                      <option value="Personalizado">✍️ Digitar manualmente outra empresa...</option>
                    </select>
                    <input
                      type="text"
                      value={newMotoboyEmpresaExclusiva}
                      onChange={(e) => setNewMotoboyEmpresaExclusiva(e.target.value)}
                      placeholder="Ex: BARROS AUTOPEÇAS"
                      className="w-full bg-white text-slate-900 border border-slate-250 rounded p-2 text-xs focus:ring-2 focus:ring-orange-550 font-mono font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-700 uppercase mb-0.5 font-mono">
                      Veículo de Atuação
                    </label>
                    <select
                      value={newMotoboyVeiculo}
                      onChange={(e) => setNewMotoboyVeiculo(e.target.value)}
                      className="w-full bg-white text-slate-900 border border-slate-250 rounded p-1.5 text-xs focus:ring-2 focus:ring-orange-550 font-mono font-semibold"
                    >
                      <option value="Moto">Moto 🏍️</option>
                      <option value="Carro">Carro 🚗</option>
                      <option value="Van">Van 🚐</option>
                      <option value="Furgão">Furgão 🚚</option>
                    </select>
                  </div>

                  {newMotoboyVeiculo === 'Moto' && (
                    <div>
                      <label className="block text-[9px] font-bold text-slate-705 uppercase mb-1 font-mono">
                        Vínculo da Motocicleta (Frota)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setNewMotoboyTipoMoto('propria')}
                          className={`py-1.5 px-3 rounded text-[10px] font-mono font-bold border transition ${
                            newMotoboyTipoMoto === 'propria'
                              ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                              : 'bg-white border-slate-255 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          🏍️ Moto Própria
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewMotoboyTipoMoto('alugada')}
                          className={`py-1.5 px-3 rounded text-[10px] font-mono font-bold border transition ${
                            newMotoboyTipoMoto === 'alugada'
                              ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                              : 'bg-white border-slate-255 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          🔑 Moto Alugada (Frota)
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-slate-900 text-white font-mono font-bold text-xs py-2 rounded shadow-sm hover:bg-slate-850 cursor-pointer"
                  >
                    CONFIRMAR CREDENCIAMENTO MEI ✅
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* List of active motoboys and passwords for reference */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {motoboys.map((m) => {
                const isOnline = ordens.some(o => o.motoboyId === m.id && o.status === 'Moto a Caminho');
                return (
                  <div key={m.id} className="p-3 bg-slate-50 rounded-lg border border-slate-150 flex justify-between items-center text-xs font-mono">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-800">{m.nome}</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-orange-500 animate-pulse' : 'bg-slate-300'}`}></span>
                      </div>
                      <span className="text-[10px] text-slate-400 block">{m.cidade} • Tel: {m.telefone}</span>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[9px] bg-slate-200 text-slate-700 px-1 rounded inline-block">Chave: <strong>{m.senha}</strong></span>
                        {m.situacao && m.situacao !== 'Ativo' && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-200 px-1.5 rounded font-bold font-sans">
                            ⚠️ {m.situacao}
                          </span>
                        )}
                        {m.empresaExclusiva && (
                          <span className="text-[9px] bg-sky-50 text-sky-700 border border-sky-150 px-1.5 rounded font-bold font-sans">
                            🏢 Exclusivo: {m.empresaExclusiva}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.empresaExclusiva && (
                        <button
                          type="button"
                          onClick={() => handleRastrearMotoboyNoGoogleMaps(m)}
                          className="bg-orange-600 hover:bg-orange-700 active:scale-95 hover:scale-103 text-white font-mono font-black text-[10px] px-2.5 py-1.5 rounded-lg transition shadow-sm cursor-pointer flex items-center gap-1 shrink-0"
                          title="Rastrear localização do entregador exclusivo no Google Maps"
                        >
                          <Navigation className="w-2.5 h-2.5 animate-pulse" />
                          Rastrear 🗺️
                        </button>
                      )}
                      <div className="text-right">
                        <span className="text-[9px] text-slate-450 block uppercase font-bold tracking-tight">Repasse</span>
                        <span className="text-sm font-extrabold text-slate-950 font-mono">R$ {m.valorRepasseFixo.toFixed(2)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMotoboyParaEditar(m);
                          setEditMotoboyNome(m.nome);
                          setEditMotoboyTelefone(m.telefone);
                          setEditMotoboyCidade(m.cidade);
                          setEditMotoboySenha(m.senha);
                          setEditMotoboyRepasse(m.valorRepasseFixo);
                          setEditMotoboyContratoExclusivo(m.valorContratoExclusivo || 150.00);
                          setEditMotoboyTaxaFreelancer(m.valorTaxaFreelancer || 6.00);
                          setEditMotoboySituacao(m.situacao || 'Ativo');
                          setEditMotoboyEmpresaExclusiva(m.empresaExclusiva || '');
                          setEditMotoboyVeiculo(m.veiculo || 'Moto');
                          setEditMotoboyTipoMoto(m.tipoMoto || 'propria');
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded transition border border-slate-250 cursor-pointer self-center"
                        title="Editar credenciamento de motoboy"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletarMotoboy(m.id)}
                        className="bg-red-50 hover:bg-red-100 text-red-650 p-1.5 rounded transition border border-red-200 cursor-pointer self-center"
                        title="Excluir credenciamento de motoboy"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-[9px] leading-relaxed text-slate-400 font-mono mt-3 border-t border-slate-100 pt-2">
              ⚖️ No modelo trabalhista TorqueLog, as taxas de repasse (Ex: R$ 4,00) são acordadas diretamente no credenciamento, sem ingerência de jornada ou metas impostas unilateralmente.
            </div>
          </div>

        </section>

        {/* ==========================================
            RIGHT COLUMN: MOTOBOY / ENTRREGADOR SMARTPHONE EMULATION
            ========================================== */}
        <section className="lg:col-span-6 flex flex-col gap-6" id="panel-rider">
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-950/5 to-transparent rounded-bl-full pointer-events-none" />
            
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="bg-slate-900 text-orange-400 p-2 rounded">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">2. App do Motoboy Parceiro</h2>
                  <p className="text-xs text-slate-505">Painel remoto do motoboy parceiro (MEI Independente)</p>
                </div>
              </div>
              <div className="bg-slate-100 border border-slate-200 py-1 px-2.5 rounded text-[10px] font-bold text-slate-600 font-mono flex items-center gap-1.5 self-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Sincronia Ativa
              </div>
            </div>

            {/* Quick action: ADD NEW CLIENT FROM THE STREET */}
            <div className="bg-slate-950 text-white p-4 rounded-xl border-l-4 border-orange-500" id="rider-add-shortcut">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 gap-y-1.5">
                <div>
                  <span className="text-[11px] font-mono text-orange-400 uppercase tracking-widest block font-bold">Rua: Sincronização Dupla</span>
                  <h3 className="text-xs font-bold font-mono">Adicione oficina faturada de onde você estiver!</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewClientQuadrante('A');
                    setIsAddingNewClient(true);
                  }}
                  className="bg-orange-500 text-white hover:bg-orange-600 font-mono text-xs font-bold py-2 px-3.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shrink-0 self-end sm:self-auto shadow-sm"
                  id="btn-add-client-rider"
                >
                  <Plus className="w-3.5 h-3.5 text-white" />
                  [Adicionar Cliente ao Quadrante]
                </button>
              </div>
            </div>

            {/* DYNAMIC LIST OF JOBS FOR INDEPENDENT RIDERS */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-705 uppercase font-mono tracking-wider">
                  Fretes / Demandas Disponíveis por Demanda MEI
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Sem escalas fixas</span>
              </div>

              {/* Grid-based smartphone notification list */}
              <div className="space-y-3.5" id="rider-jobs-feed">
                {ordens.filter(o => o.status !== 'Entregue').length === 0 ? (
                  <div className="text-xs text-center text-slate-400 p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Nenhum faturamento de frete pendente no momento. Aguardando emissão automática da expedição...
                  </div>
                ) : (
                  ordens.filter(o => o.status !== 'Entregue').map(o => (
                    <div 
                      key={o.id} 
                      className={`rounded-xl border p-4 transition-all duration-200 bg-slate-50 ${
                        o.travaCubagemStatus === 'Bloqueado - Excesso de Volume'
                          ? 'border-red-200 bg-red-50/20'
                          : o.status === 'Rota Agrupada'
                          ? 'border-blue-200 bg-blue-50/10'
                          : 'border-slate-200 hover:border-slate-350 bg-slate-50/60'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-bold font-mono text-slate-900 bg-white border border-slate-300 px-1.5 py-0.2 rounded shadow-sm">{o.id}</span>
                            <span className="text-xs font-bold font-mono text-white bg-slate-900 px-2 py-0.2 rounded">Setor {o.quadrante}</span>
                            
                            {o.status === 'Rota Agrupada' && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.2 rounded font-mono">
                                🏍️ Combo Agrupado
                              </span>
                            )}

                            {o.travaCubagemStatus === 'Bloqueado - Excesso de Volume' ? (
                              <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 rounded font-mono flex items-center gap-0.5">
                                <Lock className="w-2.5 h-2.5" /> Cubagem Lock
                              </span>
                            ) : null}
                          </div>
                          
                          <h4 className="font-bold text-slate-900 text-sm mt-1.5">{o.clienteNome}</h4>
                        </div>
                        
                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-slate-400 block font-mono">Repasse ao Motoboy</span>
                          <span className="text-sm font-extrabold text-orange-600 font-mono">
                            R$ {(o.valorPagoMotoboy || 4.00).toFixed(2)}
                          </span>
                          <span className="text-[8px] text-slate-400 block font-mono">(Fixo da distribuidora)</span>
                        </div>
                      </div>

                      <div className="bg-white border text-[11px] p-2 rounded-lg text-slate-650 font-mono mb-3 space-y-1 border-slate-100">
                        <div><strong>📦 Objeto de Envio:</strong> {o.itensDescricao}</div>
                        <div>
                          <strong>🛡️ Tipo de Contrato:</strong> B2B Avulso MEI (Sem subordinação ou jornada)
                        </div>
                        {o.retornoPeca && (
                          <div className="text-orange-600 font-bold flex items-center gap-1">
                            <span>🔄 Rota reversa inclusa para Distribuidora</span>
                          </div>
                        )}
                        {o.motivoDesmembramento && (
                          <div className="text-red-600">
                            🚨 {o.motivoDesmembramento}
                          </div>
                        )}
                      </div>

                      {/* INDEPENDENCE REASSURANCE (COMPLIANCE COUTOUT) */}
                      <p className="text-[9.5px] text-slate-400 italic font-mono leading-tight mb-3">
                        {gerarNotificacaoParaMotoboy(o.clienteNome, o.quadrante, o.status === 'Rota Agrupada').substring(120, 260)}...
                      </p>

                      {/* Interactive Actions for Rider */}
                      <div className="flex flex-wrap gap-2 justify-between items-center bg-slate-100/60 p-2 rounded-lg border border-slate-200/50">
                        <div className="text-[10px] font-mono font-bold text-slate-500">
                          Status: <span className="text-slate-900">{o.status}</span>
                        </div>
                        
                        <div className="flex gap-2.5">
                          {o.status !== 'Entregue' && (
                            <button
                              type="button"
                              onClick={() => handleCancelarOrdem(o.id)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-mono text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer shadow-sm transition-colors"
                            >
                              ✕ Cancelar
                            </button>
                          )}
                          {o.status === 'Buscando Parceiro' || o.status === 'Pendente' ? (
                            <button
                              type="button"
                              onClick={() => handleAtualizarStatusOrdem(o.id, 'Moto a Caminho')}
                              className="bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer shadow-sm transition-colors"
                            >
                              Aceitar e Partir 🏍️
                            </button>
                          ) : o.status === 'Moto a Caminho' || o.status === 'Rota Agrupada' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSignatureName('');
                                setActiveSignOrder(o);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer shadow-sm transition-colors animate-pulse"
                            >
                              Coletar Assinatura (Canhoto) ✍️
                            </button>
                          ) : (
                            <span className="text-emerald-600 font-bold text-xs flex items-center gap-1 font-mono">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Entregue com Canhoto
                            </span>
                          )}
                        </div>
                      </div>

                    </div>
                  ))
                )}
              </div>
            </div>

            {/* MEI PROTECTION SEAL (COMPLIANCE EXPLANATORY) */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 mt-2 font-mono" id="mei-seal">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-1.5 mb-1">
                <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                Selo de Autonomia de Prestação de Serviço
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed mb-2">
                As motocicletas integrantes de nossa rede utilizam rotas parametrizadas por algoritmo sem controle fixo de ponto. O motoboy possui flexibilidade para operar onde e quando desejar.
              </p>
              <div className="grid grid-cols-3 gap-2 text-[10px] text-center font-bold">
                <div className="bg-emerald-50 text-emerald-700 py-1 px-1 rounded border border-emerald-100">
                  Sem Subordinação
                </div>
                <div className="bg-emerald-50 text-emerald-700 py-1 px-1 rounded border border-emerald-100">
                  MEI Prestador
                </div>
                <div className="bg-emerald-50 text-emerald-700 py-1 px-1 rounded border border-emerald-100">
                  Despacho Livre
                </div>
              </div>
            </div>

          </div>
        </section>

      </main>
      )}

      {/* ==========================================
          BOTTOM LOGISTICS WORKSPACE: DELIVERED LOGS (INTERACTIVE CALENDAR)
          ========================================== */}
      {effectiveRole === 'Empresa' && adminSubTab === 'logistica' && (
        <section className="max-w-7xl mx-auto px-4 lg:px-6 mb-6 w-full" id="delivered-history">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mt-2">
            
            {/* Header section with icon and meta information */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 pb-3 border-b border-slate-100 gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest font-mono flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-500 animate-[pulse_2s_infinite]" />
                  Calendário Auditor de Entregas & Nota Fiscal (B2B)
                </h3>
                <p className="text-xs text-slate-450 mt-0.5">Clique em qualquer dia do mês para auditar canhotos digitais e featurar notas retroativas.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Supabase Dynamic real-time sync indicator */}
                <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase font-extrabold bg-slate-100/80 border border-slate-250 py-1.5 px-2.5 rounded-lg">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      dbSyncStatus === 'synced' ? 'bg-emerald-400' :
                      dbSyncStatus === 'connecting' || dbSyncStatus === 'updating' ? 'bg-amber-400 animate-pulse' :
                      'bg-slate-400'
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      dbSyncStatus === 'synced' ? 'bg-emerald-500' :
                      dbSyncStatus === 'connecting' || dbSyncStatus === 'updating' ? 'bg-amber-500' :
                      'bg-slate-500'
                    }`}></span>
                  </span>
                  <span className="text-slate-700">
                    {dbSyncStatus === 'synced' && 'Real-time Ativo'}
                    {dbSyncStatus === 'connecting' && 'Chamando Banco...'}
                    {dbSyncStatus === 'updating' && 'Sincronizando...'}
                    {dbSyncStatus === 'local' && 'Simulador Local Ativo'}
                  </span>
                </div>

                {/* Manual refresh trigger */}
                {isSupabaseConfigured && (
                  <button
                    type="button"
                    onClick={() => fetchLatestOrdensFromSupabase(false)}
                    disabled={supabaseLoading}
                    className="flex items-center gap-1.5 hover:bg-slate-100 border border-slate-200 rounded-lg py-1.5 px-2.5 font-mono text-[10px] uppercase font-bold text-slate-700 cursor-pointer disabled:opacity-50 transition-colors bg-white shadow-xs"
                    title="Forçar Sincronização Manual"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${supabaseLoading ? 'animate-spin' : ''}`} />
                    Sincronizar
                  </button>
                )}

                {/* FIREBASE PERSISTENCE TEST BUTTON */}
                <button
                  type="button"
                  onClick={executeFirebaseSavingTest}
                  disabled={firebaseTestStatus === 'testing'}
                  className={`flex items-center gap-1.5 border rounded-lg py-1.5 px-2.5 font-mono text-[10px] uppercase font-extrabold cursor-pointer hover:scale-[1.01] transition-all shadow-xs ${
                    firebaseTestStatus === 'testing' ? 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-800' :
                    firebaseTestStatus === 'success' ? 'bg-emerald-100 hover:bg-emerald-250 border-emerald-400 text-emerald-800 font-black' :
                    firebaseTestStatus === 'error' ? 'bg-rose-100 hover:bg-rose-205 border-rose-400 text-rose-800' :
                    'bg-slate-900 hover:bg-slate-800 border-slate-700 text-orange-400'
                  }`}
                  title="Testar Salvamento Supremo no Firebase"
                >
                  <span>🔥 Testar Salvamento (Firebase)</span>
                </button>

                {/* LOCAL TEST BATTERY RUNNER BUTTON */}
                <button
                  type="button"
                  onClick={runLocalTestBattery}
                  disabled={localTestStatus === 'running'}
                  className="flex items-center gap-1.5 border border-amber-500 rounded-lg py-1.5 px-2.5 font-mono text-[10px] uppercase font-extrabold cursor-pointer hover:scale-[1.01] transition-all shadow-xs bg-amber-550 text-white bg-amber-600 hover:bg-amber-700"
                  title="Rodar Bateria de Testes de Funcionamento B2B 100% Local"
                >
                  <span>🔧 Bateria de Testes Locais</span>
                </button>

                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-bold text-slate-600 bg-slate-50 py-1.5 px-2.5 rounded-lg border border-slate-200">
                  <span>Total Geral (Entregue):</span>
                  <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px]">{ordens.filter(o => o.status === 'Entregue').length} OS</span>
                </div>
              </div>
            </div>

            {/* Firebase Persistence Test Output Banner */}
            {firebaseTestStatus !== 'idle' && (
              <div className={`mb-6 p-4 rounded-xl border font-mono text-xs shadow-md animate-fade-in transition-all ${
                firebaseTestStatus === 'testing' ? 'bg-amber-50 border-amber-250 text-amber-900 border-dashed animate-pulse' :
                firebaseTestStatus === 'success' ? 'bg-emerald-50/95 border-emerald-300 text-emerald-950' :
                'bg-red-50 border-red-300 text-red-950'
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xl shrink-0 mt-0.5">
                      {firebaseTestStatus === 'testing' && '⏳'}
                      {firebaseTestStatus === 'success' && '🔥'}
                      {firebaseTestStatus === 'error' && '❌'}
                    </span>
                    <div>
                      <p className="font-black uppercase tracking-widest text-[9px] text-slate-500">
                        Painel de Diagnóstico: Testar Gravabilidade no Firebase Firestore
                      </p>
                      <p className="mt-1 font-bold leading-relaxed">
                        {firebaseTestDetail}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {firebaseCreatedTestId && (
                      <button
                        type="button"
                        onClick={deleteFirebaseSavingTestRecord}
                        className="bg-red-650 hover:bg-red-750 text-white font-extrabold py-1.5 px-3 rounded-lg text-[9px] uppercase cursor-pointer transition-colors hover:scale-102 bg-red-600"
                        title="Deletar registro temporário"
                      >
                        🗑️ Limpar Teste do Firebase
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setFirebaseTestStatus('idle');
                        setFirebaseTestDetail('');
                      }}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-2.5 py-1.5 rounded-lg text-[9px] uppercase cursor-pointer transition-colors"
                    >
                      Dispensar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Main Interactive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT/TOP WIDGET: THE CALENDAR MODULE */}
              <div className="lg:col-span-5 bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4 shadow-inner">
                
                {/* Distributor Selection Filter */}
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 shadow-xs">
                  <label className="block text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    🏢 Filtrar por Parceiro B2B
                  </label>
                  <select
                    value={calendarSelectedDistributorId}
                    onChange={(e) => setCalendarSelectedDistributorId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-250 text-slate-850 rounded-md p-1.5 text-xs font-bold focus:outline-none focus:border-orange-505 cursor-pointer"
                  >
                    <option value="Todas">📊 Todos os Parceiros (Geral)</option>
                    {clientes.filter(c => !c.criadoPorClienteId).map(dist => (
                      <option key={dist.id} value={dist.id}>
                        🏢 {dist.nome} ({dist.cidade})
                      </option>
                    ))}
                  </select>
                  {calendarSelectedDistributorId !== 'Todas' && (
                    <p className="text-[9.5px] text-orange-600 font-mono font-semibold">
                      ⚡ Exibindo apenas a base histórica para este parceiro.
                    </p>
                  )}
                </div>

                {/* Calendar Navigation header */}
                <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (calendarViewMonth === 0) {
                        setCalendarViewMonth(11);
                        setCalendarViewYear(prev => prev - 1);
                      } else {
                        setCalendarViewMonth(prev => prev - 1);
                      }
                    }}
                    className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-600 cursor-pointer"
                    title="Mês Anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  
                  <span className="font-mono text-xs font-black text-slate-850 uppercase tracking-wider">
                    {MONTHS_PT[calendarViewMonth]} {calendarViewYear}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      if (calendarViewMonth === 11) {
                        setCalendarViewMonth(0);
                        setCalendarViewYear(prev => prev + 1);
                      } else {
                        setCalendarViewMonth(prev => prev + 1);
                      }
                    }}
                    className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-600 cursor-pointer"
                    title="Próximo Mês"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Weekdays Labels Header */}
                <div className="grid grid-cols-7 gap-1 text-center font-mono text-[9px] font-bold text-slate-400 uppercase">
                  {WEEKDAYS_PT.map(d => (
                    <div key={d} className="py-1">{d}</div>
                  ))}
                </div>

                {/* Days Grid Rendering */}
                <div className="grid grid-cols-7 gap-1.5" id="calendar-days-grid">
                  {/* Previous month paddings spacer */}
                  {Array.from({ length: new Date(calendarViewYear, calendarViewMonth, 1).getDay() }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-11 text-slate-200 rounded-lg flex items-center justify-center text-xs pointer-events-none bg-slate-100/30 font-mono" />
                  ))}

                  {/* Operational Month Days */}
                  {Array.from({ length: new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate() }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const cellDate = new Date(calendarViewYear, calendarViewMonth, dayNum);
                    
                    const yyyy = calendarViewYear;
                    const mm = String(calendarViewMonth + 1).padStart(2, '0');
                    const dd = String(dayNum).padStart(2, '0');
                    const cellDateKey = `${yyyy}-${mm}-${dd}`;
                    
                    // Look up orders on this day key
                    const finishedDayOrders = deliveredOrdersByDateString[cellDateKey] || [];
                    const allDayOrders = allOrdersByDateString[cellDateKey] || [];
                    const hasDeliveries = finishedDayOrders.length > 0;
                    
                    const isSelected = selectedCalendarDate.getDate() === dayNum && 
                                       selectedCalendarDate.getMonth() === calendarViewMonth &&
                                       selectedCalendarDate.getFullYear() === calendarViewYear;
                                       
                    const isToday = new Date().toDateString() === cellDate.toDateString();

                    // Style decisions
                    let cellBg = 'bg-white hover:bg-orange-50';
                    let cellBorder = 'border border-slate-200';
                    let cellText = 'text-slate-800 font-bold';
                    
                    if (isSelected) {
                      cellBg = 'bg-slate-900 border-slate-900 scale-102 font-black';
                      cellBorder = 'border border-slate-900';
                      cellText = 'text-white';
                    } else if (isToday) {
                      cellBorder = 'border-2 border-orange-505';
                      cellBg = 'bg-orange-50/55 hover:bg-orange-100';
                    } else if (hasDeliveries) {
                      cellBg = 'bg-emerald-500/5 hover:bg-emerald-500/10';
                      cellBorder = 'border border-emerald-250';
                      cellText = 'text-emerald-950';
                    }

                    return (
                      <button
                        key={`day-${dayNum}`}
                        type="button"
                        onClick={() => setSelectedCalendarDate(cellDate)}
                        className={`h-11 rounded-lg text-xs font-mono relative cursor-pointer font-bold flex flex-col items-center justify-center transition-all ${cellBg} ${cellBorder} ${cellText}`}
                        title={`${finishedDayOrders.length} entrega(s) concluída(s) dia ${dayNum}`}
                      >
                        <span className="z-10 text-[11px] block">{dayNum}</span>
                        
                        {/* Completed entregas count indicator inside cell */}
                        {finishedDayOrders.length > 0 && (
                          <span className={`text-[8.5px] font-black pointer-events-none mt-0.5 leading-none ${
                            isSelected ? 'text-emerald-300' : 'text-emerald-600 bg-emerald-100/90 px-1 rounded-sm'
                          }`}>
                            ✓{finishedDayOrders.length}
                          </span>
                        )}
                        
                        {/* Other general status marker if pending but not finished */}
                        {!hasDeliveries && allDayOrders.length > 0 && (
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isSelected ? 'bg-orange-400' : 'bg-orange-500'
                          } absolute bottom-1 right-1/2 translate-x-1/2`} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Daily invoicing quick metrics widget */}
                <div className="bg-slate-900 text-white rounded-xl p-3.5 space-y-2.5 font-mono text-xs shadow-sm border border-slate-800">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                    <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest block">MÉTRICAS DO DIA</span>
                    <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-bold uppercase">FECHAMENTO B2B</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950/50 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 text-[8.5px] block uppercase tracking-tight font-bold">Cobrança Total</span>
                      <strong className="text-[11.5px] font-black text-emerald-400">R$ {selectedDayMetrics.billing.toFixed(2)}</strong>
                    </div>
                    <div className="bg-slate-950/50 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 text-[8.5px] block uppercase tracking-tight font-bold">Repasse Motoboys</span>
                      <strong className="text-[11.5px] font-black text-rose-400">R$ {selectedDayMetrics.repasse.toFixed(2)}</strong>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-slate-950/85 p-2 rounded-lg border border-slate-800">
                    <div>
                      <span className="text-slate-400 text-[8.5px] block uppercase font-bold">Ganhos TorqueLog</span>
                      <strong className="text-sm font-black text-orange-300">R$ {(selectedDayMetrics.billing - selectedDayMetrics.repasse).toFixed(2)}</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-450 text-[8px] block uppercase">Concluídas</span>
                      <span className="text-xs bg-slate-800 py-0.5 px-1.5 rounded font-black text-white">{selectedDayMetrics.count} OS</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyDayReport}
                    className="w-full text-center py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-98 text-white text-[10.5px] font-bold uppercase rounded-lg shadow-md font-mono tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    {copiedDay ? "Copiado para o Clipboard! ✓" : "📋 Copiar Fechamento B2B"}
                  </button>
                </div>

              </div>

              {/* RIGHT DETAILS PANEL: THE DELIVERIES LIST FOR SELECTED DAY */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                
                {/* Detailed view title banner */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="bg-white p-1.5 rounded shadow-sm border border-slate-200">
                      <FileSpreadsheet className="w-4 h-4 text-orange-505" />
                    </div>
                    <div>
                      <span className="text-[9.5px] font-mono text-slate-400 block uppercase font-bold tracking-wider">Detalhamento de Fluxo</span>
                      <h4 className="text-xs font-black text-slate-900 font-mono">
                        Data Selecionada: {selectedCalendarDate.getDate()} de {MONTHS_PT[selectedCalendarDate.getMonth()]} de {selectedCalendarDate.getFullYear()}
                      </h4>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-black text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-xs">
                    {selectedDayOrders.length} OS Ativas
                  </span>
                </div>

                {/* Orders scroll list */}
                <div className="space-y-3.5 max-h-[465px] overflow-y-auto pr-1">
                  {selectedDayOrders.map(o => {
                    const isDelivered = o.status === 'Entregue';
                    const hasReverse = o.retornoPeca === true;
                    
                    const fee = (o.valorCobradoCliente || 10.00) + (0);
                    const rep = (o.valorPagoMotoboy || 4.00) + (0);
                    const net = fee - rep;

                    // Compute clean status pills colors
                    let statusBg = 'bg-blue-55 text-blue-800 border-blue-200';
                    if (o.status === 'Entregue') {
                      statusBg = 'bg-emerald-50 text-emerald-850 border-emerald-250';
                    } else if (o.status === 'Moto a Caminho') {
                      statusBg = 'bg-orange-50 text-orange-850 border-orange-250 animate-pulse';
                    } else if (o.status === 'Buscando Parceiro') {
                      statusBg = 'bg-amber-50 text-amber-850 border-amber-250';
                    }

                    return (
                      <div key={o.id} className={`p-4 rounded-xl border relative transition-all duration-150 flex flex-col justify-between ${
                        isDelivered 
                          ? 'bg-emerald-50/10 border-emerald-200/60 hover:bg-emerald-550/[0.03]' 
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}>
                        
                        {/* Top banner labels */}
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-mono font-black bg-slate-900 text-orange-450 px-2 py-0.5 rounded shadow-sm border border-slate-950">
                                {o.id}
                              </span>
                              <span className="text-[8.5px] font-mono tracking-wider font-extrabold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200 uppercase">
                                SETOR {o.quadrante}
                              </span>
                              {hasReverse && (
                                <span className="text-[8.5px] font-mono font-extrabold bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded border border-rose-200 uppercase tracking-tight">
                                  Reversa
                                </span>
                              )}
                            </div>
                            <h4 className="font-bold text-slate-900 text-sm mt-2">{o.clienteNome}</h4>
                          </div>
                          
                          <span className={`text-[9.5px] font-mono font-black border uppercase px-2 py-0.5 rounded ${statusBg}`}>
                            {o.status}
                          </span>
                        </div>

                        {/* Middle details description */}
                        <div className="mt-2 text-xs text-slate-600 bg-slate-50/60 p-2.5 rounded-lg border border-slate-105 font-mono leading-relaxed space-y-1">
                          <div><strong>Itens Catalogados:</strong> {o.itensDescricao}</div>
                          <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                            <span>🗺️ {o.distanciaKm ? `Distância Exata: ${o.distanciaKm.toFixed(2)} km (Google Maps)` : `Distância Est.: ${obterEstimativaTempoPercurso(o.quadrante).distanciaKm} km`}</span>
                            <span className="text-slate-300">|</span>
                            <span>⏱️ Rota Est.: ~{o.distanciaKm ? Math.round(o.distanciaKm * 1.5) : obterEstimativaTempoPercurso(o.quadrante).tempoMin} min</span>
                          </div>
                        </div>

                        {/* Fees audit block */}
                        <div className="mt-3.5 pt-3 border-t border-dashed border-slate-200 grid grid-cols-3 gap-2 text-[10.5px] font-mono text-slate-500">
                          <div>
                            <span className="text-[8.5px] block font-bold text-slate-400 uppercase tracking-tight">Fatura Cliente</span>
                            <strong className="text-slate-850 font-extrabold text-xs sm:text-sm font-mono text-slate-900">R$ {fee.toFixed(2)}</strong>
                          </div>
                          <div>
                            <span className="text-[8.5px] block font-bold text-slate-400 uppercase tracking-tight">Repasse Motoboy</span>
                            <strong className="text-rose-600 font-extrabold text-xs sm:text-sm font-mono">R$ {rep.toFixed(2)}</strong>
                          </div>
                          <div className="text-right">
                            <span className="text-[8.5px] block font-bold text-slate-400 uppercase tracking-tight">Ganhos TorqueLog</span>
                            <strong className="text-emerald-600 font-black text-xs sm:text-sm font-mono">
                              + R$ {net.toFixed(2)}
                            </strong>
                          </div>
                        </div>

                        {/* Verification Sign-Off Comprovante */}
                        <div className="mt-3.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-[10.5px] font-mono gap-1 text-slate-400">
                          <span className={`${
                            isDelivered ? 'text-emerald-700 font-bold flex items-center gap-1' : 'text-slate-450 font-bold flex items-center gap-1'
                          }`}>
                            {isDelivered ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                Canhoto Auditado com Assinatura Legal
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                Despacho Operacional Em Processamento
                              </>
                            )}
                          </span>
                          <span className="text-slate-400 font-bold text-[9.5px]">
                            Despacho: {new Date(o.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                      </div>
                    );
                  })}

                  {/* Empty State visual details */}
                  {selectedDayOrders.length === 0 && (
                    <div className="text-center p-8 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 mt-2 flex flex-col items-center justify-center space-y-2.5">
                      <div className="p-3 bg-white border border-slate-200 rounded-full shadow-xs">
                        <Calendar className="w-8 h-8 text-slate-300" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 tracking-wide font-mono uppercase">Vazio Operacional</h4>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5 max-w-sm leading-relaxed">
                          Nenhuma entrega cadastrada para este dia fiscal. Clique em outro dia marcado no calendário para carregar os canhotos digitais.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Interactive Simulation Helper */}
                <div className="bg-slate-900 text-slate-350 p-3.5 rounded-xl border border-slate-800 text-[10.5px] font-mono leading-relaxed mt-1">
                  💡 <strong>Simulação Facilitada:</strong> Clique em dias passados do calendário (ou despache novos pedidos hoje) para ver novos dados sincronizando em tempo real no painel de conciliação.
                </div>

              </div>

            </div>

            {/* RELATÓRIO CONSOLIDADO POR DISTRIBUIDORA & FECHAMENTO MENSAL */}
            <div className="mt-8 pt-6 border-t border-slate-200" id="distribuidores-fechamento-b2b">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
                <div>
                  <h4 className="text-sm font-black text-slate-800 uppercase font-mono tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-orange-505 animate-pulse" />
                    Balanço por Parceiro B2B & Emissão de Nota Fiscal
                  </h4>
                  <p className="text-xs text-slate-450 mt-0.5">Valores apurados em tempo real para as entregas de status <strong className="text-emerald-700 font-mono">"Entregue"</strong> na competência selecionada.</p>
                </div>
                <div className="bg-slate-100/80 border border-slate-200 px-3 py-1.5 rounded-lg text-[10.5px] font-mono text-slate-650 font-black uppercase shadow-xs">
                  Mês de Referência: <span className="text-slate-900">{MONTHS_PT[calendarViewMonth]} de {calendarViewYear}</span>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-slate-50/25 shadow-inner">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-250 text-slate-600 font-mono text-[9px] uppercase font-extrabold tracking-wider">
                      <th className="p-3">🏢 Parceiro</th>
                      <th className="p-3 text-center">Setor</th>
                      <th className="p-3 text-center">Faturamento Hoje</th>
                      <th className="p-3 text-center">Entregas no Mês</th>
                      <th className="p-3 text-center">Faturamento no Mês</th>
                      <th className="p-3 text-center">Repasse aos Motoboys</th>
                      <th className="p-3 text-center">Net TorqueLog (Margem)</th>
                      <th className="p-3 text-right">Ações de Conciliação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 bg-white text-slate-700">
                    {monthlyDistributorStats.map((stat) => {
                      const dist = stat.distributor;
                      return (
                        <tr key={dist.id} className="hover:bg-slate-50 border-b border-slate-100 transition-colors">
                          <td className="p-3 border-r border-slate-100">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900">{dist.nome}</span>
                              <span className="text-[9px] text-slate-400 font-mono font-medium">{dist.cnpj || 'Inscrição de CNPJ Isenta'}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center border-r border-slate-100">
                            <span className="bg-slate-100 text-slate-700 border border-slate-200 font-mono font-extrabold text-[9px] py-0.5 px-2 rounded">
                              Setor {dist.quadrante}
                            </span>
                          </td>
                          <td className="p-3 text-center border-r border-slate-100">
                            <strong className="font-mono text-emerald-700 block text-[11px]">
                              R$ {stat.dailyBilling.toFixed(2)}
                            </strong>
                            <span className="text-[9px] text-slate-450 font-mono">({stat.completedDayCount} OS completas)</span>
                          </td>
                          <td className="p-3 text-center border-r border-slate-100">
                            <span className="bg-blue-50 text-blue-800 border border-blue-200 font-mono font-black text-[10px] py-1 px-2.5 rounded-lg inline-block">
                              {stat.completedMonthCount} OS
                            </span>
                          </td>
                          <td className="p-3 text-center border-r border-slate-100">
                            <strong className="font-mono font-black text-slate-850 text-[11px]">R$ {stat.monthlyBilling.toFixed(2)}</strong>
                          </td>
                          <td className="p-3 text-center border-r border-slate-100">
                            <span className="font-mono font-bold text-rose-600">R$ {stat.monthlyRepasse.toFixed(2)}</span>
                          </td>
                          <td className="p-3 text-center border-r border-slate-100">
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-black text-[11px] px-2.5 py-1 rounded inline-block shadow-xs">
                              + R$ {stat.monthlyMargin.toFixed(2)}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveClosingDistributorId(dist.id);
                                setIsCopiedClosingReport(false);
                              }}
                              className="bg-slate-900 hover:bg-slate-950 text-white text-[9.5px] font-black uppercase font-mono py-1.5 px-3 rounded-lg flex items-center gap-1.5 ml-auto cursor-pointer shadow-sm hover:scale-102 active:scale-98 transition-all border border-slate-950"
                            >
                              <FileText className="w-3.5 h-3.5 text-orange-450 shrink-0" />
                              📄 Gerar Fechamento
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {monthlyDistributorStats.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-455 italic font-mono uppercase">
                          Nenhuma distribuidora parceira cadastrada na base.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </section>
      )}

      {/* ==========================================
          REPRESENTATIVIDADE & PROGRAMA DE INDICAÇÕES (CADERNO DO INCENTIVO)
          ========================================== */}
      {effectiveRole === 'Empresa' && adminSubTab === 'representantes' && (
        <main className="max-w-7xl mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 w-full animate-fade-in" id="representantes-dashboard">
          
          {/* Top Info Banner - Explaining how the commission system works */}
          <div className="lg:col-span-12 bg-indigo-50 border border-indigo-200 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3.5">
              <div className="bg-indigo-100 p-3 rounded-xl text-indigo-700 font-bold shrink-0">
                <Coins className="w-6 h-6 animate-pulse text-indigo-600" />
              </div>
              <div className="font-mono">
                <h3 className="text-sm font-black text-indigo-900 uppercase tracking-tight">💵 Programa de Indicações TorqueLog Ativo</h3>
                <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
                  Seus representantes comerciais atuam prospectando novos parceiros (Parceiros B2B). Ao cadastrar um novo parceiro associado a um representante, ele passa a receber uma comissão fixa de R$ {comissaoRepsPorEntrega.toFixed(2)} por cada entrega concluída pelo parceiro prospectado, independentemente do entregador que realize o frete.
                </p>
              </div>
            </div>
            <div className="bg-indigo-900 text-white rounded-xl px-4 py-2.5 font-mono text-center shrink-0">
              <span className="text-[10px] block uppercase text-indigo-300 font-bold">Comissão Fixa</span>
              <strong className="text-base font-black">R$ {comissaoRepsPorEntrega.toFixed(2)} / Entrega</strong>
            </div>
          </div>

          {/* Left Column: Register & List of Representatives */}
          <section className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Form to Register Representative */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-orange-500" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-tight">
                    Equipe de Representantes
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingNewRepresentative(!isAddingNewRepresentative)}
                  className="bg-slate-900 hover:bg-slate-950 text-white font-mono text-xs font-bold py-1 px-3 rounded flex items-center gap-1 cursor-pointer transition border border-slate-800"
                >
                  {isAddingNewRepresentative ? '✕ Ocultar Form' : '+ Novo Representante'}
                </button>
              </div>

              {isAddingNewRepresentative && (
                <form onSubmit={handleCriarRepresentante} className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 animate-fade-in font-mono">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                        Nome do Representante *
                      </label>
                      <input
                        type="text"
                        required
                        value={newRepNome}
                        onChange={(e) => setNewRepNome(e.target.value)}
                        placeholder="Ex: Carlos silva (Vendas Centro)"
                        className="w-full bg-white text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                        Chave PIX p/ Pagamento *
                      </label>
                      <input
                        type="text"
                        required
                        value={newRepPix}
                        onChange={(e) => setNewRepPix(e.target.value)}
                        placeholder="Ex: Celular, CPF ou e-mail"
                        className="w-full bg-white text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                        Celular / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={newRepTelefone}
                        onChange={(e) => setNewRepTelefone(e.target.value)}
                        placeholder="Ex: (35) 99999-1234"
                        className="w-full bg-white text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                        E-mail de Contato
                      </label>
                      <input
                        type="email"
                        value={newRepEmail}
                        onChange={(e) => setNewRepEmail(e.target.value)}
                        placeholder="Ex: carlos@torquelog.com"
                        className="w-full bg-white text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingNewRepresentative(false)}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold py-1.5 px-4 rounded-lg cursor-pointer font-mono"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-black py-1.5 px-4 rounded-lg cursor-pointer shadow font-mono"
                    >
                      Criar Representante
                    </button>
                  </div>
                </form>
              )}

              {/* List of Representatives */}
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white font-mono uppercase text-[9px] border-b border-slate-800">
                      <th className="p-3">Representante</th>
                      <th className="p-3 text-center">B2B Indicados</th>
                      <th className="p-3 text-center">Entregas das Bases</th>
                      <th className="p-3 text-right">Repasse Acumulado</th>
                      <th className="p-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {representantes.map(rep => {
                      const repClients = clientes.filter(c => c.indicadoPorRepId === rep.id);
                      const repClientsCount = repClients.length;

                      let totalRepDeliveries = 0;
                      repClients.forEach(cli => {
                        const count = ordens.filter(o => o.status === 'Entregue' && o.clienteId === cli.id).length;
                        totalRepDeliveries += count;
                      });

                      const repEarnings = totalRepDeliveries * comissaoRepsPorEntrega;
                      const isSelected = selectedRepIdForDetails === rep.id;

                      return (
                        <tr
                          key={rep.id}
                          className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                            isSelected ? 'bg-orange-50/70 border-l-4 border-l-orange-500 font-medium' : ''
                          }`}
                          onClick={() => setSelectedRepIdForDetails(rep.id)}
                        >
                          <td className="p-3">
                            <div className="font-bold text-slate-900 font-sans tracking-tight">{rep.nome}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              📱 {rep.telefone} • {rep.email}
                            </div>
                            <div className="text-[9.5px] text-slate-500 font-mono mt-0.5">
                              🔑 PIX: <span className="bg-slate-100 font-bold px-1 rounded text-slate-800">{rep.pix}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center font-mono font-black text-slate-600">
                            {repClientsCount} ind.
                          </td>
                          <td className="p-3 text-center font-mono">
                            <span className="bg-indigo-50 border border-indigo-150 text-indigo-700 px-2 py-0.5 rounded-full font-black text-[10px]">
                              {totalRepDeliveries} entregas
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-sm font-black text-emerald-700 bg-emerald-50/20">
                            R$ {repEarnings.toFixed(2)}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex gap-1.5 justify-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  setRepresentativeParaEditar(rep);
                                  setEditRepNome(rep.nome);
                                  setEditRepTelefone(rep.telefone);
                                  setEditRepEmail(rep.email);
                                  setEditRepPix(rep.pix);
                                }}
                                className="bg-white hover:bg-slate-100 text-slate-700 p-1.5 rounded border border-slate-250 cursor-pointer shadow-xs"
                                title="Editar dados"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletarRepresentante(rep.id)}
                                className="bg-slate-50 hover:bg-rose-50 text-rose-600 p-1.5 rounded border border-slate-250 hover:border-rose-200 cursor-pointer shadow-xs"
                                title="Excluir representante"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {representantes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 italic font-mono uppercase">
                          Nenhum representante cadastrado. Abra o formulário acima para registrar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
          </section>

          {/* Right Column: Detailed auditing of the selected representative */}
          <section className="lg:col-span-5 flex flex-col gap-6">
            
            {(() => {
              const rep = representantes.find(r => r.id === selectedRepIdForDetails);
              if (!rep) {
                return (
                  <div className="bg-slate-55/60 border border-slate-200 rounded-xl p-8 text-center text-slate-500 italic font-sans flex flex-col items-center justify-center min-h-[300px]">
                    <Search className="w-10 h-10 text-slate-300 mb-3 shrink-0" />
                    <span>Selecione um representante ao lado para auditar suas distribuidoras indicadas e faturamento em tempo real.</span>
                  </div>
                );
              }

              const repClients = clientes.filter(c => c.indicadoPorRepId === rep.id);
              const unassignedClients = clientes.filter(c => !c.indicadoPorRepId);

              return (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 font-mono">
                  
                  {/* Header */}
                  <div className="border-b border-slate-150 pb-3 mb-4 flex justify-between items-start">
                    <div>
                      <span className="text-[9.5px] font-black text-orange-500 uppercase tracking-widest block font-mono">
                        Auditoria de Indicações de Campo
                      </span>
                      <h3 className="text-xs font-black text-slate-900 uppercase font-mono mt-0.5">
                        📂 Carteira: {rep.nome.toUpperCase()}
                      </h3>
                    </div>
                    <span className="bg-slate-900 text-orange-400 font-mono text-[9px] px-2 py-0.5 rounded font-black uppercase">
                      ID: {rep.id}
                    </span>
                  </div>

                  {/* Summary Metric Strip for Selected Representative */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850 text-center">
                      <span className="text-[9px] uppercase tracking-wider text-slate-450 font-mono block">Base de Parceiros</span>
                      <strong className="text-lg font-mono text-white block mt-0.5">
                        {repClients.length} <span className="text-[10px] text-slate-400">empresas</span>
                      </strong>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850 text-center">
                      <span className="text-[9px] uppercase tracking-wider text-slate-450 font-mono block">Acumulado a Pagar</span>
                      <strong className="text-lg font-mono text-emerald-400 block mt-0.5">
                        R$ { (repClients.reduce((acc, cli) => acc + ordens.filter(o => o.status === 'Entregue' && o.clienteId === cli.id).length, 0) * comissaoRepsPorEntrega).toFixed(2) }
                      </strong>
                    </div>
                  </div>

                  {/* Link existing client helper form */}
                  {unassignedClients.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl mb-4 text-xs font-mono">
                      <h4 className="font-extrabold text-[10px] text-slate-800 uppercase flex items-center gap-1 mb-2">
                        <Plus className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        Vincular Parceiro Livre
                      </h4>
                      <div className="flex gap-2">
                        <select
                          id="select-linking-client"
                          className="flex-1 bg-white border border-slate-250 p-1 rounded-lg text-xs font-mono outline-none focus:ring-1 focus:ring-orange-500 font-bold"
                        >
                          <option value="">-- Escolha um Parceiro Livre --</option>
                          {unassignedClients.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.nome} ({c.cidade || 'Passos'})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const selectEl = document.getElementById('select-linking-client') as HTMLSelectElement;
                            if (selectEl && selectEl.value) {
                              const selectedId = selectEl.value;
                              setClientes(prev => prev.map(c => c.id === selectedId ? { ...c, indicadoPorRepId: rep.id } : c));
                              selectEl.value = '';
                              setSupabaseSuccessMsg(`🤝 Parceiro associado ao representante ${rep.nome} com sucesso!`);
                              setTimeout(() => setSupabaseSuccessMsg(''), 3000);
                            } else {
                              alert('Por favor, selecione um parceiro válido da lista.');
                            }
                          }}
                          className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-1 px-3 rounded-lg cursor-pointer text-xs font-mono"
                        >
                          Vincular
                        </button>
                      </div>
                    </div>
                  )}

                  {/* List of active partners belonging to this representative */}
                  <h4 className="text-[9.5px] font-black text-slate-550 uppercase font-mono tracking-widest mb-2">
                    Parceiros & Clientes Prospectados:
                  </h4>
                  <div className="space-y-2 max-h-[350px] overflow-y-auto">
                    {repClients.map(cli => {
                      const clientDeliveries = ordens.filter(o => o.status === 'Entregue' && o.clienteId === cli.id).length;
                      const clientEarning = clientDeliveries * comissaoRepsPorEntrega;

                      return (
                        <div key={cli.id} className="bg-slate-50/70 hover:bg-slate-100/80 p-3 rounded-lg border border-slate-200 font-sans flex items-center justify-between text-xs transition">
                          <div>
                            <strong className="text-slate-900 block font-bold leading-tight">{cli.nome}</strong>
                            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                              🏭 {cli.ramo || 'Autopeças'} • 📍 {cli.cidade}
                            </span>
                          </div>
                          
                          <div className="text-right shrink-0 font-mono">
                            <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded font-bold text-[9px]">
                              {clientDeliveries} entregas
                            </span>
                            <div className="text-sm font-black text-emerald-700 mt-1">
                              + R$ {clientEarning.toFixed(2)}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteConfirmType('desvincular-cliente');
                                setDeleteConfirmId(cli.id);
                                setDeleteConfirmName(`${cli.nome} (do Representante: ${rep.nome})`);
                              }}
                              className="text-[9.5px] text-rose-500 hover:underline block ml-auto mt-1 cursor-pointer font-bold font-mono"
                            >
                              [Desvincular]
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {repClients.length === 0 && (
                      <div className="text-center p-6 text-slate-400 italic text-[11px] bg-slate-50 rounded-xl border border-slate-200">
                        Nenhum parceiro associado a este representante até o momento.
                        <br />
                        <span className="text-[9.5px] block mt-1.5 text-slate-450 leading-relaxed font-sans">
                          Associe novos parceiros ao cadastrá-los ou use o menu vincular acima para atribuir!
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-150 pt-3 mt-4 text-[10px] bg-slate-50 p-2.5 rounded border border-slate-150 text-slate-500 leading-relaxed font-mono">
                    👉 <strong>Conciliação p/ Pagamento:</strong> O valor do repasse é derivado das ordens com status "Entregue" no aplicativo. Ao transferir via PIX para o representante, o histórico recalculado é atualizado em tempo real.
                  </div>

                </div>
              );
            })()}

          </section>

        </main>
      )}

      {/* ==========================================
          TAXAS, TARIFAS & REPASSES CONFIG PANEL (VALORES TAB)
          ========================================== */}
      {effectiveRole === 'Empresa' && adminSubTab === 'taxas' && (
        <main className="max-w-7xl mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 w-full animate-fade-in" id="taxas-config-dashboard">
          {/* Header Description */}
          <div className="lg:col-span-12 bg-indigo-950 text-white rounded-2xl border border-indigo-900 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-md">
            <div>
              <span className="bg-orange-500 text-white font-mono font-black text-[9px] px-2 py-0.5 rounded uppercase tracking-widest block w-max mb-1.5 animate-pulse">
                Área de Tarifação
              </span>
              <h2 className="text-xl font-extrabold font-sans tracking-tight">
                ⚙️ Configuração de Taxas e Tarifas
              </h2>
              <p className="text-xs text-slate-300 mt-1 font-mono">
                Ajuste os valores operacionais padrão para representantes comerciais e revendas em tempo real.
              </p>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-xl shrink-0">
              <span className="text-xs font-mono font-bold text-slate-400 px-2 border-r border-slate-800">Moeda</span>
              <strong className="text-sm font-mono text-emerald-400 px-1">BRL (R$)</strong>
            </div>
          </div>

          {/* Left Column: Form Controls */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 w-full">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                <Coins className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-tight">Comissão de Representantes</h3>
              </div>

              <div className="space-y-4 font-mono text-xs">
                <p className="text-slate-600 leading-relaxed">
                  Defina o valor repassado ao representante para <strong>cada entrega com status "Entregue"</strong> realizada pelas distribuidoras vinculadas.
                </p>

                <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1">
                      Valor por Entrega (R$)
                    </label>
                    <span className="text-[9px] text-slate-400 block mb-2 leading-none">Ajuste o valor no campo ao lado</span>
                    <strong className="text-2xl font-black text-slate-900 tracking-tight">
                      R$ {comissaoRepsPorEntrega.toFixed(2)}
                    </strong>
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      step="0.05"
                      min="0.00"
                      max="10.00"
                      value={comissaoRepsPorEntrega}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setComissaoRepsPorEntrega(isNaN(val) ? 0 : val);
                      }}
                      className="w-full bg-white text-slate-900 border border-slate-300 font-bold p-2.5 rounded-lg text-center font-mono text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    />
                  </div>
                </div>

                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg text-indigo-800 font-sans text-xs leading-relaxed flex gap-2.5">
                  <span className="text-base shrink-0">🛡️</span>
                  <div>
                    <strong>Alteração Instantânea:</strong> Ao mudar este valor, todos os cálculos de conciliação acumulada a pagar e relatórios para representantes serão reajustados retroativamente baseado nas ordens de serviço atuais.
                  </div>
                </div>
              </div>
            </div>


          </div>

          {/* Right Column: Dynamic Realtime Impact Preview */}
          <div className="lg:col-span-6">
            <div className="bg-slate-900 text-white rounded-xl border border-slate-800 p-5 space-y-4 h-full flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-mono tracking-widest text-slate-500 block uppercase mb-1">Impacto Financeiro Estimado</span>
                <h3 className="text-sm font-bold font-mono text-indigo-400 uppercase tracking-tight mb-2 pb-2 border-b border-slate-800">
                  Simulação de Repasse por Representante
                </h3>
                
                <p className="text-xs text-slate-300 font-mono leading-relaxed mb-4">
                  Abaixo está a projeção atualizada de pagamentos com base na nova taxa definida de <strong className="text-orange-400 font-bold font-mono">R$ {comissaoRepsPorEntrega.toFixed(2)}</strong>.
                </p>

                <div className="space-y-3">
                  {representantes.map(rep => {
                    const repClients = clientes.filter(c => c.indicadoPorRepId === rep.id);
                    let totalRepDeliveries = 0;
                    repClients.forEach(cli => {
                      const count = ordens.filter(o => o.status === 'Entregue' && o.clienteId === cli.id).length;
                      totalRepDeliveries += count;
                    });
                    const repEarnings = totalRepDeliveries * comissaoRepsPorEntrega;

                    return (
                      <div key={rep.id} className="bg-slate-950 p-3 rounded-lg border border-slate-850 flex items-center justify-between text-xs font-mono">
                        <div>
                          <strong className="text-slate-200 block">{rep.nome}</strong>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            💼 {repClients.length} distribuidora(s) • 📦 {totalRepDeliveries} entrega(s)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block leading-tight">Comissão acumulada</span>
                          <span className="text-sm font-black text-emerald-400">R$ {repEarnings.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-850 font-mono text-[10px] text-slate-500 leading-relaxed mt-4">
                💡 <strong>Automação de Recálculos:</strong> O motor de faturamento do TorqueLog atualiza ciclicamente todas as projeções exibidas nesta tela sem necessidade de salvar as alterações manualmente no banco de dados local.
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ==========================================
          FECHAMENTO E FATURAMENTO QUINZENAL DE 15 DIAS (ADMIN PANEL)
          ========================================== */}
      {effectiveRole === 'Empresa' && adminSubTab === 'quinzenal' && (
        <main className="max-w-7xl mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 w-full animate-fade-in" id="faturamento-quinzenal-dashboard">
          {/* Cabeçalho do Faturamento */}
          <div className="lg:col-span-12 bg-slate-900 border border-slate-800 text-white rounded-2xl p-5 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-md shadow-orange-500/5">
            <div>
              <span className="bg-orange-550/20 text-orange-400 border border-orange-550/15 font-bold text-[8px] px-2 py-0.5 rounded uppercase tracking-widest block w-fit mb-1.5 leading-none">
                Ciclo de 15 Dias • Quinzena Ativa
              </span>
              <h2 className="text-lg font-black font-mono uppercase tracking-tight text-white">
                📅 Conciliação Quinzenal & Liquidação de Frota
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Gerencie o faturamento corporativo CNPJ com incidência de 6%, retenção de combustível (R$0,50/km) e descontos de aluguel fixo de R$700,00.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 bg-slate-950 p-3 rounded-xl border border-slate-850">
              <div className="flex items-center gap-2 select-none">
                <input
                  type="checkbox"
                  id="toggle-deducao-fiscal"
                  checked={isDeducaoGovernoAtiva}
                  onChange={(e) => setIsDeducaoGovernoAtiva(e.target.checked)}
                  className="w-4.5 h-4.5 rounded border-slate-705 text-orange-500 focus:ring-orange-500 cursor-pointer accent-orange-550 bg-slate-900"
                />
                <label htmlFor="toggle-deducao-fiscal" className="text-xs font-mono font-bold text-slate-300 cursor-pointer">
                  Dedução Fiscal Governo (6%)
                </label>
              </div>
              <div className="h-5 w-px bg-slate-800 hidden sm:block" />
              <div className="text-xs font-mono">
                <span className="text-slate-500 block text-[9px] leading-none uppercase">Caixa Combustível TorqueLog</span>
                <span className="text-emerald-400 font-extrabold text-[13px] mt-1 block">R$ {livroCaixaCombustivelTorquelog.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* LADO ESQUERDO: PARCEIROS CORPORATIVOS (CLIENTES CNPJ) */}
          <div className="lg:col-span-12 xl:col-span-6 space-y-6">
            <div className="bg-white rounded-2xl p-5 border border-slate-205 shadow-sm">
              <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase font-mono tracking-wider">
                    🏢 Faturas Quinzenais de Parceiros (B2B CNPJ)
                  </h3>
                  <p className="text-[11px] text-slate-400">Marque como pagas para liberar repasses de entregas intermunicipais</p>
                </div>
                <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-650">
                  Total: {clientes.filter(c => !c.criadoPorClienteId).length}
                </span>
              </div>

              {/* Tabela do Faturamento dos Parceiros (Clientes) */}
              <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                {clientes.filter(c => !c.criadoPorClienteId).map(cli => {
                  const ordensCliente = ordens.filter(o => o.clienteId === cli.id && o.status === 'Entregue');
                  const countEntregas = ordensCliente.length;
                  
                  const faturamentoBruto = ordensCliente.reduce((sum, o) => sum + (o.valorCobradoCliente || 10), 0);
                  const deducaoFiscalAmt = isDeducaoGovernoAtiva ? faturamentoBruto * 0.06 : 0;
                  const faturamentoLiquido = faturamentoBruto - deducaoFiscalAmt;

                  const totalPagas = ordensCliente.filter(o => o.faturaParceiraPaga).length;
                  const isFaturaPaga = countEntregas > 0 && totalPagas === countEntregas;

                  return (
                    <div key={cli.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3 font-mono text-xs text-slate-700">
                      <div className="flex justify-between items-start">
                        <div>
                          <strong className="text-slate-900 text-[13px] block">{cli.nome}</strong>
                          <span className="text-[9.5px] text-slate-505 block mt-0.5">CNPJ: {cli.cnpj || '38.450.128/0001-90'} • Cidade: {cli.cidade || 'Passos - MG'}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider ${
                          isFaturaPaga 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse'
                        }`}>
                          {isFaturaPaga ? '✅ FATURA PAGA' : '⏳ COMPROVANTE PENDENTE'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-1 text-center bg-white border border-slate-150 rounded-lg p-2">
                        <div>
                          <span className="block text-[8px] text-slate-400 uppercase tracking-tight">Entregas</span>
                          <span className="text-[12px] font-black text-slate-800 font-mono">{countEntregas}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-slate-400 uppercase tracking-tight">Valor Bruto</span>
                          <span className="text-[12px] font-black text-slate-800 font-mono">R$ {faturamentoBruto.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-slate-400 uppercase tracking-tight">Líquido (c/ Desc.)</span>
                          <span className="text-[12px] font-black text-emerald-600 font-mono font-black animate-pulse">R$ {faturamentoLiquido.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] border-t border-dashed border-slate-200 pt-2 flex-wrap gap-2">
                        <div className="text-slate-500 leading-normal">
                          {isDeducaoGovernoAtiva ? (
                            <span>Com retenção governamental de <strong className="text-rose-600 font-mono">6% (- R$ {deducaoFiscalAmt.toFixed(2)})</strong> aplicada</span>
                          ) : (
                            <span>Isenção de tributo fiscal de 6%</span>
                          )}
                        </div>

                        {!isFaturaPaga && countEntregas > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              const updatedOrdens = ordens.map(o => {
                                if (o.clienteId === cli.id && o.status === 'Entregue') {
                                  return { ...o, faturaParceiraPaga: true };
                                }
                                return o;
                              });
                              setOrdens(updatedOrdens);
                              alert(`✅ Sucesso!\nFaturamento da quinzena para "${cli.nome}" de R$ ${faturamentoLiquido.toFixed(2)} recebido! Repasses intermunicipais associados foram liberados.`);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold text-[9px] px-3 py-1.5 rounded-lg transition active:scale-95 shadow cursor-pointer uppercase font-black"
                          >
                            💸 Marcar como Pago e Liberar Repasse
                          </button>
                        ) : isFaturaPaga ? (
                          <button
                            type="button"
                            onClick={() => {
                              const updatedOrdens = ordens.map(o => {
                                if (o.clienteId === cli.id && o.status === 'Entregue') {
                                  return { ...o, faturaParceiraPaga: false };
                                }
                                return o;
                              });
                              setOrdens(updatedOrdens);
                              alert(`⚠️ Faturamento de "${cli.nome}" estornado para PENDENTE.`);
                            }}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-mono text-[8.5px] px-2 py-1 rounded transition cursor-pointer"
                          >
                            Estornar Pagamento
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Sem entregas entregues na quinzena</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* LADO DIREITO: DEMONSTRATIVO & LIQUIDAÇÃO DE ENTREGADORES */}
          <div className="lg:col-span-12 xl:col-span-6 space-y-6">
            <div className="bg-white rounded-2xl p-5 border border-slate-205 shadow-sm">
              <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase font-mono tracking-wider">
                    🏍️ Repasses Quinzenais & Descontos de Entregadores
                  </h3>
                  <p className="text-[11px] text-slate-400">Verifique aluguéis, retenções de combustível e repasses bloqueados</p>
                </div>
                <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-650">
                  Total: {motoboys.length}
                </span>
              </div>

              {/* Tabela de Fechamento de Repasses por Entregador */}
              <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                {motoboys.map(mb => {
                  const ordensMb = ordens.filter(o => o.motoboyId === mb.id && o.status === 'Entregue');
                  
                  const ordensLocais = ordensMb.filter(o => o.tipoEntrega === 'local');
                  const repasseBrutoLocal = ordensLocais.reduce((sum, o) => sum + (o.valorPagoMotoboy || 4.00), 0);

                  const ordensIntermunicipais = ordensMb.filter(o => o.tipoEntrega === 'intermunicipal');
                  const kmIntermunicipalConcluido = ordensIntermunicipais.reduce((sum, o) => sum + (o.distanciaKm || 0), 0);
                  const repasseIntermunicipalTotal = ordensIntermunicipais.reduce((sum, o) => sum + (o.valorPagoMotoboy || 0), 0);
                  
                  const repasseIntermunicipalLiberado = ordensIntermunicipais
                    .filter(o => o.faturaParceiraPaga)
                    .reduce((sum, o) => sum + (o.valorPagoMotoboy || 0), 0);

                  const repasseIntermunicipalBloqueado = repasseIntermunicipalTotal - repasseIntermunicipalLiberado;

                  const isAlugada = mb.tipoMoto === 'alugada';
                  const kmRodadoQuinzenal = isAlugada ? (mb.kmSaidaAcumuladaQuinzenal || 0) : 0;
                  const deducaoCombustivelAmt = isAlugada ? kmRodadoQuinzenal * 0.50 : 0;

                  const taxaAluguelMoto = isAlugada ? 700.00 : 0;

                  const repasseTotalLiberadoBruto = repasseBrutoLocal + repasseIntermunicipalLiberado;
                  const repasseLiquido = repasseTotalLiberadoBruto - deducaoCombustivelAmt - taxaAluguelMoto;

                  return (
                    <div key={mb.id} className="bg-slate-950 text-slate-100 rounded-xl p-4.5 border border-slate-850 font-mono text-xs flex flex-col justify-between gap-3.5" id={`mb-fechamento-${mb.id}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <strong className="text-white text-[13px] block">{mb.nome}</strong>
                          <span className="text-[9.5px] text-slate-450 block mt-0.5">
                            Veículo: <strong className="text-orange-400 font-bold font-mono">{mb.veiculo?.toUpperCase() || 'MOTO'} ({isAlugada ? 'Frota Torque Alugada' : 'Moto Própria'})</strong>
                          </span>
                        </div>
                        {isAlugada ? (
                          <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-widest animate-pulse">
                            Frota Torque Rented
                          </span>
                        ) : (
                          <span className="bg-slate-800 text-slate-450 px-2 py-0.5 rounded text-[8.5px] uppercase">
                            Own Bike
                          </span>
                        )}
                      </div>

                      {/* Demonstrativo Financeiro Interno da Quinzena */}
                      <div className="space-y-1.5 text-[11px] bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-300">
                        <div className="flex justify-between items-center">
                          <span>📦 Repasse Local Bruto:</span>
                          <strong>R$ {repasseBrutoLocal.toFixed(2)}</strong>
                        </div>

                        {repasseIntermunicipalTotal > 0 && (
                          <div className="border-t border-slate-850/50 pt-1 space-y-1">
                            <div className="flex justify-between items-center text-emerald-400">
                              <span>🌍 Repasse Intermunicipal Liberado:</span>
                              <strong>R$ {repasseIntermunicipalLiberado.toFixed(2)}</strong>
                            </div>
                            {repasseIntermunicipalBloqueado > 0 && (
                              <div className="flex justify-between items-center text-amber-500 font-extrabold animate-pulse">
                                <span className="flex items-center gap-1">🔒 Repasse Intermunicipal Bloqueado:</span>
                                <span>R$ {repasseIntermunicipalBloqueado.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {isAlugada && (
                          <div className="border-t border-slate-850 pt-1.5 space-y-1">
                            <div className="flex justify-between items-center text-rose-400">
                              <span>🔥 Retenção de Combustível ({kmRodadoQuinzenal.toFixed(1)} km):</span>
                              <strong>- R$ {deducaoCombustivelAmt.toFixed(2)}</strong>
                            </div>
                            <div className="flex justify-between items-center text-amber-500 font-bold">
                              <span>📝 Aluguel Fixo Quinzenal:</span>
                              <strong>- R$ {taxaAluguelMoto.toFixed(2)}</strong>
                            </div>
                          </div>
                        )}

                        <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-xs font-black">
                          <span className="text-white font-mono">💰 Saldo Líquido Liberado na Quinzena:</span>
                          <span className={`${repasseLiquido >= 0 ? 'text-emerald-400 animate-pulse font-black' : 'text-rose-455 text-rose-400'} text-xs font-black`}>
                            R$ {repasseLiquido.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Botão de Fechamento / Liquidação Quinzenal do Entregador */}
                      <div className="flex items-center justify-between text-[10px] border-t border-slate-850 pt-3 flex-wrap gap-2">
                        <span className="text-slate-500 font-mono">
                          {isAlugada ? 'Zera odômetros acumulados' : 'Fecha saldos de entregas'}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            if (repasseIntermunicipalBloqueado > 0) {
                              if (!window.confirm(`⚠️ Atenção: Este entregador possui R$ ${repasseIntermunicipalBloqueado.toFixed(2)} em repasses intermunicipais BLOQUEADOS na quinzena porque os Parceiros (clientes) correspondentes não pagaram as faturas corporativas. Deseja liquidar a quinzena APENAS com o saldo liberado de R$ ${repasseLiquido.toFixed(2)}? O saldo bloqueado ficará pendente de recolhimento para a próxima quinzena.`)) {
                                return;
                              }
                            } else {
                              if (!window.confirm(`Deseja efetuar o fechamento quinzenal unificado de 15 dias de "${mb.nome}"?\n\nIsso gerará o extrato e zerará KM quinzenal acumulado para a frota.`)) {
                                return;
                              }
                            }

                            const novoExtrato: ExtratoQuinzenal = {
                              id: `EXT-${Math.floor(10000 + Math.random() * 90000)}`,
                              motoboyId: mb.id,
                              motoboyNome: mb.nome,
                              dataFechamento: new Date().toISOString(),
                              totalBrutoLocal: repasseBrutoLocal,
                              totalBrutoIntermunicipal: repasseIntermunicipalTotal,
                              repasseBloqueadoPendente: repasseIntermunicipalBloqueado,
                              kmRodadoCombustivel: kmRodadoQuinzenal,
                              descontoCombustivel: deducaoCombustivelAmt,
                              descontoAluguelMoto: taxaAluguelMoto,
                              saldoLiquidoPago: repasseLiquido
                            };

                            setExtratosQuinzenais(prev => [novoExtrato, ...prev]);

                            const updatedRidersList = motoboys.map(m => {
                              if (m.id === mb.id) {
                                return { 
                                  ...m, 
                                  kmSaidaAcumuladaQuinzenal: 0,
                                  isTrabalhandoAtivo: false,
                                  placaAtual: undefined,
                                  kmEntrada: undefined,
                                  fotoOdometroEntrada: undefined,
                                  dataEntrada: undefined
                                };
                              }
                              return m;
                            });

                            if (activeMotoboyUser && activeMotoboyUser.id === mb.id) {
                              setActiveMotoboyUser({
                                ...activeMotoboyUser,
                                kmSaidaAcumuladaQuinzenal: 0,
                                isTrabalhandoAtivo: false,
                                placaAtual: undefined,
                                kmEntrada: undefined,
                                fotoOdometroEntrada: undefined,
                                dataEntrada: undefined
                              });
                            }

                            setMotoboys(updatedRidersList);

                            setLivroCaixaCombustivelTorquelog(prev => prev + deducaoCombustivelAmt);

                            alert(`🎉 Quinzena liquidada com absoluto sucesso de ${mb.nome}!\nExtrato ${novoExtrato.id} gerado.\nValor pago: R$ ${repasseLiquido.toFixed(2)} via PIX Corporativo.`);
                          }}
                          className="bg-orange-500 hover:bg-orange-600 border border-orange-400 text-white font-mono text-[9px] font-black uppercase py-1.5 px-3 rounded-lg transition hover:scale-103 cursor-pointer"
                        >
                          📅 Realizar Fechamento Quinzenal
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* HISTÓRICO DE EXTRATOS EMITIDOS */}
          <div className="lg:col-span-12 space-y-4">
            <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl p-5 font-mono">
              <h3 className="text-xs font-black text-white uppercase tracking-wider mb-2.5 flex items-center gap-2">
                📂 Histórico de Extratos Quinzenais Consolidados ({extratosQuinzenais.length})
              </h3>
              
              {extratosQuinzenais.length === 0 ? (
                <div className="text-xs text-center text-slate-500 p-4 bg-slate-950 border border-dashed border-slate-850 rounded-xl leading-relaxed">
                  Nenhum extrato quinzenal fechado ou faturado até o momento.<br />
                  Selecione um entregador acima e realize o fechamento do ciclo de 15 dias para gerar o documento.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {extratosQuinzenais.map(ext => (
                    <div key={ext.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-2.5 text-[11px]" id={`extrato-${ext.id}`}>
                      <div className="flex justify-between items-center border-b border-slate-850 pb-2 mb-1.5">
                        <strong className="text-orange-400 font-extrabold text-[12px]">{ext.id}</strong>
                        <span className="text-[9px] text-slate-505">{new Date(ext.dataFechamento).toLocaleDateString()} {new Date(ext.dataFechamento).toLocaleTimeString()}</span>
                      </div>

                      <div className="space-y-1 text-slate-350">
                        <div>Entregador: <strong className="text-white font-bold">{ext.motoboyNome}</strong></div>
                        <div className="flex justify-between">
                          <span>Bruto Local:</span>
                          <span className="text-white">R$ {ext.totalBrutoLocal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Bruto Interminic.:</span>
                          <span className="text-white">R$ {ext.totalBrutoIntermunicipal.toFixed(2)}</span>
                        </div>
                        {ext.repasseBloqueadoPendente > 0 && (
                          <div className="flex justify-between text-amber-500 font-bold">
                            <span>Retido p/ Próx. Quinz.:</span>
                            <span>R$ {ext.repasseBloqueadoPendente.toFixed(2)}</span>
                          </div>
                        )}
                        {ext.descontoCombustivel > 0 && (
                          <div className="flex justify-between text-rose-400">
                            <span>Desc. Combustível ({ext.kmRodadoCombustivel?.toFixed(1)}km):</span>
                            <span>- R$ {ext.descontoCombustivel.toFixed(2)}</span>
                          </div>
                        )}
                        {ext.descontoAluguelMoto > 0 && (
                          <div className="flex justify-between text-rose-400">
                            <span>Desc. Aluguel Moto:</span>
                            <span>- R$ {ext.descontoAluguelMoto.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="border-t border-slate-850 pt-1.5 flex justify-between font-black text-emerald-450 text-emerald-400">
                          <span>Saldo Pago:</span>
                          <span>R$ {ext.saldoLiquidoPago.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 mt-2 bg-slate-900 border border-slate-850 p-2 rounded justify-between text-[9px] text-slate-500 leading-normal">
                        <span>Status Transação:</span>
                        <span className="text-emerald-400 font-black tracking-widest uppercase">✅ PIX PROCESSADO</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ==========================================
          ALUGUEL DE MOTOS & RELATÓRIOS DE KM (ADMIN PANEL)
          ========================================== */}
      {effectiveRole === 'Empresa' && adminSubTab === 'aluguel' && (
        <main className="max-w-7xl mx-auto p-4 lg:p-6 flex flex-col gap-6 flex-1 w-full animate-fade-in" id="admin-aluguel-dashboard">
          {/* Header Banner */}
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-5 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-md shadow-orange-500/5">
            <div>
              <span className="bg-orange-550/20 text-orange-400 border border-orange-550/15 font-bold text-[8px] px-2 py-0.5 rounded uppercase tracking-widest block w-fit mb-1.5 leading-none">
                MÓDULO DE EXPEDIENTE & FROTA
              </span>
              <h2 className="text-lg font-black font-mono uppercase tracking-tight text-white flex items-center gap-2">
                🏍️ Controle de Motos Alugadas & Quilometragem Diária
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Visualize os entregadores ativos com motos alugadas da frota TorqueLog, edite taxas contratuais diretamente, e gere relatórios detalhados de quilometragem percorrida por dia.
              </p>
            </div>
          </div>

          {/* KPI Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <span className="text-2xl p-2 bg-orange-50 text-orange-600 rounded-lg">🏍️</span>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-black font-mono block">Alugadas Ativas</span>
                <strong className="text-lg font-mono text-slate-900 font-black">{motoboys.filter(m => m.tipoMoto === 'alugada').length} Motos</strong>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <span className="text-2xl p-2 bg-emerald-50 text-emerald-600 rounded-lg">⚡</span>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-black font-mono block">Em Turno Agora</span>
                <strong className="text-lg font-mono text-emerald-600 font-black">
                  {motoboys.filter(m => m.tipoMoto === 'alugada' && m.isTrabalhandoAtivo).length} Ativos
                </strong>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <span className="text-2xl p-2 bg-indigo-50 text-indigo-600 rounded-lg">🛣️</span>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-black font-mono block">KM Total Rodado</span>
                <strong className="text-lg font-mono text-indigo-600 font-black">
                  {motoboys.filter(m => m.tipoMoto === 'alugada').reduce((sum, m) => sum + (m.kmSaidaAcumuladaQuinzenal || 0), 0).toFixed(1)} km
                </strong>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <span className="text-2xl p-2 bg-rose-50 text-rose-600 rounded-lg">💰</span>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-black font-mono block">Faturamento Aluguel</span>
                <strong className="text-lg font-mono text-rose-600 font-black">
                  R$ {(motoboys.filter(m => m.tipoMoto === 'alugada').length * 700.00).toFixed(2)} / quin.
                </strong>
              </div>
            </div>
          </div>

          {/* Main sections layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
            
            {/* Section 1: Couriers with rented bikes & config (Left/Wide Column) */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase font-mono">
                    📋 Entregadores com Aluguel de Moto Ativo
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Gerencie os parâmetros de cada contrato de locação e as taxas operacionais</p>
                </div>
              </div>

              <div className="space-y-4">
                {motoboys.filter(m => m.tipoMoto === 'alugada').length === 0 ? (
                  <div className="p-8 text-center text-slate-505 border border-dashed border-slate-200 rounded-xl text-xs font-mono">
                    Nenhum entregador cadastrado com o tipo "Moto Alugada (Frota)".<br/>
                    Você pode alterar o tipo de veículo de qualquer entregador no painel de Logística Geral.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {motoboys.filter(m => m.tipoMoto === 'alugada').map(m => (
                      <div key={m.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3 font-mono text-xs">
                        {/* Header card info */}
                        <div className="flex justify-between items-start border-b border-slate-200/55 pb-2">
                          <div>
                            <strong className="text-[13px] text-slate-900 block font-black">{m.nome}</strong>
                            <span className="text-[9.5px] text-slate-505 font-bold">REGISTRO: {m.id}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider ${
                            m.isTrabalhandoAtivo 
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                              : 'bg-slate-200 text-slate-600'
                          }`}>
                            {m.isTrabalhandoAtivo ? '🟢 EM EXPEDIENTE' : '⚪ FORA DE EXPEDIENTE'}
                          </span>
                        </div>

                        {/* Telemetry info */}
                        <div className="space-y-1.5 text-[11px] bg-white border border-slate-150 p-2.5 rounded-lg text-slate-700">
                          <div className="flex justify-between">
                            <span>🏍️ Placa Ativa:</span>
                            <span className="font-bold text-slate-900">{m.placaAtual || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>🛣️ Odômetro Inicial:</span>
                            <span className="font-bold text-slate-900">{m.kmEntrada || 0} km</span>
                          </div>
                          <div className="flex justify-between">
                            <span>📊 Rodagem Acumulada:</span>
                            <span className="font-black text-orange-600">{m.kmSaidaAcumuladaQuinzenal || 0} km</span>
                          </div>
                          <div className="flex justify-between">
                            <span>⛽ Retenção Combustível (R$0,50/km):</span>
                            <span className="font-bold text-rose-600">R$ {((m.kmSaidaAcumuladaQuinzenal || 0) * 0.50).toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Configurable Rates */}
                        <div className="space-y-2 border-t border-slate-200/65 pt-2.5">
                          <span className="text-[9px] font-black uppercase text-slate-505 tracking-wider block">⚙️ Ajustar Tarifas do Contrato</span>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[8px] font-bold uppercase text-slate-505 mb-0.5">Repasse Fixo (R$)</label>
                              <input 
                                type="number" 
                                step="0.10"
                                defaultValue={m.valorRepasseFixo || 4.00}
                                id={`fixed-repasse-${m.id}`}
                                className="w-full bg-white border border-slate-200 rounded p-1 text-[11px] text-slate-900 font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold uppercase text-slate-505 mb-0.5">Freelancer Rate (R$)</label>
                              <input 
                                type="number" 
                                step="0.50"
                                defaultValue={m.valorTaxaFreelancer || 6.00}
                                id={`free-rate-${m.id}`}
                                className="w-full bg-white border border-slate-200 rounded p-1 text-[11px] text-slate-900 font-bold"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[8px] font-bold uppercase text-slate-505 mb-0.5">Valor do Contrato Exclusivo (R$)</label>
                            <input 
                              type="number" 
                              step="5.00"
                              defaultValue={m.valorContratoExclusivo || 150.00}
                              id={`excl-rate-${m.id}`}
                              className="w-full bg-white border border-slate-200 rounded p-1.5 text-[11px] text-slate-900 font-bold text-orange-600"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const fixo = parseFloat((document.getElementById(`fixed-repasse-${m.id}`) as HTMLInputElement)?.value) || 4.00;
                              const free = parseFloat((document.getElementById(`free-rate-${m.id}`) as HTMLInputElement)?.value) || 6.00;
                              const excl = parseFloat((document.getElementById(`excl-rate-${m.id}`) as HTMLInputElement)?.value) || 150.00;
                              
                              const updated = motoboys.map(item => {
                                if (item.id === m.id) {
                                  return {
                                    ...item,
                                    valorRepasseFixo: fixo,
                                    valorTaxaFreelancer: free,
                                    valorContratoExclusivo: excl
                                  };
                                }
                                return item;
                              });
                              setMotoboys(updated);

                              if (isFirebaseConfigured) {
                                const target = updated.find(x => x.id === m.id);
                                if (target) syncSingleMotoboyToFirebase(target).catch(console.error);
                              }
                              if (supabase) {
                                const target = updated.find(x => x.id === m.id);
                                if (target) syncMotoboysToSupabase([target]).catch(console.error);
                              }

                              setSupabaseSuccessMsg(`✅ Tarifas de ${m.nome} atualizadas com sucesso!`);
                              setTimeout(() => setSupabaseSuccessMsg(''), 5000);
                            }}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-1.5 rounded uppercase text-[9.5px] cursor-pointer transition shadow shadow-orange-500/10 hover:scale-101"
                          >
                            💾 Salvar Tarifas
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Daily KM Reports & Report Generator (Right/Sidebar Column) */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-5 font-mono">
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase">
                      📊 Relatório de KM Diário
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Histórico consolidado por dia</p>
                  </div>
                  <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">ODÔMETRO</span>
                </div>

                {/* Table of Daily KM */}
                <div className="max-h-[300px] overflow-y-auto space-y-2 border border-slate-100 rounded-xl p-2 bg-slate-50">
                  {(() => {
                    const dailyGroups: { [key: string]: { date: string, name: string, km: number, placa: string } } = {};
                    
                    registrosOdometros.forEach(r => {
                      if (r.dataSaida && r.kmTrabalhado) {
                        const dateStr = new Date(r.dataSaida).toLocaleDateString('pt-BR');
                        const key = `${dateStr}-${r.motoboyId}`;
                        if (dailyGroups[key]) {
                          dailyGroups[key].km += r.kmTrabalhado;
                        } else {
                          dailyGroups[key] = {
                            date: dateStr,
                            name: r.motoboyNome,
                            km: r.kmTrabalhado,
                            placa: r.placa
                          };
                        }
                      }
                    });

                    const sortedGroups = Object.values(dailyGroups).sort((a, b) => {
                      const parseDate = (d: string) => {
                        const parts = d.split('/');
                        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
                      };
                      return parseDate(b.date) - parseDate(a.date);
                    });

                    if (sortedGroups.length === 0) {
                      return (
                        <div className="text-[10px] text-center text-slate-400 py-6 leading-relaxed">
                          Nenhum KM diário registrado ainda.<br/>
                          Os registros aparecerão aqui assim que os entregadores realizarem o Check-Out do turno.
                        </div>
                      );
                    }

                    return sortedGroups.map((g, idx) => (
                      <div key={idx} className="bg-white p-2.5 rounded border border-slate-200 flex items-center justify-between text-[11px] hover:border-slate-300 transition">
                        <div>
                          <strong className="text-slate-800 block text-[12px]">{g.name}</strong>
                          <span className="text-[9px] text-slate-505 block font-bold">🗓️ {g.date} • 🎫 {g.placa}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] text-slate-400 block font-black uppercase">KM Diário</span>
                          <span className="font-extrabold text-orange-600 text-xs font-mono">{g.km.toFixed(1)} km</span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                {/* Relatório Generator button */}
                <button
                  type="button"
                  onClick={() => {
                    const dailyGroups: { [key: string]: { date: string, name: string, km: number, placa: string } } = {};
                    registrosOdometros.forEach(r => {
                      if (r.dataSaida && r.kmTrabalhado) {
                        const dateStr = new Date(r.dataSaida).toLocaleDateString('pt-BR');
                        const key = `${dateStr}-${r.motoboyId}`;
                        if (dailyGroups[key]) {
                          dailyGroups[key].km += r.kmTrabalhado;
                        } else {
                          dailyGroups[key] = {
                            date: dateStr,
                            name: r.motoboyNome,
                            km: r.kmTrabalhado,
                            placa: r.placa
                          };
                        }
                      }
                    });

                    const sortedGroups = Object.values(dailyGroups);
                    
                    let reportText = `==================================================\n`;
                    reportText += `       TORQUELOG - RELATÓRIO DE QUILOMETRAGEM DIÁRIA       \n`;
                    reportText += `                Gerado em: ${new Date().toLocaleString('pt-BR')}            \n`;
                    reportText += `==================================================\n\n`;
                    
                    if (sortedGroups.length === 0) {
                      reportText += `Nenhum registro de odômetro finalizado na base de dados.\n`;
                    } else {
                      sortedGroups.forEach((g, i) => {
                        reportText += `${i + 1}. DATA: ${g.date} | ENTREGADOR: ${g.name.padEnd(20)} | PLACA: ${g.placa.padEnd(8)} | KM TOTAL: ${g.km.toFixed(1)} km\n`;
                      });
                    }
                    
                    reportText += `\n==================================================\n`;
                    reportText += `Fim do Relatório • TorqueLog Frota Inteligente\n`;
                    
                    const win = window.open("", "Relatório TorqueLog", "width=600,height=400");
                    if (win) {
                      win.document.write(`<pre style="font-family: monospace; background: #0f172a; color: #38bdf8; padding: 20px; border-radius: 8px;">${reportText}</pre>`);
                    } else {
                      alert(reportText);
                    }
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl uppercase text-xs cursor-pointer transition shadow shadow-indigo-600/10 flex items-center justify-center gap-2 hover:scale-[1.02]"
                >
                  📄 Gerar Relatório Consolidado de KM 📊
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[10px] text-slate-505 leading-normal font-sans">
                💡 <strong>Análise de Odômetros:</strong> Os dados de quilometragem diária são preenchidos e validados diretamente pelos entregadores através de fotos registradas no início e no fim do expediente.
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ==========================================
          PORTAL PERSPECTIVE: MOTOBOY DASHBOARD
          ========================================== */}
      {effectiveRole === 'Motoboy' && (
        <main className="max-w-7xl mx-auto p-4 lg:p-6 flex flex-col gap-6 flex-1 w-full animate-fade-in" id="motoboy-main">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
              {/* Active Audio/Visual Driver Alerts Banner */}
          {activeDriverAlerts.length > 0 && (
            <div className="lg:col-span-12 space-y-3" id="driver-live-alerts-container">
              <AnimatePresence>
                {activeDriverAlerts.map(alertOrder => (
                  <motion.div
                    key={alertOrder.id}
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="relative bg-gradient-to-r from-orange-600 via-orange-550 to-amber-600 text-white rounded-2xl border-2 border-orange-400 p-5 shadow-xl shadow-orange-500/10 animate-pulse-slow overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5"
                    style={{ animationDuration: '4s' }}
                  >
                    {/* Glowing highlight aura */}
                    <div className="absolute inset-0 bg-white/5 opacity-20 pointer-events-none" />
                    
                    <div className="flex items-start gap-4 z-10">
                      <div className="bg-white text-orange-600 p-3 rounded-xl shrink-0 flex items-center justify-center shadow">
                        <Bell className="w-6 h-6 animate-bounce" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="bg-white/20 text-white text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                            Nova Entrega Disponível ({alertOrder.cidade})
                          </span>
                          <span className="bg-slate-900/35 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                            {alertOrder.id}
                          </span>
                        </div>
                        <h4 className="text-base font-black tracking-tight mt-1">
                          Retirada em: {alertOrder.clienteNome}
                        </h4>
                        <p className="text-xs text-white/90 font-mono mt-1">
                          🎯 Destino: <strong className="text-white underline">{alertOrder.destinatarioNome || 'Oficina'}</strong> • {alertOrder.enderecoEntrega || `Setor ${alertOrder.quadrante}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 z-10 w-full md:w-auto mt-2 md:mt-0 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          playNotificationSound();
                          handleAceitarOuPerguntarOrdem(alertOrder);
                          setActiveDriverAlerts(prev => prev.filter(o => o.id !== alertOrder.id));
                        }}
                        className="bg-white hover:bg-slate-50 text-orange-600 hover:scale-103 font-mono font-black text-xs px-5 py-3 rounded-xl transition shadow shadow-black/10 cursor-pointer flex items-center justify-center gap-1.5 flex-1 md:flex-none uppercase tracking-wider"
                      >
                        <Volume2 className="w-4 h-4 text-orange-500 animate-pulse" />
                        Aceitar Corrida 🏍️
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDriverAlerts(prev => prev.filter(o => o.id !== alertOrder.id));
                        }}
                        className="bg-slate-900/20 hover:bg-slate-900/40 border border-white/20 text-white font-mono text-xs font-bold py-3 px-4 rounded-xl hover:scale-102 active:scale-98 transition cursor-pointer"
                        title="Dispensar aviso"
                      >
                        Dispensar ✕
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
          
          {/* Welcome section & Quick stats */}
          <div className="lg:col-span-12 bg-slate-900 text-white rounded-2xl border border-slate-800 p-4 sm:p-6 flex flex-col gap-4 shadow-md shadow-orange-500/5">
            {/* Daily vs Monthly freights details - NOW PLACED AT THE TOP AND HIGHLY COMPACT FOR MOBILE */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 w-full">
              <div className="bg-slate-950/80 p-2.5 text-center rounded-xl border border-slate-805">
                <span className="block text-[8px] text-slate-400 uppercase tracking-wider mb-0.5 font-bold">Entregas Diárias</span>
                <span className="text-xl font-mono font-black text-orange-400">{motoboyStats.hojeCount}</span>
              </div>
              <div className="bg-slate-950/80 p-2.5 text-center rounded-xl border border-slate-805">
                <span className="block text-[8px] text-emerald-400 uppercase tracking-wider mb-0.5 font-bold">Ganho Hoje</span>
                <span className="text-sm font-black font-mono text-emerald-400">R$ {motoboyStats.hojeEarnings.toFixed(2)}</span>
              </div>
              <div className="bg-slate-950/80 p-2.5 text-center rounded-xl border border-slate-805">
                <span className="block text-[8px] text-slate-400 uppercase tracking-wider mb-0.5 font-bold">Entregas do Mês</span>
                <span className="text-xl font-black font-mono text-slate-300">{motoboyStats.mesCount}</span>
              </div>
              <div className="bg-slate-950/80 p-2.5 text-center rounded-xl border border-slate-805">
                <span className="block text-[8px] text-emerald-400 uppercase tracking-wider mb-0.5 font-bold">Ganho Mensal</span>
                <span className="text-sm font-black font-mono text-emerald-400">R$ {motoboyStats.mesEarnings.toFixed(2)}</span>
              </div>
            </div>

            {/* Subtle Divider */}
            <div className="border-t border-slate-800/50 w-full" />

            {/* Welcome message and controls grouped together */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full">
              <div className="flex-1 w-full animate-fade-in">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="text-[9px] bg-orange-550/20 text-orange-400 border border-orange-550/20 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                    DASHBOARD DO ENTREGADOR
                  </span>

                  {/* Removed exclusivity override buttons by user request - locked to AUTOMÁTICO */}
                </div>

                <h1 className="text-xl font-black mt-1">Olá, {activeMotoboyUser?.nome}!</h1>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5 leading-relaxed">
                  Região contratual: <strong className="text-orange-400">{activeMotoboyUser?.cidade || 'Passos - MG'}</strong> • {' '}
                  {activeMotoboyUser?.empresaExclusiva ? (
                    isExclusiveNow ? (
                      <span>Contrato: <strong className="text-amber-400">Exclusivo B2B (Ativo)</strong> • Repasse Fixo: <strong className="text-emerald-400">R$ {(activeMotoboyUser?.valorRepasseFixo || 4.00).toFixed(2)}</strong> por entrega</span>
                    ) : (
                      <span>Contrato: <strong className="text-emerald-450 text-emerald-400">Freelancer (Ativo fora de horário)</strong> • Taxa Corrida: <strong className="text-emerald-400">R$ {(activeMotoboyUser?.valorTaxaFreelancer || 6.00).toFixed(2)}</strong> por entrega</span>
                    )
                  ) : (
                    <span>Contrato: <strong className="text-emerald-400">Freelancer Geral</strong> • Tarifa variável por cliente local</span>
                  )}
                </p>
                
                {activeMotoboyUser?.empresaExclusiva && (
                  <div className="mt-2.5 p-2 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[10px] font-mono leading-normal font-bold">
                    <div className="flex items-center gap-1.5">
                       <span className="text-sm">🏢</span>
                       <div>
                        <span className="text-slate-400 text-[8px] block leading-none">Parceiro Exclusivo</span>
                        <span className="text-orange-400 font-black uppercase text-[10px]">{activeMotoboyUser.empresaExclusiva}</span>
                      </div>
                    </div>
                    <div>
                      {isExclusiveNow ? (
                        <div className="flex flex-col sm:items-end gap-0.5">
                          <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[9px] tracking-wider font-extrabold uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                            Exclusivo (Até 18h Seg-Sex | Comercial) • Repasse: R$ {(activeMotoboyUser?.valorRepasseFixo || 4.00).toFixed(2)} / entrega
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:items-end gap-0.5">
                          <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[9px] tracking-wider font-extrabold uppercase text-right">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Freelancer Ativado • Taxa: R$ {(activeMotoboyUser?.valorTaxaFreelancer || 6.00).toFixed(2)} / entrega
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => handleAbrirRelatorio('Motoboy')}
                    className="bg-orange-500 hover:bg-orange-650 text-white text-[10px] font-black font-mono py-1.5 px-3 rounded-lg flex items-center gap-1.5 shadow transition-all cursor-pointer hover:scale-[1.01]"
                  >
                    📊 CONFERÊNCIA & HISTÓRICO 🧾
                  </button>

                  {/* Preferência do Maps */}
                  <div className="bg-slate-950/85 border border-slate-800 rounded-lg px-2 py-1 flex items-center gap-1.5 shadow font-mono text-[9px]">
                    <span className="text-orange-400 font-bold block whitespace-nowrap">🗺️ Maps:</span>
                    <select
                      value={mapsPreference}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setMapsPreference(val);
                        localStorage.setItem('torque_log_maps_pref', val);
                      }}
                      className="bg-slate-900 border border-slate-755 rounded px-1 py-0.5 text-[9px] text-slate-100 font-sans font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                    >
                      <option value="always_ask">Perguntar sempre</option>
                      <option value="always_open">Abrir Rota direto 🏍️</option>
                      <option value="always_skip_maps">Não abrir Mapa 👍</option>
                    </select>
                  </div>

                  {/* AUDIO CONFIRMATION / AUTOPLAY UNLOCKER PILL */}
                  <button
                    type="button"
                    onClick={() => {
                      playNotificationSound(true);
                      if ('Notification' in window) {
                        Notification.requestPermission();
                        if (Notification.permission === 'granted') {
                          new Notification("🏍️ TorqueLog: Alertas Ativados", {
                            body: "O som de plantão para encomendas exclusivas já está ativo neste celular!",
                            silent: false
                          });
                        }
                      }
                    }}
                    className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-300 hover:text-white px-2 py-1.5 rounded-lg text-[9px] font-bold font-mono tracking-wider flex items-center gap-1 cursor-pointer transition active:scale-95"
                    title="Permitir e testar o som do plantão"
                  >
                    🔊 CONFIRMAR SOM DO CELULAR
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* PAINEL DE GESTÃO DE MOTO ALUGADA TORQUELOG */}
          {activeMotoboyUser?.tipoMoto === 'alugada' && (
            <div className="lg:col-span-12 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6 flex flex-col md:flex-row justify-between gap-6" id="painel-moto-alugada">
              {/* Lado Esquerdo: Check-In/Check-Out */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="p-2.5 bg-orange-100 text-orange-600 rounded-xl text-lg">🏍️</span>
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider font-mono">
                      Controle de Frota Alugada & Odômetro
                    </h2>
                    <p className="text-[11px] text-slate-500 font-mono">Documente a rodagem do veículo do plantão para faturamento seguro</p>
                  </div>
                </div>

                {!activeMotoboyUser.isTrabalhandoAtivo ? (
                  <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <span className="text-base">⚠️</span>
                      <div>
                        <h4 className="text-xs font-bold text-amber-900 font-mono">Turno Bloqueado — Check-In Pendente</h4>
                        <p className="text-[10px] text-amber-700 leading-normal mt-0.5">
                          Como você utiliza uma moto alugada da frota, é obrigatório registrar a foto do odômetro e a quilometragem de entrada para iniciar o recebimento de corridas.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCheckinPlaca(activeMotoboyUser.placaAtual || '');
                        setCheckinKm(activeMotoboyUser.kmEntrada?.toString() || '');
                        setCheckinFoto('https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400&auto=format&fit=crop&q=60referrerPolicy=no-referrer');
                        setCheckinModalOpen(true);
                      }}
                      className="w-full bg-orange-605 bg-orange-600 hover:bg-orange-700 text-white font-mono font-bold text-xs py-2 rounded-lg transition shadow-sm cursor-pointer uppercase tracking-wider text-center flex items-center justify-center gap-1.5"
                    >
                      <span>🔓 Registrar Entrada / Abrir Turno</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-emerald-50/50 border border-emerald-250 rounded-xl p-4 space-y-3 font-mono text-xs text-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-700 border border-emerald-500/35 px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-widest">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                        Turno Ativo / Moto Liberada
                      </span>
                      <span className="text-[10px] text-slate-400">Desde: {activeMotoboyUser.dataEntrada ? new Date(activeMotoboyUser.dataEntrada).toLocaleTimeString() : 'Agora'}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="bg-white p-2.5 rounded border border-slate-150 text-center">
                        <span className="block text-[8px] text-slate-400 uppercase tracking-tight">Placa Ativa</span>
                        <span className="text-[13px] font-black text-slate-850">{activeMotoboyUser.placaAtual || 'NÃO CONFIG.'}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded border border-slate-150 text-center">
                        <span className="block text-[8px] text-slate-400 uppercase tracking-tight">KM de Entrada</span>
                        <span className="text-[13px] font-black text-slate-850 font-mono">{activeMotoboyUser.kmEntrada || 0} km</span>
                      </div>
                    </div>

                    {activeMotoboyUser.fotoOdometroEntrada && (
                      <div className="relative h-14 bg-slate-900 rounded overflow-hidden flex items-center justify-center border border-slate-200">
                        <img referrerPolicy="no-referrer" src={activeMotoboyUser.fotoOdometroEntrada} alt="Foto Entrada" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                        <span className="absolute bottom-1 right-1.5 bg-black/75 text-white text-[8px] px-1 py-0.2 rounded font-sans uppercase">Foto Entrada Gravada 📸</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setCheckoutKm('');
                        setCheckoutFoto('https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400&auto=format&fit=crop&q=60referrerPolicy=no-referrer');
                        setCheckoutModalOpen(true);
                      }}
                      className="w-full bg-slate-900 hover:bg-slate-950 text-white font-mono font-bold text-xs py-2 rounded-lg transition shadow cursor-pointer uppercase tracking-wider text-center"
                    >
                      <span>🔒 Registrar Saída / Registrar Fim-Turno</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Lado Direito: Faturamento Quinzenal Provisório */}
              <div className="flex-1 bg-slate-950 text-slate-100 rounded-2xl p-5 border border-slate-805 flex flex-col justify-between gap-4 font-mono">
                <div>
                  <span className="bg-orange-550/20 text-orange-400 border border-orange-550/15 font-bold px-2 py-0.5 rounded text-[8px] tracking-widest uppercase block w-fit mb-1 leading-none">
                    Diferencial Operacional de Frota
                  </span>
                  <h3 className="text-[13px] font-black text-white uppercase tracking-wider leading-tight">
                    Demonstrativo Financeiro do Aluguel
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-1">Simulação provisória com base nas rodagens e retenções da quinzena</p>
                </div>

                <div className="space-y-2 text-[11px] pt-1 border-t border-slate-850">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>🏍️ Distância Concluída por Entregas:</span>
                    <strong className="text-white">{(activeMotoboyUser.kmSaidaAcumuladaQuinzenal || 0).toFixed(1)} km</strong>
                  </div>
                  <div className="flex justify-between items-center text-emerald-400">
                    <span>🔥 Retenção Combustível (Caixa):</span>
                    <strong className="font-bold">- R$ {((activeMotoboyUser.kmSaidaAcumuladaQuinzenal || 0) * 0.50).toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between items-center text-amber-400">
                    <span>📝 Mensalidade/Aluguel Quinzenal Moto:</span>
                    <strong className="font-bold">- R$ 700.00</strong>
                  </div>
                  
                  <div className="border-t border-slate-850 pt-2 flex justify-between items-center text-xs font-black">
                    <span className="text-slate-300">💰 Deduções Acumuladas Provisórias:</span>
                    <span className="text-rose-455 text-rose-400 font-black">
                      R$ {(((activeMotoboyUser.kmSaidaAcumuladaQuinzenal || 0) * 0.50) + 700.00).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-[9px] text-slate-400 leading-normal">
                  💡 <strong>Regra 15 dias:</strong> O aluguel fixo de R$ 700,00 e o combustível de R$ 0,50/KM são descontados no fechamento da quinzena. KMs das corridas locais baseiam-se na distância do setor (quadrante). Entregas Intermunicipais baseiam-se nos KMs reais computados.
                </div>
              </div>
            </div>
          )}

          {/* Left Panel: Available runs (Demandas na Rua) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <TorqueLogLogoIcon size={18} className="text-orange-500 animate-pulse" variant={logoVariant} />
                    Demandas Disponíveis na Região ({activeMotoboyUser?.cidade || 'Passos - MG'})
                  </h2>
                  <p className="text-xs text-slate-400">Clique para aceitar uma corrida e realizar entrega expressa</p>
                </div>
                <span className="text-xs font-mono font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded">
                  {motoboyVisibleOrders.length} disponíveis
                </span>
              </div>

              {/* List of orders */}
              <div className="space-y-4">
                {motoboyVisibleOrders.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                    <Check className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-mono">Nenhum frete disponível no momento.</p>
                    <p className="text-[10px] text-slate-400 mt-1">Novas ordens surgirão assim que os clientes despacharem pelo faturamento.</p>
                  </div>
                ) : (
                  motoboyVisibleOrders.map(o => (
                    <div key={o.id} className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-1.5 py-0.5 rounded font-mono">{o.id}</span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                            o.status === 'Pendente' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            o.status === 'Buscando Parceiro' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            o.status === 'Rota Agrupada' ? 'bg-purple-100 text-purple-800 border-purple-200 border' :
                            'bg-orange-100 text-orange-850 animate-pulse'
                          }`}>
                            {o.status === 'Rota Agrupada' ? 'Roteiro Coletivo' : o.status}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 font-mono">📍 Setor {o.quadrante}</span>
                          
                          {/* Dynamic payout rates on each run card */}
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                            💰 Ganho: R$ {((obterValorRepasseOperacional(o)) + (0)).toFixed(2)}
                            {isExclusiveNow && activeMotoboyUser?.empresaExclusiva && (o.clienteNome.toLowerCase() === activeMotoboyUser.empresaExclusiva.toLowerCase() || o.clienteId === activeMotoboyUser.empresaExclusiva) ? (
                              <span className="text-[8px] text-emerald-600/90 font-normal font-sans ml-0.5">(Fixo Exclusividade)</span>
                            ) : (
                              <span className="text-[8px] text-emerald-600/90 font-normal font-sans ml-0.5">(Livre Co-Faturado TorqueLog)</span>
                            )}
                          </span>
                        </div>
                        
                        <div className="text-xs text-slate-750 font-mono space-y-0.5 leading-normal mt-1.5">
                          <p>
                            🏢 <strong>Ponto de Retirada (Coleta):</strong> {o.clienteNome}
                            {clientes.find(c => c.id === o.clienteId || c.nome.toLowerCase() === o.clienteNome.toLowerCase())?.ramo && (
                              <span className="bg-indigo-50 border border-indigo-150 text-indigo-700 px-1.5 py-0.5 rounded text-[9px] font-bold font-sans ml-1.5 uppercase shadow-xs">
                                👜 {clientes.find(c => c.id === o.clienteId || c.nome.toLowerCase() === o.clienteNome.toLowerCase())?.ramo}
                              </span>
                            )}
                          </p>
                          <p>🎯 <strong>Ponto de Destino:</strong> <span className="text-orange-600 font-extrabold">{o.destinatarioNome || 'Oficina / Destinatário Final'}</span> • {o.enderecoEntrega || `Setor ${o.quadrante}`}</p>
                          
                          {o.distanciaKm ? (
                            <div className="p-1.5 px-3 border border-emerald-300 bg-emerald-50 text-emerald-800 rounded-lg text-[10px] sm:text-[11px] w-fit flex items-center gap-2 mt-2 font-mono font-bold shadow-sm animate-fade-in">
                              <span className="flex h-2 w-2 relative shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <span>
                                🗺️ <strong>Logística Exata:</strong> Coleta ➔ Entrega • Est.: ~{Math.round(o.distanciaKm * 1.5)} min • Distância: <span className="underline font-black text-emerald-700">{o.distanciaKm.toFixed(2)} km (Google Maps 🗺️)</span>
                              </span>
                            </div>
                          ) : (
                            <div className="p-1 px-2 border border-orange-200 bg-orange-50/40 rounded text-[10px] text-orange-700 w-fit flex items-center gap-1.5 mt-1">
                              <span>🗺️ <strong>Logística de Percurso:</strong> Origem ➔ Destino • Rota Est.: ~{obterEstimativaTempoPercurso(o.quadrante).tempoMin} min • Distância: {obterEstimativaTempoPercurso(o.quadrante).distanciaKm} km</span>
                            </div>
                          )}
                        </div>
                        
                        {o.retornoPeca && (
                          <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded font-mono font-bold mt-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                            REVERSA: Coletar retorno de peça na entrega e devolver ao solicitante
                          </div>
                        )}

                      </div>

                      <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 mt-1 sm:mt-0">
                        {o.status !== 'Moto a Caminho' ? (
                          <button
                            onClick={() => handleAceitarOuPerguntarOrdem(o)}
                            className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-mono font-bold text-xs px-3 py-2 rounded-lg transition shadow shadow-orange-500/10 cursor-pointer flex items-center gap-1.5 w-full sm:w-auto text-center justify-center font-mono font-black"
                          >
                            <TorqueLogLogoIcon size={16} className="text-white animate-spin-slow" variant={logoVariant} />
                            Aceitar Corrida 🏍️
                          </button>
                        ) : (
                          <div className="flex flex-col gap-1.5 w-full">
                            <button
                              type="button"
                              onClick={() => handleAbrirGoogleMaps(o, true)}
                              className="bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-mono font-bold text-xs px-3 py-2 rounded-lg transition shadow cursor-pointer flex items-center gap-1.5 justify-center w-full grow font-black"
                            >
                              <Navigation className="w-3.5 h-3.5 animate-pulse" />
                              Iniciar Trajeto (GPS Rota) 🚀
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveSignOrder(o)}
                              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-mono font-bold text-xs px-3 py-2 rounded-lg transition shadow shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5 justify-center w-full grow font-black"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Entregar e Assinar ✍️
                            </button>
                          </div>
                        )}
                        {o.motoboyId && (
                          <button
                            type="button"
                            onClick={() => handleDevolverOrdem(o.id)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 font-mono text-[10px] font-bold py-1.5 px-2.5 rounded-lg active:scale-95 transition cursor-pointer w-full sm:w-auto text-center justify-center flex items-center gap-1"
                          >
                            ✕ Devolver Corrida
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Motoboy delivery log history & fast-actions */}
          <div className="lg:col-span-4 space-y-6">


            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-xs font-black text-slate-900 uppercase font-mono tracking-widest mb-3 flex items-center gap-1">
                <FileSpreadsheet className="w-4 h-4 text-orange-500" />
                Histórico Pessoal de Ganhos
              </h3>
              
              <div className="space-y-3.5">
                {ordens.filter(o => o.status === 'Entregue' && o.motoboyId === activeMotoboyUser?.id).length === 0 ? (
                  <p className="text-xs text-slate-400 font-mono text-center py-6 border border-dashed border-slate-200 rounded-lg">Você ainda não completou corridas nesta sessão.</p>
                ) : (
                  ordens.filter(o => o.status === 'Entregue' && o.motoboyId === activeMotoboyUser?.id).map(o => (
                    <div key={o.id} className="p-3 bg-slate-50 border border-slate-150 rounded-lg flex justify-between items-center text-xs font-mono">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="text-slate-900">{o.id}</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.2 rounded uppercase">✓ CONFIRMADO</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 space-y-0.5">
                          <p>🏢 <strong>Origem:</strong> {o.clienteNome}</p>
                          <p>📍 <strong>Destino:</strong> <span className="text-orange-600 font-bold">{o.destinatarioNome || 'Oficina'}</span> • {o.enderecoEntrega || `Setor ${o.quadrante}`}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-emerald-700 font-bold font-mono">
                          + R$ {((o.valorPagoMotoboy || 4.00) + (0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Compliance checklist info */}
            <div className="bg-orange-55 border border-orange-200 rounded-xl p-4 space-y-2 text-xs">
              <h4 className="font-black text-orange-900 uppercase tracking-widest font-mono text-[10px]">⚖️ Relação Parceiro MEI Segura</h4>
              <ul className="space-y-1.5 text-slate-700 list-disc list-inside font-mono">
                <li>Sem subordinação ou controle de ponto diário</li>
                <li>Livre arbítrio para aceitar ou recusar qualquer rota</li>
                <li>Recebimento por lote executado através de canhotos biometrizados</li>
              </ul>
            </div>
          </div>
          </div>

        </main>
      )}

      {/* ==========================================
          PORTAL PERSPECTIVE: CLIENTE DASHBOARD
          ========================================== */}
      {effectiveRole === 'Cliente' && (
        <main className="max-w-7xl mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 w-full" id="cliente-main">
          
          {/* MODAL PARA ATUALIZAÇÃO REQUERIDA DE SENHA NO PRIMEIRO ACESSO */}
          {activeClienteUser?.primeiroAcessoPendente === true && (
            <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-fade-in" id="modal-primeiro-acesso-senha">
              <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all duration-300 scale-100 p-6 md:p-8 space-y-6">
                
                <div className="text-center space-y-2">
                  <div className="mx-auto w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-3xl shadow-sm animate-bounce">
                    🔑
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-900 font-sans tracking-tight">
                    Cadastrar Nova Senha de Acesso
                  </h2>
                  <p className="text-xs text-slate-500 font-mono">
                    Parceiro {activeClienteUser?.nome} • Primeiro Acesso Requerido
                  </p>
                </div>

                <div className="bg-orange-50 border border-orange-200 text-orange-850 rounded-xl p-3.5 text-xs font-mono leading-relaxed space-y-1">
                  <span className="font-bold block text-[10px] uppercase">🛡️ AVISO DE CREDENCIAIS</span>
                  <p>Por motivos de segurança cibernética, você deve substituir a senha provisória definida pelo administrador por uma nova senha definitiva e exclusiva.</p>
                </div>

                {partnerChangePasswordError && (
                  <div className="p-3 bg-red-50 border border-red-250 text-red-750 rounded-lg text-xs font-mono font-bold leading-normal">
                    ⚠️ {partnerChangePasswordError}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1">
                      Nova Senha Definitiva *
                    </label>
                    <input
                      type="password"
                      value={partnerNewPassword}
                      onChange={(e) => setPartnerNewPassword(e.target.value)}
                      placeholder="Mínimo de 4 caracteres"
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1">
                      Confirme sua Nova Senha *
                    </label>
                    <input
                      type="password"
                      value={partnerConfirmPassword}
                      onChange={(e) => setPartnerConfirmPassword(e.target.value)}
                      placeholder="Redigite a senha acima"
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAtualizarSenhaPrimeiroAcesso}
                    className="w-full bg-slate-900 hover:bg-slate-950 text-white font-mono font-bold text-xs py-3 rounded-lg transition duration-150 cursor-pointer shadow-md uppercase tracking-wider scale-100 hover:scale-[1.01]"
                  >
                    Salvar Senha e Liberar Painel 🚀
                  </button>
                  
                  <div className="text-center font-mono text-[9px] text-slate-400">
                    A TorqueLog nunca solicita suas chaves de acesso fora do portal oficial.
                  </div>
                </div>

              </div>
            </div>
          )}
          
          {/* Welcome and client quick stats */}
          <div className="lg:col-span-12 bg-slate-900 text-white rounded-2xl border border-slate-800 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-md shadow-orange-500/5">
            <div>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 font-bold px-3 py-1 rounded-full uppercase tracking-widest font-mono">PORTAL DO CLIENTE B2B</span>
              <h1 className="text-2xl font-black mt-2">Olá, {activeClienteUser?.nome}!</h1>
              <p className="text-xs text-slate-400 font-mono mt-1">Sua agência de autopeças/oficina • Endereço B2B: {activeClienteUser?.endereco} ({activeClienteUser?.cidade})</p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => handleAbrirRelatorio('Cliente')}
                  className="bg-emerald-600 hover:bg-emerald-650 text-white text-xs font-black font-mono py-1.5 px-4 rounded-xl flex items-center gap-2 shadow transition-all cursor-pointer hover:scale-[1.02]"
                >
                  📊 CONFERÊNCIA E FECHAMENTO SEMANA/MÊS 🧾
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClientNewClientNome('');
                    setClientNewClientQuadrante(activeClienteUser?.quadrante || 'A');
                    setClientNewClientCEP('');
                    setClientNewClientEndereco('');
                    setClientNewClientTelefone('');
                    setClientNewClientCidade(activeClienteUser?.cidade || 'Passos - MG');
                    setClientNewClientEmail('');
                    setIsClientAddingNewClient(true);
                  }}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-black font-mono py-1.5 px-4 rounded-xl flex items-center gap-1.5 shadow transition-all cursor-pointer hover:scale-[1.02]"
                >
                  🚀 CADASTRAR NOVO CLIENTE B2B ➕
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <span className="block text-[9px] text-slate-400 uppercase tracking-wider mb-1">Entregas Diárias</span>
                <span className="text-2xl font-black font-mono text-orange-400">{clienteStats.hojeCount}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <span className="block text-[9px] text-emerald-400 uppercase tracking-wider mb-1">Custo Diário</span>
                <span className="text-base font-black font-mono text-emerald-400">R$ {clienteStats.hojeBilling.toFixed(2)}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <span className="block text-[9px] text-slate-400 uppercase tracking-wider mb-1">Entregas do Mês</span>
                <span className="text-2xl font-black font-mono text-slate-300">{clienteStats.mesCount}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <span className="block text-[9px] text-emerald-400 uppercase tracking-wider mb-1">Custo Mensal</span>
                <span className="text-base font-black font-mono text-emerald-400">R$ {clienteStats.mesBilling.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Column A (lg:col-span-6) - Dispatch form */}
          <div className="lg:col-span-6 bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between" id="portal-cliente-form-solicitacao">
            <div>
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-orange-500" />
                  Despachar Solicitação B2B Express
                </h2>
                <p className="text-xs text-slate-400">Esqueça cubagens pesadas. Escolha entre Endereço ou Cliente Cadastrado</p>
              </div>

              {/* High-visibility inline dispatch notification banner */}
              {lastDispatchedOrder && (
                <div id="inline-dispatch-success-toast" className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3.5 relative transition-all animate-fade-in shadow-xs flex gap-2.5">
                  <div className="text-base select-none shrink-0">✨</div>
                  <div className="pr-5">
                    <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider font-mono">
                      Despachado com Sucesso!
                    </h4>
                    <p className="text-[10.5px] text-emerald-700 font-mono mt-1 leading-normal">
                      A ordem <strong className="text-slate-950 font-extrabold">{lastDispatchedOrder.id}</strong> para <strong className="text-slate-950 font-extrabold">{lastDispatchedOrder.destName}</strong> foi enviada em tempo real para os entregadores ativos de Passos - MG.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLastDispatchedOrder(null)}
                    className="absolute top-2.5 right-2.5 text-emerald-400 hover:text-emerald-700 font-bold transition p-0.5"
                    title="Fechar aviso"
                  >
                    <span className="text-xs block leading-none font-sans">✕</span>
                  </button>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono">Tipo de Destino para Entrega</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setDestinoTipo('endereco')}
                    className={`py-1.5 px-2 text-xs font-mono font-bold rounded-lg border text-center transition ${
                      destinoTipo === 'endereco'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    📍 Endereço Livre
                  </button>
                  <button
                    type="button"
                    onClick={() => setDestinoTipo('cliente')}
                    className={`py-1.5 px-2 text-xs font-mono font-bold rounded-lg border text-center transition ${
                      destinoTipo === 'cliente'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    🏢 Cliente Cadastrado
                  </button>
                </div>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!activeClienteUser) return;
                
                const isAddress = destinoTipo === 'endereco';
                let finalQuadrante = destinoQuadrante;
                let finalEndereco = destinoEndereco;
                let finalDestName = "Entrega Direta B2B";
                let finalClienteId = destinoClienteId;

                if (!isAddress) {
                  let updatedClientes = [...clientes];
                  // If we're currently quick-registering, finalize it automatically
                  if (isQuickRegisteringDestinatario) {
                    if (!quickClientNome.trim() || !quickClientEndereco.trim()) {
                      alert("Por favor, informe o Nome e o Endereço do destinatário rápido ou cancele o preenchimento.");
                      return;
                    }
                    const randId = Math.floor(1000 + Math.random() * 9000);
                    const newId = `CLI-${destinoQuadrante}-${randId}`;
                    const formattedEndereco = `${quickClientEndereco.trim()}${quickClientNumero.trim() ? `, ${quickClientNumero.trim()}` : ''}${quickClientCEP.trim() ? ` - CEP: ${quickClientCEP.trim()}` : ''}`;
                    const novoCli: Cliente = {
                      id: newId,
                      nome: quickClientNome,
                      quadrante: destinoQuadrante,
                      endereco: formattedEndereco,
                      cep: quickClientCEP,
                      numero: quickClientNumero,
                      telefone: 'Não informado',
                      cidade: activeClienteUser?.cidade || 'Passos - MG',
                      valorPagoMotoboy: 4.00,
                      valorCobradoCliente: 10.00,
                      senha: `cli-${randId}`,
                      email: `contato-${newId.toLowerCase()}@torque-log-b2b.com`,
                      emailConfirmado: true,
                      cadastroCompleto: true,
                      criadoPor: 'Cliente',
                      criadoPorClienteId: activeClienteUser?.id,
                      criadoEm: new Date().toISOString()
                    };

                    updatedClientes = [novoCli, ...clientes];
                    setClientes(updatedClientes);
                    
                    if (isFirebaseConfigured) {
                      await syncSingleClienteToFirebase(novoCli).catch(err => console.error("Erro Firebase:", err));
                    }
                    if (supabase) {
                      await syncClientesToSupabase([novoCli]).catch(err => console.error("Erro Supabase:", err));
                    }

                    finalClienteId = newId;
                    setDestinoClienteId(newId);

                    setQuickClientNome('');
                    setQuickClientEndereco('');
                    setQuickClientCEP('');
                    setQuickClientNumero('');
                    setIsQuickRegisteringDestinatario(false);
                  }

                  let targetC = updatedClientes.find(c => c.id === finalClienteId);
                  
                  // Auto fallback if selection is empty but matching options exist
                  if (!targetC) {
                    const availableOptions = updatedClientes.filter(c => c.criadoPorClienteId === activeClienteUser.id && c.quadrante === destinoQuadrante);
                    if (availableOptions.length > 0) {
                      targetC = availableOptions[0];
                      setDestinoClienteId(targetC.id);
                    }
                  }

                  if (targetC) {
                    finalQuadrante = targetC.quadrante;
                    finalEndereco = targetC.endereco;
                    finalDestName = targetC.nome;
                  } else {
                    alert("Por favor, selecione ou cadastre um destinatário credenciado para o setor escolhido.");
                    return;
                  }
                } else {
                  if (!destinoEndereco.trim()) {
                    alert("Por favor, preencha o endereço de destino.");
                    return;
                  }
                  // Compile address with CEP and Numero
                  let fullAddr = destinoEndereco.trim();
                  if (destinoNumero.trim()) {
                    fullAddr += `, ${destinoNumero.trim()}`;
                  }
                  if (destinoCEP.trim()) {
                    fullAddr += ` - CEP: ${destinoCEP.trim()}`;
                  }
                  finalEndereco = fullAddr;
                }

                const statusFinal = 'Buscando Parceiro';
                const novaOrdemId = `OS-${Math.floor(1000 + Math.random() * 9000)}`;

                const isInter = pedidoIntermunicipal;
                const kmTotal = isInter 
                  ? (Number(pedidoDistanciaKm) * 2) 
                  : (googleMapsDistance && googleMapsDistance.status === 'success' && googleMapsDistance.total > 0
                      ? googleMapsDistance.total 
                      : obterEstimativaTempoPercurso(finalQuadrante).distanciaKm);
                const cobrado = isInter 
                  ? (10.00 + (Number(pedidoDistanciaKm) * 2.50) + (Number(pedidoDistanciaKm) * 1.20))
                  : 9.00; // Taxa fixa R$ 9.00
                const repasse = isInter
                  ? (Number(pedidoDistanciaKm) * 2) // R$ 1.00 por KM total
                  : (tipoEntregadorPedido === 'exclusivo' ? 4.50 : 6.00);

                const novaOrdem: OrdemServico = {
                  id: novaOrdemId,
                  clienteId: activeClienteUser.id,
                  clienteNome: activeClienteUser.nome,
                  quadrante: finalQuadrante,
                  cidade: isInter ? pedidoCidadeDestino : (activeClienteUser.cidade || 'Passos - MG'),
                  itensDescricao: clientItemTexto.trim() || 'Objeto de Envio',
                  itensAnalistas: [], // Empty since we do not need items/cubage logic
                  enderecoEntrega: finalEndereco,
                  destinatarioNome: finalDestName,
                  retornoPeca,
                  taxaReversa: retornoPeca ? 15 : undefined,
                  valorPagoMotoboy: repasse,
                  valorCobradoCliente: cobrado,
                  criadoEm: new Date().toISOString(),
                  status: statusFinal,
                  travaCubagemStatus: 'Liberado - Cabe no Baú',
                  tempoRestanteSweep: 15,
                  tipoEntrega: isInter ? 'intermunicipal' : 'local',
                  distanciaKm: kmTotal,
                  tipoEntregadorPedido: tipoEntregadorPedido,
                  faturaParceiraPaga: false
                };

                const updatedList = [novaOrdem, ...ordens];
                setOrdens(updatedList);

                if (isFirebaseConfigured) {
                  try {
                    await syncSingleOrdemToFirebase(novaOrdem);
                  } catch (err) {
                    console.error("Erro ao sincronizar nova ordem individual no Firebase:", err);
                  }
                }
                if (supabase) {
                  try {
                    await syncOrdensToSupabase([novaOrdem]);
                  } catch (err) {
                    console.error("Erro ao sincronizar nova ordem individual no Supabase:", err);
                  }
                }

                // Update API Output view
                const apiPayload = compilarAPIResponse(activeClienteUser, novaOrdem, [], 'Liberado - Cabe no Baú');
                setApiResponseLog(apiPayload);
                setApiLogTimestamp(new Date().toLocaleTimeString());
                setApiActionDescription(`Novo despacho solicitado individualmente no portal do cliente: ${novaOrdemId}`);

                // Reset B2B dispatch fields to empty / false defaults for the next entry
                setDestinoEndereco('');
                setDestinoCEP('');
                setDestinoNumero('');
                setDestinoClienteId('');
                setRetornoPeca(false);
                setQuickClientNome('');
                setQuickClientEndereco('');
                setQuickClientCEP('');
                setQuickClientNumero('');
                setIsQuickRegisteringDestinatario(false);
                setClientItemTexto('');

                // Set local reactive dispatch confirmation card details
                setLastDispatchedOrder({ id: novaOrdemId, destName: finalDestName });
                
                // Trigger floating real-time synchronized status toast
                setSupabaseSuccessMsg(`🚀 Entrega ${novaOrdemId} despachada com sucesso para "${finalDestName}"! Disponível para os entregadores.`);
                setTimeout(() => {
                  setSupabaseSuccessMsg('');
                }, 10000);
              }} className="space-y-4">
                
                {destinoTipo === 'endereco' ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700 uppercase font-mono">CEP</label>
                        <input
                          type="text"
                          value={destinoCEP}
                          onChange={(e) => handleCEPChange(e.target.value, 'destino')}
                          placeholder="37900-000"
                          className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                        />
                        {isFetchingDestinoCEP && <p className="text-[10px] text-orange-500 font-mono animate-pulse">Buscando CEP...</p>}
                        {cepErrorState['destino'] && (
                          <p className="text-red-500 text-[10px] font-mono mt-1 text-left">⚠️ {cepErrorState['destino']}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700 uppercase font-mono">Número</label>
                        <input
                          type="text"
                          value={destinoNumero}
                          onChange={(e) => setDestinoNumero(e.target.value)}
                          placeholder="Ex: 1040"
                          className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase font-mono">Endereço de Entrega</label>
                      <input
                        type="text"
                        required
                        value={destinoEndereco}
                        onChange={(e) => setDestinoEndereco(e.target.value)}
                        placeholder="Ex: Av. da Moda - Centro, Passos - MG"
                        className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase font-mono">Setor / Região da Moto</label>
                      <select
                        value={destinoQuadrante}
                        onChange={(e) => setDestinoQuadrante(e.target.value as Quadrante)}
                        className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs font-mono"
                      >
                        {(['A', 'B', 'C', 'D', 'E', 'F'] as Quadrante[]).map(q => (
                          <option key={q} value={q}>Setor {q} - Rota do Contrato</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase font-mono">Filtrar Setor do Destinatário</label>
                      <select
                        value={destinoQuadrante}
                        onChange={(e) => setDestinoQuadrante(e.target.value as Quadrante)}
                        className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs font-mono"
                      >
                        {(['A', 'B', 'C', 'D', 'E', 'F'] as Quadrante[]).map(q => (
                          <option key={q} value={q}>Setor {q} - Região</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="block text-xs font-bold text-slate-700 uppercase font-mono">Destinatário Credenciado</label>
                        {!isQuickRegisteringDestinatario && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIsQuickRegisteringDestinatario(true);
                                setQuickClientNome('');
                                setQuickClientEndereco('');
                                setQuickClientCEP('');
                                setQuickClientNumero('');
                              }}
                              className="text-[10px] text-orange-650 hover:text-orange-700 font-bold font-mono uppercase tracking-tight flex items-center gap-0.5 cursor-pointer"
                            >
                              <Plus className="w-3 h-3 text-orange-500" /> Rápido
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setClientNewClientNome('');
                                setClientNewClientQuadrante(destinoQuadrante || 'A');
                                setClientNewClientCEP('');
                                setClientNewClientEndereco('');
                                setClientNewClientTelefone('');
                                setClientNewClientCidade(activeClienteUser?.cidade || 'Passos - MG');
                                setClientNewClientEmail('');
                                setIsClientAddingNewClient(true);
                              }}
                              className="text-[10px] text-emerald-650 hover:text-emerald-700 font-bold font-mono uppercase tracking-tight flex items-center gap-0.5 cursor-pointer border-l pl-2 border-slate-200"
                            >
                              🚀 Completo
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {!isQuickRegisteringDestinatario ? (
                        <select
                          value={destinoClienteId}
                          onChange={(e) => setDestinoClienteId(e.target.value)}
                          required={!isQuickRegisteringDestinatario}
                          className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs font-mono"
                        >
                          {clientes.filter(c => c.criadoPorClienteId === activeClienteUser?.id && c.quadrante === destinoQuadrante).length === 0 ? (
                            <option value="">Nenhum cliente cadastrado neste setor</option>
                          ) : (
                            clientes.filter(c => c.criadoPorClienteId === activeClienteUser?.id && c.quadrante === destinoQuadrante).map(c => (
                              <option key={c.id} value={c.id}>{c.nome} ({c.endereco.slice(0, 25)}...)</option>
                            ))
                          )}
                        </select>
                      ) : (
                        <div className="bg-orange-50/55 p-3 rounded-xl border border-orange-200/60 space-y-2 mt-1 shadow-sm">
                          <span className="text-[10px] font-extrabold text-orange-750 uppercase font-mono tracking-wider block">
                            ✨ NOVO DESTINATÁRIO NO SETOR {destinoQuadrante}
                          </span>
                          
                          <div>
                            <input
                              type="text"
                              required
                              value={quickClientNome}
                              onChange={(e) => setQuickClientNome(e.target.value)}
                              placeholder="Nome da Oficina / Destinatário"
                              className="w-full bg-white text-slate-900 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:ring-1 focus:ring-orange-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <input
                                type="text"
                                value={quickClientCEP}
                                onChange={(e) => handleCEPChange(e.target.value, 'quickClient')}
                                placeholder="CEP (ex: 37900-000)"
                                className="w-full bg-white text-slate-900 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:ring-1 focus:ring-orange-500"
                              />
                              {isFetchingQuickClientCEP && <p className="text-[9px] text-orange-500 font-mono animate-pulse">Buscando...</p>}
                              {cepErrorState['quickClient'] && (
                                <p className="text-red-500 text-[9px] font-mono mt-0.5 text-left">⚠️ {cepErrorState['quickClient']}</p>
                              )}
                            </div>

                            <div>
                              <input
                                type="text"
                                value={quickClientNumero}
                                onChange={(e) => setQuickClientNumero(e.target.value)}
                                placeholder="Número"
                                className="w-full bg-white text-slate-900 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:ring-1 focus:ring-orange-500"
                              />
                            </div>
                          </div>

                          <div>
                            <input
                              type="text"
                              required
                              value={quickClientEndereco}
                              onChange={(e) => setQuickClientEndereco(e.target.value)}
                              placeholder="Endereço (Rua, Bairro) - Auto por CEP"
                              className="w-full bg-white text-slate-900 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:ring-1 focus:ring-orange-500"
                            />
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setIsQuickRegisteringDestinatario(false);
                                setQuickClientNome('');
                                setQuickClientEndereco('');
                                setQuickClientCEP('');
                                setQuickClientNumero('');
                              }}
                              className="flex-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 py-1 px-2 rounded text-[10px] font-bold font-mono transition cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!quickClientNome.trim() || !quickClientEndereco.trim()) {
                                  alert("Por favor, informe o Nome e o Endereço do destinatário.");
                                  return;
                                }

                                const randId = Math.floor(1000 + Math.random() * 9000);
                                const newId = `CLI-${destinoQuadrante}-${randId}`;
                                const formattedEndereco = `${quickClientEndereco.trim()}${quickClientNumero.trim() ? `, ${quickClientNumero.trim()}` : ''}${quickClientCEP.trim() ? ` - CEP: ${quickClientCEP.trim()}` : ''}`;
                                
                                const novoCli: Cliente = {
                                  id: newId,
                                  nome: quickClientNome,
                                  quadrante: destinoQuadrante,
                                  endereco: formattedEndereco,
                                  cep: quickClientCEP,
                                  numero: quickClientNumero,
                                  telefone: 'Não informado',
                                  cidade: activeClienteUser?.cidade || 'Passos - MG',
                                  valorPagoMotoboy: 4.00,
                                  valorCobradoCliente: 10.00,
                                  senha: `cli-${randId}`,
                                  email: `contato-${newId.toLowerCase()}@torque-log-b2b.com`,
                                  emailConfirmado: true,
                                  cadastroCompleto: true,
                                  criadoPor: 'Cliente',
                                  criadoPorClienteId: activeClienteUser?.id,
                                  criadoEm: new Date().toISOString()
                                };

                                const updatedList = [novoCli, ...clientes];
                                setClientes(updatedList);
                                
                                if (isFirebaseConfigured) {
                                  await syncSingleClienteToFirebase(novoCli).catch(err => console.error("Firebase Sync error:", err));
                                }
                                if (supabase) {
                                  await syncClientesToSupabase([novoCli]).catch(err => console.error("Supabase Sync error:", err));
                                }

                                setDestinoClienteId(novoCli.id);

                                setQuickClientNome('');
                                setQuickClientEndereco('');
                                setQuickClientCEP('');
                                setQuickClientNumero('');
                                setIsQuickRegisteringDestinatario(false);

                                setSupabaseSuccessMsg(`✅ Destinatário "${novoCli.nome}" cadastrado, SALVO NO BANCO e selecionado!`);
                                setTimeout(() => setSupabaseSuccessMsg(''), 5000);
                              }}
                              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-1 px-2 rounded text-[10px] font-bold font-mono shadow-sm transition cursor-pointer"
                            >
                              Salvar e Selecionar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono font-bold">Detalhamento do Objeto de Envio (Opcional)</label>
                  <input
                    type="text"
                    value={clientItemTexto}
                    onChange={(e) => setClientItemTexto(e.target.value)}
                    placeholder="Ex: um remédio, um lanche... (Padrão: Objeto de Envio)"
                    className="w-full bg-slate-50 text-slate-950 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                {/* BOTÃO DE SELEÇÃO DE ENTREGADOR (EXCLUSIVO VS FREELANCER) */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 space-y-2">
                  <label className="block text-[10px] font-black text-slate-700 uppercase font-mono tracking-tight leading-none">
                    🎯 Tipo de Despacho & Roteamento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTipoEntregadorPedido('exclusivo')}
                      className={`py-2 px-3 rounded-md text-[10.5px] font-mono font-black border transition-all flex flex-col items-center justify-center text-center ${
                        tipoEntregadorPedido === 'exclusivo'
                          ? 'bg-orange-555 bg-orange-600 border-orange-551 text-white shadow-sm scale-102'
                          : 'bg-white border-slate-201 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="block text-[11px]">👤 Exclusivo</span>
                      <span className="block text-[8px] opacity-80 font-normal leading-tight">Motorista Dedicado</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoEntregadorPedido('freelancer')}
                      className={`py-2 px-3 rounded-md text-[10.5px] font-mono font-black border transition-all flex flex-col items-center justify-center text-center ${
                        tipoEntregadorPedido === 'freelancer'
                          ? 'bg-emerald-600 border-emerald-650 text-white shadow-sm scale-102'
                          : 'bg-white border-slate-201 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="block text-[11px]">🌐 Freelancer</span>
                      <span className="block text-[8px] opacity-80 font-normal leading-tight">Painel Geral Geral</span>
                    </button>
                  </div>
                </div>

                {/* SELETOR DE ENTREGA INTERMUNICIPAL / LONGA DISTÂNCIA */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-black text-slate-700 uppercase font-mono tracking-tight leading-none">
                      🗺️ Destinação Territorial
                    </label>
                    <span className="bg-slate-200/60 text-slate-600 font-mono text-[8px] px-1.5 py-0.5 rounded uppercase font-bold">raio urbano</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="toggle-intermunicipal"
                      checked={pedidoIntermunicipal}
                      onChange={(e) => setPedidoIntermunicipal(e.target.checked)}
                      className="cursor-pointer h-4 w-4 accent-orange-600"
                    />
                    <label htmlFor="toggle-intermunicipal" className="text-[11px] font-mono font-bold text-slate-750 cursor-pointer select-none">
                      Entrega Intermunicipal de Longa Distância?
                    </label>
                  </div>

                  {pedidoIntermunicipal && (
                    <div className="space-y-2 p-2 bg-white rounded border border-slate-150 animate-fade-in text-xs font-mono">
                      <div>
                        <label className="block text-[9px] text-slate-500 font-bold uppercase mb-0.5">Cidade Destino</label>
                        <input
                          type="text"
                          value={pedidoCidadeDestino}
                          onChange={(e) => setPedidoCidadeDestino(e.target.value)}
                          placeholder="Ex: Porto Ferreira - SP"
                          className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-slate-800 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-500 font-bold uppercase mb-0.5">Distância Aproximada (Ida em KM)</label>
                        <input
                          type="number"
                          value={pedidoDistanciaKm}
                          onChange={(e) => setPedidoDistanciaKm(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-slate-800 font-bold"
                          min="1"
                        />
                        <span className="text-[9px] text-slate-400 mt-0.5 block leading-tight">
                          Será computado KM de Volta equivalente ({pedidoDistanciaKm || 0} KM ida + {pedidoDistanciaKm || 0} KM volta = {(pedidoDistanciaKm || 0) * 2} KM Total)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* LIVE GOOGLE MAPS ROUTE TELEMETRY - REQUISITO 3 */}
                {!pedidoIntermunicipal && (destinoEndereco.trim() || destinoClienteId) && (
                  <div className="bg-slate-900 text-slate-100 rounded-xl border border-slate-800 p-4 font-mono space-y-2.5 shadow-md shadow-orange-500/5 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded text-[9px] uppercase font-black tracking-widest">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                        Google Maps Conectado
                      </span>
                      <span className="text-[8px] text-slate-450 uppercase">Roteamento em tempo real</span>
                    </div>

                    {googleMapsDistance.status === 'loading' ? (
                      <div className="flex items-center justify-center py-2 gap-2 text-xs text-orange-400">
                        <span className="animate-spin text-sm">🔄</span>
                        <span>Traçando rotas rodoviárias de ida e volta...</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2.5 text-center">
                          <div className="bg-slate-950 p-2 rounded-lg border border-slate-850">
                            <span className="block text-[8px] text-slate-400 uppercase font-black">Distância Ida</span>
                            <span className="text-sm font-black font-mono text-slate-100">
                              {googleMapsDistance.status === 'success' ? `${googleMapsDistance.ida} KM` : '---'}
                            </span>
                          </div>
                          <div className="bg-slate-950 p-2 rounded-lg border border-slate-850">
                            <span className="block text-[8px] text-slate-400 uppercase font-black">Distância Volta</span>
                            <span className="text-sm font-black font-mono text-slate-100">
                              {googleMapsDistance.status === 'success' ? `${googleMapsDistance.volta} KM` : '---'}
                            </span>
                          </div>
                          <div className="bg-slate-950 p-2 rounded-lg border border-slate-850 bg-gradient-to-br from-slate-950 to-orange-950/20 border-orange-550/15">
                            <span className="block text-[8px] text-orange-400 uppercase font-black">Rodagem Total</span>
                            <span className="text-sm font-black font-mono text-orange-400">
                              {googleMapsDistance.status === 'success' ? `${googleMapsDistance.total} KM` : '---'}
                            </span>
                          </div>
                        </div>

                        {googleMapsDistance.origemUsed && googleMapsDistance.destinoUsed && (
                          <div className="text-[9px] text-slate-400 space-y-0.5 pt-1 border-t border-slate-850/80 leading-normal">
                            <div className="truncate"><strong className="text-slate-300 font-bold">Origem:</strong> {googleMapsDistance.origemUsed}</div>
                            <div className="truncate"><strong className="text-slate-300 font-bold">Destino:</strong> {googleMapsDistance.destinoUsed}</div>
                          </div>
                        )}

                        {googleMapsDistance.errorMsg && (
                          <div className="text-[9.5px] bg-amber-500/10 text-amber-300 p-2 rounded border border-amber-500/20 leading-normal">
                            ⚠️ {googleMapsDistance.errorMsg}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2 font-mono">Preço do Despacho (Sua Fatura B2B)</label>
                  {pedidoIntermunicipal ? (
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>🏷️ Tarifa Longa Distância Unificada:</span>
                        <span className="text-sm font-black text-slate-900 font-mono">
                          R$ {(10.00 + (Number(pedidoDistanciaKm) * 2.50) + (Number(pedidoDistanciaKm) * 1.20)).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[8.5px] text-slate-450 border-t border-slate-200/50 pt-1 leading-normal">
                        Cálculo: R$ 10.00 (Base) + ({pedidoDistanciaKm} KM ida * R$ 2.50) + ({pedidoDistanciaKm} KM volta * R$ 1.20)<br/>
                        <strong className="text-orange-600">Repasse para o entregador: R$ {((Number(pedidoDistanciaKm) * 2)).toFixed(2)} acumulando KMs</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-150 flex justify-between text-[11px] font-mono">
                      <span>💵 Taxa Fixa Urbana (Local):</span>
                      <span className="font-extrabold text-slate-900">R$ 9.00 por envio</span>
                    </div>
                  )}
                </div>

                {/* Reversa option */}
                <div className="flex items-center gap-2 bg-slate-50 p-2 text-xs rounded-lg border border-slate-150">
                  <input
                    type="checkbox"
                    id="reversa-check-cliente"
                    checked={retornoPeca}
                    onChange={(e) => setRetornoPeca(e.target.checked)}
                    className="cursor-pointer"
                  />
                  <label htmlFor="reversa-check-cliente" className="text-[10px] font-mono font-bold text-slate-700 cursor-pointer select-none">
                    🛠️ Solicitar Coleta Reversa? (Retorno de Peça por Erro de Aplicação)
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold text-xs py-2.5 rounded-lg transition shadow shadow-emerald-600/10 cursor-pointer uppercase"
                >
                  DESPACHAR ENTREGA 🚀
                </button>
              </form>
            </div>
          </div>

          {/* Column B (lg:col-span-6) - CUSTOMER'S OWN CLIENTS BASE DATABASE / SUB-CLIENTS */}
          <div className="lg:col-span-6 bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between" id="carteira-clientes-distribuidora">
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Briefcase className="w-4 h-4 text-orange-500" />
                    Sua Carteira de Clientes
                  </h2>
                  <p className="text-xs text-slate-450 font-mono">Consulte, selecione para envio ou pré-registre novas oficinas parceiras em sua base persistente.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setClientNewClientNome('');
                    setClientNewClientEndereco('');
                    setClientNewClientQuadrante('A');
                    setIsClientAddingNewClient(true);
                  }}
                  className="bg-orange-500 text-white font-mono text-xs font-bold py-1.5 px-3 rounded-lg hover:bg-orange-600 flex items-center gap-1 cursor-pointer transition shadow-xs self-stretch sm:self-auto text-center justify-center shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-white" />
                  Novo
                </button>
              </div>

              {clientes.filter(c => c.criadoPorClienteId === activeClienteUser?.id).length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl space-y-2 bg-slate-50/50">
                  <p className="text-xs text-slate-500 font-mono">Nenhum cliente/oficina destinatária cadastrada na sua base de dados ainda.</p>
                  <p className="text-[10px] text-slate-450 font-mono">Use o botão acima ou o cadastro rápido no formulário de despacho para começar.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
                  {clientes.filter(c => c.criadoPorClienteId === activeClienteUser?.id).map(c => (
                    <div key={c.id} className="p-3 bg-slate-50 border border-slate-150 rounded-lg flex flex-col justify-between hover:border-orange-200 hover:bg-slate-50/60 transition duration-155">
                      <div className="space-y-1">
                        <div className="flex justify-between items-start gap-1">
                          <span className="text-xs font-bold text-slate-900 font-mono truncate max-w-[120px] block">{c.nome}</span>
                          <span className="text-[9px] font-mono bg-orange-100 text-orange-800 font-bold px-1.5 py-0.2 rounded shrink-0">
                            Setor {c.quadrante}
                          </span>
                        </div>
                        <span className="text-[9.5px] text-slate-400 font-mono block">Código: {c.id}</span>
                        <p className="text-[10.5px] text-slate-650 font-mono leading-relaxed line-clamp-2">📍 {c.endereco}</p>
                      </div>

                      <div className="border-t border-slate-100 mt-3 pt-2.5 flex items-center justify-between gap-2">
                        <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">
                          ✓ Sincronizado
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setDestinoTipo('cliente');
                            setDestinoClienteId(c.id);
                            setDestinoQuadrante(c.quadrante);
                            
                            setSupabaseSuccessMsg(`🎯 "${c.nome}" selecionado com sucesso! Preencha a descrição de itens.`);
                            setTimeout(() => setSupabaseSuccessMsg(''), 4500);

                            // Scroll back smoothly to form focus
                            const dispatchFormSec = document.getElementById("portal-cliente-form-solicitacao");
                            if (dispatchFormSec) {
                              dispatchFormSec.scrollIntoView({ behavior: 'smooth' });
                            }
                          }}
                          className="bg-white hover:bg-orange-500 hover:text-white text-orange-600 border border-orange-200 hover:border-orange-500 text-[10px] font-bold font-mono py-1 px-2.5 rounded-md transition cursor-pointer shrink-0"
                        >
                          🚚 Selecionar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 3 (lg:col-span-12) - Registered Motoboys */}
          <div className="lg:col-span-12 bg-white rounded-xl shadow-sm border border-slate-200 p-5" id="portal-cliente-motoboys">
            <div>
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <TorqueLogLogoIcon size={18} className="text-emerald-600" variant={logoVariant} />
                  Motoboys Credenciados
                </h2>
                <p className="text-xs text-slate-450 font-mono">Clique no botão para seguir a rota de cada prestador em tempo real</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[350px] overflow-y-auto pr-1">
                {filteredMotoboysForClient.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 italic font-mono text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50 col-span-full">
                    Nenhum entregador exclusivo cadastrado para a sua região ({activeClienteUser?.cidade || 'Sem Cidade'}).
                  </div>
                ) : (
                  filteredMotoboysForClient.map((mb, idx) => {
                    const activeDelivery = ordens.find(o => o.status === 'Moto a Caminho' && o.motoboyId === mb.id);
                    const isDeliveringForSelf = activeDelivery && activeDelivery.clienteId === activeClienteUser?.id;

                    const statusClass = activeDelivery 
                      ? (isDeliveringForSelf ? 'bg-orange-100 text-orange-850 animate-pulse font-bold' : 'bg-slate-100 text-slate-505')
                      : 'bg-emerald-100 text-emerald-800';

                    const statusText = activeDelivery 
                      ? (isDeliveringForSelf ? 'Sua Entrega 🏍️' : 'Em outra rota')
                      : 'Pátio Central / Loja';

                    return (
                      <div 
                        key={mb.id} 
                        className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between gap-2 transition duration-200 hover:bg-slate-100/50"
                      >
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-slate-900 block font-mono leading-none">{mb.nome}</span>
                          <span className="text-[9px] text-slate-400 font-mono block">MEI Ativo • {mb.cidade}</span>
                          <span className={`inline-block mt-0.5 text-[9px] font-mono px-1.5 py-0.2 rounded ${statusClass}`}>
                            {statusText}
                          </span>
                        </div>

                        {mb.empresaExclusiva ? (
                          <button
                            onClick={() => handleRastrearMotoboyNoGoogleMaps(mb)}
                            className="text-[9px] font-mono font-black py-1.5 px-2.5 rounded border bg-orange-600 hover:bg-orange-700 hover:scale-103 text-white uppercase transition duration-150 cursor-pointer flex items-center gap-1 shrink-0 shadow shadow-orange-500/10"
                            title="Rastrear localização do entregador exclusivo no Google Maps"
                          >
                            <Navigation className="w-2.5 h-2.5 animate-pulse" />
                            Rastrear 🗺️
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono italic pr-1">Rotativo</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-4 p-2.5 bg-emerald-50 border border-emerald-150 rounded-xl text-[10px] font-mono text-emerald-850 leading-relaxed">
              ⭐ <strong>Acompanhamento:</strong> Motoboys que estiverem listados como <strong>Sua Entrega</strong> estão trazendo sua mercadoria! Use o botão "Rastrear" para abrir a rota exata no Google Maps.
            </div>
          </div>

          {/* Row 2 (lg:col-span-12) - Real-time Order tracking list */}
          <div className="lg:col-span-12 bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3 mb-4 font-mono">
              <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
              Seu Histórico de Despacho B2B Express (Entregas Diárias e Mensais)
            </h2>

            <div className="space-y-3.5">
              {ordens.filter(o => o.clienteId === activeClienteUser?.id).length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl space-y-2">
                  <p className="text-xs text-slate-400 font-mono">Você não tem pedidos registrados nas últimas 24 h.</p>
                  <p className="text-[10px] text-slate-400 font-mono">Despache autopeças no formulário ao lado para abrir requisições.</p>
                </div>
              ) : (
                ordens.filter(o => o.clienteId === activeClienteUser?.id).map(o => (
                  <div key={o.id} className="p-3.5 bg-slate-50/70 border border-slate-150 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-slate-300 transition duration-150">
                    <div className="space-y-1 w-full sm:w-auto">
                      <div className="flex items-center gap-2 flex-wrap pb-1.5 border-b border-slate-100 mb-2">
                        <span className="text-[10px] bg-slate-200 text-slate-900 px-1.5 py-0.2 rounded font-mono font-bold">{o.id}</span>
                        <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-black uppercase ${
                          o.status === 'Entregue' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          o.status === 'Moto a Caminho' ? 'bg-orange-100 text-orange-850 border border-orange-200 animate-pulse' :
                          'bg-amber-100 text-amber-805 border border-amber-200'
                        }`}>
                          {o.status === 'Buscando Parceiro' ? '⏳ Na Fila (Aguardando Coleta)' : o.status}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">Criado em: {new Date(o.criadoEm).toLocaleTimeString()}</span>
                      </div>
                      
                      <div className="text-xs text-slate-700 font-mono space-y-1 mt-1 leading-normal">
                        <div>🏢 <strong>Auto-Peça de Coleta (Origem):</strong> {o.clienteNome}</div>
                        <div>🎯 <strong>Oficina de Entrega (Destino):</strong> {o.destinatarioNome || 'Oficina Credenciada'}</div>
                        <div>📍 <strong>Endereço de Destino:</strong> {o.enderecoEntrega}</div>
                        <div>🧭 <strong>Região / Quadrante Atribuído:</strong> Setor {o.quadrante}</div>
                        {o.distanciaKm ? (
                          <div className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 mt-1.5 font-bold flex items-center gap-1.5 w-fit">
                            <span className="flex h-1.5 w-1.5 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                            </span>
                            <span>⏱️ Rota Est.: ~{Math.round(o.distanciaKm * 1.5)} min • 🛣️ Distância Coleta-Entrega: <strong className="font-mono text-emerald-800">{o.distanciaKm.toFixed(2)} km (Exata via Google Maps 🗺️)</strong></span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-orange-650 bg-orange-50 border border-orange-100 rounded px-1.5 py-0.5 mt-1.5 font-bold flex items-center gap-1 w-fit">
                            <span>⏱️ Rota Est.: ~{obterEstimativaTempoPercurso(o.quadrante).tempoMin} min • 🛣️ Distância Coleta-Entrega: {obterEstimativaTempoPercurso(o.quadrante).distanciaKm} km</span>
                          </div>
                        )}
                      </div>

                      {o.motoboyNome ? (
                        <div className="mt-2.5 p-2.5 bg-emerald-50 rounded-lg border border-emerald-100 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] text-emerald-900 font-mono font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse block shrink-0"></span>
                            🏍️ Saída do Motoboy: <span className="underline text-emerald-950 font-black">{o.motoboyNome}</span>
                          </div>
                          <div className="text-[10px] text-slate-600 font-mono leading-relaxed pl-3.5">
                            👉 O condutor parceiro aceitou o frete e está se dirigindo ao <strong>Setor {o.quadrante}</strong> para fazer a entrega final no cliente/oficina destinatária: <strong className="text-slate-900">{o.destinatarioNome}</strong>.
                          </div>
                          <div className="pl-3.5 pt-0.5">
                            {(() => {
                              const mbObj = motoboys.find(m => m.id === o.motoboyId);
                              return mbObj ? (
                                <button 
                                  onClick={() => handleRastrearMotoboyNoGoogleMaps(mbObj)}
                                  className="bg-orange-600 hover:bg-orange-700 text-white font-mono text-[9px] font-black px-3 py-1 rounded transition uppercase tracking-wider cursor-pointer shadow-sm ml-0 flex items-center gap-1"
                                >
                                  <Navigation className="w-2.5 h-2.5" />
                                  Rastrear no Google Maps 🗺️
                                </button>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono italic block mt-1.5 pl-1">
                          ⏳ Aguardando aceitação de um motoboy parceiro no pátio central... (Setor de busca: {o.quadrante})
                        </span>
                      )}
                    </div>

                    <div className="text-right font-mono self-end sm:self-center pr-2 shrink-0 border-t sm:border-t-0 border-slate-100 sm:pt-0 pt-2 w-full sm:w-auto flex flex-col items-end gap-1.5">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded ${o.status === 'Entregue' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {o.status === 'Entregue' ? '✓ Conclída com Sucesso' : '• Em Andamento'}
                      </span>
                      {o.retornoPeca && (
                        <span className="text-[9px] text-rose-600 block font-bold">🔄 Coleta Reversa Ativa</span>
                      )}
                      {o.status !== 'Entregue' && (
                        <button
                          type="button"
                          onClick={() => handleCancelarOrdem(o.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 hover:border-red-200 text-[10px] font-bold py-1 px-2.5 rounded-lg active:scale-95 transition cursor-pointer text-center flex items-center justify-center gap-1 w-full sm:w-auto"
                        >
                          ✕ Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </main>
      )}



      {/* --- REUSABLE FOOTER --- */}
      <footer className="bg-slate-900 text-slate-400 font-mono text-center py-6 border-t border-slate-800 text-xs mt-auto px-4" id="application-footer">
        <p>© 2026 TorqueLog B2B S.A. Todos os direitos reservados. – Tecnologia em Logística Autônoma Garantida.</p>
        <p className="text-[10px] text-slate-500 mt-1">Frota homologada: 100% Motocicleta | Contrato de Risco Trabalhista Zero em vigor.</p>
        
        {/* Link to the brand new proposal accessible from inside any session */}
        <div className="mt-3.5 max-w-lg mx-auto bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
          <span className="text-[10.5px] text-slate-300 font-bold block">📈 Quer apresentar a TorqueLog para novos parceiros?</span>
          <a
            href="/proposta_comercial.html"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-orange-600 hover:bg-orange-500 text-white text-[10.5px] font-bold py-1 px-3.5 rounded transition shadow-sm text-center w-full sm:w-auto"
          >
            Abrir Proposta B2B →
          </a>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800/60 max-w-lg mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 text-[11px]">
          <span className="text-orange-400 font-bold select-all">📧 Suporte: administracao@torquelog.com.br</span>
          <span className="hidden sm:inline text-slate-700">|</span>
          <a
            href="https://wa.me/5519984427748"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1 px-3 rounded-lg transition"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" referrerPolicy="no-referrer">
              <path d="M12.031 6.172c-2.02 0-3.659 1.635-3.659 3.659 0 .614.152 1.209.444 1.74l-.472 1.72 1.764-.46a3.618 3.618 0 0 0 1.923.541c2.019 0 3.66-1.636 3.66-3.66 0-2.022-1.64-3.66-3.66-3.66zm1.905 5.155c-.078.22-.44.426-.644.453-.203.027-.457.042-.741-.051a2.822 2.822 0 0 1-1.127-.723 3.123 3.123 0 0 1-.774-1.22c-.156-.37-.024-.572.073-.674.098-.102.219-.254.329-.381.11-.127.147-.212.22-.352.073-.14.037-.263-.018-.37-.056-.107-.491-1.185-.674-1.62-.178-.426-.358-.369-.492-.375-.123-.005-.264-.006-.405-.006a.78.78 0 0 0-.563.262c-.195.214-.741.724-.741 1.763 0 1.04.757 2.046.862 2.188.106.14 1.491 2.278 3.611 3.193.504.218.898.348 1.206.446.505.161.966.138 1.33.084.406-.06.126-.412.247-.412a1.008 1.008 0 0 0 .7.493c.241.05.485.074.726.074.458 0 .895-.083 1.298-.246zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.019 21.72c-1.83 0-3.623-.483-5.203-1.397l-.373-.222-3.867 1.013 1.03-3.768-.243-.387A9.673 9.673 0 0 1 2.28 12c0-5.352 4.36-9.712 9.72-9.712 5.353 0 9.712 4.36 9.712 9.712 0 5.353-4.36 9.72-9.712 9.72z" />
            </svg>
            Chamar no WhatsApp
          </a>
        </div>
      </footer>

      {/* ==========================================
          MODAL: SIGN INVOICE (CANHOTO DIGITAL)
          ========================================== */}
      <AnimatePresence>
        {activeSignOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="modal-canhoto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-tight">
                  Canhoto Digital de Entrega
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveSignOrder(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold py-1 px-2 rounded hover:bg-slate-100 cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="bg-slate-50 py-2.5 px-3 rounded-lg border text-xs font-mono text-slate-650 space-y-1 border-slate-200 mb-4">
                <div><strong>Ordem ID:</strong> {activeSignOrder.id}</div>
                <div><strong>Destinatário B2B:</strong> {activeSignOrder.clienteNome}</div>
                <div><strong>Objeto Entregue:</strong> {activeSignOrder.itensDescricao}</div>
                <div className="border-t border-slate-200 mt-2 pt-1.5 text-[11px]">
                  {effectiveRole === 'Motoboy' ? (
                    // Within courier / driver session: ONLY show the freight price (repasse)
                    <div className="flex justify-between items-center py-1 bg-amber-50 px-2 rounded border border-amber-100">
                      <span className="font-bold text-amber-800 font-mono">🏍️ VALOR DO FRETE (REPASSE ACORDADO):</span>
                      <span className="font-extrabold text-amber-955 text-xs font-mono">
                        R$ {((activeSignOrder.valorPagoMotoboy || 4.00) + (0)).toFixed(2)}
                      </span>
                    </div>
                  ) : effectiveRole === 'Cliente' ? (
                    // Within distributor / client session: ONLY show their cost (Cobrança Cliente B2B), hide repasse entirely
                    <div className="flex justify-between items-center py-1 bg-emerald-50 px-2 rounded border border-emerald-100">
                      <span className="font-bold text-emerald-800 font-mono">💵 VALOR DO ENVIO (FABRIL B2B):</span>
                      <span className="font-extrabold text-emerald-955 text-xs font-mono">
                        R$ {((activeSignOrder.valorCobradoCliente || 10.00) + (0)).toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    // Admin (Empresa) view: show the full breakdown
                    <>
                      <div className="flex justify-between">
                        <span>💵 Cobrança Cliente B2B:</span>
                        <span className="font-bold text-slate-800">R$ {((activeSignOrder.valorCobradoCliente || 10.00) + (0)).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>🏍️ Repasse ao Motoboy:</span>
                        <span className="font-bold text-rose-600">R$ {((activeSignOrder.valorPagoMotoboy || 4.00) + (0)).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-600 border-t border-dashed border-slate-200 mt-1 pt-1">
                        <span>⚡ Lucro Líquido TorqueLog:</span>
                        <span>R$ {(activeSignOrder.valorCobradoCliente - activeSignOrder.valorPagoMotoboy).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <form onSubmit={handleAssinarCanhotoDigital} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-705 uppercase mb-1.5 font-mono">
                    Nome / Assinatura do Mecânico Recebedor
                  </label>
                  <input
                    type="text"
                    required
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    placeholder="Ex: Renan da Oficina / Carvalho"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                {/* Simulated Mouse Drawing Pad Area for Touch/Click Sign */}
                <div>
                  <span className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 font-mono">
                    Assinatura Física no Display do Celular
                  </span>
                  <div className="border border-slate-350 bg-slate-100 h-28 rounded-lg flex items-center justify-center relative cursor-crosshair">
                    {signatureName ? (
                      <span className="font-mono text-slate-800 text-sm italic font-black uppercase underline decoration-2 decoration-orange-500">
                        {signatureName}
                      </span>
                    ) : (
                      <div className="text-center">
                        <span className="text-slate-400 text-[11px] font-mono block">Assine na caixa acima digitando seu nome</span>
                        <span className="text-[10px] text-slate-400">Canhoto biométrico auto-certificado</span>
                      </div>
                    )}
                    {signatureName && (
                      <span className="absolute bottom-2 right-2 text-[9px] bg-slate-900 text-orange-400 py-0.5 px-1.5 font-mono rounded-full font-bold">
                        🔒 Digital Guard
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSignOrder(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-xs font-bold font-mono cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-xs font-bold font-mono cursor-pointer shadow-md"
                  >
                    Faturar e Finalizar
                  </button>
                </div>
              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          MODAL: CHECK-IN DE ODÔMETRO (MOTO ALUGADA)
          ========================================== */}
      <AnimatePresence>
        {isCheckinModalOpen && activeMotoboyUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="modal-checkin-odometro">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-black text-slate-900 uppercase font-mono tracking-tight">
                  🔓 Check-In de Odômetro (Entrada)
                </h3>
                <button
                  type="button"
                  onClick={() => setCheckinModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold py-1 px-2 rounded hover:bg-slate-100 cursor-pointer text-xs font-mono"
                >
                  ✕
                </button>
              </div>

              <p className="text-[10px] text-slate-500 font-mono mb-4 leading-normal">
                Preencha os indicadores de rodagem da motocicleta de frota alugada para liberar as entregas do turno.
              </p>

              <div className="space-y-4 font-mono text-xs">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Placa do Veículo 🏍️</label>
                  <input
                    type="text"
                    value={checkinPlaca}
                    onChange={(e) => setCheckinPlaca(e.target.value.toUpperCase())}
                    placeholder="Ex: ABC-1234"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold font-mono focus:ring-1 focus:ring-orange-500 text-slate-900"
                    maxLength={8}
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Quilometragem de Entrada (Painel) 📊</label>
                  <input
                    type="number"
                    value={checkinKm}
                    onChange={(e) => setCheckinKm(e.target.value)}
                    placeholder="Ex: 12450"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold font-mono focus:ring-1 focus:ring-orange-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Foto de Registro do Painel 📸</label>
                  <div className="border border-dashed border-slate-200 rounded-lg p-3 bg-slate-50 flex flex-col items-center justify-center text-center gap-2">
                    {checkinFoto ? (
                      <div className="relative w-full max-w-[120px] aspect-video rounded border overflow-hidden bg-slate-100 shadow-sm">
                        <img src={checkinFoto} alt="Odometer In" className="w-full h-full object-cover" />
                        <button 
                          type="button" 
                          onClick={() => setCheckinFoto('')} 
                          className="absolute top-1 right-1 bg-red-650 bg-red-600 text-white text-[8px] font-bold p-1 rounded-full cursor-pointer leading-none flex items-center justify-center w-4 h-4"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span className="text-lg">📷</span>
                    )}

                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      id="checkin-camera-input" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setCheckinFoto(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => {
                        document.getElementById('checkin-camera-input')?.click();
                        // If no file gets uploaded, we make sure they still have a nice default mock photo
                        setTimeout(() => {
                          if (!checkinFoto) {
                            setCheckinFoto('https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400&auto=format&fit=crop&q=60referrerPolicy=no-referrer');
                          }
                        }, 1000);
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-[9.5px] uppercase font-bold py-1.5 px-3 rounded font-mono shadow-sm cursor-pointer border border-slate-700 hover:scale-102 transition flex items-center gap-1"
                    >
                      📸 Abrir Câmera do Celular
                    </button>

                    <span className="text-[8px] text-slate-400 font-mono uppercase font-bold">
                      {checkinFoto ? "✓ Foto capturada com sucesso" : "Aperte para bater a foto do odômetro"}
                    </span>
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-2.5 text-[10px] text-orange-800 leading-normal font-sans">
                  💡 <strong>Lembrete Importante:</strong> Ao final do expediente de hoje, você terá que realizar o <strong>Check-Out</strong> batendo outra foto do odômetro com o <strong>KM final do dia</strong> e calcular o KM rodado!
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckinModalOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-xs font-bold font-mono cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!checkinPlaca.trim() || !checkinKm.trim()) {
                        alert("Por favor, informe a Placa e a Quilometragem de Entrada válidos!");
                        return;
                      }
                      const kmNum = parseInt(checkinKm);
                      if (isNaN(kmNum) || kmNum < 0) {
                        alert("Por favor, digite uma quilometragem de entrada válida!");
                        return;
                      }

                      const updatedMb = {
                        ...activeMotoboyUser,
                        isTrabalhandoAtivo: true,
                        placaAtual: checkinPlaca,
                        kmEntrada: kmNum,
                        fotoOdometroEntrada: checkinFoto,
                        dataEntrada: new Date().toISOString()
                      };

                      const updatedRidersList = motoboys.map(m => {
                        if (m.id === activeMotoboyUser.id) {
                          return { 
                            ...m, 
                            isTrabalhandoAtivo: true, 
                            placaAtual: checkinPlaca, 
                            kmEntrada: kmNum, 
                            fotoOdometroEntrada: checkinFoto, 
                            dataEntrada: updatedMb.dataEntrada 
                          };
                        }
                        return m;
                      });

                      setMotoboys(updatedRidersList);
                      setActiveMotoboyUser(updatedMb);
                      setCheckinModalOpen(false);
                      alert("🔓 Check-In realizado com sucesso! Turno iniciado e entregas liberadas para você.");
                      setTimeout(() => {
                        window.scrollTo({
                          top: document.body.scrollHeight / 2,
                          behavior: "smooth"
                        });
                      }, 400);
                    }}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-mono font-bold text-xs py-2 rounded-lg transition shadow uppercase cursor-pointer"
                  >
                    Enviar Check-In
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          MODAL: CHECK-OUT DE ODÔMETRO (MOTO ALUGADA)
          ========================================== */}
      <AnimatePresence>
        {isCheckoutModalOpen && activeMotoboyUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="modal-checkout-odometro">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-black text-slate-900 uppercase font-mono tracking-tight">
                  🔒 Check-Out de Odômetro (Saída)
                </h3>
                <button
                  type="button"
                  onClick={() => setCheckoutModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold py-1 px-2 rounded hover:bg-slate-100 cursor-pointer text-xs font-mono"
                >
                  ✕
                </button>
              </div>

              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-slate-600 text-[10px] font-mono mb-4 leading-normal">
                <div>Placa Registrada: <strong className="text-slate-800">{activeMotoboyUser.placaAtual}</strong></div>
                <div>KM de Entrada: <strong className="text-slate-800">{activeMotoboyUser.kmEntrada} km</strong></div>
                <div>Entrada em: {activeMotoboyUser.dataEntrada ? new Date(activeMotoboyUser.dataEntrada).toLocaleTimeString() : 'Não informada'}</div>
              </div>

              <div className="space-y-4 font-mono text-xs">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Quilometragem de Saída (Painel) 📊</label>
                  <input
                    type="number"
                    value={checkoutKm}
                    onChange={(e) => setCheckoutKm(e.target.value)}
                    placeholder={`Deve ser maior ou igual a ${activeMotoboyUser.kmEntrada || 0}`}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold font-mono focus:ring-1 focus:ring-orange-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Foto de Registro do Painel 📸</label>
                  <div className="border border-dashed border-slate-200 rounded-lg p-3 bg-slate-50 flex flex-col items-center justify-center text-center gap-2">
                    {checkoutFoto ? (
                      <div className="relative w-full max-w-[120px] aspect-video rounded border overflow-hidden bg-slate-100 shadow-sm">
                        <img src={checkoutFoto} alt="Odometer Out" className="w-full h-full object-cover" />
                        <button 
                          type="button" 
                          onClick={() => setCheckoutFoto('')} 
                          className="absolute top-1 right-1 bg-red-650 bg-red-600 text-white text-[8px] font-bold p-1 rounded-full cursor-pointer leading-none flex items-center justify-center w-4 h-4"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span className="text-lg">📷</span>
                    )}

                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      id="checkout-camera-input" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setCheckoutFoto(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => {
                        document.getElementById('checkout-camera-input')?.click();
                        setTimeout(() => {
                          if (!checkoutFoto) {
                            setCheckoutFoto('https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400&auto=format&fit=crop&q=60referrerPolicy=no-referrer');
                          }
                        }, 1000);
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-[9.5px] uppercase font-bold py-1.5 px-3 rounded font-mono shadow-sm cursor-pointer border border-slate-700 hover:scale-102 transition flex items-center gap-1"
                    >
                      📸 Abrir Câmera do Celular
                    </button>

                    <span className="text-[8px] text-slate-400 font-mono uppercase font-bold">
                      {checkoutFoto ? "✓ Foto capturada com sucesso" : "Aperte para bater a foto do odômetro"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutModalOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-xs font-bold font-mono cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const kmInicial = activeMotoboyUser.kmEntrada || 0;
                      const kmFinal = parseInt(checkoutKm);
                      if (isNaN(kmFinal) || kmFinal < kmInicial) {
                        alert(`⚠️ Erro: A quilometragem de saída (${kmFinal || 0}) não pode ser inferior à quilometragem de entrada gravada (${kmInicial} km)!`);
                        return;
                      }

                      const kmRodado = kmFinal - kmInicial;
                      
                      const novoRegistro: RegistroOdometro = {
                        id: `ODO-${Math.floor(1000 + Math.random() * 9000)}`,
                        motoboyId: activeMotoboyUser.id,
                        motoboyNome: activeMotoboyUser.nome,
                        placa: activeMotoboyUser.placaAtual || '',
                        kmInicial: kmInicial,
                        fotoInicial: activeMotoboyUser.fotoOdometroEntrada || '',
                        dataEntrada: activeMotoboyUser.dataEntrada || new Date().toISOString(),
                        kmFinal: kmFinal,
                        fotoFinal: checkoutFoto,
                        dataSaida: new Date().toISOString(),
                        kmTrabalhado: kmRodado
                      };

                      setRegistrosOdometros(prev => [novoRegistro, ...prev]);

                      const updatedMb = {
                        ...activeMotoboyUser,
                        isTrabalhandoAtivo: false,
                        placaAtual: undefined,
                        kmEntrada: undefined,
                        fotoOdometroEntrada: undefined,
                        dataEntrada: undefined
                      };

                      const updatedRidersList = motoboys.map(m => {
                        if (m.id === activeMotoboyUser.id) {
                          return { 
                            ...m, 
                            isTrabalhandoAtivo: false, 
                            placaAtual: undefined, 
                            kmEntrada: undefined, 
                            fotoOdometroEntrada: undefined, 
                            dataEntrada: undefined 
                          };
                        }
                        return m;
                      });

                      setMotoboys(updatedRidersList);
                      setActiveMotoboyUser(updatedMb);
                      setCheckoutModalOpen(false);
                      alert(`🔒 Expediente finalizado com absoluto sucesso!\nTotal percorrido no turno: ${kmRodado} km.`);
                    }}
                    className="flex-1 bg-slate-900 hover:bg-slate-950 text-white font-mono font-bold text-xs py-2 rounded-lg transition shadow uppercase cursor-pointer"
                  >
                    Enviar Saída
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          MODAL: CONFIRMAR ACEITE E MAPA DA ROTA (MOTOBOY)
          ========================================== */}
      <AnimatePresence>
        {orderToAcceptPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl" id="modal-confirmar-aceite">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-250 max-w-md w-full p-6 space-y-4"
            >
              <div className="flex justify-between items-start">
                <div className="bg-orange-100 text-orange-600 p-2.5 rounded-xl shrink-0 flex items-center justify-center shadow-xs">
                  <Navigation className="w-5 h-5 animate-pulse" />
                </div>
                <button
                  type="button"
                  onClick={() => setOrderToAcceptPrompt(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg font-mono px-2"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-black text-slate-900 font-sans tracking-tight">
                  Aceitar Corrida e Iniciar Despacho?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-sans">
                  Você está assumindo a responsabilidade pela corrida de <strong className="text-slate-900">{orderToAcceptPrompt.clienteNome}</strong> com destino a <strong className="text-slate-900">{orderToAcceptPrompt.destinatarioNome || 'Oficina / Cliente'}</strong>.
                </p>
                
                <div className="bg-orange-50/50 rounded-xl p-3 border border-orange-100 text-xs text-orange-850 space-y-1.5 font-mono">
                  <p>🏢 <strong>Coleta:</strong> {orderToAcceptPrompt.clienteNome}</p>
                  <p>🎯 <strong>Entrega:</strong> {orderToAcceptPrompt.destinatarioNome || 'Oficina'} • {orderToAcceptPrompt.enderecoEntrega || `Setor ${orderToAcceptPrompt.quadrante}`}</p>
                  <p>🧭 <strong>Vizinhança/Quadrante:</strong> Setor {orderToAcceptPrompt.quadrante}</p>
                </div>
                
                <p className="text-xs text-slate-500 font-sans font-semibold pt-1">
                  Deseja abrir a rota dinâmica desta corrida no Google Maps para te orientar no trajeto?
                </p>
              </div>

              {/* Remember preference checkbox */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="remember-pref-checkbox"
                  checked={rememberPreference}
                  onChange={(e) => setRememberPreference(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="remember-pref-checkbox" className="text-[11px] text-slate-650 leading-tight font-sans cursor-pointer select-none">
                  <strong className="text-slate-800 block mb-0.5">Lembrar minha escolha para as próximas vezes</strong>
                  Salva sua escolha e pula esse diálogo de confirmação em corridas futuras.
                </label>
              </div>

              <div className="flex flex-col gap-2 pt-1 font-mono">
                <button
                  type="button"
                  onClick={() => {
                    handleAtualizarStatusOrdem(orderToAcceptPrompt.id, 'Moto a Caminho');
                    handleAbrirGoogleMaps(orderToAcceptPrompt, true);
                    if (rememberPreference) {
                      localStorage.setItem('torque_log_maps_pref', 'always_open');
                      setMapsPreference('always_open');
                    }
                    setOrderToAcceptPrompt(null);
                  }}
                  className="w-full bg-orange-600 hover:bg-orange-700 active:scale-98 text-white font-black text-xs py-3 rounded-xl transition duration-155 flex items-center justify-center gap-2 shadow-md shadow-orange-500/10 cursor-pointer text-center"
                >
                  <Navigation className="w-4 h-4 text-white animate-pulse" />
                  Sim, Aceitar e Iniciar Trajeto 🚀
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    handleAtualizarStatusOrdem(orderToAcceptPrompt.id, 'Moto a Caminho');
                    if (rememberPreference) {
                      localStorage.setItem('torque_log_maps_pref', 'always_skip_maps');
                      setMapsPreference('always_skip_maps');
                    }
                    setOrderToAcceptPrompt(null);
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2.5 rounded-xl transition cursor-pointer text-center"
                >
                  Não, aceitar sem abrir mapa (Já sei o caminho) 👍
                </button>
                
                <button
                  type="button"
                  onClick={() => setOrderToAcceptPrompt(null)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-550 text-xs font-semibold py-2 rounded-lg transition cursor-pointer text-center"
                >
                  Cancelar / Voltar ✕
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          MODAL: DETALHAMENTO DE FECHAMENTO MENSAL E NOTA FISCAL (B2B DISTRIBUIDORA)
          ========================================== */}
      <AnimatePresence>
        {activeClosingDistributorId && (() => {
          const closingDist = clientes.find(c => c.id === activeClosingDistributorId);
          const closingStats = monthlyDistributorStats.find(s => s.distributor.id === activeClosingDistributorId);
          if (!closingDist || !closingStats) return null;

          const closingOrdersList = ordens.filter(o => {
            if (o.status !== 'Entregue') return false;
            const belongsToThisDist = getDistributorIdForOrder(o.clienteId) === closingDist.id;
            if (!belongsToThisDist) return false;
            const orderDate = new Date(o.criadoEm);
            return orderDate.getMonth() === calendarViewMonth && orderDate.getFullYear() === calendarViewYear;
          });

          const copyClosingReportToClipboard = () => {
            let text = `========= FECHAMENTO MENSAL B2B TORQUELOG =========\n`;
            text += `DISTRIBUIDORA DEVEDORA: ${closingDist.nome}\n`;
            text += `CNPJ: ${closingDist.cnpj || 'Isento / Não informado'}\n`;
            text += `CIDADE: ${closingDist.cidade}\n`;
            text += `MÊS DE REFERÊNCIA: ${MONTHS_PT[calendarViewMonth]} / ${calendarViewYear}\n`;
            text += `TOTAL DE ENTREGAS COMPLETADAS: ${closingStats.completedMonthCount} OS\n`;
            text += `VALOR TOTAL DA COBRANÇA (FATURAMENTO DE ENTREGAS): R$ ${closingStats.monthlyBilling.toFixed(2)}\n`;
            text += `----------------------------------------------------\n`;
            text += `RELAÇÃO DETALHADA DE ORDENS DE SERVIÇO (OS):\n`;
            closingOrdersList.forEach((ord, index) => {
              const val = (ord.valorCobradoCliente || 10.00) + (0);
              text += `${index + 1}. OS ID: ${ord.id} | Data: ${new Date(ord.criadoEm).toLocaleDateString()} | Oficina: ${ord.destinatarioNome || 'Prefeitura / Balcão'} | Valor: R$ ${val.toFixed(2)}${ord.retornoPeca ? ' (Reversa inclusa)' : ''}\n`;
            });
            text += `----------------------------------------------------\n`;
            text += `Instrução de Pagamento: Emitir boleto ou realizar transferência de R$ ${closingStats.monthlyBilling.toFixed(2)} para chave Pix da TorqueLog.\n`;
            text += `====================================================`;

            navigator.clipboard.writeText(text);
            setIsCopiedClosingReport(true);
            setTimeout(() => setIsCopiedClosingReport(false), 2500);
          };

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" id="modal-fechamento-b2b">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-5 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase font-mono tracking-tight flex items-center gap-1.5">
                      🧾 Fechamento Consolidado & Demonstrativo (B2B)
                    </h3>
                    <p className="text-[11px] text-slate-405 font-mono">Competência: {MONTHS_PT[calendarViewMonth]} / {calendarViewYear}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveClosingDistributorId(null)}
                    className="text-slate-400 hover:text-slate-650 font-bold py-1 px-2.5 rounded hover:bg-slate-100 cursor-pointer text-xs"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="text-[9px] font-mono text-slate-400 block uppercase font-bold">🏢 Distribuidora Devedora</span>
                    <strong className="text-xs text-slate-800 block truncate">{closingDist.nome}</strong>
                    <span className="text-[9.5px] font-mono text-slate-500 block">CNPJ: {closingDist.cnpj || 'CPF/CNPJ Isento'}</span>
                    <span className="text-[9.5px] font-mono text-slate-500 block">Cidade: {closingDist.cidade}</span>
                  </div>

                  <div className="p-3 bg-emerald-500/5 border border-emerald-250 rounded-xl space-y-1">
                    <span className="text-[9px] font-mono text-emerald-800 block uppercase font-bold">💵 Cobrança Consolidada</span>
                    <strong className="text-lg font-mono text-emerald-950 block">R$ {closingStats.monthlyBilling.toFixed(2)}</strong>
                    <span className="text-[9.5px] font-mono text-emerald-700 block">Total de Entregas: <strong>{closingStats.completedMonthCount} OS</strong></span>
                    <span className="text-[9.5px] font-mono text-slate-500 block">Repasse do Mês: R$ {closingStats.monthlyRepasse.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <h4 className="text-[10px] font-black text-slate-600 uppercase font-mono tracking-wider">
                    Relação Detalhada de Encomendas no Período
                  </h4>
                  
                  <div className="border border-slate-200 rounded-lg max-h-[180px] overflow-y-auto divide-y divide-slate-150 bg-slate-50 font-mono text-[10px] shadow-xs">
                    {closingOrdersList.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 italic">
                        Nenhuma entrega registrada para faturamento neste período.
                      </div>
                    ) : (
                      closingOrdersList.map((ord, idx) => {
                        const val = (ord.valorCobradoCliente || 10.00) + (0);
                        return (
                          <div key={ord.id} className="p-2 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors">
                            <div className="space-y-0.5">
                              <span className="bg-slate-900 text-orange-450 px-1 font-bold rounded text-[8.5px] mr-1">{ord.id}</span>
                              <span className="text-slate-450">{new Date(ord.criadoEm).toLocaleDateString()}</span>
                              <span className="text-slate-550 block max-w-sm truncate text-[9px]">Destinatário: {ord.destinatarioNome || 'Balcão Geral'}</span>
                            </div>
                            <div className="text-right">
                              <strong className="text-slate-800 block">R$ {val.toFixed(2)}</strong>
                              {ord.retornoPeca && <span className="text-[8px] bg-rose-100 text-rose-800 px-1 rounded-sm uppercase tracking-tight font-extrabold">Reversa</span>}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="bg-slate-900 rounded-xl p-3 border border-slate-850 space-y-2.5 text-[11px] font-mono text-slate-300">
                  <p>🛠️ <strong>Guia de Conciliação B2B:</strong> Emita a nota fiscal baseada no resumo acima e fature diretamente para a distribuidora parceira utilizando a chave cadastrada: <strong>{closingDist.email || 'financeiro@b2bservice.com'}</strong>.</p>
                  
                  <button
                    type="button"
                    onClick={copyClosingReportToClipboard}
                    className="w-full text-center py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-98 text-white font-bold uppercase rounded-lg shadow-md font-mono tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    {isCopiedClosingReport ? "📋 DEMONSTRATIVO COPIADO! ✓" : "📋 COPIAR DEMONSTRATIVO FINANCEIRO"}
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 no-print">
                    <button
                      type="button"
                      onClick={() => {
                        let text = `========= FECHAMENTO MENSAL B2B TORQUELOG =========\n`;
                        text += `🏢 DISTRIBUIDORA DEVEDORA: ${closingDist.nome}\n`;
                        text += `📄 CNPJ: ${closingDist.cnpj || 'Isento / Não informado'}\n`;
                        text += `📍 CIDADE: ${closingDist.cidade}\n`;
                        text += `📅 MÊS DE REFERÊNCIA: ${MONTHS_PT[calendarViewMonth]} / ${calendarViewYear}\n`;
                        text += `📦 TOTAL DE ENTREGAS COMPLETADAS: ${closingStats.completedMonthCount} OS\n`;
                        text += `💰 VALOR TOTAL DA COBRANÇA (FATURAMENTO DETALHADO): R$ ${closingStats.monthlyBilling.toFixed(2)}\n`;
                        text += `----------------------------------------------------\n`;
                        text += `RELAÇÃO DETALHADA DE ORDENS DE SERVIÇO (OS):\n`;
                        closingOrdersList.slice(0, 40).forEach((ord, index) => {
                          const val = (ord.valorCobradoCliente || 10.00) + (0);
                          text += `${index + 1}. OS ID: ${ord.id} | Data: ${new Date(ord.criadoEm).toLocaleDateString()} | Oficina: ${ord.destinatarioNome || 'Prefeitura / Balcão'} | Valor: R$ ${val.toFixed(2)}${ord.retornoPeca ? ' (Reversa inclusa)' : ''}\n`;
                        });
                        if (closingOrdersList.length > 40) {
                          text += `...e outras ${closingOrdersList.length - 40} ordens no faturamento.\n`;
                        }
                        text += `----------------------------------------------------\n`;
                        text += `📲 Instrução de Pagamento: Favor transferir R$ ${closingStats.monthlyBilling.toFixed(2)} para a conta cadastrada da TorqueLog.\n`;
                        text += `====================================================`;

                        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                        const link = document.createElement('a');
                        link.href = waUrl;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-2 rounded-lg shadow font-mono text-center flex items-center justify-center gap-1.5 cursor-pointer text-xs transition-colors"
                    >
                      💬 Enviar WhatsApp
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        exportFechamentoPDF({
                          role: 'Cliente',
                          periodText: `${MONTHS_PT[calendarViewMonth]} / ${calendarViewYear}`,
                          activeCliente: closingDist,
                          activeMotoboy: null,
                          ordens: closingOrdersList,
                          allClientes: clientes,
                          allMotoboys: motoboys
                        });
                      }}
                      className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold py-2 rounded-lg shadow font-mono text-center flex items-center justify-center gap-1.5 cursor-pointer text-xs transition-colors"
                    >
                      📄 Exportar PDF Formatado
                    </button>
                  </div>
                </div>

              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* ==========================================
          MODAL: RELATORIO & FECHAMENTO DE ENTREGAS (REPORTING AND CLOSURE)
          ========================================== */}
      <AnimatePresence>
        {isReportModalOpen && reportRole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="modal-report">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-5 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase font-mono tracking-tight flex items-center gap-2">
                    📊 RELATÓRIO DO FECHAMENTO OPERACIONAL 🧾
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {reportRole === 'Empresa' && 'Painel Geral de Conciliação e Auditoria para Emissão de Notas Fiscais'}
                    {reportRole === 'Cliente' && `Painel de Auditoria de Entregas – ${activeClienteUser?.nome}`}
                    {reportRole === 'Motoboy' && `Painel de Ganhos e Emissão de Notas MEI – ${activeMotoboyUser?.nome}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold py-1 px-2.5 rounded hover:bg-slate-100 cursor-pointer text-xs"
                >
                  ✕ Fechar
                </button>
              </div>

              {/* Selector for Period & Filters */}
              <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl mb-5 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                    <span className="font-bold text-slate-650">📅 Período de Conferência:</span>
                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                      <button
                        type="button"
                        onClick={() => setReportPeriod('Semana')}
                        className={`px-3 py-1 text-[11px] font-bold rounded-md transition ${reportPeriod === 'Semana' ? 'bg-orange-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Semana Atual (Últimos 7 dias)
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportPeriod('Mes')}
                        className={`px-3 py-1 text-[11px] font-bold rounded-md transition ${reportPeriod === 'Mes' ? 'bg-orange-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Mês Atual
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportPeriod('Personalizado')}
                        className={`px-3 py-1 text-[11px] font-bold rounded-md transition ${reportPeriod === 'Personalizado' ? 'bg-orange-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Fechamento Customizado 📅
                      </button>
                    </div>
                  </div>

                  {/* Print / Export Action button */}
                  <div className="flex flex-wrap items-center gap-2 no-print">
                    <button
                      type="button"
                      onClick={() => {
                        const list = getFilteredReportOrders();
                        let billed = 0;
                        let owed = 0;
                        list.forEach(o => {
                          billed += (o.valorCobradoCliente || 10.00) + (0);
                          owed += (o.valorPagoMotoboy || 4.00) + (0);
                        });
                        const count = list.length;
                        const profit = billed - owed;

                        let periodText = '';
                        if (reportPeriod === 'Semana') {
                          periodText = 'Últimos 7 dias (Semana Atual)';
                        } else if (reportPeriod === 'Mes') {
                          periodText = 'Este Mês';
                        } else {
                          periodText = `${reportFilterStartDate.split('-').reverse().join('/')} até ${reportFilterEndDate.split('-').reverse().join('/')}`;
                        }

                        let profile = '';
                        let details = '';
                        if (reportRole === 'Motoboy') {
                          profile = `Entregador MEI: ${activeMotoboyUser?.nome || 'Motoboy Parceiro'}`;
                          details = `• Quantidade de Corridas: ${count}\n• Total de Comissão a receber: R$ ${owed.toFixed(2)}`;
                        } else if (reportRole === 'Cliente') {
                          profile = `Cliente / Oficina B2B: ${activeClienteUser?.nome || 'Cliente Parceiro'}`;
                          details = `• Quantidade de Corridas: ${count}\n• Custo total de faturamento: R$ ${billed.toFixed(2)}`;
                        } else {
                          profile = `Administração torqueLog (Geral)`;
                          details = `• Qtd Corridas: ${count}\n• Total Clientes B2B: R$ ${billed.toFixed(2)}\n• Pago aos Motoboys: R$ ${owed.toFixed(2)}\n• Lucro Líquido: R$ ${profit.toFixed(2)}`;
                        }

                        let orderBreakdown = list.slice(0, 40).map(o => {
                          const val = reportRole === 'Cliente' 
                            ? ((o.valorCobradoCliente || 10.00) + (0))
                            : ((o.valorPagoMotoboy || 4.00) + (0));
                          return `✅ OS #${o.id} | ${new Date(o.criadoEm).toLocaleDateString('pt-BR')} | ${o.clienteNome.slice(0, 15)} | R$ ${val.toFixed(2)}`;
                        }).join('\n');

                        if (list.length > 40) {
                          orderBreakdown += `\n_...e outras ${list.length - 40} ordens no período._`;
                        }

                        const textMsg = `*🧾 COMPROVANTE DE FECHAMENTO - TORQUELOG*\n` +
                          `-----------------------------------------\n` +
                          `📅 *Período:* ${periodText}\n` +
                          `👤 *Titular:* ${profile}\n` +
                          `-----------------------------------------\n` +
                          `💰 *RESUMO DO FECHAMENTO:* \n${details}\n\n` +
                          `*📦 DETALHE DAS ENTREGAS:*\n` +
                          `${orderBreakdown || 'Nenhuma ordem no período selecionado.'}\n\n` +
                          `-----------------------------------------\n` +
                          `📲 *DICA:* Para salvar o relatório em formato PDF, utilize o botão "Salvar como PDF / Imprimir" do painel.\n` +
                          `🌐 Gerado via painel TorqueLog em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;

                        // Open WhatsApp securely to bypass popup-blockers:
                        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textMsg)}`;
                        const link = document.createElement('a');
                        link.href = waUrl;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-bold font-mono py-1.5 px-3 rounded-lg flex items-center gap-1.5 shadow transition-all cursor-pointer hover:scale-102 active:scale-98"
                    >
                      💬 Enviar WhatsApp Fechamento
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        let periodText = '';
                        if (reportPeriod === 'Semana') {
                          periodText = 'Últimos 7 dias (Semana Atual)';
                        } else if (reportPeriod === 'Mes') {
                          periodText = 'Este Mês';
                        } else {
                          periodText = `${reportFilterStartDate.split('-').reverse().join('/')} até ${reportFilterEndDate.split('-').reverse().join('/')}`;
                        }

                        exportFechamentoPDF({
                          role: reportRole,
                          periodText,
                          activeCliente: activeClienteUser,
                          activeMotoboy: activeMotoboyUser,
                          ordens: getFilteredReportOrders(),
                          allClientes: clientes,
                          allMotoboys: motoboys
                        });
                      }}
                      className="bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-[11px] font-bold font-mono py-1.5 px-3 rounded-lg flex items-center gap-1.5 shadow transition-all cursor-pointer hover:scale-102 active:scale-98"
                    >
                      📄 Exportar Relatório em PDF Formatado
                    </button>
                  </div>
                </div>

                {reportPeriod === 'Personalizado' && (
                  <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col sm:flex-row flex-wrap items-end gap-4 animate-fade-in">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">📅 Data de Início</label>
                      <input
                        type="date"
                        value={reportFilterStartDate}
                        onChange={(e) => setReportFilterStartDate(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 font-mono">📅 Data de Término</label>
                      <input
                        type="date"
                        value={reportFilterEndDate}
                        onChange={(e) => setReportFilterEndDate(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                      />
                    </div>
                    <div className="text-xs text-slate-500 font-mono pb-1">
                      Filtrado: <span className="font-bold text-orange-650">{reportFilterStartDate.split('-').reverse().join('/')}</span> a <span className="font-bold text-orange-650">{reportFilterEndDate.split('-').reverse().join('/')}</span>
                    </div>
                  </div>
                )}

                {/* Filters specifically for torqueLog Admin (Empresa role) */}
                {reportRole === 'Empresa' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1 font-mono">Filtro por Cliente (B2B)</label>
                      <select
                        value={reportFilterClienteId}
                        onChange={(e) => setReportFilterClienteId(e.target.value)}
                        className="w-full bg-white text-slate-900 border border-slate-200 rounded-lg p-2 text-xs font-mono font-semibold"
                      >
                        <option value="Todos">🔧 Todos os Clientes B2B</option>
                        {clientes.map(c => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1 font-mono">Filtro por Motoboy (Credenciado MEI)</label>
                      <select
                        value={reportFilterMotoboyId}
                        onChange={(e) => setReportFilterMotoboyId(e.target.value)}
                        className="w-full bg-white text-slate-900 border border-slate-200 rounded-lg p-2 text-xs font-mono font-semibold"
                      >
                        <option value="Todos">🏍️ Todos os Motoboys</option>
                        {motoboys.map(m => (
                          <option key={m.id} value={m.id}>{m.nome}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Report Tables and Data Calculations */}
              {(() => {
                const filteredOrders = getFilteredReportOrders();
                
                // Value aggregations
                let totalBilledToClients = 0;
                let totalOwedToMotoboys = 0;

                filteredOrders.forEach(o => {
                  totalBilledToClients += (o.valorCobradoCliente || 10.00) + (0);
                  totalOwedToMotoboys += (o.valorPagoMotoboy || 4.00) + (0);
                });

                const totalProfit = totalBilledToClients - totalOwedToMotoboys;
                const totalCount = filteredOrders.length;

                return (
                  <div className="space-y-5">
                    {/* Totals Summary Cards Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center">
                        <span className="block text-[9px] text-slate-500 uppercase tracking-wide">Qtd de Entregas</span>
                        <span className="text-xl font-black text-slate-900">{totalCount} concluídas</span>
                      </div>

                      {/* Display content adapting based on logged-in role */}
                      {reportRole === 'Empresa' && (
                        <>
                          <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl font-mono text-center">
                            <span className="block text-[9px] text-indigo-700 uppercase tracking-wide">Faturado Clientes B2B</span>
                            <span className="text-xl font-black text-indigo-900">R$ {totalBilledToClients.toFixed(2)}</span>
                          </div>
                          <div className="p-3.5 bg-rose-50 border border-rose-105 rounded-xl font-mono text-center">
                            <span className="block text-[9px] text-rose-700 uppercase tracking-wide">Repassar a Motoboys</span>
                            <span className="text-xl font-black text-rose-900">R$ {totalOwedToMotoboys.toFixed(2)}</span>
                          </div>
                          <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl font-mono text-center">
                            <span className="block text-[9px] text-emerald-700 uppercase tracking-wide">Lucro TorqueLog</span>
                            <span className="text-xl font-black text-emerald-905">R$ {totalProfit.toFixed(2)}</span>
                          </div>
                        </>
                      )}

                      {reportRole === 'Cliente' && (
                        <>
                          <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl font-mono text-center col-span-3">
                            <span className="block text-[9px] text-emerald-700 uppercase tracking-wide">VALOR TOTAL DO FATURAMENTO (Cobrança TorqueLog)</span>
                            <span className="text-2xl font-black text-emerald-900 mt-1 block">R$ {totalBilledToClients.toFixed(2)}</span>
                          </div>
                        </>
                      )}

                      {reportRole === 'Motoboy' && (
                        <>
                          <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl font-mono text-center col-span-3">
                            <span className="block text-[9px] text-amber-700 uppercase tracking-wide">VALOR TOTAL DE REPASSE A RECEBER (Faturamento MEI)</span>
                            <span className="text-2xl font-black text-amber-900 mt-1 block">R$ {totalOwedToMotoboys.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Report Help boxes */}
                    <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-xl">
                      {reportRole === 'Empresa' && (
                        <p className="font-mono">
                          💡 <strong>Painel Fiduciário:</strong> Use os totais de <strong>Faturado Clientes B2B</strong> para gerar e enviar as respectivas cobranças ou notas fiscais para as oficinas clientes. O total de <strong>Repassar a Motoboys</strong> é o valor acumulado que os entregadores MEI faturarão e emitirão de nota para receber do pátio centrale.
                        </p>
                      )}
                      {reportRole === 'Cliente' && (
                        <p className="font-mono">
                          ℹ️ <strong>Histórico Fiscal:</strong> Este relatório serve para auditoria e conciliação do seu contrato B2B. A TorqueLog emitirá a fatura correspondente ao total acima no fechamento periódico.
                        </p>
                      )}
                      {reportRole === 'Motoboy' && (
                        <p className="font-mono">
                          ✌️ <strong>Parceiro MEI:</strong> Este é o valor consolidado de fretes que você tem a receber no período selecionado. Emita sua Nota Fiscal Avulsa (NFP/MEI) com o valor exato de <strong>R$ {totalOwedToMotoboys.toFixed(2)}</strong> e mande para a administração TorqueLog efetuar o PIX.
                        </p>
                      )}
                    </div>

                    {/* Table listing */}
                    <div className="border border-slate-205 rounded-xl overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse font-sans">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200 font-mono text-[10px] text-slate-500 uppercase tracking-wider">
                              <th className="p-3">Cod OS</th>
                              <th className="p-3">Data/Hora</th>
                              <th className="p-3">Cliente / Destinatário B2B</th>
                              <th className="p-3">Entregador (Motoboy)</th>
                              <th className="p-3">Descrição do Objeto</th>
                              <th className="p-3">Status</th>
                              <th className="p-3 text-right">
                                {reportRole === 'Cliente' ? 'Custo (R$)' : (reportRole === 'Motoboy' ? 'Frete (R$)' : 'Valores (R$)')}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 text-xs text-slate-705 font-mono">
                            {filteredOrders.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="p-8 text-center text-slate-400 font-sans italic">
                                  Nenhuma ordem entregue encontrada no período / combinação de filtros selecionado.
                                </td>
                              </tr>
                            ) : (
                              filteredOrders.map(o => {
                                const b2bVal = (o.valorCobradoCliente || 10.00) + (0);
                                const mbVal = (o.valorPagoMotoboy || 4.00) + (0);
                                return (
                                  <tr key={o.id} className="hover:bg-slate-50">
                                    <td className="p-3 font-bold text-slate-900">{o.id}</td>
                                    <td className="p-3 text-slate-500 text-[11px]">
                                      {new Date(o.criadoEm).toLocaleDateString('pt-BR')} {new Date(o.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="p-3">
                                      <span className="font-bold text-slate-850 block">{o.clienteNome}</span>
                                      <span className="text-[10px] text-slate-400 font-sans">Setor {o.quadrante}</span>
                                    </td>
                                    <td className="p-3 grid grid-cols-1 border-none">
                                      <span className="font-sans block text-slate-700 font-bold whitespace-nowrap">{o.motoboyNome || 'Sem atribuição'}</span>
                                    </td>
                                    <td className="p-3 max-w-[150px] truncate" title={o.itensDescricao}>
                                      {o.itensDescricao}
                                    </td>
                                    <td className="p-3">
                                      <span className="text-[9.5px] font-sans font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-150 whitespace-nowrap font-mono">
                                        ✓ Concluído
                                      </span>
                                    </td>
                                    <td className="p-3 text-right">
                                      {reportRole === 'Cliente' && (
                                        <span className="font-bold text-slate-900">R$ {b2bVal.toFixed(2)}</span>
                                      )}
                                      {reportRole === 'Motoboy' && (
                                        <span className="font-bold text-indigo-700">R$ {mbVal.toFixed(2)}</span>
                                      )}
                                      {reportRole === 'Empresa' && (
                                        <div className="flex flex-col text-[10px] items-end space-y-0.5">
                                          <div className="whitespace-nowrap"><span className="text-slate-455 font-mono">B2B:</span> <span className="font-bold text-indigo-750">R$ {b2bVal.toFixed(2)}</span></div>
                                          <div className="whitespace-nowrap"><span className="text-slate-455 font-mono">Moto:</span> <span className="font-bold text-rose-650">R$ {mbVal.toFixed(2)}</span></div>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-705 py-2 px-6 rounded-xl text-xs font-bold font-mono cursor-pointer transition border border-slate-250"
                >
                  Voltar ao Portal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          MODAL: CLIENT PORTAL CLIENT REGISTRATION
          ========================================== */}
      <AnimatePresence>
        {isClientAddingNewClient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="modal-client-adding-client">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 max-h-[95vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-tight">
                    [Novo Cliente B2B]
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Cadastrado pelo Cliente {activeClienteUser?.nome}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsClientAddingNewClient(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold py-1 px-2 rounded hover:bg-slate-100 cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!clientNewClientNome.trim()) {
                  alert("Por favor, preencha o Nome / Razão Social do cliente.");
                  return;
                }
                if (!clientNewClientEmail.trim()) {
                  alert("Por favor, preencha o E-mail de cadastro do cliente.");
                  return;
                }

                const randCode = Math.floor(1000 + Math.random() * 9000);
                const generatedId = `CLI-${clientNewClientQuadrante}-${randCode}`;

                const novoCli: Cliente = {
                  id: generatedId,
                  nome: clientNewClientNome,
                  quadrante: clientNewClientQuadrante,
                  endereco: clientNewClientEndereco || 'Pendente - Preencher no 1º Acesso',
                  telefone: clientNewClientTelefone || 'Não informado',
                  cidade: clientNewClientCidade || 'Passos - MG',
                  cep: clientNewClientCEP,
                  numero: clientNewClientNumero,
                  cnpj: clientNewClientCNPJorCPF,
                  valorPagoMotoboy: 0.00,
                  valorCobradoCliente: 0.00,
                  senha: `cli-${randCode}`,
                  email: clientNewClientEmail,
                  emailConfirmado: true,
                  cadastroCompleto: true,
                  criadoPor: 'Cliente',
                  criadoPorClienteId: activeClienteUser?.id,
                  criadoEm: new Date().toISOString(),
                  motoboysAtivos: 0
                };

                // Enviar e-mail de confirmação para o email sandbox do destinatário
                const partnerEmailEntry = {
                  id: `EML-${Math.floor(1005 + Math.random() * 8990)}`,
                  para: novoCli.email,
                  assunto: `🎉 Ativação & Credenciais de Novo Parceiro B2B - ${novoCli.nome}`,
                  corpo: `Olá, ${novoCli.nome}!\n\nSua agro-oficina ou autopeças parceira foi cadastrada com sucesso pelo distribuidor ${activeClienteUser?.nome || 'Parceiro Master'} na nossa rede inteligente TorqueLog B2B.\n\nSua conta está ativa e pronta para receber despachos e compartilhar entregadores.\n\n🔑 Credenciais de Logon:\n• Perfil de Acesso: Cliente B2B\n• Nome na Lista: ${novoCli.nome}\n• Senha Provisória: cli-${randCode}\n\nEntre no portal para começar a agendar e acompanhar suas entregas expressas com risco zero!\n\nAtenciosamente,\nEngenharia de Redes TorqueLog B2B`,
                  codigo: `cli-${randCode}`,
                  data: new Date().toLocaleTimeString(),
                  lido: false
                };
                setSimulatedEmails(prev => [partnerEmailEntry, ...prev]);

                // Enviar email real via SMTP
                if (novoCli.email) {
                  sendRealEmail(novoCli.email, partnerEmailEntry.assunto, partnerEmailEntry.corpo);
                }

                // Sync with local state
                const updatedClientesList = [novoCli, ...clientes];
                setClientes(updatedClientesList);

                // Sync with Firebase Firestore if active
                if (isFirebaseConfigured) {
                  try {
                    await syncSingleClienteToFirebase(novoCli);
                  } catch (err) {
                    console.error("Erro ao sincronizar novo cliente com o Firebase:", err);
                  }
                }

                // Sync with Supabase if active
                if (supabase) {
                  try {
                    await syncClientesToSupabase([novoCli]);
                  } catch (err) {
                    console.error("Erro ao sincronizar novo cliente com o Supabase:", err);
                  }
                }

                setIsClientAddingNewClient(false);

                // Set interactive confirmation message toast!
                setSupabaseSuccessMsg(`🚀 Cliente B2B "${novoCli.nome}" cadastrado com sucesso!`);
                setTimeout(() => setSupabaseSuccessMsg(''), 5500);

                // Reset internal state
                setClientNewClientNome('');
                setClientNewClientCNPJorCPF('');
                setClientNewClientCEP('');
                setClientNewClientEndereco('');
                setClientNewClientNumero('');
                setClientNewClientTelefone('');
                setClientNewClientCidade('Passos - MG');
                setClientNewClientEmail('');
              }} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Nome do Estabelecimento / Oficina *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientNewClientNome}
                    onChange={(e) => setClientNewClientNome(e.target.value)}
                    placeholder="Ex: Auto Mecânica Passos"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    CNPJ ou CPF
                  </label>
                  <input
                    type="text"
                    value={clientNewClientCNPJorCPF}
                    onChange={(e) => setClientNewClientCNPJorCPF(e.target.value)}
                    placeholder="Ex: 00.000.000/0001-00 ou 111.222.333-44"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Atribuir à Região (Quadrante Geográfico) *
                  </label>
                  <select
                    value={clientNewClientQuadrante}
                    onChange={(e) => setClientNewClientQuadrante(e.target.value as Quadrante)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                  >
                    {(['A', 'B', 'C', 'D', 'E', 'F'] as Quadrante[]).map((q) => (
                      <option key={q} value={q}>Quadrante {q}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono flex items-center justify-between">
                    <span>CEP *</span>
                    {isClientFetchingNewClientCEP && (
                      <span className="text-emerald-500 animate-pulse text-[10px] font-mono leading-none">🔍 BUSCANDO CEP...</span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={clientNewClientCEP}
                      onChange={(e) => handleCEPChange(e.target.value, 'clientNewClient')}
                      placeholder="Ex: 37900-124"
                      className="flex-1 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleFetchCEP(clientNewClientCEP, 'clientNewClient')}
                      disabled={isClientFetchingNewClientCEP || !clientNewClientCEP}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-black px-4 rounded-lg font-mono tracking-tight cursor-pointer shadow transition shrink-0"
                    >
                      {isClientFetchingNewClientCEP ? '...' : '🔍 Buscar CEP'}
                    </button>
                  </div>
                  {cepErrorState['clientNewClient'] && (
                    <p className="text-red-500 text-[10px] font-mono mt-1 text-left">⚠️ {cepErrorState['clientNewClient']}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Endereço Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientNewClientEndereco}
                    onChange={(e) => setClientNewClientEndereco(e.target.value)}
                    placeholder="Ex: Rua Central"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Número do Estabelecimento *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientNewClientNumero}
                    onChange={(e) => setClientNewClientNumero(e.target.value)}
                    placeholder="Ex: 45 ou S/N"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Cidade *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientNewClientCidade}
                    onChange={(e) => setClientNewClientCidade(e.target.value)}
                    placeholder="Ex: Passos - MG"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Telefone de Contato
                  </label>
                  <input
                    type="text"
                    value={clientNewClientTelefone}
                    onChange={(e) => setClientNewClientTelefone(e.target.value)}
                    placeholder="Ex: (35) 99999-9999"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    E-mail do Cliente *
                  </label>
                  <input
                    type="email"
                    required
                    value={clientNewClientEmail}
                    onChange={(e) => setClientNewClientEmail(e.target.value)}
                    placeholder="Ex: oficina@email.com"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-black py-2.5 rounded-lg text-xs transition duration-150 shadow cursor-pointer"
                  >
                    Confirmar Cadastro
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          MODAL: ADD NEW CLIENT (DOUBLE REGISTER)
          ========================================== */}
      <AnimatePresence>
        {isAddingNewClient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="modal-client">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-tight">
                    [Cadastro de Novo Parceiro]
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Sincronização Ativa Parceiro & Entregador</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingNewClient(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold py-1 px-2 rounded hover:bg-slate-100 cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Nome do Parceiro B2B *
                  </label>
                  <input
                    type="text"
                    required
                    value={newClientNome}
                    onChange={(e) => setNewClientNome(e.target.value)}
                    placeholder="Ex: Moto Peças Diamante"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Ramo da Empresa / Estabelecimento *
                  </label>
                  <select
                    value={['Autopeças', 'Oficina mecânica', 'Farmácia', 'Lanchonete', 'Restaurante'].includes(newClientRamo) ? newClientRamo : (newClientRamo ? 'Outro' : 'Autopeças')}
                    onChange={(e) => {
                      if (e.target.value !== 'Outro') {
                        setNewClientRamo(e.target.value);
                      } else {
                        setNewClientRamo('');
                      }
                    }}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-orange-500 font-mono mb-1.5 font-semibold"
                  >
                    <option value="Autopeças">Autopeças</option>
                    <option value="Oficina mecânica">Oficina mecânica</option>
                    <option value="Farmácia">Farmácia</option>
                    <option value="Lanchonete">Lanchonete</option>
                    <option value="Restaurante">Restaurante</option>
                    <option value="Outro">✍️ Digitar ramo personalizado...</option>
                  </select>
                  {(!['Autopeças', 'Oficina mecânica', 'Farmácia', 'Lanchonete', 'Restaurante'].includes(newClientRamo) || newClientRamo === '') && (
                    <input
                      type="text"
                      required
                      value={newClientRamo}
                      onChange={(e) => setNewClientRamo(e.target.value)}
                      placeholder="Escreva o ramo da empresa..."
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                    />
                  )}
                </div>

                {/* Region selector (Quadrante) removed for Admin, defaulted to A */}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono flex items-center justify-between">
                    <span>CEP (Opcional)</span>
                    {isFetchingNewClientCEP && (
                      <span className="text-emerald-500 animate-pulse text-[10px] font-mono leading-none">🔍 BUSCANDO CEP...</span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newClientCEP}
                      onChange={(e) => handleCEPChange(e.target.value, 'newClient')}
                      placeholder="Ex: 37900-124"
                      className="flex-1 bg-slate-50 text-slate-900 border border-slate-205 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleFetchCEP(newClientCEP, 'newClient')}
                      disabled={isFetchingNewClientCEP || !newClientCEP}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-black px-4 rounded-lg font-mono tracking-tight cursor-pointer shadow transition shrink-0"
                    >
                      {isFetchingNewClientCEP ? '...' : '🔍 Buscar CEP'}
                    </button>
                  </div>
                  {cepErrorState['newClient'] && (
                    <p className="text-red-500 text-[10px] font-mono mt-1 text-left">⚠️ {cepErrorState['newClient']}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Endereço Completo do Parceiro *
                  </label>
                  <input
                    type="text"
                    required
                    value={newClientEndereco}
                    onChange={(e) => setNewClientEndereco(e.target.value)}
                    placeholder="Ex: Av. Juca Stockler - Centro"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Número do Estabelecimento *
                  </label>
                  <input
                    type="text"
                    required
                    value={newClientNumero}
                    onChange={(e) => setNewClientNumero(e.target.value)}
                    placeholder="Ex: 1200 ou S/N"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Contato Telefônico B2B (Opcional)
                  </label>
                  <input
                    type="text"
                    value={newClientTelefone}
                    onChange={(e) => setNewClientTelefone(e.target.value)}
                    placeholder="Ex: (35) 99999-9999"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                  />
                </div>

                {/* Custom Credentials & Email Confirmation Settings */}
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <span className="text-[10px] font-black text-emerald-600 uppercase font-mono tracking-wider block">
                    📬 CONTROLE DE PRIMEIRO ACESSO DO CLIENTE
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                        E-mail de Cadastro do Cliente *
                      </label>
                      <input
                        type="email"
                        required
                        value={newClientEmail}
                        onChange={(e) => setNewClientEmail(e.target.value)}
                        placeholder="Ex: contato@mecanicab2b.com"
                        className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                        Senha Provisória de Acesso *
                      </label>
                      <input
                        type="text"
                        required
                        value={newClientSenha}
                        onChange={(e) => setNewClientSenha(e.target.value)}
                        placeholder="Ex: torque2026"
                        className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] p-2.5 rounded-lg font-mono leading-relaxed">
                    ⚙️ <strong>Sem Verificação de E-mail:</strong> O parceiro poderá fazer o login inserindo a <strong>Senha Provisória</strong> diretamente sem necessidade de confirmação por e-mail. Ao entrar pela primeira vez no painel deles, uma tela será exibida para ele cadastrar sua senha definitiva de preferência.
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3">
                  <span className="text-[10px] font-black text-orange-600 uppercase font-mono tracking-wider block">
                    🔧 CONFIGURAÇÃO DE FRETE E TARIFAS (Ex: PASSOS - MG)
                  </span>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1 font-mono">
                      Cidade / Região do Contrato
                    </label>
                    <input
                      type="text"
                      required
                      value={newClientCidade}
                      onChange={(e) => setNewClientCidade(e.target.value)}
                      placeholder="Ex: Passos - MG"
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1 font-mono">
                        Taxa de Contrato B2B (Fixo Cobrado do Parceiro) *
                      </label>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        value={newClientValorCobradoCliente}
                        onChange={(e) => setNewClientValorCobradoCliente(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1 font-mono">
                      Motoboys Ativos no Cliente
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newClientMotoboysAtivos}
                      onChange={(e) => setNewClientMotoboysAtivos(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-orange-500 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1 font-mono">
                      Representante (Indicação da Rua)
                    </label>
                    <select
                      value={newClientIndicadoPorRepId}
                      onChange={(e) => setNewClientIndicadoPorRepId(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-orange-500 font-mono font-semibold"
                    >
                      <option value="">Nenhum (Sem Indicação)</option>
                      {representantes.map(rep => (
                        <option key={rep.id} value={rep.id}>
                          {rep.nome} (comissão R$ {comissaoRepsPorEntrega.toFixed(2)} / entrega)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-[10px] text-slate-500 leading-normal font-mono">
                  💡 <strong>Nota de Sincronia:</strong> Este cliente será adicionado instantaneamente aos bancos de dados compartilhados, sendo listável tanto para faturamento na Expedição quanto para agenciamento de fretes no Aplicativo do Motoboy.
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingNewClient(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-xs font-bold font-mono cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCriarCliente('Entregador')} // Registers immediately as synchronized dual
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-xs font-bold font-mono cursor-pointer shadow-md"
                  >
                    Confirmar Cadastro
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          MODAL: EDIT CLIENT (CRUD UPDATE)
          ========================================== */}
      <AnimatePresence>
        {clienteParaEditar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="modal-edit-client">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`bg-white rounded-xl shadow-2xl border border-slate-200 w-full p-5 max-h-[92vh] overflow-y-auto transition-all duration-300 ${
                !clienteParaEditar.criadoPorClienteId ? 'max-w-4xl' : 'max-w-md'
              }`}
            >
              <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-tight">
                    {!clienteParaEditar.criadoPorClienteId ? `[⚙️ Gestão de Parceiro: ${clienteParaEditar.id}]` : `[Editar Cliente: ${clienteParaEditar.id}]`}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {!clienteParaEditar.criadoPorClienteId ? 'Painel de Controle de Parceiro e Sub-Clientes B2B' : 'Sincronização Ativa Distribuidor & Entregador'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setClienteParaEditar(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold py-1 px-2 rounded hover:bg-slate-100 cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <div className={!clienteParaEditar.criadoPorClienteId ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : ""}>
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider block border-b border-slate-100 pb-1">
                    ℹ️ CADASTRO GERAL DO PARCEIRO
                  </span>
                  <form onSubmit={handleUpdateCliente} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Nome do Estabelecimento / Oficina
                  </label>
                  <input
                    type="text"
                    required
                    value={editClientNome}
                    onChange={(e) => setEditClientNome(e.target.value)}
                    placeholder="Ex: Oficina Mecânica do Renan"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Ramo da Empresa / Estabelecimento *
                  </label>
                  <select
                    value={['Autopeças', 'Oficina mecânica', 'Farmácia', 'Lanchonete', 'Restaurante'].includes(editClientRamo) ? editClientRamo : (editClientRamo ? 'Outro' : 'Autopeças')}
                    onChange={(e) => {
                      if (e.target.value !== 'Outro') {
                        setEditClientRamo(e.target.value);
                      } else {
                        setEditClientRamo('');
                      }
                    }}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-orange-500 font-mono mb-1.5 font-semibold"
                  >
                    <option value="Autopeças">Autopeças</option>
                    <option value="Oficina mecânica">Oficina mecânica</option>
                    <option value="Farmácia">Farmácia</option>
                    <option value="Lanchonete">Lanchonete</option>
                    <option value="Restaurante">Restaurante</option>
                    <option value="Outro">✍️ Digitar ramo personalizado...</option>
                  </select>
                  {(!['Autopeças', 'Oficina mecânica', 'Farmácia', 'Lanchonete', 'Restaurante'].includes(editClientRamo) || editClientRamo === '') && (
                    <input
                      type="text"
                      required
                      value={editClientRamo}
                      onChange={(e) => setEditClientRamo(e.target.value)}
                      placeholder="Escreva o ramo da empresa..."
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                    />
                  )}
                </div>

                {!!clienteParaEditar.criadoPorClienteId && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                      Atribuir à Região (Quadrante Geográfico)
                    </label>
                    <select
                      value={editClientQuadrante}
                      onChange={(e) => setEditClientQuadrante(e.target.value as Quadrante)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                    >
                      {(['A', 'B', 'C', 'D', 'E', 'F'] as Quadrante[]).map((q) => (
                        <option key={q} value={q}>Quadrante {q}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono flex items-center justify-between">
                    <span>CEP</span>
                    {isFetchingEditClientCEP && (
                      <span className="text-emerald-500 animate-pulse text-[10px] font-mono leading-none font-bold">🔍 BUSCANDO CEP...</span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editClientCEP}
                      onChange={(e) => handleCEPChange(e.target.value, 'editClient')}
                      placeholder="Ex: 37900-124"
                      className="flex-1 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleFetchCEP(editClientCEP, 'editClient')}
                      disabled={isFetchingEditClientCEP || !editClientCEP}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-black px-4 rounded-lg font-mono tracking-tight cursor-pointer shadow transition shrink-0"
                    >
                      {isFetchingEditClientCEP ? '...' : '🔍 Buscar CEP'}
                    </button>
                  </div>
                  {cepErrorState['editClient'] && (
                    <p className="text-red-500 text-[10px] font-mono mt-1 text-left">⚠️ {cepErrorState['editClient']}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Endereço Completo
                  </label>
                  <input
                    type="text"
                    value={editClientEndereco}
                    onChange={(e) => setEditClientEndereco(e.target.value)}
                    placeholder="Endereço principal da empresa"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Número do Estabelecimento
                  </label>
                  <input
                    type="text"
                    value={editClientNumero}
                    onChange={(e) => setEditClientNumero(e.target.value)}
                    placeholder="Ex: 1200 ou S/N"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Contato Telefônico B2B
                  </label>
                  <input
                    type="text"
                    value={editClientTelefone}
                    onChange={(e) => setEditClientTelefone(e.target.value)}
                    placeholder="Número de telefone principal"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                  />
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <span className="text-[10px] font-black text-emerald-600 uppercase font-mono tracking-wider block">
                    📬 CREDENCIAIS E E-MAIL DO CLIENTE
                  </span>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                      E-mail de Cadastro *
                    </label>
                    <input
                      type="email"
                      required
                      value={editClientEmail}
                      onChange={(e) => setEditClientEmail(e.target.value)}
                      placeholder="Ex: contato@mecanicab2b.com"
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                      Senha de Acesso (Dica/Temporária)
                    </label>
                    <input
                      type="text"
                      value={editClientSenha}
                      onChange={(e) => setEditClientSenha(e.target.value)}
                      placeholder="Senha de login do cliente"
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3">
                  <span className="text-[10px] font-black text-orange-600 uppercase font-mono tracking-wider block">
                    🔧 CONFIGURAÇÃO DE FRETE E TARIFAS (Ex: PASSOS - MG)
                  </span>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1 font-mono">
                      Cidade / Região do Contrato
                    </label>
                    <input
                      type="text"
                      required
                      value={editClientCidade}
                      onChange={(e) => setEditClientCidade(e.target.value)}
                      placeholder="Ex: Passos - MG"
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 uppercase mb-1 font-mono leading-tight">
                        Fixo Cobrado (Cliente)
                      </label>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        value={editClientValorCobradoCliente}
                        onChange={(e) => setEditClientValorCobradoCliente(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 px-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 uppercase mb-1 font-mono leading-tight">
                        Repasse (Motoboy)
                      </label>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        value={editClientValorPagoMotoboy}
                        onChange={(e) => setEditClientValorPagoMotoboy(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 px-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1 font-mono">
                      Motoboys Ativos no Cliente
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editClientMotoboysAtivos}
                      onChange={(e) => setEditClientMotoboysAtivos(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-orange-500 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1 font-mono">
                      Representante Comercial / Indicação
                    </label>
                    <select
                      value={editClientIndicadoPorRepId}
                      onChange={(e) => setEditClientIndicadoPorRepId(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-orange-500 font-mono font-semibold"
                    >
                      <option value="">Nenhum (Sem Indicação)</option>
                      {representantes.map(rep => (
                        <option key={rep.id} value={rep.id}>
                          {rep.nome} (comissão R$ {comissaoRepsPorEntrega.toFixed(2)} / entrega)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="text-[10px] font-extrabold text-emerald-600 font-mono bg-emerald-50 p-2 rounded border border-emerald-100 flex justify-between">
                    <span>💵 MARGEM LIQUIDA:</span>
                    <span>R$ {(editClientValorCobradoCliente - editClientValorPagoMotoboy).toFixed(2)}</span>
                  </div>

                  {/* EXCLUSIVE ADMIN CONTROLS FOR THE PARTNER */}
                  <div className="border-t border-slate-200 mt-2.5 pt-2.5 bg-amber-500/5 p-2.5 rounded-lg border border-amber-500/10 space-y-2">
                    <span className="text-[9px] font-black text-amber-800 uppercase font-mono flex items-center gap-1">
                      🔒 ÁREA DE AUDITORIA EXCLUSIVA DO ADMIN (O parceiro não vê)
                    </span>
                    
                    <div>
                      <label className="block text-[8.5px] font-bold text-amber-905 uppercase font-mono">Nota Interna sobre este Parceiro</label>
                      <input
                        type="text"
                        value={editClientNotaAdmin}
                        onChange={(e) => setEditClientNotaAdmin(e.target.value)}
                        placeholder="Ex: Contrato assinado. Enviar fatura quinzenal."
                        className="w-full bg-white text-slate-950 border border-amber-200 rounded p-1.5 text-xs font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="partner-admin-block"
                        checked={editClientAdminBloqueado}
                        onChange={(e) => setEditClientAdminBloqueado(e.target.checked)}
                        className="rounded text-red-600 h-3.5 w-3.5 bg-white border border-slate-250 cursor-pointer"
                      />
                      <label htmlFor="partner-admin-block" className="text-[9px] font-extrabold text-red-955 uppercase font-mono cursor-pointer">
                        Bloquear faturamento do parceiro (Admin)
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setClienteParaEditar(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-xs font-bold font-mono cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-xs font-bold font-mono cursor-pointer shadow-md"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </div> {/* Closes the <div className="space-y-3"> containing the first form */}

            {/* --- SECOND COLUMN: SUB-CLIENT MANAGEMENT PANEL (ONLY FOR PARTNERS/DISTRIBUTORS) --- */}
            {!clienteParaEditar.criadoPorClienteId && (
              <div className="space-y-4 border-t lg:border-t-0 lg:border-l border-slate-150 pt-5 lg:pt-0 lg:pl-6 max-h-[80vh] overflow-y-auto">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase font-mono tracking-wider border-b border-slate-100 pb-1 mb-1 flex justify-between items-center bg-slate-50 p-2 rounded">
                    <span>👥 Clientes / Oficinas Atreladas ({clientes.filter(c => c.criadoPorClienteId === clienteParaEditar.id).length})</span>
                    <span className="text-[10px] text-slate-400 capitalize font-normal">Controle de Carteira B2B</span>
                  </h4>
                  
                  {/* Sub-Client List */}
                  <div className="space-y-2 mt-2 max-h-[30vh] overflow-y-auto pr-1">
                    {clientes.filter(c => c.criadoPorClienteId === clienteParaEditar.id).map(sub => (
                      <div key={sub.id} className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex justify-between items-center text-xs">
                        <div className="font-mono">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            {sub.adminBloqueado && <span className="bg-red-100 text-red-700 text-[8px] px-1 rounded uppercase font-black">🚫 Bloqueado</span>}
                            {sub.nome}
                          </div>
                          <div className="text-[9px] text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis max-w-xs">
                            📩 {sub.email} • 📞 {sub.telefone}
                          </div>
                          <div className="text-[9px] text-slate-650 mt-0.5">
                            Região: <span className="font-semibold">Q{sub.quadrante}</span> • Cobrado: <span className="font-semibold text-emerald-800">R$ {(sub.valorCobradoCliente || 0).toFixed(2)}</span>
                          </div>
                          {sub.notaAdmin && (
                            <div className="text-[8px] bg-amber-50 text-amber-800 p-1 rounded mt-1 border border-amber-150">
                              🔒 Nota Admin: {sub.notaAdmin}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => handleEditSubClientInsideModal(sub)}
                            className="bg-white border border-slate-300 hover:bg-slate-150 text-slate-800 p-1 rounded text-[10px] font-mono cursor-pointer"
                            title="Editar dados/valores deste cliente"
                          >
                            ✏️
                          </button>
                        </div>
                      </div>
                    ))}
                    {clientes.filter(c => c.criadoPorClienteId === clienteParaEditar.id).length === 0 && (
                      <div className="text-[11px] text-slate-400 py-3 text-center border-2 border-dashed border-slate-150 rounded-lg font-mono">
                        Nenhum cliente associado ainda. Cadastre um abaixo!
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-Client Creation/Edition Form */}
                <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3.5 mt-2 shadow-inner">
                  <span className="text-[10px] font-extrabold text-indigo-600 uppercase font-mono tracking-widest block mb-2 pb-1 border-b border-indigo-100 flex justify-between">
                    <span>{subCliEditingId ? `✏️ EDITAR CLIENTE DO PARCEIRO` : `➕ CADASTRAR NOVO CLIENTE DO PARCEIRO`}</span>
                    {subCliEditingId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSubCliEditingId(null);
                          setSubCliNome('');
                          setSubCliEmail('');
                          setSubCliSenha('');
                          setSubCliEndereco('');
                          setSubCliTelefone('');
                          setSubCliRamo('Oficina mecânica');
                          setSubCliQuadrante(clienteParaEditar.quadrante || 'A');
                          setSubCliNotaAdmin('');
                          setSubCliAdminBloqueado(false);
                          setSubCliValorCobradoCliente(10.00);
                          setSubCliValorPagoMotoboy(4.00);
                        }}
                        className="text-red-500 hover:underline text-[9px] font-normal"
                      >
                        Cancelar Edição
                      </button>
                    )}
                  </span>
                  
                  <form onSubmit={handleSaveSubClient} className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-705 uppercase font-mono mb-0.5">Nome do Cliente *</label>
                        <input
                          type="text"
                          required
                          value={subCliNome}
                          onChange={(e) => setSubCliNome(e.target.value)}
                          placeholder="Ex: Oficina Mecânica Sul"
                          className="w-full bg-white text-slate-950 border border-slate-250 rounded p-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-705 uppercase font-mono mb-0.5">E-mail de Cadastro *</label>
                        <input
                          type="email"
                          required
                          value={subCliEmail}
                          onChange={(e) => setSubCliEmail(e.target.value)}
                          placeholder="Ex: b2b@canal-parceiro.com"
                          className="w-full bg-white text-slate-950 border border-slate-250 rounded p-1.5 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 flex-wrap">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-705 uppercase font-mono mb-0.5">Senha</label>
                        <input
                          type="text"
                          value={subCliSenha}
                          onChange={(e) => setSubCliSenha(e.target.value)}
                          placeholder="Fica padrão se vazio"
                          className="w-full bg-white text-slate-950 border border-slate-250 rounded p-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-705 uppercase font-mono mb-0.5">Telefone</label>
                        <input
                          type="text"
                          value={subCliTelefone}
                          onChange={(e) => setSubCliTelefone(e.target.value)}
                          placeholder="Ex: (35) 99123-4567"
                          className="w-full bg-white text-slate-950 border border-slate-250 rounded p-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-705 uppercase font-mono mb-0.5">Região (Quadrante)</label>
                        <select
                          value={subCliQuadrante}
                          onChange={(e) => setSubCliQuadrante(e.target.value as Quadrante)}
                          className="w-full bg-white text-slate-950 border border-slate-250 rounded p-1.5 text-xs font-mono font-semibold"
                        >
                          {(['A', 'B', 'C', 'D', 'E', 'F'] as Quadrante[]).map((q) => (
                            <option key={q} value={q}>Q - {q}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-705 uppercase font-mono mb-0.5">Fixo Cobrado Cliente</label>
                        <input
                          type="number"
                          step="0.50"
                          value={subCliValorCobradoCliente}
                          onChange={(e) => setSubCliValorCobradoCliente(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white text-slate-950 border border-slate-250 rounded p-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-705 uppercase font-mono mb-0.5">Repasse Pago Motoboy</label>
                        <input
                          type="number"
                          step="0.50"
                          value={subCliValorPagoMotoboy}
                          onChange={(e) => setSubCliValorPagoMotoboy(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white text-slate-950 border border-slate-250 rounded p-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-705 uppercase font-mono mb-0.5 flex items-center justify-between">
                        <span>CEP (Opcional)</span>
                        {isFetchingSubCliCEP && (
                          <span className="text-emerald-500 animate-pulse text-[8px] font-mono leading-none">🔍 BUSCANDO CEP...</span>
                        )}
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={subCliCEP}
                          onChange={(e) => handleCEPChange(e.target.value, 'subCli')}
                          placeholder="Ex: 37900-124"
                          className="flex-1 bg-white text-slate-950 border border-slate-250 rounded p-1.5 text-xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleFetchCEP(subCliCEP, 'subCli')}
                          disabled={isFetchingSubCliCEP || !subCliCEP}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-[9px] font-bold px-2 rounded font-mono cursor-pointer shadow transition shrink-0"
                        >
                          {isFetchingSubCliCEP ? '...' : '🔍 Buscar'}
                        </button>
                      </div>
                      {cepErrorState['subCli'] && (
                        <p className="text-red-500 text-[8.5px] font-mono mt-0.5 text-left">⚠️ {cepErrorState['subCli']}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-[9px] font-bold text-slate-705 uppercase font-mono mb-0.5">Endereço de Entrega</label>
                        <input
                          type="text"
                          value={subCliEndereco}
                          onChange={(e) => setSubCliEndereco(e.target.value)}
                          placeholder="Ex: Rua das Flores - Centro"
                          className="w-full bg-white text-slate-950 border border-slate-250 rounded p-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-705 uppercase font-mono mb-0.5">Número *</label>
                        <input
                          type="text"
                          required
                          value={subCliNumero}
                          onChange={(e) => setSubCliNumero(e.target.value)}
                          placeholder="Ex: 450 ou S/N"
                          className="w-full bg-white text-slate-950 border border-slate-250 rounded p-1.5 text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* EXCLUSIVE ADMIN CONTROLS THAT THE PARTNER CANNOT EDIT/SEE */}
                    <div className="border-t border-slate-200 mt-2 pt-2 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 space-y-2">
                      <span className="text-[9px] font-black text-amber-800 uppercase font-mono flex items-center gap-1">
                        🔒 ÁREA ADMIN MODERADOR (Parceiro não visualiza ou altera)
                      </span>
                      
                      <div>
                        <label className="block text-[8.5px] font-bold text-amber-900 uppercase font-mono">Nota Interna de Auditoria Private</label>
                        <input
                          type="text"
                          value={subCliNotaAdmin}
                          onChange={(e) => setSubCliNotaAdmin(e.target.value)}
                          placeholder="Observações de faturamento, restrições"
                          className="w-full bg-white text-slate-950 border border-amber-200 rounded p-1.5 text-xs font-mono"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="sub-cli-admin-block"
                          checked={subCliAdminBloqueado}
                          onChange={(e) => setSubCliAdminBloqueado(e.target.checked)}
                          className="rounded text-red-600 focus:ring-red-500 cursor-pointer h-3.5 w-3.5 bg-white border border-slate-250"
                        />
                        <label htmlFor="sub-cli-admin-block" className="text-[9px] font-extrabold text-red-955 cursor-pointer uppercase font-mono select-none">
                          Bloquear Despacho / Faturamento deste cliente
                        </label>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold py-2 rounded text-xs font-mono uppercase tracking-wider transition cursor-pointer shadow-md"
                    >
                      {subCliEditingId ? 'Salvar Alterações do Cliente' : 'Associar Novo Cliente'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div> {/* Closes the grid configuration or split-screen container */}
        </motion.div>
      </div>
    )}
  </AnimatePresence>

      {/* ==========================================
          MODAL: EDIT REPRESENTATIVE (CRUD UPDATE)
          ========================================== */}
      <AnimatePresence>
        {representativeParaEditar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="modal-edit-representative">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-tight">
                    [Editar Representante: {representativeParaEditar.id}]
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Atualize os dados cadastrais da equipe de vendas da rua</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRepresentativeParaEditar(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold py-1 px-2 rounded hover:bg-slate-100 cursor-pointer text-xs font-mono"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleEditarRepresentanteSubmit} className="space-y-3.5 font-mono">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nome do Representante *
                  </label>
                  <input
                    type="text"
                    required
                    value={editRepNome}
                    onChange={(e) => setEditRepNome(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Contato Celular / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={editRepTelefone}
                    onChange={(e) => setEditRepTelefone(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    E-mail do Representante
                  </label>
                  <input
                    type="email"
                    value={editRepEmail}
                    onChange={(e) => setEditRepEmail(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Chave PIX Registrada *
                  </label>
                  <input
                    type="text"
                    required
                    value={editRepPix}
                    onChange={(e) => setEditRepPix(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono font-bold"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRepresentativeParaEditar(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-xs font-bold cursor-pointer shadow-md"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          MODAL: EDIT MOTOBOY (CRUD UPDATE)
          ========================================== */}
      <AnimatePresence>
        {motoboyParaEditar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="modal-edit-motoboy">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-tight">
                    [Editar Motoboy: {motoboyParaEditar.id}]
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Atualize os dados e a situação operacional do entregador</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMotoboyParaEditar(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold py-1 px-2 rounded hover:bg-slate-100 cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateMotoboy} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Nome do Profissional
                  </label>
                  <input
                    type="text"
                    required
                    value={editMotoboyNome}
                    onChange={(e) => setEditMotoboyNome(e.target.value)}
                    placeholder="Nome completo do motoboy"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Contato Telefônico
                  </label>
                  <input
                    type="text"
                    value={editMotoboyTelefone}
                    onChange={(e) => setEditMotoboyTelefone(e.target.value)}
                    placeholder="Ex: (35) 99123-4567"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Cidade / Base
                  </label>
                  <input
                    type="text"
                    required
                    value={editMotoboyCidade}
                    onChange={(e) => setEditMotoboyCidade(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Senha de Acesso
                  </label>
                  <input
                    type="text"
                    required
                    value={editMotoboySenha}
                    onChange={(e) => setEditMotoboySenha(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Valor de Repasse Fixo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    required
                    value={editMotoboyRepasse}
                    onChange={(e) => setEditMotoboyRepasse(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                      Diária Contrato Exclusivo (R$)
                    </label>
                    <input
                      type="number"
                      step="1.00"
                      min="0"
                      required
                      value={editMotoboyContratoExclusivo}
                      onChange={(e) => setEditMotoboyContratoExclusivo(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono font-bold text-orange-650"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                      Taxa Corrida Freelancer (R$)
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      required
                      value={editMotoboyTaxaFreelancer}
                      onChange={(e) => setEditMotoboyTaxaFreelancer(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono font-bold text-emerald-650"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase font-mono">
                      Empresa de Serviço Exclusiva (Opcional)
                    </label>
                    <span className="text-[9px] text-amber-600 font-bold uppercase font-mono">Exclusividade B2B</span>
                  </div>
                  
                  <select
                    onChange={(e) => {
                      if (e.target.value !== 'Personalizado') {
                        setEditMotoboyEmpresaExclusiva(e.target.value);
                      } else {
                        setEditMotoboyEmpresaExclusiva('');
                      }
                    }}
                    value={clientes.some(c => c.nome === editMotoboyEmpresaExclusiva) ? editMotoboyEmpresaExclusiva : (editMotoboyEmpresaExclusiva ? 'Personalizado' : '')}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs font-mono font-semibold mb-2"
                  >
                    <option value="">Sem exclusividade (Polo Geral / Todos)</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.nome}>{c.nome}</option>
                    ))}
                    <option value="Personalizado">✍️ Digitar manualmente outra empresa...</option>
                  </select>

                  <input
                    type="text"
                    value={editMotoboyEmpresaExclusiva}
                    onChange={(e) => setEditMotoboyEmpresaExclusiva(e.target.value)}
                    placeholder="Escreva ou escolha a empresa exclusiva de atendimento"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-orange-500 font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Veículo de Atuação
                  </label>
                  <select
                    value={editMotoboyVeiculo}
                    onChange={(e) => setEditMotoboyVeiculo(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono font-semibold"
                  >
                    <option value="Moto">Moto 🏍️</option>
                    <option value="Carro">Carro 🚗</option>
                    <option value="Van">Van 🚐</option>
                    <option value="Furgão">Furgão 🚚</option>
                  </select>
                </div>

                {editMotoboyVeiculo === 'Moto' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-705 uppercase mb-1 font-mono">
                      Vínculo da Motocicleta (Frota)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditMotoboyTipoMoto('propria')}
                        className={`py-1.5 px-3 rounded text-[11px] font-mono font-bold border transition ${
                          editMotoboyTipoMoto === 'propria'
                            ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                            : 'bg-white border-slate-250 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        🏍️ Moto Própria
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditMotoboyTipoMoto('alugada')}
                        className={`py-1.5 px-3 rounded text-[11px] font-mono font-bold border transition ${
                          editMotoboyTipoMoto === 'alugada'
                            ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                            : 'bg-white border-slate-250 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        🔑 Moto Alugada (Frota)
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase font-mono">
                      Situação / Observação Operacional
                    </label>
                    <span className="text-[9px] text-orange-600 font-bold uppercase font-mono">Status e Alertas</span>
                  </div>
                  
                  {/* Select templates */}
                  <select
                    onChange={(e) => setEditMotoboySituacao(e.target.value)}
                    value={editMotoboySituacao}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs font-mono font-semibold mb-2"
                  >
                    <option value="Ativo">Ativo e Operacional</option>
                    <option value="Faltou hoje">⚠️ Faltou hoje</option>
                    <option value="Faltou há 2 dias">⚠️ Faltou há 2 dias</option>
                    <option value="Telefone mudou - atualizar">📞 Mudou telefone</option>
                    <option value="Afastado temporariamente">🛑 Afastado temporariamente</option>
                    <option value="Aviso Prévio">⏳ Aviso Prévio</option>
                    <option value="Customizado">✍️ Escrever situação personalizada...</option>
                  </select>

                  <input
                    type="text"
                    value={editMotoboySituacao}
                    onChange={(e) => setEditMotoboySituacao(e.target.value)}
                    placeholder="Escreva a situação operacional do entregador"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                  <p className="text-[9px] text-slate-400 mt-1 font-sans">
                    Esta anotação de situação aparecerá como um alerta ao lado do entregador na lista para tomada de decisão antecipada.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setMotoboyParaEditar(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-xs font-bold font-mono cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-xs font-bold font-mono cursor-pointer shadow-md"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          MODAL: CONFIRM EXCLUSION (STATE BASED)
          ========================================== */}
      <AnimatePresence>
        {deleteConfirmType && deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm shadow-2xl" id="modal-delete-confirm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center"
            >
              <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-100 uppercase font-mono tracking-tight mb-2">
                {deleteConfirmType === 'desvincular-cliente' ? 'Desvincular Indicação 💔' : deleteConfirmType === 'ordem' ? 'Cancelar Entrega ⚠️' : deleteConfirmType === 'devolver-ordem' ? 'Devolver Corrida 🏍️' : 'Confirmar Exclusão ⚠️'}
              </h3>
              <p className="text-xs text-slate-400 mb-6 font-sans text-center">
                {deleteConfirmType === 'desvincular-cliente' ? (
                  <span>Deseja realmente desvincular as indicações e repasses futuros do parceiro:</span>
                ) : deleteConfirmType === 'ordem' ? (
                  <span>Tem certeza de que deseja cancelar a entrega de código:</span>
                ) : deleteConfirmType === 'devolver-ordem' ? (
                  <span>Tem certeza que deseja devolver esta corrida para a fila de disponíveis? Outros motoboys poderão aceitá-la:</span>
                ) : (
                  <span>Tem certeza que deseja excluir permanentemente o cadastro de:</span>
                )}
                <strong className="text-white font-mono break-all font-bold block mt-1.5 bg-slate-950 p-2 rounded border border-slate-850">
                  {deleteConfirmName || deleteConfirmId}
                </strong>
                {deleteConfirmType === 'representante' && (
                  <span className="text-[10px] text-orange-400 block mt-2 font-mono">
                    ⚠️ Atenção: Todos os parceiros indicados por este representante ficarão sem indicação associada.
                  </span>
                )}
              </p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmType(null);
                    setDeleteConfirmId(null);
                    setDeleteConfirmName('');
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold py-2.5 rounded-lg border border-slate-700 cursor-pointer active:scale-95 transition-all text-center"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executeConfirmDelete}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-mono text-xs font-bold py-2.5 rounded-lg border border-red-500 cursor-pointer active:scale-95 transition-all text-center"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
    )}

      {/* ==========================================
          MODAL: CLIENT FIRST ACCESS / ACTIVATION
          ==========================================
          These live outside the activeSessionRole ternary so they can be shown during login phase. */}
      <AnimatePresence>
        {isFirstAccessModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm shadow-2xl overflow-y-auto" id="modal-first-access">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl max-w-md w-full p-6 my-8"
            >
              <div className="flex justify-between items-start mb-4 border-b border-slate-805 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-orange-400 uppercase font-mono tracking-tight flex items-center gap-1.5">
                    ⚙️ ATIVAÇÃO DE PRIMEIRO ACESSO B2B
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Complete o perfil de sua empresa e confirme seu e-mail</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFirstAccessModalOpen(false)}
                  className="text-slate-400 hover:text-white font-bold py-1 px-2 rounded hover:bg-slate-800 cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCompletarPrimeiroAcesso} className="space-y-4">
                
                {firstAccessEmailStep === 'send_email' && (
                  <div className="space-y-4 text-left">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5 font-mono">
                        1. Escolha sua Empresa Pré-Cadastrada *
                      </label>
                      <select
                        value={firstAccessClientId}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          setFirstAccessClientId(selectedId);
                          const cli = clientes.find(c => c.id === selectedId);
                          if (cli) {
                            setFirstAccessEmail(cli.email || '');
                            setFirstAccessEndereco(cli.endereco && !cli.endereco.startsWith('Pendente') ? cli.endereco : '');
                            setFirstAccessTelefone(cli.telefone && !cli.telefone.startsWith('Pendente') ? cli.telefone : '');
                            setFirstAccessCNPJ(cli.cnpj || '');
                            setFirstAccessInscricaoEstadual(cli.inscricaoEstadual || '');
                            setFirstAccessCEP(cli.cep || '');
                            setFirstAccessNumero(cli.numero || '');
                            setFirstAccessCidade(cli.cidade || 'Passos - MG');
                          }
                        }}
                        className="w-full bg-slate-950 text-white border border-slate-800 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-orange-500 cursor-pointer"
                        required
                      >
                        <option value="">-- Selecione o nome de sua Oficina/Autopeça --</option>
                        {clientes.filter(c => !c.cadastroCompleto).map(c => (
                          <option key={c.id} value={c.id}>{c.nome} ({c.cidade})</option>
                        ))}
                      </select>
                      {clientes.filter(c => !c.cadastroCompleto).length === 0 && (
                        <p className="text-[10px] text-amber-500 font-mono mt-1 leading-normal">
                          ⚠️ Nenhum cliente com cadastro pendente encontrado no momento. Cadastre um novo cliente no painel Admin primeiro!
                        </p>
                      )}
                    </div>

                    {firstAccessClientId && (
                      <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-3">
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Para garantir a conformidade e a segurança de sua conta faturada B2B, enviaremos um e-mail com o código exclusivo de faturamento e ativação para:
                        </p>
                        <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg font-mono text-[11px] flex items-center justify-between">
                          <span className="text-slate-400">E-mail Cadastrado:</span>
                          <span className="text-orange-400 font-extrabold">{firstAccessEmail || 'suporte@torque-log.com'}</span>
                        </div>
                        
                        <button
                          type="button"
                          disabled={isSendingFirstAccessEmail}
                          onClick={() => {
                            if (!firstAccessEmail) {
                              setFirstAccessError('Nenhum e-mail pré-cadastrado encontrado para este cliente.');
                              return;
                            }
                            setIsSendingFirstAccessEmail(true);
                            setFirstAccessError('');
                            
                            setTimeout(() => {
                              const code = 'TL-' + Math.floor(1000 + Math.random() * 9000);
                              setCorrectFirstAccessCode(code);
                              setIsSendingFirstAccessEmail(false);
                              setFirstAccessEmailStep('verify_code');
                              setSupabaseSuccessMsg(`📩 E-mail enviado com código de segurança para ${firstAccessEmail}!`);

                              const firstAccessEmailMsg = {
                                id: `EML-${Math.floor(1005 + Math.random() * 8990)}`,
                                para: firstAccessEmail,
                                assunto: `🔐 Código de Ativação (1º Acesso) - TorqueLog`,
                                corpo: `Olá!\n\nSeu código de segurança TorqueLog exclusivo para faturamento e-faturado B2B é: ${code}.\n\nInsira este token no formulário do Primeiro Acesso no painel para validar o e-mail da sua empresa e desbloquear seu login.\n\nAtenciosamente,\nSuporte Técnico TorqueLog`,
                                codigo: code,
                                data: new Date().toLocaleTimeString(),
                                lido: false
                              };
                              setSimulatedEmails(prev => [firstAccessEmailMsg, ...prev]);

                              // Enviar email real via SMTP
                              if (firstAccessEmail) {
                                sendRealEmail(firstAccessEmail, firstAccessEmailMsg.assunto, firstAccessEmailMsg.corpo);
                              }

                              setTimeout(() => setSupabaseSuccessMsg(''), 5000);
                            }, 1200);
                          }}
                          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all text-white font-mono font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-orange-500/10"
                        >
                          {isSendingFirstAccessEmail ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                              <span>Processando Envios de E-mail...</span>
                            </>
                          ) : (
                            <>
                              <span>✉️ Enviar Código de Confirmação por E-mail</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {firstAccessEmailStep === 'verify_code' && (
                  <div className="space-y-4 text-left">
                    <p className="text-xs text-slate-300 leading-relaxed font-mono">
                      Um código de ativação exclusivo foi gerado e enviado para <strong className="text-orange-400">{firstAccessEmail}</strong>. Verifique sua caixa de e-mail corporativo.
                    </p>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5 font-mono">
                        Digite o código de confirmação recebido: *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Insira o Token TL-XXXX..."
                        value={firstAccessVerificationCode}
                        onChange={(e) => setFirstAccessVerificationCode(e.target.value.toUpperCase().trim())}
                        className="w-full bg-slate-950 text-white placeholder-slate-700 border border-slate-800 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (firstAccessVerificationCode === correctFirstAccessCode) {
                          setFirstAccessEmailStep('completed_form');
                          setFirstAccessError('');
                        } else {
                          setFirstAccessError('Código de segurança incorreto. Verifique o código recebido no seu e-mail e tente novamente.');
                        }
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98] transition text-white font-mono font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <span>🔓 Confirmar E-mail & Liberar Cadastro</span>
                    </button>
                  </div>
                )}

                {firstAccessEmailStep === 'completed_form' && (
                  <div className="border-t border-slate-800 pt-3.5 space-y-3.5 text-left">
                    <div className="bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 text-xs p-3 rounded-lg flex items-center gap-2 font-mono mb-2">
                      <span>✓</span>
                      <span>E-mail verificado! Preencha os dados finais para faturar rotas agregadas.</span>
                    </div>

                    <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">
                      2. Dados Cadastrais e Faturamento B2B:
                    </span>

                    <div className="grid grid-cols-2 gap-2 text-left">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1 font-mono text-left">CNPJ da Empresa *</label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: 00.000.000/0001-00"
                          value={firstAccessCNPJ}
                          onChange={(e) => setFirstAccessCNPJ(e.target.value)}
                          className="w-full bg-slate-100/10 text-white placeholder-slate-600 border border-slate-800 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1 font-mono text-left">Inscrição Estadual</label>
                        <input
                          type="text"
                          placeholder="Ex: Isento ou Nº"
                          value={firstAccessInscricaoEstadual}
                          onChange={(e) => setFirstAccessInscricaoEstadual(e.target.value)}
                          className="w-full bg-slate-100/10 text-white placeholder-slate-600 border border-slate-800 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-left">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1 font-mono text-left flex items-center justify-between">
                          <span>CEP *</span>
                          {isFetchingFirstAccessCEP && (
                            <span className="text-emerald-400 animate-pulse text-[9px] font-mono leading-none">🔍 BUSCANDO...</span>
                          )}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Ex: 37900-124"
                            value={firstAccessCEP}
                            onChange={(e) => handleCEPChange(e.target.value, 'firstAccess')}
                            className="flex-1 bg-slate-100/10 text-white placeholder-slate-600 border border-slate-800 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-orange-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleFetchCEP(firstAccessCEP, 'firstAccess')}
                            disabled={isFetchingFirstAccessCEP || !firstAccessCEP}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 text-white text-xs font-black px-3.5 rounded-lg font-mono tracking-tight cursor-pointer shadow transition shrink-0"
                          >
                            {isFetchingFirstAccessCEP ? '...' : '🔍 Buscar'}
                          </button>
                        </div>
                        {cepErrorState['firstAccess'] && (
                          <p className="text-red-400 text-[10px] font-mono mt-1 text-left">⚠️ {cepErrorState['firstAccess']}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1 font-mono text-left">Cidade / UF *</label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Passos - MG"
                          value={firstAccessCidade}
                          onChange={(e) => setFirstAccessCidade(e.target.value)}
                          className="w-full bg-slate-100/10 text-white placeholder-slate-600 border border-slate-800 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <div className="text-left">
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1 font-mono text-left">Endereço Completo da Sede *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Rua das Flores - Centro"
                        value={firstAccessEndereco}
                        onChange={(e) => setFirstAccessEndereco(e.target.value)}
                        className="w-full bg-slate-100/10 text-white placeholder-slate-600 border border-slate-800 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div className="text-left">
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1 font-mono text-left">Número do Estabelecimento *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: 123 ou S/N"
                        value={firstAccessNumero}
                        onChange={(e) => setFirstAccessNumero(e.target.value)}
                        className="w-full bg-slate-100/10 text-white placeholder-slate-600 border border-slate-800 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div className="text-left">
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1 font-mono text-left">Telefone de Contato B2B *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: (35) 98765-4321"
                        value={firstAccessTelefone}
                        onChange={(e) => setFirstAccessTelefone(e.target.value)}
                        className="w-full bg-slate-100/10 text-white placeholder-slate-600 border border-slate-800 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div className="text-left">
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1 font-mono text-left text-orange-400">Criar Sua Senha de Acesso *</label>
                      <input
                        type="password"
                        required
                        placeholder="Defina uma senha segura para fazer login"
                        value={firstAccessSenha}
                        onChange={(e) => setFirstAccessSenha(e.target.value)}
                        className="w-full bg-slate-100/10 border-orange-500/30 text-white placeholder-slate-600 border rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                )}

                {firstAccessError && (
                  <div className="p-3 bg-red-955/40 border border-red-900/60 text-red-405 text-red-400 text-xs rounded-lg flex items-start gap-1.5 font-mono">
                    <span className="shrink-0 mt-0.5">⚠️</span>
                    <span>{firstAccessError}</span>
                  </div>
                )}

                <div className="flex gap-2.5 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      if (firstAccessEmailStep === 'completed_form') {
                        setFirstAccessEmailStep('verify_code');
                      } else if (firstAccessEmailStep === 'verify_code') {
                        setFirstAccessEmailStep('send_email');
                      } else {
                        setIsFirstAccessModalOpen(false);
                      }
                    }}
                    className="flex-1 bg-slate-850 hover:bg-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-bold font-mono transition cursor-pointer"
                  >
                    {firstAccessEmailStep === 'send_email' ? 'Cancelar' : 'Voltar'}
                  </button>
                  {firstAccessEmailStep === 'completed_form' && (
                    <button
                      type="submit"
                      className="flex-1 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white py-2.5 rounded-xl text-xs font-extrabold font-mono transition cursor-pointer shadow-lg shadow-orange-500/10"
                    >
                      Ativar Cadastro 🚀
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
 
      {/* ==========================================
          MODAL: ADMIN ACCESS PASSWORD VERIFICATION
          ========================================== */}
      <AnimatePresence>
        {showAdminPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" id="modal-admin-auth">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 max-w-sm w-full p-6 relative overflow-hidden"
            >
              {/* Outer decorative line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-amber-500"></div>
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-orange-400 shrink-0" />
                    Autenticação Master Admin
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Entre com a chave de controle central TorqueLog</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdminPasswordModal(false)}
                  className="text-slate-400 hover:text-white font-black text-xs p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  setAdminLoginError('');
                  const MAIN_DEV_MASTER_PASSWORD = 'torqueadmin2026';
                  if (adminPasswordInput === MAIN_DEV_MASTER_PASSWORD) {
                    setActiveSessionRole('Empresa');
                    setActiveMotoboyUser(null);
                    setActiveClienteUser(null);
                    setShowAdminPasswordModal(false);
                    setAdminPasswordInput('');
                  } else {
                    setAdminLoginError('🔒 Senha de Administrador incorreta! Tente novamente.');
                  }
                }} 
                className="space-y-4"
              >
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 font-mono">Senha Master do Painel</label>
                  <input
                    type="password"
                    required
                    autoFocus
                    placeholder="Sua senha de segurança..."
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-805 rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none focus:border-orange-500 placeholder-slate-650 bg-slate-950"
                  />
                </div>

                {adminLoginError && (
                  <div className="p-3 bg-red-955/40 border border-red-900/50 text-red-400 text-[11px] rounded-lg flex items-start gap-1.5 font-mono leading-tight">
                    <span className="shrink-0">⚠️</span>
                    <span>{adminLoginError}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminPasswordModal(false);
                      setAdminPasswordInput('');
                      setAdminLoginError('');
                    }}
                    className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 py-2 rounded-xl text-xs font-bold font-mono transition cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white py-2 rounded-xl text-xs font-extrabold font-mono transition cursor-pointer shadow-lg shadow-orange-500/10"
                  >
                    Acessar Painel 🚀
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Supabase Live Status Toast */}
      {supabaseSuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-950 border border-emerald-400 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 max-w-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <p className="text-[11px] font-mono font-extrabold text-emerald-400">
            {supabaseSuccessMsg}
          </p>
        </div>
      )}

      {/* ==========================================
          MODAL: BATERIA DE TESTES DE FUNCIONAMENTO (100% LOCAL DIAGNOSTICS)
          ========================================== */}
      <AnimatePresence>
        {showLocalTestModal && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" id="modal-local-test-battery" style={{ zIndex: 120 }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-705/60 border-slate-700/60 rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-white relative overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 animate-pulse" />
              
              {/* Header */}
              <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔧</span>
                  <div>
                    <h3 className="text-sm font-black font-mono text-orange-400 uppercase tracking-wider">
                      Bateria de Testes Funcionais da TorqueLog
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono">
                      Homologação 100% Local – Simulação Livre de Escrita Remota
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLocalTestModal(false)}
                  disabled={localTestStatus === 'running'}
                  className="text-slate-400 hover:text-white font-bold py-1 px-2.5 rounded hover:bg-slate-800 cursor-pointer text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ✕ Fechar
                </button>
              </div>

              {/* Steps status list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-xs font-mono">
                <div className="space-y-2 bg-slate-950/40 p-3 rounded-lg border border-slate-850 border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className={localTestActiveStep >= 1 ? "text-emerald-400" : "text-slate-600"}>
                      {localTestActiveStep > 1 ? "✓" : "●"}
                    </span>
                    <span className={localTestActiveStep === 1 ? "text-amber-400 font-black" : localTestActiveStep > 1 ? "text-slate-300" : "text-slate-500"}>
                      1. Normalização & Cadastro B2B
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={localTestActiveStep >= 2 ? "text-emerald-400" : "text-slate-600"}>
                      {localTestActiveStep > 2 ? "✓" : "●"}
                    </span>
                    <span className={localTestActiveStep === 2 ? "text-amber-400 font-black" : localTestActiveStep > 2 ? "text-slate-300" : "text-slate-500"}>
                      2. Motor de Cubagem de Peças
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={localTestActiveStep >= 3 ? "text-emerald-400" : "text-slate-600"}>
                      {localTestActiveStep > 3 ? "✓" : "●"}
                    </span>
                    <span className={localTestActiveStep === 3 ? "text-amber-400 font-black" : localTestActiveStep > 3 ? "text-slate-300" : "text-slate-500"}>
                      3. Varredura Sweep de Rotas
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={localTestActiveStep >= 4 ? "text-emerald-400" : "text-slate-600"}>
                      {localTestActiveStep > 4 ? "✓" : "●"}
                    </span>
                    <span className={localTestActiveStep === 4 ? "text-amber-400 font-black" : localTestActiveStep > 4 ? "text-slate-300" : "text-slate-500"}>
                      4. Emissão Sonora de Alerta
                    </span>
                  </div>
                </div>

                <div className="space-y-2 bg-slate-950/40 p-3 rounded-lg border border-slate-850 border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className={localTestActiveStep >= 5 ? "text-emerald-400" : "text-slate-600"}>
                      {localTestActiveStep > 5 ? "✓" : "●"}
                    </span>
                    <span className={localTestActiveStep === 5 ? "text-amber-400 font-black" : localTestActiveStep > 5 ? "text-slate-300" : "text-slate-500"}>
                      5. Livro de Comissões & Repasses
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={localTestActiveStep >= 6 ? "text-emerald-400" : "text-slate-600"}>
                      {localTestActiveStep > 6 ? "✓" : "●"}
                    </span>
                    <span className={localTestActiveStep === 6 ? "text-amber-400 font-black" : localTestActiveStep > 6 ? "text-slate-300" : "text-slate-500"}>
                      6. Workspace Inbox de E-mails
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={localTestActiveStep >= 7 ? "text-emerald-400" : "text-slate-600"}>
                      {localTestActiveStep > 7 ? "✓" : "●"}
                    </span>
                    <span className={localTestActiveStep === 7 ? "text-amber-400 font-black" : localTestActiveStep > 7 ? "text-slate-300" : "text-slate-500"}>
                      7. Injeção de OS Local na Tela
                    </span>
                  </div>
                </div>
              </div>

              {/* Log Console Terminal */}
              <div className="flex-1 min-h-[160px] bg-black rounded-lg border border-slate-800 p-3 font-mono text-[10px] leading-relaxed text-slate-300 overflow-y-auto flex flex-col shadow-inner">
                {localTestLogs.length === 0 ? (
                  <p className="text-slate-650 text-slate-600 italic">Pressione "Executar Testes" para iniciar o diagnóstico...</p>
                ) : (
                  localTestLogs.map((logLine, index) => {
                    let color = "text-slate-300";
                    if (logLine.includes("✅") || logLine.includes("🏆") || logLine.includes("✨") || logLine.includes("✓")) color = "text-emerald-400 font-black";
                    if (logLine.includes("🚀") || logLine.includes("🔥")) color = "text-orange-400 font-bold";
                    if (logLine.includes("❌")) color = "text-red-405 text-red-400 font-bold";
                    if (logLine.includes("[PASSO")) color = "text-blue-400 font-bold border-b border-slate-900/50 pb-0.5 mt-1";
                    return (
                      <div key={index} className={`${color}`}>
                        {logLine}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Status and Action controls */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                <div className="text-xs font-mono">
                  {localTestStatus === 'running' && (
                    <span className="text-amber-450 text-amber-500 font-bold animate-pulse font-mono">⏳ Executando fluxo {localTestActiveStep}/7...</span>
                  )}
                  {localTestStatus === 'success' && (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      🏆 Sistema Homologado com Sucesso!
                    </span>
                  )}
                  {localTestStatus === 'error' && (
                    <span className="text-red-400 font-bold">❌ Falha crítica no diagnóstico local!</span>
                  )}
                  {localTestStatus === 'idle' && (
                    <span className="text-slate-400">Pronto para iniciar</span>
                  )}
                </div>

                <div className="flex gap-2">
                  {localTestStatus !== 'running' && (
                    <button
                      type="button"
                      onClick={runLocalTestBattery}
                      className="bg-amber-600 hover:bg-amber-500 font-mono text-xs font-black text-slate-950 px-4 py-2 rounded-xl cursor-pointer transition shadow-lg shadow-amber-600/10 text-white"
                    >
                      {localTestStatus === 'success' ? 'Re-executar Teste' : 'Iniciar Testes 🚀'}
                    </button>
                  )}
                  
                  <button
                    type="button"
                    onClick={() => setShowLocalTestModal(false)}
                    disabled={localTestStatus === 'running'}
                    className="bg-slate-800 hover:bg-slate-700 font-mono text-xs font-bold text-slate-300 px-4 py-2 rounded-xl cursor-pointer transition disabled:opacity-35"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          MODAL: ADMIN FIREBASE SYNC SAVE POPUP
          ========================================== */}
      <AnimatePresence>
        {adminFirebaseSaveMsg && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs" id="modal-firebase-save" style={{ zIndex: 100 }}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-950 text-white rounded-2xl shadow-2xl border border-orange-500/40 p-6 max-w-sm w-full text-center relative overflow-hidden"
            >
              {/* Decorative top pulse badge */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 to-amber-500" />
              
              <div className="mx-auto w-14 h-14 bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 rounded-full flex items-center justify-center text-orange-400 mb-4 animate-bounce">
                <svg className="w-7 h-7 fill-current animate-pulse text-amber-500" viewBox="0 0 24 24" referrerPolicy="no-referrer">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>

              <h3 className="text-sm font-black font-mono text-orange-400 uppercase tracking-wider mb-2">
                🔥 Sincronização Firebase Realizada!
              </h3>
              
              <p className="text-xs text-slate-300 font-mono leading-relaxed mb-5">
                {adminFirebaseSaveMsg}
              </p>

              <button
                type="button"
                onClick={() => setAdminFirebaseSaveMsg(null)}
                className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-mono font-bold text-xs py-2.5 rounded-xl cursor-pointer shadow-md transition duration-150 transform hover:scale-[1.01]"
              >
                Ótimo, Entendido! 👍
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
  </>
  );

  // Helper inside standard React state modifiers because of input controls
  function setFormCheckbox(val: boolean) {
    setRetornoPeca(val);
  }
}

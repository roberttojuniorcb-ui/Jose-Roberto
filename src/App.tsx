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
  Volume2
} from 'lucide-react';
import { Cliente, OrdemServico, Quadrante, APIResponse, Motoboy } from './types';
import { getInitialClientes, AUTO_PECA_SUGESTOES, INITIAL_MOTOBOYS } from './mockData';
import { 
  query, 
  collection, 
  orderBy, 
  onSnapshot 
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
  loadInitialDataFromFirebase
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
import MapaDaCidade from './components/MapaDaCidade';
import GpsNavigator from './components/GpsNavigator';
import TorqueLogLogoIcon from './components/TorqueLogLogoIcon';

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const WEEKDAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function App() {
  // --- STATE MANAGEMENT ---
  const [clientes, setClientes] = useState<Cliente[]>(() => getInitialClientes());
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
  const [itemTexto, setItemTexto] = useState<string>('Peças Diversas');
  const [retornoPeca, setRetornoPeca] = useState<boolean>(false);
  const [taxaReversaParam, setTaxaReversaParam] = useState<number>(15.00);

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
  const [newClientValorPagoMotoboy, setNewClientValorPagoMotoboy] = useState<number>(4.00);
  const [newClientValorCobradoCliente, setNewClientValorCobradoCliente] = useState<number>(10.00);
  const [newClientEmail, setNewClientEmail] = useState<string>('');
  const [newClientSenha, setNewClientSenha] = useState<string>('');
  const [newClientMotoboysAtivos, setNewClientMotoboysAtivos] = useState<number>(1);

  // --- STATE FOR QUICK REGISTERING CLIENT/DESTINATARIO (CRUD) ---
  const [isQuickRegisteringDestinatario, setIsQuickRegisteringDestinatario] = useState<boolean>(false);
  const [quickClientNome, setQuickClientNome] = useState<string>('');
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
  const [editClientValorPagoMotoboy, setEditClientValorPagoMotoboy] = useState<number>(4.00);
  const [editClientValorCobradoCliente, setEditClientValorCobradoCliente] = useState<number>(10.00);
  const [editClientEmail, setEditClientEmail] = useState<string>('');
  const [editClientSenha, setEditClientSenha] = useState<string>('');
  const [editClientMotoboysAtivos, setEditClientMotoboysAtivos] = useState<number>(1);

  // --- STATES FOR FIRST ACCESS SELF-REGISTRATION ---
  const [isFirstAccessModalOpen, setIsFirstAccessModalOpen] = useState<boolean>(false);
  const [firstAccessClientId, setFirstAccessClientId] = useState<string>('');
  const [firstAccessCNPJ, setFirstAccessCNPJ] = useState<string>('');
  const [firstAccessInscricaoEstadual, setFirstAccessInscricaoEstadual] = useState<string>('');
  const [firstAccessCEP, setFirstAccessCEP] = useState<string>('');
  const [isFetchingFirstAccessCEP, setIsFetchingFirstAccessCEP] = useState<boolean>(false);
  const [firstAccessEndereco, setFirstAccessEndereco] = useState<string>('');
  const [firstAccessCidade, setFirstAccessCidade] = useState<string>('');
  const [firstAccessTelefone, setFirstAccessTelefone] = useState<string>('');
  const [firstAccessEmail, setFirstAccessEmail] = useState<string>('');
  const [firstAccessSenha, setFirstAccessSenha] = useState<string>('');
  const [firstAccessError, setFirstAccessError] = useState<string>('');

  // --- STATE FOR CLIENT PORTAL REGISTERING NEW CLIENTS ---
  const [isClientAddingNewClient, setIsClientAddingNewClient] = useState<boolean>(false);
  const [clientNewClientNome, setClientNewClientNome] = useState<string>('');
  const [clientNewClientQuadrante, setClientNewClientQuadrante] = useState<Quadrante>('A');
  const [clientNewClientCEP, setClientNewClientCEP] = useState<string>('');
  const [isClientFetchingNewClientCEP, setIsClientFetchingNewClientCEP] = useState<boolean>(false);
  const [clientNewClientEndereco, setClientNewClientEndereco] = useState<string>('');
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

  // --- MOTOBOY REGISTRATION & SESSIONS (NEW COMPONENT REQUIREMENTS) ---
  const [motoboys, setMotoboys] = useState<Motoboy[]>(() => INITIAL_MOTOBOYS);
  const [isAddingNewMotoboy, setIsAddingNewMotoboy] = useState<boolean>(false);
  const [newMotoboyNome, setNewMotoboyNome] = useState<string>('');
  const [newMotoboyTelefone, setNewMotoboyTelefone] = useState<string>('');
  const [newMotoboyCidade, setNewMotoboyCidade] = useState<string>('Passos - MG');
  const [newMotoboySenha, setNewMotoboySenha] = useState<string>('passos123');
  const [newMotoboyRepasse, setNewMotoboyRepasse] = useState<number>(4.00);
  const [newMotoboyEmpresaExclusiva, setNewMotoboyEmpresaExclusiva] = useState<string>('');

  // --- STATE FOR MOTOBOY EDITING (CRUD) ---
  const [motoboyParaEditar, setMotoboyParaEditar] = useState<Motoboy | null>(null);
  const [editMotoboyNome, setEditMotoboyNome] = useState<string>('');
  const [editMotoboyTelefone, setEditMotoboyTelefone] = useState<string>('');
  const [editMotoboyCidade, setEditMotoboyCidade] = useState<string>('Passos - MG');
  const [editMotoboySenha, setEditMotoboySenha] = useState<string>('');
  const [editMotoboyRepasse, setEditMotoboyRepasse] = useState<number>(4.00);
  const [editMotoboySituacao, setEditMotoboySituacao] = useState<string>('Ativo');
  const [editMotoboyEmpresaExclusiva, setEditMotoboyEmpresaExclusiva] = useState<string>('');

  // --- STATES FOR EXCLUSION CONFIRMATION ---
  const [deleteConfirmType, setDeleteConfirmType] = useState<'cliente' | 'motoboy' | 'multiple-clientes' | 'ordem' | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);

  // Multi-session credentials portal states
  const [logoVariant, setLogoVariant] = useState<'esportivo' | 'premium'>('esportivo');
  const [activeSessionRole, setActiveSessionRole] = useState<'Empresa' | 'Motoboy' | 'Cliente' | null>(null);
  const [activeMotoboyUser, setActiveMotoboyUser] = useState<Motoboy | null>(null);
  const [activeClienteUser, setActiveClienteUser] = useState<Cliente | null>(null);

  // --- ADMIN CITY FILTER & SEARCH ---
  const [selectedAdminCity, setSelectedAdminCity] = useState<string>('Todas');

  // --- CLIENT SELF-REGISTRATION STATE ---
  const [isSelfRegistering, setIsSelfRegistering] = useState<boolean>(false);
  const [selfRegNome, setSelfRegNome] = useState<string>('');
  const [selfRegCNPJ, setSelfRegCNPJ] = useState<string>('');
  const [selfRegInscricaoEstadual, setSelfRegInscricaoEstadual] = useState<string>('Isento');
  const [selfRegCEP, setSelfRegCEP] = useState<string>('');
  const [selfRegEndereco, setSelfRegEndereco] = useState<string>('');
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
  const [activeGpsOrder, setActiveGpsOrder] = useState<OrdemServico | null>(null);
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
  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      
      // Note 1: E5 (659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Note 2: A5 (880.00 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, now + 0.12);
      gain2.gain.setValueAtTime(0, now + 0.12);
      gain2.gain.linearRampToValueAtTime(0.20, now + 0.17);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.6);
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
      return isAvailable && isSameCity && isUnclaimed && isNewlyDispatched;
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

      // Play the chime beep alert!
      playNotificationSound();
    }
  }, [ordens, activeSessionRole, activeMotoboyUser]);

  // --- DATABASE SYNCHRONIZATION AND PRE-POPULATION (FIREBASE & SUPABASE) ---
  const [supabaseLoading, setSupabaseLoading] = useState<boolean>(false);
  const [supabaseSuccessMsg, setSupabaseSuccessMsg] = useState<string>('');
  const [dbSyncStatus, setDbSyncStatus] = useState<'synced' | 'connecting' | 'updating' | 'local'>(
    (isFirebaseConfigured || isSupabaseConfigured) ? 'connecting' : 'local'
  );
  const isSupabaseBootstrappedRef = React.useRef<boolean>(false);
  const isFirebaseBootstrappedRef = React.useRef<boolean>(false);

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
      if (isFirebaseConfigured) {
        setSupabaseLoading(true);
        setDbSyncStatus('connecting');
        try {
          const loaded = await loadInitialDataFromFirebase();
          if (active) {
            if (loaded) {
              if (loaded.clientes && loaded.clientes.length > 0) {
                setClientes(loaded.clientes);
              } else {
                await syncClientesToFirebase(clientes);
              }

              if (loaded.motoboys && loaded.motoboys.length > 0) {
                setMotoboys(loaded.motoboys);
              } else {
                await syncMotoboysToFirebase(motoboys);
              }

              if (loaded.ordens && loaded.ordens.length > 0) {
                setOrdens(loaded.ordens);
              } else {
                await syncOrdensToFirebase(ordens);
              }
            } else {
              // Firebase response was empty or null, seed the data
              await syncClientesToFirebase(clientes);
              await syncMotoboysToFirebase(motoboys);
              await syncOrdensToFirebase(ordens);
            }

            isFirebaseBootstrappedRef.current = true;
            setSupabaseSuccessMsg('Banco Firebase Firestore carregado em tempo real! 🔥');
            setTimeout(() => setSupabaseSuccessMsg(''), 5000);
            setDbSyncStatus('synced');
          }
        } catch (err) {
          console.error("Firebase loader failed:", err);
          setDbSyncStatus('local');
        } finally {
          if (active) setSupabaseLoading(false);
        }
        return;
      }

      // Supabase Fallback
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

          if (cliErr) console.error("Error loading clientes:", cliErr);
          if (motoErr) console.error("Error loading motoboys:", motoErr);

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
              setClientes(mappedCli);
            } else {
              await syncClientesToSupabase(clientes);
            }

            // Process Motoboys fallback or load
            if (dbMoto && dbMoto.length > 0) {
              const mappedMoto: Motoboy[] = dbMoto.map(m => ({
                id: m.id,
                nome: m.nome,
                telefone: m.telefone,
                cidade: m.cidade,
                senha: m.senha,
                valorRepasseFixo: Number(m.valor_repasse_fixo),
                criadoEm: m.criado_em
              }));
              setMotoboys(mappedMoto);
            } else {
              await syncMotoboysToSupabase(motoboys);
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
    if (isFirebaseConfigured) {
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
            criadoEm: o.criadoEm
          });
        });
        if (mapped.length > 0) {
          setOrdens(mapped);
        }
        setDbSyncStatus('synced');
      }, (error) => {
        console.error("Firestore onSnapshot streaming error:", error);
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

  // Post-bootstrap local-state modifications automated syncing
  useEffect(() => {
    if (isFirebaseConfigured && isFirebaseBootstrappedRef.current) {
      syncClientesToFirebase(clientes);
    }
    if (supabase && isSupabaseBootstrappedRef.current) {
      syncClientesToSupabase(clientes);
    }
  }, [clientes]);

  useEffect(() => {
    if (isFirebaseConfigured && isFirebaseBootstrappedRef.current) {
      syncOrdensToFirebase(ordens);
    }
    if (supabase && isSupabaseBootstrappedRef.current) {
      syncOrdensToSupabase(ordens);
    }
  }, [ordens]);

  useEffect(() => {
    if (isFirebaseConfigured && isFirebaseBootstrappedRef.current) {
      syncMotoboysToFirebase(motoboys);
    }
    if (supabase && isSupabaseBootstrappedRef.current) {
      syncMotoboysToSupabase(motoboys);
    }
  }, [motoboys]);

  // Login form field states
  const [loginRole, setLoginRole] = useState<'Empresa' | 'Motoboy' | 'Cliente'>('Empresa');
  const [selectedLoginUserId, setSelectedLoginUserId] = useState<string>('');
  const [loginPasswordInput, setLoginPasswordInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  // --- STATE FOR CURRENT MOTOBOY SIGNATURE MODAL ---
  const [activeSignOrder, setActiveSignOrder] = useState<OrdemServico | null>(null);
  const [signatureName, setSignatureName] = useState<string>('');

  // --- STATES FOR CLIENT WORKSPACE DISPATCH FORM (CLEAN EXTRA OPTIONS) ---
  const [destinoTipo, setDestinoTipo] = useState<'endereco' | 'cliente'>('endereco');
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
      const cobradoVal = (o.valorCobradoCliente || 10.00) + (o.retornoPeca ? (o.taxaReversa || 15) : 0);
      const pagoVal = (o.valorPagoMotoboy || 4.00) + (o.retornoPeca ? (o.taxaReversa || 15) : 0);
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

  // Statistics for the active logged-in Motoboy (Daily/Monthly)
  const motoboyStats = useMemo(() => {
    if (!activeMotoboyUser) return { hojeCount: 0, hojeEarnings: 0, mesCount: 0, mesEarnings: 0 };
    
    // helper to check date properties
    const cleanToday = new Date().toDateString();
    const cleanMonth = new Date().getMonth();
    const cleanYear = new Date().getFullYear();

    let hojeCount = 0;
    let hojeEarnings = 0;
    let mesCount = 0;
    let mesEarnings = 0;

    ordens.forEach(o => {
      if (o.motoboyId === activeMotoboyUser.id) {
        const orderDate = new Date(o.criadoEm);
        const orderDateString = orderDate.toDateString();
        const orderMonth = orderDate.getMonth();
        const orderYear = orderDate.getFullYear();

        const isOToday = orderDateString === cleanToday;
        const isOThisMonth = orderMonth === cleanMonth && orderYear === cleanYear;
        const repasse = o.valorPagoMotoboy || 4.00;

        if (isOThisMonth && o.status === 'Entregue') {
          mesCount++;
          mesEarnings += repasse;
        }
        if (isOToday && o.status === 'Entregue') {
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
        const fee = (o.valorCobradoCliente || 10.00) + (o.retornoPeca ? (o.taxaReversa || 15) : 0);

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
        const fee = (o.valorCobradoCliente || 10.00) + (o.retornoPeca ? (o.taxaReversa || 15) : 0);

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
        const fee = (o.valorCobradoCliente || 10.00) + (o.retornoPeca ? (o.taxaReversa || 15) : 0);
        billing += fee;
        const rep = (o.valorPagoMotoboy || 4.00) + (o.retornoPeca ? (o.taxaReversa || 15) : 0);
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
        monthlyBilling += (o.valorCobradoCliente || 10.00) + (o.retornoPeca ? (o.taxaReversa || 15) : 0);
        monthlyRepasse += (o.valorPagoMotoboy || 4.00) + (o.retornoPeca ? (o.taxaReversa || 15) : 0);
      });

      let dailyBilling = 0;
      completedOrdersThisDay.forEach(o => {
        dailyBilling += (o.valorCobradoCliente || 10.00) + (o.retornoPeca ? (o.taxaReversa || 15) : 0);
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

  // --- CONTROLLER FUNCTIONS ---

  // Dispatch a new Order from the distributor
  const handleDespacharOrdem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClienteId) return;

    const targetCliente = clientes.find(c => c.id === selectedClienteId);
    if (!targetCliente) return;

    const finalItemMsg = itemTexto.trim() || 'Peças Diversas';

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
      tempoRestanteSweep: 15
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

    if (isFirebaseConfigured) {
      try {
        await syncOrdensToFirebase(nextOrdensList);
      } catch (err) {
        console.error("Erro ao sincronizar ordem faturada no Firebase:", err);
      }
    }
    if (supabase) {
      try {
        await syncOrdensToSupabase(nextOrdensList);
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
    setItemTexto('Peças Diversas');
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

    const tempSenha = `temp-${Math.floor(100000 + Math.random() * 900000)}`;

    const novoCli: Cliente = {
      id: `CLI-${newClientQuadrante}-${Math.floor(1000 + Math.random() * 9000)}`,
      nome: newClientNome,
      quadrante: newClientQuadrante,
      endereco: newClientEndereco,
      telefone: newClientTelefone || 'Pendente - Preencher no 1º Acesso',
      cidade: newClientCidade || 'Passos - MG',
      cep: newClientCEP,
      valorPagoMotoboy: Number(newClientValorPagoMotoboy) || 4.00,
      valorCobradoCliente: Number(newClientValorCobradoCliente) || 10.00,
      senha: tempSenha, // temporary fallback password
      email: newClientEmail,
      emailConfirmado: false, // Will be activated/confirmed upon full registration/self activation
      cadastroCompleto: false, // Explicitly false! Trigger B2B onboarding setup on first login/access!
      criadoPor: source,
      criadoEm: new Date().toISOString(),
      motoboysAtivos: Number(newClientMotoboysAtivos) || 0
    };

    setClientes(prev => [novoCli, ...prev]);
    setIsAddingNewClient(false);

    // Simulated Inbox Dispatch
    const clientEmailEntry = {
      id: `EML-${Math.floor(1005 + Math.random() * 8990)}`,
      para: novoCli.email,
      assunto: `🔑 Ativação de Cadastro B2B - ${novoCli.nome}`,
      corpo: `Olá, ${novoCli.nome}!\n\nSua empresa foi pré-cadastrada com sucesso nas rotas agregadas da TorqueLog.\n\nPara realizar o seu auto-cadastro final, definir sua senha e habilitar o faturamento por CNPJ, acesse a área de login, selecione o Perfil "Cliente B2B", escolha o nome "${novoCli.nome}" na lista e tente entrar.\n\nO sistema abrirá a tela de Primeiro Acesso para você concluir o faturamento por CNPJ de forma descomplicada.\n\nSeu Código de Segurança / Token de Primeiro Acesso é: ${tempSenha}\n\nAtenciosamente,\nSuporte Técnico TorqueLog`,
      codigo: tempSenha,
      data: new Date().toLocaleTimeString(),
      lido: false
    };
    setSimulatedEmails(prev => [clientEmailEntry, ...prev]);

    // Call Supabase native auth register link if configured (real integration)
    if (supabase) {
      try {
        console.log(`Starting real Supabase Auth signUp pre-registration for ${novoCli.email}...`);
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: novoCli.email,
          password: tempSenha,
          options: {
            data: {
              nome: novoCli.nome,
              id_cliente: novoCli.id,
              cadastro_completo: false
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
    setNewClientTelefone('');
    setNewClientEmail('');
    setNewClientSenha('');
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
      valorPagoMotoboy: Number(editClientValorPagoMotoboy) || 4.00,
      valorCobradoCliente: Number(editClientValorCobradoCliente) || 10.00,
      email: editClientEmail,
      senha: editClientSenha || clienteParaEditar.senha,
      motoboysAtivos: Number(editClientMotoboysAtivos) || 0
    };

    setClientes(prev => prev.map(c => c.id === clienteParaEditar.id ? updatedCli : c));
    setClienteParaEditar(null);

    setSupabaseSuccessMsg(`✅ Cadastro de "${updatedCli.nome}" atualizado com sucesso!`);
    setTimeout(() => setSupabaseSuccessMsg(''), 4000);
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
      situacao: editMotoboySituacao || 'Ativo',
      empresaExclusiva: editMotoboyEmpresaExclusiva || undefined
    };

    setMotoboys(prev => prev.map(m => m.id === motoboyParaEditar.id ? updatedMb : m));
    setMotoboyParaEditar(null);
    setEditMotoboyEmpresaExclusiva('');

    setSupabaseSuccessMsg(`✅ Cadastro do motoboy "${updatedMb.nome}" atualizado com sucesso!`);
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
    }

    // Reset confirmation states
    setDeleteConfirmType(null);
    setDeleteConfirmId(null);
    setDeleteConfirmName('');
  };

  // --- INTEGRATED VIA CEP LOOKUP ENGINE (AUTO-RESOLVE ADRESS/CITY) ---
  const handleFetchCEP = async (cep: string, target: 'selfReg' | 'newClient' | 'editClient' | 'clientNewClient' | 'firstAccess') => {
    const cleanedCEP = cep.replace(/\D/g, '');
    if (cleanedCEP.length !== 8) return;

    if (target === 'selfReg') setIsFetchingCEP(true);
    else if (target === 'newClient') setIsFetchingNewClientCEP(true);
    else if (target === 'editClient') setIsFetchingEditClientCEP(true);
    else if (target === 'clientNewClient') setIsClientFetchingNewClientCEP(true);
    else if (target === 'firstAccess') setIsFetchingFirstAccessCEP(true);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanedCEP}/json/`);
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
        }
      } else {
        console.warn("CEP não encontrado no ViaCEP.");
      }
    } catch (err) {
      console.error("Erro ao buscar CEP via ViaCEP API:", err);
    } finally {
      if (target === 'selfReg') setIsFetchingCEP(false);
      else if (target === 'newClient') setIsFetchingNewClientCEP(false);
      else if (target === 'editClient') setIsFetchingEditClientCEP(false);
      else if (target === 'clientNewClient') setIsClientFetchingNewClientCEP(false);
      else if (target === 'firstAccess') setIsFetchingFirstAccessCEP(false);
    }
  };

  const handleCEPChange = (val: string, target: 'selfReg' | 'newClient' | 'editClient' | 'clientNewClient' | 'firstAccess') => {
    let formatted = val.replace(/\D/g, '');
    if (formatted.length > 8) formatted = formatted.slice(0, 8);
    
    let displayVal = formatted;
    if (formatted.length > 5) {
      displayVal = `${formatted.slice(0, 5)}-${formatted.slice(5)}`;
    }

    if (target === 'selfReg') {
      setSelfRegCEP(displayVal);
      if (formatted.length === 8) {
        handleFetchCEP(formatted, 'selfReg');
      }
    } else if (target === 'newClient') {
      setNewClientCEP(displayVal);
      if (formatted.length === 8) {
        handleFetchCEP(formatted, 'newClient');
      }
    } else if (target === 'editClient') {
      setEditClientCEP(displayVal);
      if (formatted.length === 8) {
        handleFetchCEP(formatted, 'editClient');
      }
    } else if (target === 'clientNewClient') {
      setClientNewClientCEP(displayVal);
      if (formatted.length === 8) {
        handleFetchCEP(formatted, 'clientNewClient');
      }
    } else if (target === 'firstAccess') {
      setFirstAccessCEP(displayVal);
      if (formatted.length === 8) {
        handleFetchCEP(formatted, 'firstAccess');
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
      } else {
        setLoginError(`Senha incorreta para ${selected.nome} (Dica: ${selected.senha})`);
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
      } else {
        setLoginError(`Senha incorreta para ${selected.nome} (Dica: ${actualPW})`);
      }
    }
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
      criadoEm: new Date().toISOString(),
      empresaExclusiva: newMotoboyEmpresaExclusiva || undefined
    };

    setMotoboys(prev => [novoMotoboy, ...prev]);
    setIsAddingNewMotoboy(false);

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
    setNewMotoboyEmpresaExclusiva('');
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
      const value = (o.valorCobradoCliente || 10.00) + (o.retornoPeca ? (o.taxaReversa || 15) : 0);
      report += `${index + 1}. [${o.id}] - ${o.clienteNome}\n`;
      report += `   - Itens: ${o.itensDescricao}\n`;
      report += `   - Valor B2B: R$ ${value.toFixed(2)} | Repasse: R$ ${((o.valorPagoMotoboy || 4.00) + (o.retornoPeca ? (o.taxaReversa || 15) : 0)).toFixed(2)}\n`;
      report += `   - ${statusLabel}\n\n`;
    });
    
    navigator.clipboard.writeText(report).then(() => {
      setCopiedDay(true);
      setTimeout(() => setCopiedDay(false), 2000);
    });
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

    if (novoStatus === 'Moto a Caminho') {
      const updatedOrder = nextOrdens.find(o => o.id === ordemId);
      if (updatedOrder) {
        setActiveGpsOrder(updatedOrder);
      }
    }

    if (isFirebaseConfigured) {
      try {
        await syncOrdensToFirebase(nextOrdens);
      } catch (err) {
        console.error("Erro ao sincronizar atualização de status no Firebase:", err);
      }
    }
    if (supabase) {
      try {
        await syncOrdensToSupabase(nextOrdens);
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

    if (isFirebaseConfigured) {
      try {
        await syncOrdensToFirebase(nextOrdens);
      } catch (err) {
        console.error("Erro ao sincronizar assinatura de canhoto no Firebase:", err);
      }
    }
    if (supabase) {
      try {
        await syncOrdensToSupabase(nextOrdens);
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

  if (!activeSessionRole) {
    return (
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
              <div className="flex items-center gap-3">
                <span className="text-[46px] font-black tracking-tighter font-mono text-orange-400 drop-shadow-md">TorqueLog</span>
                <span className="text-[10px] bg-slate-900 border border-orange-500/30 text-orange-400 px-2.5 py-0.5 rounded font-black font-mono animate-pulse">B2B PORTAL</span>
              </div>
              <p className="text-[10.5px] text-slate-400 font-mono tracking-wider uppercase mt-1">PLATAFORMA INTEGRADA DE DISTRIBUIÇÃO DE MERCADORIAS</p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-500 tracking-widest hidden lg:inline">ROTEIRIZAÇÃO AUTOMOTIVA INTELIGENTE</span>
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
                    <input
                      type="text"
                      placeholder="Ex: 37900-124"
                      value={selfRegCEP}
                      onChange={(e) => handleCEPChange(e.target.value, 'selfReg')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Endereço de Entrega Completo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Av. dos Autistas, 305 - Centro"
                      value={selfRegEndereco}
                      onChange={(e) => setSelfRegEndereco(e.target.value)}
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

                  {/* Simulated Mailbox client helper */}
                  <div className="p-3 bg-slate-950 border border-orange-500/10 rounded-lg">
                    <span className="text-[10px] font-bold text-orange-400 flex items-center gap-1 uppercase block mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping"></span>
                      📬 SIMULADOR DE E-MAIL ADIANTADO (LOCAL):
                    </span>
                    <div className="text-[11px] leading-relaxed text-slate-350 border-t border-slate-900 pt-2 font-mono space-y-1">
                      <p>Para: <span className="text-white text-[10px]">{selfRegEmail}</span></p>
                      <p>Assunto: <span className="text-white text-[10px]">Ativação de Cadastro TorqueLog</span></p>
                      <div className="bg-emerald-950/15 border border-emerald-500/20 p-2 rounded mt-2 text-slate-250">
                        O código de ativação do seu auto-cadastro é: <strong className="text-emerald-400 text-xs bg-slate-900 px-1.5 py-0.2 rounded border border-emerald-500/30">{correctSelfRegCode}</strong>
                      </div>
                    </div>
                  </div>
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
                  <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => { setLoginRole('Empresa'); setIsSelfRegistering(false); }}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${loginRole === 'Empresa' ? 'bg-orange-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                      🏢 Admin
                    </button>
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
                      🏢 Distribuidora
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
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Selecione sua Distribuidora</label>
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
                    
                    <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg text-xs leading-normal">
                      <p className="text-slate-300 font-mono text-[11.5px]">
                        🆕 <strong className="text-emerald-400">Cliente Novo?</strong> Se sua oficina não possui convênio ainda, registre sua empresa sozinho imediatamente:
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSelfRegistering(true);
                          setSelfRegStep('form');
                          setSelfRegError('');
                        }}
                        className="mt-2 text-emerald-400 hover:text-emerald-300 underline font-black font-mono text-[11.5px] block text-left"
                      >
                        🚀 REALIZAR NOVO CADASTRO B2B PROPRIO →
                      </button>
                    </div>
                  </div>
                )}

                {/* Password input */}
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

                {/* Error prompt */}
                {loginError && (
                  <div className="p-3 bg-red-950/50 border border-red-800 text-red-400 text-xs rounded-lg flex items-center gap-2 font-mono">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                {/* Login button */}
                <button
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 active:transform active:scale-95 text-white font-mono font-bold text-sm py-3 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10 cursor-pointer"
                >
                  <Lock className="w-4 h-4 text-white" />
                  AUTENTICAR PORTAL
                </button>
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
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col selection:bg-orange-500 selection:text-white" id="torquelog-app">
      
      {/* --- TOP HIGH-PERFORMANCE NAVIGATION & HUD --- */}
      <header className="bg-slate-900 text-white border-b-4 border-orange-500 sticky top-0 z-50 shadow-md p-4" id="header-hud">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-4">
          
          <div className="flex flex-wrap items-center justify-between lg:justify-start w-full lg:w-auto gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-slate-950 p-2.5 rounded-xl shadow-xl flex items-center justify-center border-2 border-orange-500 scale-105 hover:scale-110 transition duration-300" id="brand-logo">
                <TorqueLogLogoIcon size={84} className="text-orange-500" variant="esportivo" />
              </div>
              <div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-5xl font-black tracking-tighter font-mono text-orange-400 drop-shadow-md select-none uppercase">TorqueLog</span>
                  <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded shadow-sm border border-amber-400 animate-pulse">LOGÍSTICA B2B EXPRESS</span>
                </div>
                <p className="text-[10.5px] text-orange-100 font-mono tracking-widest font-extrabold uppercase mt-1">PLATAFORMA INTEGRADA DE DISTRIBUIÇÃO DE MERCADORIAS</p>
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
                    <span className="block text-[9px] text-slate-400 leading-none">Distribuidoras Cadastradas</span>
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
                      Clientes de {activeMotoboyUser?.empresaExclusiva || 'Distribuidor'}
                    </span>
                    <span className="text-sm font-bold text-white">
                      {(() => {
                        const linkedDist = clientes.find(
                          c => c.nome.toLowerCase() === activeMotoboyUser?.empresaExclusiva?.toLowerCase() || c.id === activeMotoboyUser?.empresaExclusiva
                        );
                        return linkedDist
                          ? clientes.filter(c => c.criadoPorClienteId === linkedDist.id).length
                          : clientes.length;
                      })()}{' '}
                      <span className="text-[10px] text-slate-400">parceiros</span>
                    </span>
                  </>
                )}
              </div>
            </div>

            {activeSessionRole === 'Empresa' && (
              <div className="bg-slate-800/80 px-3 py-1.5 rounded border border-slate-700 font-mono text-xs flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="block text-[9px] text-emerald-400 leading-none">Lucro TorqueLog</span>
                  <span className="text-sm font-bold text-emerald-400">R$ {stats.lucroTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="bg-slate-800/80 px-3 py-1.5 rounded border border-slate-700 font-mono text-xs flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              <div>
                <span className="block text-[9px] text-slate-400 leading-none">Varredura Sweep</span>
                <span className="text-sm font-bold text-white">15 Minutos</span>
              </div>
            </div>

            <div className="bg-slate-800/80 px-3 py-1.5 rounded border border-slate-700 font-mono text-xs flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-400" />
              <div>
                <span className="block text-[9px] text-slate-400 leading-none">Compliance MEI</span>
                <span className="text-sm font-bold text-green-450 text-green-400 font-bold">Risco Zero</span>
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
                  {isFirebaseConfigured ? 'Firebase On' : (isSupabaseConfigured ? 'Supabase On' : 'Simulador Local')}
                </span>
              </div>
            </div>
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
                🏢 Portal da Distribuidora B2B
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

      {/* --- RECRUITING & EMERGENCY NOTICES (COMPLIANCE VERIFICATION) --- */}
      <div className="bg-orange-50 border-b border-orange-200 py-2.5 px-4 text-xs font-mono text-orange-850" id="compliance-ribbon">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-650 shrink-0" />
            <span><strong>Filtro Antiprocesso Ativo:</strong> Comunicações estruturadas para o prestador MEI de forma autônoma (livre de subordinação ou jornada fixa).</span>
          </div>
          <div className="text-[10px] bg-orange-200/50 text-orange-900 border border-orange-300 py-0.5 px-2 rounded font-bold">
            Frota: 100% Motocicletas Parceiras
          </div>
        </div>
      </div>
      {effectiveRole === 'Empresa' && (
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
              <p className="text-xs text-slate-500 mt-0.5">Distribuição estratégica em 6 setores regionais • Arrastre de motoboys e pedidos simulados por satélite</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleAbrirRelatorio('Empresa')}
                className="bg-indigo-650 hover:bg-indigo-750 text-white text-xs font-black font-mono py-2 px-4 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer hover:scale-[1.02] border border-indigo-700"
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
                {['Todas', 'Passos - MG', 'Santa Cruz das Palmeiras', 'Belo Horizonte - MG'].map((city) => {
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

          {/* Master 2-Column Grid of Heatmap Matrix + Interactive Map */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* Left side: Sector Cards & Alarm status */}
            <div className="xl:col-span-7 space-y-4">
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

            {/* Right side: Real-time SVG map visualization in Admin session */}
            <div className="xl:col-span-5 h-full">
              <MapaDaCidade 
                clientes={clientes}
                ordens={ordens}
                motoboys={motoboys}
                selectedMotoboyIdForTracking={selectedMotoboyIdForTracking}
                setSelectedMotoboyIdForTracking={setSelectedMotoboyIdForTracking}
                activeSessionRole={effectiveRole}
                activeClienteUser={activeClienteUser}
                selectedQuadrant={selectedQuadrant}
                setSelectedQuadrant={setSelectedQuadrant}
                animationTick={animationTick}
              />
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
                    Passo C: Detalhamento das Peças (Opcional - Padrão: Peças Diversas)
                  </label>
                  <span className="text-[10px] text-orange-600 font-mono font-bold">Livre de Preenchimento ⚡</span>
                </div>
                
                <input
                  type="text"
                  value={itemTexto}
                  onChange={(e) => setItemTexto(e.target.value)}
                  placeholder="Deixe em branco para usar 'Peças Diversas' ou discrimine se desejar"
                  className="w-full bg-slate-50 text-slate-950 border border-slate-250 rounded-lg p-3 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                />

                {/* Autocomplete / Suggested Autopart Chips */}
                <div className="mt-2.5">
                  <span className="text-[11px] text-slate-400 block mb-1 font-mono uppercase">Sugestões Rápidas (Caso queira discriminar):</span>
                  <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto p-1 bg-slate-100 rounded border border-slate-200">
                    {/* Empty reset button option */}
                    <button
                      type="button"
                      onClick={() => setItemTexto('Peças Diversas')}
                      className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold py-1 px-2 rounded-md transition-colors cursor-pointer text-left font-mono"
                    >
                      🔄 Resetar para Peças Diversas
                    </button>
                    {AUTO_PECA_SUGESTOES.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setItemTexto(sug)}
                        className="text-[10px] bg-white text-slate-705 border border-slate-200 hover:border-orange-400 hover:bg-orange-50 py-1 px-2 rounded-md transition-colors cursor-pointer text-left truncate max-w-full font-mono"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-lg">
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

                {retornoPeca && (
                  <div className="flex items-center gap-1.5 self-end sm:self-auto font-mono text-xs text-slate-700 bg-white border border-slate-200 px-2 py-1 rounded">
                    <Coins className="w-3.5 h-3.5 text-orange-500" />
                    <span>Taxa Reversa: </span>
                    <input
                      type="number"
                      step="0.5"
                      min="5"
                      value={taxaReversaParam}
                      onChange={(e) => setTaxaReversaParam(parseFloat(e.target.value) || 15)}
                      className="w-16 bg-slate-50 py-0.5 px-1 border border-slate-200 rounded text-center text-xs font-bold font-mono focus:ring-1 focus:ring-orange-500 text-slate-800"
                    />
                  </div>
                )}
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
                <p className="text-xs text-slate-400">Classificação: as Distribuidoras (clientes da TorqueLog) vs Clientes (oficinas) delas</p>
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
                Nova Distribuidora (Cliente Torque)
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
                🏢 Distribuidoras ({clientes.filter(c => !c.criadoPorClienteId).length})
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
                placeholder={adminClientFilterTab === 'distributors' ? "Pesquisar distribuidora TorqueLog..." : adminClientFilterTab === 'subclients' ? "Pesquisar clientes / oficinas registradas..." : "Pesquisar distribuidora ou oficina..."}
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
                            setEditClientQuadrante(cli.quadrante);
                            setEditClientEndereco(cli.endereco);
                            setEditClientTelefone(cli.telefone);
                            setEditClientCidade(cli.cidade);
                            setEditClientEmail(cli.email || '');
                            setEditClientSenha(cli.senha || '');
                            setEditClientValorCobradoCliente(cli.valorCobradoCliente);
                            setEditClientValorPagoMotoboy(cli.valorPagoMotoboy);
                            setEditClientMotoboysAtivos(cli.motoboysAtivos || 0);
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
                          setEditMotoboySituacao(m.situacao || 'Ativo');
                          setEditMotoboyEmpresaExclusiva(m.empresaExclusiva || '');
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
                            R$ {((o.valorPagoMotoboy || 4.00) + (o.retornoPeca ? (o.taxaReversa || 15) : 0)).toFixed(2)}
                          </span>
                          <span className="text-[8px] text-slate-400 block font-mono">(Fixo da distribuidora)</span>
                        </div>
                      </div>

                      <div className="bg-white border text-[11px] p-2 rounded-lg text-slate-650 font-mono mb-3 space-y-1 border-slate-100">
                        <div><strong>📦 Peças:</strong> {o.itensDescricao}</div>
                        <div>
                          <strong>🛡️ Tipo de Contrato:</strong> B2B Avulso MEI (Sem subordinação ou jornada)
                        </div>
                        {o.retornoPeca && (
                          <div className="text-orange-600 font-bold flex items-center gap-1">
                            <span>🔄 Rota reversa inclusa para Distribuidora (+ R$ {o.taxaReversa?.toFixed(2)})</span>
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
      {effectiveRole === 'Empresa' && (
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

                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-bold text-slate-600 bg-slate-50 py-1.5 px-2.5 rounded-lg border border-slate-200">
                  <span>Total Geral (Entregue):</span>
                  <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px]">{ordens.filter(o => o.status === 'Entregue').length} OS</span>
                </div>
              </div>
            </div>

            {/* Main Interactive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT/TOP WIDGET: THE CALENDAR MODULE */}
              <div className="lg:col-span-5 bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4 shadow-inner">
                
                {/* Distributor Selection Filter */}
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 shadow-xs">
                  <label className="block text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    🏢 Filtrar por Distribuidora B2B
                  </label>
                  <select
                    value={calendarSelectedDistributorId}
                    onChange={(e) => setCalendarSelectedDistributorId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-250 text-slate-850 rounded-md p-1.5 text-xs font-bold focus:outline-none focus:border-orange-505 cursor-pointer"
                  >
                    <option value="Todas">📊 Todas as Distribuidoras (Geral)</option>
                    {clientes.filter(c => !c.criadoPorClienteId).map(dist => (
                      <option key={dist.id} value={dist.id}>
                        🏢 {dist.nome} ({dist.cidade})
                      </option>
                    ))}
                  </select>
                  {calendarSelectedDistributorId !== 'Todas' && (
                    <p className="text-[9.5px] text-orange-600 font-mono font-semibold">
                      ⚡ Exibindo apenas a base histórica para esta distribuidora.
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
                    
                    const fee = (o.valorCobradoCliente || 10.00) + (o.retornoPeca ? (o.taxaReversa || 15) : 0);
                    const rep = (o.valorPagoMotoboy || 4.00) + (o.retornoPeca ? (o.taxaReversa || 15) : 0);
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
                        <div className="mt-2 text-xs text-slate-600 bg-slate-50/60 p-2.5 rounded-lg border border-slate-105 font-mono leading-relaxed">
                          <strong>Itens Catalogados:</strong> {o.itensDescricao}
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
                    Balanço por Distribuidora & Emissão de Nota Fiscal (B2B)
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
                      <th className="p-3">🏢 Distribuidora</th>
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
          PORTAL PERSPECTIVE: MOTOBOY DASHBOARD
          ========================================== */}
      {effectiveRole === 'Motoboy' && (
        <main className="max-w-7xl mx-auto p-4 lg:p-6 flex flex-col gap-6 flex-1 w-full animate-fade-in" id="motoboy-main">
          {activeGpsOrder ? (
            <GpsNavigator 
              order={activeGpsOrder}
              client={clientes.find(c => c.id === activeGpsOrder.clienteId) || null}
              onBack={() => setActiveGpsOrder(null)}
              onDelivered={() => {
                setActiveSignOrder(activeGpsOrder);
                setActiveGpsOrder(null);
              }}
            />
          ) : (
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
                          handleAtualizarStatusOrdem(alertOrder.id, 'Moto a Caminho');
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
          <div className="lg:col-span-12 bg-slate-900 text-white rounded-2xl border border-slate-800 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-md shadow-orange-500/5">
            <div className="flex-1">
              <span className="text-xs bg-orange-550/20 text-orange-400 font-bold px-3 py-1 rounded-full uppercase tracking-widest font-mono">DASHBOARD DO ENTREGADOR</span>
              <h1 className="text-2xl font-black mt-2">Olá, {activeMotoboyUser?.nome}!</h1>
              <p className="text-xs text-slate-400 font-mono mt-1">Região de atuação contratual: Passos - MG • Tarifa Local: R$ {(activeMotoboyUser?.valorRepasseFixo || 4.00).toFixed(2)} por entrega</p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => handleAbrirRelatorio('Motoboy')}
                  className="bg-orange-500 hover:bg-orange-650 text-white text-xs font-black font-mono py-1.5 px-4 rounded-xl flex items-center gap-2 shadow transition-all cursor-pointer hover:scale-[1.02]"
                >
                  📊 CONFERÊNCIA & FECHAMENTO SEMANA/MÊS 🧾
                </button>
              </div>
            </div>
            
            {/* Daily vs Monthly freights details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <span className="block text-[9px] text-slate-400 uppercase tracking-wider mb-1">Entregas Diárias</span>
                <span className="text-2xl font-mono font-black text-orange-405">{motoboyStats.hojeCount}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <span className="block text-[9px] text-emerald-400 uppercase tracking-wider mb-1">Ganho Hoje</span>
                <span className="text-base font-black font-mono text-emerald-400">R$ {motoboyStats.hojeEarnings.toFixed(2)}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <span className="block text-[9px] text-slate-400 uppercase tracking-wider mb-1">Entregas do Mês</span>
                <span className="text-2xl font-black font-mono text-slate-300">{motoboyStats.mesCount}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <span className="block text-[9px] text-emerald-400 tracking-wider mb-1 uppercase">Ganho Mensal</span>
                <span className="text-base font-black font-mono text-emerald-400">R$ {motoboyStats.mesEarnings.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Left Panel: Available runs (Demandas na Rua) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <TorqueLogLogoIcon size={18} className="text-orange-500 animate-pulse" variant={logoVariant} />
                    Demandas Disponíveis na Região (Passos - MG)
                  </h2>
                  <p className="text-xs text-slate-400">Clique para aceitar uma corrida e realizar entrega expressa</p>
                </div>
                <span className="text-xs font-mono font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded">
                  {ordens.filter(o => o.status !== 'Entregue').length} disponíveis
                </span>
              </div>

              {/* List of orders */}
              <div className="space-y-4">
                {ordens.filter(o => o.status !== 'Entregue').length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                    <Check className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-mono">Nenhum frete disponível no momento.</p>
                    <p className="text-[10px] text-slate-400 mt-1">Novas ordens surgirão assim que os clientes despacharem pelo faturamento.</p>
                  </div>
                ) : (
                  ordens.filter(o => o.status !== 'Entregue').map(o => (
                    <div key={o.id} className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
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
                        </div>
                        
                        <div className="text-xs text-slate-750 font-mono space-y-0.5 leading-normal mt-1.5">
                          <p>🏢 <strong>Ponto de Retirada (Coleta):</strong> {o.clienteNome}</p>
                          <p>🎯 <strong>Ponto de Destino:</strong> <span className="text-orange-600 font-extrabold">{o.destinatarioNome || 'Oficina / Destinatário Final'}</span> • {o.enderecoEntrega || `Setor ${o.quadrante}`}</p>
                        </div>
                        
                        {o.retornoPeca && (
                          <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                            REVERSA: Coletar retorno de peça na entrega e devolver ao solicitante
                          </div>
                        )}

                      </div>

                      <div className="flex sm:flex-col items-stretch sm:items-end gap-2 shrink-0 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 mt-1 sm:mt-0">
                        {o.status !== 'Moto a Caminho' ? (
                          <button
                            onClick={() => handleAtualizarStatusOrdem(o.id, 'Moto a Caminho')}
                            className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-mono font-bold text-xs px-3 py-2 rounded-lg transition shadow shadow-orange-500/10 cursor-pointer flex items-center gap-1.5 w-full sm:w-auto text-center justify-center font-mono font-black"
                          >
                            <TorqueLogLogoIcon size={16} className="text-white animate-spin-slow" variant={logoVariant} />
                            Aceitar Corrida 🏍️
                          </button>
                        ) : (
                          <div className="flex flex-col gap-1.5 w-full">
                            <button
                              type="button"
                              onClick={() => setActiveGpsOrder(o)}
                              className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-mono font-bold text-xs px-3 py-2 rounded-lg transition shadow shadow-orange-500/10 cursor-pointer flex items-center gap-1.5 justify-center w-full grow font-black"
                            >
                              <Navigation className="w-3.5 h-3.5 animate-pulse" />
                              Seguir no GPS 🗺️
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
                        <button
                          type="button"
                          onClick={() => handleCancelarOrdem(o.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 font-mono text-[10px] font-bold py-1.5 px-2.5 rounded-lg active:scale-95 transition cursor-pointer w-full sm:w-auto text-center justify-center flex items-center gap-1"
                        >
                          ✕ Cancelar Entrega
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Motoboy delivery log history & fast-actions */}
          <div className="lg:col-span-4 space-y-6">
            {/* GPS Map for Motoboy tracking */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <h3 className="text-xs font-black text-slate-900 uppercase font-mono tracking-widest mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <TorqueLogLogoIcon size={18} className="text-orange-500 animate-[pulse_2s_infinite]" variant={logoVariant} />
                Seu GPS Setorial: Passos - MG
              </h3>
              <div className="h-56 rounded-lg overflow-hidden border border-slate-200">
                <MapaDaCidade 
                  clientes={clientes}
                  ordens={ordens}
                  motoboys={motoboys}
                  selectedMotoboyIdForTracking={activeMotoboyUser?.id || null}
                  setSelectedMotoboyIdForTracking={() => {}}
                  activeSessionRole={effectiveRole}
                  activeClienteUser={null}
                  selectedQuadrant={undefined}
                  animationTick={animationTick}
                />
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-2 leading-relaxed text-center">
                🔴 Suas coordenadas de satélite piscam em laranja. Dirija com cuidado!
              </p>
            </div>

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
          )}

        </main>
      )}

      {/* ==========================================
          PORTAL PERSPECTIVE: CLIENTE DASHBOARD
          ========================================== */}
      {effectiveRole === 'Cliente' && (
        <main className="max-w-7xl mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 w-full" id="cliente-main">
          
          {/* Welcome and client quick stats */}
          <div className="lg:col-span-12 bg-slate-900 text-white rounded-2xl border border-slate-800 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-md shadow-orange-500/5">
            <div>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 font-bold px-3 py-1 rounded-full uppercase tracking-widest font-mono">PORTAL DO CLIENTE B2B</span>
              <h1 className="text-2xl font-black mt-2">Olá, {activeClienteUser?.nome}!</h1>
              <p className="text-xs text-slate-400 font-mono mt-1">Sua agência de autopeças/oficina: Setor {activeClienteUser?.quadrante} • Endereço B2B: {activeClienteUser?.endereco} ({activeClienteUser?.cidade})</p>
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

          {/* Column A (lg:col-span-4) - Dispatch form */}
          <div className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between" id="portal-cliente-form-solicitacao">
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
                    const novoCli: Cliente = {
                      id: newId,
                      nome: quickClientNome,
                      quadrante: destinoQuadrante,
                      endereco: quickClientEndereco,
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
                      await syncClientesToFirebase(updatedClientes).catch(err => console.error("Erro Firebase:", err));
                    }
                    if (supabase) {
                      await syncClientesToSupabase(updatedClientes).catch(err => console.error("Erro Supabase:", err));
                    }

                    finalClienteId = newId;
                    setDestinoClienteId(newId);

                    setQuickClientNome('');
                    setQuickClientEndereco('');
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
                }

                const statusFinal = 'Buscando Parceiro';
                const novaOrdemId = `OS-${Math.floor(1000 + Math.random() * 9000)}`;
                const novaOrdem: OrdemServico = {
                  id: novaOrdemId,
                  clienteId: activeClienteUser.id,
                  clienteNome: activeClienteUser.nome,
                  quadrante: finalQuadrante,
                  itensDescricao: `Entrega expressa para: ${finalDestName}`,
                  itensAnalistas: [], // Empty since we do not need items/cubage logic
                  enderecoEntrega: finalEndereco,
                  destinatarioNome: finalDestName,
                  retornoPeca,
                  taxaReversa: retornoPeca ? 15 : undefined,
                  valorPagoMotoboy: activeClienteUser.valorPagoMotoboy || 4.00,
                  valorCobradoCliente: activeClienteUser.valorCobradoCliente || 10.00,
                  criadoEm: new Date().toISOString(),
                  status: statusFinal,
                  travaCubagemStatus: 'Liberado - Cabe no Baú',
                  tempoRestanteSweep: 15
                };

                const updatedList = [novaOrdem, ...ordens];
                setOrdens(updatedList);

                if (isFirebaseConfigured) {
                  try {
                    await syncOrdensToFirebase(updatedList);
                  } catch (err) {
                    console.error("Erro ao sincronizar nova ordem individual no Firebase:", err);
                  }
                }
                if (supabase) {
                  try {
                    await syncOrdensToSupabase(updatedList);
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
                setDestinoClienteId('');
                setRetornoPeca(false);
                setQuickClientNome('');
                setQuickClientEndereco('');
                setIsQuickRegisteringDestinatario(false);

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
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase font-mono">Endereço de Entrega</label>
                      <input
                        type="text"
                        required
                        value={destinoEndereco}
                        onChange={(e) => setDestinoEndereco(e.target.value)}
                        placeholder="Ex: Av. da Moda, 1040 - Centro, Passos - MG"
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
                              onClick={() => setIsQuickRegisteringDestinatario(true)}
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

                          <div>
                            <input
                              type="text"
                              required
                              value={quickClientEndereco}
                              onChange={(e) => setQuickClientEndereco(e.target.value)}
                              placeholder="Endereço (Rua, Número, Bairro)"
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
                                
                                const novoCli: Cliente = {
                                  id: newId,
                                  nome: quickClientNome,
                                  quadrante: destinoQuadrante,
                                  endereco: quickClientEndereco,
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
                                  await syncClientesToFirebase(updatedList).catch(err => console.error("Firebase Sync error:", err));
                                }
                                if (supabase) {
                                  await syncClientesToSupabase(updatedList).catch(err => console.error("Supabase Sync error:", err));
                                }

                                setDestinoClienteId(novoCli.id);

                                setQuickClientNome('');
                                setQuickClientEndereco('');
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2 font-mono">Sua Tarifa de Contrato B2B</label>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-150 flex justify-between text-[11px] font-mono">
                    <span>💵 Taxa Fixa Contratual</span>
                    <span className="font-extrabold text-slate-900">R$ {(activeClienteUser?.valorCobradoCliente || 10.00).toFixed(2)} por envio</span>
                  </div>
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

          {/* Column B (lg:col-span-4) - Registered Motoboys to track them */}
          <div className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between" id="portal-cliente-motoboys">
            <div>
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <TorqueLogLogoIcon size={18} className="text-emerald-600" variant={logoVariant} />
                  Motoboys Credenciados
                </h2>
                <p className="text-xs text-slate-450 font-mono">Clique no botão para seguir a rota de cada prestador em tempo real</p>
              </div>

              <div className="space-y-3 max-h-[290px] overflow-y-auto pr-1">
                {motoboys.map((mb, idx) => {
                  const isTracked = selectedMotoboyIdForTracking === mb.id;
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
                      className={`p-3 bg-slate-50 border rounded-xl flex items-center justify-between gap-2 transition duration-200 ${
                        isTracked ? 'border-orange-400 bg-orange-50/20 shadow-xs' : 'border-slate-150 hover:bg-slate-100/50'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-900 block font-mono leading-none">{mb.nome}</span>
                        <span className="text-[9px] text-slate-400 font-mono block">MEI Ativo • Passos</span>
                        <span className={`inline-block mt-0.5 text-[9px] font-mono px-1.5 py-0.2 rounded ${statusClass}`}>
                          {statusText}
                        </span>
                      </div>

                      <button
                        onClick={() => setSelectedMotoboyIdForTracking(isTracked ? null : mb.id)}
                        className={`text-[9px] font-mono font-bold py-1 px-2 rounded border uppercase transition cursor-pointer ${
                          isTracked
                            ? 'bg-orange-500 text-white border-orange-400'
                            : 'bg-white hover:bg-slate-100 border-slate-205 text-slate-700'
                        }`}
                      >
                        {isTracked ? 'Rastro 🛰️' : 'Seguindo'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 p-2.5 bg-emerald-50 border border-emerald-150 rounded-xl text-[10px] font-mono text-emerald-850 leading-relaxed">
              ⭐ <strong>Acompanhamento:</strong> Motoboys que estiverem listados como <strong>Sua Entrega</strong> estão trazendo sua mercadoria! Clique no botão para visualizá-los se movendo.
            </div>
          </div>

          {/* Column C (lg:col-span-4) - Interactive City Map representation for Customer */}
          <div className="lg:col-span-4 h-full">
            <MapaDaCidade 
              clientes={clientes}
              ordens={ordens}
              motoboys={motoboys}
              selectedMotoboyIdForTracking={selectedMotoboyIdForTracking}
              setSelectedMotoboyIdForTracking={setSelectedMotoboyIdForTracking}
              activeSessionRole={effectiveRole}
              activeClienteUser={activeClienteUser}
              selectedQuadrant={activeClienteUser?.quadrante} // highlights their own quadrant segment
              animationTick={animationTick}
            />
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
                            <button 
                              onClick={() => setSelectedMotoboyIdForTracking(o.motoboyId || null)}
                              className="bg-orange-500 hover:bg-orange-600 text-white font-mono text-[9px] font-black px-3 py-1 rounded transition uppercase tracking-wider cursor-pointer shadow-sm ml-0"
                            >
                              Rastrear Moto no Mapa 🧭
                            </button>
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

          {/* Row 3 (lg:col-span-12) - CUSTOMER'S OWN CLIENTS BASE DATABASE / SUB-CLIENTS */}
          <div className="lg:col-span-12 bg-white rounded-xl shadow-sm border border-slate-200 p-5" id="carteira-clientes-distribuidora">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3 mb-4">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Briefcase className="w-4 h-4 text-orange-500" />
                  Sua Carteira Privada de Clientes (Destinatários Cadastrados)
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
                className="bg-orange-500 text-white font-mono text-xs font-bold py-1.5 px-3 rounded-lg hover:bg-orange-600 flex items-center gap-1 cursor-pointer transition shadow-xs self-stretch sm:self-auto text-center justify-center"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
                Cadastrar Novo Cliente B2B (Oficina)
              </button>
            </div>

            {clientes.filter(c => c.criadoPorClienteId === activeClienteUser?.id).length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl space-y-2 bg-slate-50/50">
                <p className="text-xs text-slate-500 font-mono">Nenhum cliente/oficina destinatária cadastrada na sua base de dados ainda.</p>
                <p className="text-[10px] text-slate-450 font-mono">Use o botão acima ou o cadastro rápido no formulário de despacho para começar.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {clientes.filter(c => c.criadoPorClienteId === activeClienteUser?.id).map(c => (
                  <div key={c.id} className="p-3 bg-slate-50 border border-slate-150 rounded-lg flex flex-col justify-between hover:border-orange-200 hover:bg-slate-50/60 transition duration-155">
                    <div className="space-y-1">
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-xs font-bold text-slate-900 font-mono truncate max-w-[180px] block">{c.nome}</span>
                        <span className="text-[9px] font-mono bg-orange-100 text-orange-800 font-bold px-1.5 py-0.2 rounded shrink-0">
                          Setor {c.quadrante}
                        </span>
                      </div>
                      <span className="text-[9.5px] text-slate-400 font-mono block">Código: {c.id}</span>
                      <p className="text-[10.5px] text-slate-650 font-mono leading-relaxed line-clamp-2">📍 {c.endereco}</p>
                    </div>

                    <div className="border-t border-slate-100 mt-3 pt-2.5 flex items-center justify-between gap-2">
                      <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">
                        ✓ Banco Sincronizado
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
                        className="bg-white hover:bg-orange-500 hover:text-white text-orange-600 border border-orange-200 hover:border-orange-500 text-[10px] font-bold font-mono py-1 px-2.5 rounded-md transition cursor-pointer"
                      >
                        🚚 Selecionar p/ Entrega
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                <div><strong>Oficina Destinatária:</strong> {activeSignOrder.clienteNome}</div>
                <div><strong>Peças Entregues:</strong> {activeSignOrder.itensDescricao}</div>
                <div className="border-t border-slate-200 mt-2 pt-1.5 text-[11px]">
                  {effectiveRole === 'Motoboy' ? (
                    // Within courier / driver session: ONLY show the freight price (repasse)
                    <div className="flex justify-between items-center py-1 bg-amber-50 px-2 rounded border border-amber-100">
                      <span className="font-bold text-amber-800 font-mono">🏍️ VALOR DO FRETE (REPASSE ACORDADO):</span>
                      <span className="font-extrabold text-amber-955 text-xs font-mono">
                        R$ {((activeSignOrder.valorPagoMotoboy || 4.00) + (activeSignOrder.retornoPeca ? (activeSignOrder.taxaReversa || 15) : 0)).toFixed(2)}
                      </span>
                    </div>
                  ) : effectiveRole === 'Cliente' ? (
                    // Within distributor / client session: ONLY show their cost (Cobrança Cliente B2B), hide repasse entirely
                    <div className="flex justify-between items-center py-1 bg-emerald-50 px-2 rounded border border-emerald-100">
                      <span className="font-bold text-emerald-800 font-mono">💵 VALOR DO ENVIO (FABRIL B2B):</span>
                      <span className="font-extrabold text-emerald-955 text-xs font-mono">
                        R$ {((activeSignOrder.valorCobradoCliente || 10.00) + (activeSignOrder.retornoPeca ? (activeSignOrder.taxaReversa || 15) : 0)).toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    // Admin (Empresa) view: show the full breakdown
                    <>
                      <div className="flex justify-between">
                        <span>💵 Cobrança Cliente B2B:</span>
                        <span className="font-bold text-slate-800">R$ {((activeSignOrder.valorCobradoCliente || 10.00) + (activeSignOrder.retornoPeca ? (activeSignOrder.taxaReversa || 15) : 0)).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>🏍️ Repasse ao Motoboy:</span>
                        <span className="font-bold text-rose-600">R$ {((activeSignOrder.valorPagoMotoboy || 4.00) + (activeSignOrder.retornoPeca ? (activeSignOrder.taxaReversa || 15) : 0)).toFixed(2)}</span>
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
              const val = (ord.valorCobradoCliente || 10.00) + (ord.retornoPeca ? (ord.taxaReversa || 15) : 0);
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
                        const val = (ord.valorCobradoCliente || 10.00) + (ord.retornoPeca ? (ord.taxaReversa || 15) : 0);
                        return (
                          <div key={ord.id} className="p-2 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors">
                            <div className="space-y-0.5">
                              <span className="bg-slate-900 text-orange-450 px-1 font-bold rounded text-[8.5px] mr-1">{ord.id}</span>
                              <span className="text-slate-450">{new Date(ord.criadoEm).toLocaleDateString()}</span>
                              <span className="text-slate-500 block max-w-sm truncate text-[9px]">Oficina: {ord.destinatarioNome || 'Balcão/Peças'}</span>
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
                          const val = (ord.valorCobradoCliente || 10.00) + (ord.retornoPeca ? (ord.taxaReversa || 15) : 0);
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
                        window.print();
                      }}
                      className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold py-2 rounded-lg shadow font-mono text-center flex items-center justify-center gap-1.5 cursor-pointer text-xs transition-colors"
                    >
                      🖨️ Gravar em PDF
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
                          billed += (o.valorCobradoCliente || 10.00) + (o.retornoPeca ? (o.taxaReversa || 15.00) : 0);
                          owed += (o.valorPagoMotoboy || 4.00) + (o.retornoPeca ? (o.taxaReversa || 15.00) : 0);
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
                            ? ((o.valorCobradoCliente || 10.00) + (o.retornoPeca ? (o.taxaReversa || 15.00) : 0))
                            : ((o.valorPagoMotoboy || 4.00) + (o.retornoPeca ? (o.taxaReversa || 15.00) : 0));
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
                        window.print();
                      }}
                      className="bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-[11px] font-bold font-mono py-1.5 px-3 rounded-lg flex items-center gap-1.5 shadow transition-all cursor-pointer hover:scale-102 active:scale-98"
                    >
                      🖨️ Salvar como PDF / Imprimir
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
                  totalBilledToClients += (o.valorCobradoCliente || 10.00) + (o.retornoPeca ? (o.taxaReversa || 15.00) : 0);
                  totalOwedToMotoboys += (o.valorPagoMotoboy || 4.00) + (o.retornoPeca ? (o.taxaReversa || 15.00) : 0);
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
                              <th className="p-3">B2B Cliente / Oficina</th>
                              <th className="p-3">Entregador (Motoboy)</th>
                              <th className="p-3">Peças Descrição</th>
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
                                const b2bVal = (o.valorCobradoCliente || 10.00) + (o.retornoPeca ? (o.taxaReversa || 15.00) : 0);
                                const mbVal = (o.valorPagoMotoboy || 4.00) + (o.retornoPeca ? (o.taxaReversa || 15.00) : 0);
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
                  valorPagoMotoboy: 4.00,
                  valorCobradoCliente: 10.00,
                  senha: `cli-${randCode}`,
                  email: clientNewClientEmail,
                  emailConfirmado: true,
                  cadastroCompleto: true,
                  criadoPor: 'Cliente',
                  criadoPorClienteId: activeClienteUser?.id,
                  criadoEm: new Date().toISOString(),
                  motoboysAtivos: 0
                };

                // Sync with local state
                const updatedClientesList = [novoCli, ...clientes];
                setClientes(updatedClientesList);

                // Sync with Firebase Firestore if active
                if (isFirebaseConfigured) {
                  try {
                    await syncClientesToFirebase(updatedClientesList);
                  } catch (err) {
                    console.error("Erro ao sincronizar novo cliente com o Firebase:", err);
                  }
                }

                // Sync with Supabase if active
                if (supabase) {
                  try {
                    await syncClientesToSupabase(updatedClientesList);
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
                setClientNewClientCEP('');
                setClientNewClientEndereco('');
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
                  <input
                    type="text"
                    required
                    value={clientNewClientCEP}
                    onChange={(e) => handleCEPChange(e.target.value, 'clientNewClient')}
                    placeholder="Ex: 37900-124"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 font-mono"
                  />
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
                    placeholder="Ex: Rua Central, 45"
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
                    [Cadastro de Distribuidora]
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Sincronização Ativa Distribuidor & Entregador</span>
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
                    Nome da Distribuidora *
                  </label>
                  <input
                    type="text"
                    required
                    value={newClientNome}
                    onChange={(e) => setNewClientNome(e.target.value)}
                    placeholder="Ex: Distribuidora de Autopeças Passos"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                  />
                </div>

                {/* Region selector (Quadrante) removed for Admin, defaulted to A */}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono flex items-center justify-between">
                    <span>CEP (Opcional)</span>
                    {isFetchingNewClientCEP && (
                      <span className="text-emerald-500 animate-pulse text-[10px] font-mono leading-none">🔍 BUSCANDO CEP...</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={newClientCEP}
                    onChange={(e) => handleCEPChange(e.target.value, 'newClient')}
                    placeholder="Ex: 37900-124"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono">
                    Endereço Completo da Distribuidora *
                  </label>
                  <input
                    type="text"
                    required
                    value={newClientEndereco}
                    onChange={(e) => setNewClientEndereco(e.target.value)}
                    placeholder="Ex: Av. Juca Stockler, 1200 - Centro"
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
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] p-2.5 rounded-lg font-mono leading-relaxed">
                    ⚙️ <strong>Primeiro Acesso Automatizado:</strong> O cliente receberá um link de confirmação de cadastro e, ao acessar o aplicativo pela primeira vez, completará todos os dados da empresa (CNPJ, endereço, telefone) e cadastrará uma senha nova e segura de sua própria escolha para acessar o sistema.
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

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 uppercase mb-1 font-mono leading-tight">
                        Fixo Cobrado (Cliente)
                      </label>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        value={newClientValorCobradoCliente}
                        onChange={(e) => setNewClientValorCobradoCliente(parseFloat(e.target.value) || 0)}
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
                        value={newClientValorPagoMotoboy}
                        onChange={(e) => setNewClientValorPagoMotoboy(parseFloat(e.target.value) || 0)}
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
                      value={newClientMotoboysAtivos}
                      onChange={(e) => setNewClientMotoboysAtivos(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-orange-500 font-mono font-bold"
                    />
                  </div>

                  <div className="text-[10px] font-extrabold text-emerald-600 font-mono bg-emerald-50 p-2 rounded border border-emerald-100 flex justify-between">
                    <span>💵 MARGEM LIQUIDA:</span>
                    <span>R$ {(newClientValorCobradoCliente - newClientValorPagoMotoboy).toFixed(2)}</span>
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
              className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-tight">
                    [Editar Cliente: {clienteParaEditar.id}]
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Sincronização Ativa Distribuidor & Entregador</span>
                </div>
                <button
                  type="button"
                  onClick={() => setClienteParaEditar(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold py-1 px-2 rounded hover:bg-slate-100 cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

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

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 font-mono flex items-center justify-between">
                    <span>CEP</span>
                    {isFetchingEditClientCEP && (
                      <span className="text-emerald-500 animate-pulse text-[10px] font-mono leading-none font-bold">🔍 BUSCANDO CEP...</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={editClientCEP}
                    onChange={(e) => handleCEPChange(e.target.value, 'editClient')}
                    placeholder="Ex: 37900-124"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                  />
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

                  <div className="text-[10px] font-extrabold text-emerald-600 font-mono bg-emerald-50 p-2 rounded border border-emerald-100 flex justify-between">
                    <span>💵 MARGEM LIQUIDA:</span>
                    <span>R$ {(editClientValorCobradoCliente - editClientValorPagoMotoboy).toFixed(2)}</span>
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
                Confirmar Exclusão ⚠️
              </h3>
              <p className="text-xs text-slate-400 mb-6 font-sans text-center">
                Tem certeza que deseja excluir permanentemente o cadastro de{" "}
                <strong className="text-white font-mono break-all font-bold block mt-1.5 bg-slate-950 p-2 rounded border border-slate-850">
                  {deleteConfirmName || deleteConfirmId}
                </strong>
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

      {/* ==========================================
          MODAL: CLIENT FIRST ACCESS / ACTIVATION
          ========================================== */}
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
                    <div className="bg-orange-950/20 border border-orange-900/40 p-3 rounded-lg text-xs leading-normal font-mono mb-2">
                      <p className="text-orange-400 font-bold mb-1">📬 NOTIFICAÇÃO DO PROVEDOR (Simulação de E-mail)</p>
                      <p className="text-slate-300 text-[11px]">
                        Servidor TorqueLog gerou o token de segurança para {firstAccessEmail}:
                      </p>
                      <div className="mt-2 text-center bg-slate-950 p-2 rounded border border-orange-500">
                        <p className="text-[10px] text-slate-400">TorqueLog B2B Verification Token:</p>
                        <p className="text-sm font-black text-white tracking-widest">{correctFirstAccessCode}</p>
                      </div>
                    </div>

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
                          setFirstAccessError('Código de segurança incorreto. Verifique o simulador azul e tente novamente.');
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
                        <input
                          type="text"
                          required
                          placeholder="Ex: 37900-124"
                          value={firstAccessCEP}
                          onChange={(e) => handleCEPChange(e.target.value, 'firstAccess')}
                          className="w-full bg-slate-100/10 text-white placeholder-slate-600 border border-slate-800 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-orange-500"
                        />
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
                        placeholder="Ex: Rua das Flores, 123 - Centro"
                        value={firstAccessEndereco}
                        onChange={(e) => setFirstAccessEndereco(e.target.value)}
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
                  <div className="p-3 bg-red-950/40 border border-red-900/60 text-red-400 text-xs rounded-lg flex items-start gap-1.5 font-mono">
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

      {/* 📬 INTERACTIVE SIMULATED EMAIL INBOX (CENTRAL DE NOTIFICAÇÕES & TOKENS B2B) */}
      {activeSessionRole === 'Empresa' && (
        <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start transition-all" id="central-emails-simulados">
          {!showSimulatedInbox ? (
            <button
              type="button"
              onClick={() => setShowSimulatedInbox(true)}
              className="flex items-center gap-2 bg-slate-900 border border-orange-500 hover:border-orange-400 text-white font-mono font-bold text-[11px] uppercase tracking-wide px-3.5 py-2.5 rounded-2xl shadow-2xl transition hover:scale-105 active:scale-95 cursor-pointer relative"
            >
              <span className="absolute -top-1.5 -right-1.5 shrink-0 bg-orange-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 animate-bounce">
                {simulatedEmails.length}
              </span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
              <span>📬 Caixa de Entrada B2B</span>
            </button>
          ) : (
            <div className="bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl w-[350px] sm:w-[420px] max-h-[500px] flex flex-col overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-200">
              {/* Header */}
              <div className="bg-slate-950 border-b border-slate-800 p-3.5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-slate-950 rounded-full"></span>
                    <span className="text-lg">📬</span>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-white font-mono uppercase tracking-widest leading-none">SMTP Local Sandbox</h4>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5 leading-none">Visualização Geral de E-mails Enviados</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                    className="bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white px-2 py-1 text-[9px] font-mono border border-slate-800 rounded-lg cursor-pointer"
                    title="Esvaziar todos os e-mails"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSimulatedInbox(false)}
                    className="text-slate-400 hover:text-white font-mono text-[11px] font-black hover:bg-slate-850 w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer transition"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Email list or selected email details */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[380px] min-h-[220px]">
                {selectedSimulatedEmail ? (
                  // VIEW EMAIL DETAILS
                  <div className="space-y-3 font-mono text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedSimulatedEmail(null)}
                      className="text-orange-400 hover:text-orange-350 cursor-pointer flex items-center gap-1 font-bold mb-2 text-[10px]"
                    >
                      ← Voltar para Caixa de Entrada
                    </button>
                    <div className="bg-slate-950/80 border border-slate-850 p-2.5 rounded-xl space-y-1 text-slate-300">
                      <p><span className="text-slate-500">De:</span> <strong className="text-white">suporte@torquelog.com.br</strong></p>
                      <p><span className="text-slate-500">Para:</span> <strong className="text-emerald-400 select-all">{selectedSimulatedEmail.para}</strong></p>
                      <p><span className="text-slate-500">Data:</span> <strong className="text-slate-400">{selectedSimulatedEmail.data}</strong></p>
                      <p className="border-t border-slate-900 pt-1.5 mt-1.5"><span className="text-slate-500">Assunto:</span> <strong className="text-white">{selectedSimulatedEmail.assunto}</strong></p>
                    </div>
                    
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
                      {selectedSimulatedEmail.corpo}
                    </div>

                    {selectedSimulatedEmail.codigo && (
                      <div className="p-3 bg-slate-950 rounded-xl border border-orange-500/30 flex flex-col items-center gap-2">
                        <p className="text-[10px] text-slate-400 tracking-wider text-center">🔐 CHAVE DE ATIVAÇÃO IDENTIFICADA</p>
                        <strong className="text-base text-orange-400 select-all font-mono tracking-widest bg-slate-900 px-3 py-1 border border-orange-500/20 rounded-md">
                          {selectedSimulatedEmail.codigo}
                        </strong>
                        <div className="flex gap-2 w-full pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedSimulatedEmail.codigo);
                              setSupabaseSuccessMsg(`📋 Token ${selectedSimulatedEmail.codigo} copiado!`);
                              setTimeout(() => setSupabaseSuccessMsg(''), 3000);
                            }}
                            className="flex-1 text-center py-1.5 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-lg cursor-pointer font-mono text-[10px] border border-slate-700 active:scale-95 transition-all"
                          >
                            📋 Copiar Token
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const cod = selectedSimulatedEmail.codigo;
                              // Pre fill both types of confirmation inputs based on prefix/format
                              if (cod.startsWith('temp-')) {
                                // It is direct login temp senha, we copy it and show how to login!
                                navigator.clipboard.writeText(cod);
                                alert(`Seu token de Primeiro Acesso é ${cod} (copiado). Faça o login com o perfil "Cliente B2B", selecione seu nome e digite este token as senha!`);
                              } else {
                                // Put into active verification inputs
                                setSelfRegVerificationCode(cod);
                                setFirstAccessVerificationCode(cod);
                                setSupabaseSuccessMsg("⚡ Token pré-preenchido nos formulários!");
                                setTimeout(() => setSupabaseSuccessMsg(''), 3000);
                              }
                            }}
                            className="flex-1 text-center py-1.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold rounded-lg cursor-pointer font-mono text-[10px] shadow-sm transform transition-all"
                          >
                            ⚡ Usar Automático
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // LIST DISPATCHED EMAILS
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-455 uppercase font-mono tracking-wider pl-1 font-bold">Mensagens Recebidas ({simulatedEmails.length})</p>
                    
                    {simulatedEmails.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 italic font-mono text-[11px]">
                        Nenhum e-mail transitando no momento.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {simulatedEmails.map((eml) => (
                          <div
                            key={eml.id}
                            onClick={() => {
                              setSelectedSimulatedEmail(eml);
                              eml.lido = true;
                            }}
                            className={`p-3 rounded-xl border border-slate-850 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/90 transition-all cursor-pointer group text-left ${!eml.lido ? 'border-l-4 border-l-orange-500' : ''}`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] text-emerald-400 font-mono font-bold truncate max-w-[200px]">
                                Para: {eml.para}
                              </span>
                              <span className="text-[9px] text-slate-505 font-mono font-medium shrink-0">
                                {eml.data}
                              </span>
                            </div>
                            <h5 className="text-[11px] font-bold text-white group-hover:text-orange-400 mt-1 truncate font-sans">
                              {eml.assunto}
                            </h5>
                            <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                              {eml.corpo.replace(/\n/g, ' ')}
                            </p>
                            {eml.codigo && (
                              <span className="inline-block mt-2 font-mono text-[9px] bg-slate-900 border border-slate-800 text-orange-400 px-1.5 py-0.5 rounded-md font-bold">
                                Código: {eml.codigo}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="pt-2 border-t border-slate-800 mt-2 text-[10px] leading-relaxed text-slate-500 font-mono">
                      💡 <strong>Testando Fluxo:</strong> Registre um cliente novo no painel Administrador. O e-mail de Primeiro Acesso chegará aqui imediatamente!
                    </div>
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div className="bg-slate-950/80 border-t border-slate-850 px-3 py-2 flex items-center justify-between text-[9px] text-slate-500 font-mono">
                <span>Sessão: Ativa e Conectada</span>
                <span className="text-slate-400 hover:text-white transition cursor-pointer" onClick={() => setSelectedSimulatedEmail(null)}>Voltar</span>
              </div>
            </div>
          )}
        </div>
      )}

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

    </div>
  );

  // Helper inside standard React state modifiers because of input controls
  function setFormCheckbox(val: boolean) {
    setRetornoPeca(val);
  }
}

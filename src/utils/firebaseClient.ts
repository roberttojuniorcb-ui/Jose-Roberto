// Firebase Client Wrapper for TorqueLog Integration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc,
  getDocs,
  collection,
  writeBatch,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom Database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

// Initialize Auth
export const auth = getAuth();

// Verification is active
export const isFirebaseConfigured = !!(firebaseConfig.projectId && firebaseConfig.apiKey);

// Validate Connection as mandated
async function testConnection() {
  if (!isFirebaseConfigured) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or network.");
    }
  }
}
testConnection();

// --- Error Handling as required by the Eight Pillars ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error Details: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- SYNCHRONIZATION AND CRUD HELPERS ---

/**
 * Bulk writes/updates active Clientes in Firebase Firestore
 */
export async function syncClientesToFirebase(clientes: any[]) {
  if (!isFirebaseConfigured) return null;
  try {
    const batch = writeBatch(db);
    clientes.forEach(c => {
      const docRef = doc(db, 'clientes', c.id);
      const payload = {
        id: c.id,
        nome: c.nome,
        quadrante: c.quadrante,
        endereco: c.endereco,
        telefone: c.telefone,
        cidade: c.cidade,
        valorPagoMotoboy: Number(c.valorPagoMotoboy),
        valorCobradoCliente: Number(c.valorCobradoCliente),
        senha: c.senha || 'cliente123',
        email: c.email || null,
        emailConfirmado: c.emailConfirmado || false,
        cadastroCompleto: c.cadastroCompleto || false,
        cnpj: c.cnpj || null,
        inscricaoEstadual: c.inscricaoEstadual || null,
        criadoPor: c.criadoPor,
        criadoEm: c.criadoEm
      };
      batch.set(docRef, payload, { merge: true });
    });
    await batch.commit();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'clientes');
    return null;
  }
}

/**
 * Deletes a Cliente from Firebase Firestore
 */
export async function deleteClienteFromFirebase(clientId: string) {
  if (!isFirebaseConfigured) return null;
  try {
    const docRef = doc(db, 'clientes', clientId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `clientes/${clientId}`);
    return null;
  }
}

/**
 * Deletes a Motoboy from Firebase Firestore
 */
export async function deleteMotoboyFromFirebase(motoboyId: string) {
  if (!isFirebaseConfigured) return null;
  try {
    const docRef = doc(db, 'motoboys', motoboyId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `motoboys/${motoboyId}`);
    return null;
  }
}

/**
 * Bulk writes/updates Ordens de Serviço in Firebase Firestore
 */
export async function syncOrdensToFirebase(ordens: any[]) {
  if (!isFirebaseConfigured) return null;
  try {
    const batch = writeBatch(db);
    ordens.forEach(o => {
      const docRef = doc(db, 'ordens_servico', o.id);
      const payload = {
        id: o.id,
        clienteId: o.clienteId,
        clienteNome: o.clienteNome,
        quadrante: o.quadrante,
        itensDescricao: o.itensDescricao,
        itensAnalistas: o.itensAnalistas || [],
        enderecoEntrega: o.enderecoEntrega || null,
        destinatarioNome: o.destinatarioNome || null,
        retornoPeca: o.retornoPeca || false,
        taxaReversa: Number(o.taxaReversa || 0),
        valorPagoMotoboy: Number(o.valorPagoMotoboy),
        valorCobradoCliente: Number(o.valorCobradoCliente),
        motoboyId: o.motoboyId || null,
        motoboyNome: o.motoboyNome || null,
        status: o.status,
        grupoRotaId: o.grupoRotaId || null,
        motivoDesmembramento: o.motivoDesmembramento || null,
        travaCubagemStatus: o.travaCubagemStatus || 'Liberado - Cabe no Baú',
        criadoEm: o.criadoEm
      };
      batch.set(docRef, payload, { merge: true });
    });
    await batch.commit();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'ordens_servico');
    return null;
  }
}

/**
 * Deletes an Ordem de Serviço from Firebase Firestore
 */
export async function deleteOrdemFromFirebase(ordemId: string) {
  if (!isFirebaseConfigured) return null;
  try {
    const docRef = doc(db, 'ordens_servico', ordemId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `ordens_servico/${ordemId}`);
    return null;
  }
}

/**
 * Bulk writes/updates Motoboys in Firebase Firestore
 */
export async function syncMotoboysToFirebase(motoboys: any[]) {
  if (!isFirebaseConfigured) return null;
  try {
    const batch = writeBatch(db);
    motoboys.forEach(m => {
      const docRef = doc(db, 'motoboys', m.id);
      const payload = {
        id: m.id,
        nome: m.nome,
        telefone: m.telefone,
        cidade: m.cidade,
        senha: m.senha,
        valorRepasseFixo: Number(m.valorRepasseFixo),
        criadoEm: m.criadoEm
      };
      batch.set(docRef, payload, { merge: true });
    });
    await batch.commit();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'motoboys');
    return null;
  }
}

/**
 * Bulk writes/updates Rotas Agrupadas in Firebase Firestore
 */
export async function syncRotasToFirebase(rotas: any[]) {
  if (!isFirebaseConfigured) return null;
  try {
    const batch = writeBatch(db);
    rotas.forEach(r => {
      const docRef = doc(db, 'rotas_agrupadas', r.id);
      const payload = {
        id: r.id,
        quadrante: r.quadrante,
        ordensIds: r.ordensIds || [],
        status: r.status,
        itensAgrupados: r.itensAgrupados || [],
        motociclistaAtribuido: r.motociclistaAtribuido || null,
        criadoEm: r.criadoEm
      };
      batch.set(docRef, payload, { merge: true });
    });
    await batch.commit();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'rotas_agrupadas');
    return null;
  }
}

/**
 * Pulls all data from Firebase Firestore to initialize local state
 */
export async function loadInitialDataFromFirebase() {
  if (!isFirebaseConfigured) return null;
  try {
    const clientesSnapshot = await getDocs(collection(db, 'clientes'));
    const ordensSnapshot = await getDocs(collection(db, 'ordens_servico'));
    const motoboysSnapshot = await getDocs(collection(db, 'motoboys'));
    const rotasSnapshot = await getDocs(collection(db, 'rotas_agrupadas'));

    const clientes: any[] = [];
    clientesSnapshot.forEach(doc => {
      clientes.push(doc.data());
    });

    const ordens: any[] = [];
    ordensSnapshot.forEach(doc => {
      ordens.push(doc.data());
    });

    const motoboys: any[] = [];
    motoboysSnapshot.forEach(doc => {
      motoboys.push(doc.data());
    });

    const rotas: any[] = [];
    rotasSnapshot.forEach(doc => {
      rotas.push(doc.data());
    });

    return {
      clientes: clientes.length ? clientes : null,
      ordens: ordens.length ? ordens : null,
      motoboys: motoboys.length ? motoboys : null,
      rotas: rotas.length ? rotas : null
    };
  } catch (err) {
    console.error("Could not load initial data from Firebase:", err);
    return null;
  }
}

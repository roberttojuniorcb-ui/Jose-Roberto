// Supabase Client Wrapper for TorqueLog Integration
import { createClient } from '@supabase/supabase-js';

// Retrieve values from Vite meta env safely
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Check if credentials exist and are not empty placeholders
export const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseUrl.trim() !== "" && 
  (supabaseUrl.startsWith("http://") || supabaseUrl.startsWith("https://")) &&
  !supabaseUrl.includes("MY_SUPABASE") &&
  supabaseAnonKey && 
  supabaseAnonKey.trim() !== "" && 
  !supabaseAnonKey.includes("MY_ANON")
);

// Initialize Supabase Client if configured
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!isSupabaseConfigured) {
  console.warn(
    "⚠️ Supabase is not fully configured yet. Dynamic state is successfully running on robust localStorage / memory fallback! " +
    "To link your cloud database, configure 'VITE_SUPABASE_URL' and 'VITE_SUPABASE_ANON_KEY' in your environments / secrets."
  );
}

// Helpers for data synchronization if active database connection exists
export async function syncClientesToSupabase(clientes: any[]) {
  if (!supabase) return null;
  try {
    // Map standard typescript fields to snake_case schema of postgres migration standard
    const payload = clientes.map(c => ({
      id: c.id,
      nome: c.nome,
      quadrante: c.quadrante,
      endereco: c.endereco,
      telefone: c.telefone,
      cidade: c.cidade,
      valor_pago_motoboy: c.valorPagoMotoboy,
      valor_cobrado_cliente: c.valorCobradoCliente,
      senha: c.senha || 'cliente123',
      email: c.email || null,
      email_confirmado: c.emailConfirmado || false,
      cadastro_completo: c.cadastroCompleto || false,
      cnpj: c.cnpj || null,
      inscricao_estadual: c.inscricaoEstadual || null,
      criado_por: c.criadoPor,
      criado_em: c.criadoEm
    }));

    const { data, error } = await supabase
      .from('clientes')
      .upsert(payload, { onConflict: 'id' });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Failed to sync Clientes to Supabase:", err);
    return null;
  }
}

export async function syncOrdensToSupabase(ordens: any[]) {
  if (!supabase) return null;
  try {
    const payload = ordens.map(o => ({
      id: o.id,
      cliente_id: o.clienteId,
      cliente_nome: o.clienteNome,
      quadrante: o.quadrante,
      itens_descricao: o.itensDescricao,
      itens_analistas: JSON.stringify(o.itensAnalistas || []),
      endereco_entrega: o.enderecoEntrega || null,
      destinatario_nome: o.destinatarioNome || null,
      retorno_peca: o.retornoPeca || false,
      taxa_reversa: o.taxaReversa || 0.0,
      valor_pago_motoboy: o.valorPagoMotoboy,
      valor_cobrado_cliente: o.valorCobradoCliente,
      motoboy_id: o.motoboyId || null,
      motoboy_nome: o.motoboyNome || null,
      status: o.status,
      grupo_rota_id: o.grupoRotaId || null,
      motivo_desmembramento: o.motivoDesmembramento || null,
      trava_cubagem_status: o.travaCubagemStatus || 'Liberado - Cabe no Baú',
      criado_em: o.criadoEm
    }));

    const { data, error } = await supabase
      .from('ordens_servico')
      .upsert(payload, { onConflict: 'id' });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Failed to sync Ordens de Serviço to Supabase:", err);
    return null;
  }
}

export async function syncMotoboysToSupabase(motoboys: any[]) {
  if (!supabase) return null;
  try {
    const payload = motoboys.map(m => ({
      id: m.id,
      nome: m.nome,
      telefone: m.telefone,
      cidade: m.cidade,
      senha: m.senha,
      valor_repasse_fixo: m.valorRepasseFixo,
      criado_em: m.criadoEm
    }));

    const { data, error } = await supabase
      .from('motoboys')
      .upsert(payload, { onConflict: 'id' });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Failed to sync Motoboys to Supabase:", err);
    return null;
  }
}

export async function syncRotasToSupabase(rotas: any[]) {
  if (!supabase) return null;
  try {
    const payload = rotas.map(r => ({
      id: r.id,
      quadrante: r.quadrante,
      ordens_ids: r.ordensIds,
      status: r.status,
      itens_agrupados: r.itensAgrupados,
      motociclista_atribuido: r.motociclistaAtribuido || null,
      criado_em: r.criadoEm
    }));

    const { data, error } = await supabase
      .from('rotas_agrupadas')
      .upsert(payload, { onConflict: 'id' });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Failed to sync Rotas Agrupadas to Supabase:", err);
    return null;
  }
}

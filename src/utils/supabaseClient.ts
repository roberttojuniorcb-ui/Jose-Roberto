import { createClient } from '@supabase/supabase-js';
import { Cliente, OrdemServico, Motoboy } from '../types';

const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

const isValidSupabaseUrl = (url: string) => {
  try {
    return url.startsWith('http://') || url.startsWith('https://');
  } catch (e) {
    return false;
  }
};

export const supabase = supabaseUrl && supabaseAnonKey && isValidSupabaseUrl(supabaseUrl) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
export const isSupabaseConfigured = !!supabase;

export const syncClientesToSupabase = async (clientes: Cliente[]): Promise<void> => {
  if (!supabase) return;
  try {
    const mapped = clientes.map(c => ({
      id: c.id,
      nome: c.nome,
      quadrante: c.quadrante,
      endereco: c.endereco || 'Pendente - Preencher no 1º Acesso',
      telefone: c.telefone || 'Pendente - Preencher no 1º Acesso',
      cidade: c.cidade || 'Passos - MG',
      valor_pago_motoboy: Number(c.valorPagoMotoboy) || 4.00,
      valor_cobrado_cliente: Number(c.valorCobradoCliente) || 10.00,
      senha: c.senha || 'cliente123',
      email: c.email || null,
      email_confirmado: typeof c.emailConfirmado === 'boolean' ? c.emailConfirmado : false,
      cadastro_completo: typeof c.cadastroCompleto === 'boolean' ? c.cadastroCompleto : false,
      cnpj: c.cnpj || null,
      inscricao_estadual: c.inscricaoEstadual || null,
      criado_por: c.criadoPor === 'Entregador' ? 'Entregador' : 'Empresa',
      criado_em: c.criadoEm || new Date().toISOString()
    }));

    const { error } = await supabase.from('clientes').upsert(mapped, { onConflict: 'id' });
    if (error) {
      console.error("Err in syncClientesToSupabase:", error.message, error.details);
    }
  } catch (err) {
    console.error("Sync error:", err);
  }
};

export const syncOrdensToSupabase = async (ordens: OrdemServico[]): Promise<void> => {
  if (!supabase) return;
  try {
    const mapped = ordens.map(o => ({
      id: o.id,
      cliente_id: o.clienteId,
      cliente_nome: o.clienteNome,
      quadrante: o.quadrante,
      itens_descricao: o.itensDescricao,
      itens_analistas: o.itensAnalistas || [],
      endereco_entrega: o.enderecoEntrega || null,
      destinatario_nome: o.destinatarioNome || null,
      retorno_peca: !!o.retornoPeca,
      taxa_reversa: Number(o.taxaReversa) || 0.00,
      valor_pago_motoboy: Number(o.valorPagoMotoboy) || 4.00,
      valor_cobrado_cliente: Number(o.valorCobradoCliente) || 10.00,
      motoboy_id: o.motoboyId || null,
      motoboy_nome: o.motoboyNome || null,
      status: o.status,
      grupo_rota_id: o.grupoRotaId || null,
      motivo_desmembramento: o.motivoDesmembramento || null,
      trava_cubagem_status: o.travaCubagemStatus || 'Liberado - Cabe no Baú',
      distancia_km: o.distanciaKm !== undefined ? Number(o.distanciaKm) : null,
      tipo_entrega: o.tipoEntrega || 'local',
      tipo_entregador_pedido: o.tipoEntregadorPedido || 'freelancer',
      fatura_parceira_paga: !!o.faturaParceiraPaga,
      cidade: o.cidade || null,
      criado_em: o.criadoEm || new Date().toISOString()
    }));

    const { error } = await supabase.from('ordens_servico').upsert(mapped, { onConflict: 'id' });
    if (error) {
      console.error("Err in syncOrdensToSupabase:", error.message, error.details);
    }
  } catch (err) {
    console.error("Sync error:", err);
  }
};

export const syncMotoboysToSupabase = async (motoboys: Motoboy[]): Promise<void> => {
  if (!supabase) return;
  try {
    const mapped = motoboys.map(m => ({
      id: m.id,
      nome: m.nome,
      telefone: m.telefone,
      cidade: m.cidade || 'Passos - MG',
      senha: m.senha || 'passos123',
      valor_repasse_fixo: Number(m.valorRepasseFixo) || 4.00,
      criado_em: m.criadoEm || new Date().toISOString()
    }));

    const { error } = await supabase.from('motoboys').upsert(mapped, { onConflict: 'id' });
    if (error) {
      console.error("Err in syncMotoboysToSupabase:", error.message, error.details);
    }
  } catch (err) {
    console.error("Sync error:", err);
  }
};

export const syncRotasToSupabase = async (rotas: any[]): Promise<void> => {
  if (!supabase) return;
  try {
    const mapped = rotas.map(r => ({
      id: r.id,
      quadrante: r.quadrante,
      ordens_ids: r.ordensIds || [],
      status: r.status || 'Buscando Parceiro',
      itens_agrupados: r.itensAgrupados || [],
      motociclista_atribuido: r.motociclistaAtribuido || null,
      criado_em: r.criadoEm || new Date().toISOString()
    }));

    const { error } = await supabase.from('rotas_agrupadas').upsert(mapped, { onConflict: 'id' });
    if (error) {
      console.error("Err in syncRotasToSupabase:", error.message);
    }
  } catch (err) {
    console.error("Sync error:", err);
  }
};

export const deleteOrdemFromSupabase = async (ordemId: string): Promise<void> => {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('ordens_servico').delete().eq('id', ordemId);
    if (error) {
      console.error("Err in deleteOrdemFromSupabase:", error.message);
    }
  } catch (err) {
    console.error("Sync error:", err);
  }
};


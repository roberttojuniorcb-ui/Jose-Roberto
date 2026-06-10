import { Cliente, OrdemServico, Motoboy } from '../types';

// Mild mock of Supabase to prevent compilation issues when deleted or disabled.
export const supabase = null;
export const isSupabaseConfigured = false;

export const syncClientesToSupabase = async (clientes: Cliente[]): Promise<void> => {};
export const syncOrdensToSupabase = async (ordens: OrdemServico[]): Promise<void> => {};
export const syncMotoboysToSupabase = async (motoboys: Motoboy[]): Promise<void> => {};
export const syncRotasToSupabase = async (rotas: any[]): Promise<void> => {};
export const deleteOrdemFromSupabase = async (ordemId: string): Promise<void> => {};

// services/queries.ts

import { Transaction, Strategy, Profile } from '../types'

// 1. Obtener el perfil del usuario actual
export async function getUserProfile(supabase: any, userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
    
  if (error) {
    console.error("Error cargando perfil:", error.message)
    return null
  }
  return data
}

// 2. Obtener todas las transacciones
export async function getTransactions(supabase: any): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, strategies(name)') // <-- Hacemos el JOIN explícito aquí
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    
  if (error) throw new Error(error.message)
  return data || []
}

// 3. Obtener las estrategias activas
export async function getActiveStrategies(supabase: any): Promise<Strategy[]> {
  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .eq('is_active', true)
    .order('name')
    
  if (error) throw new Error(error.message)
  return data || []
}

// 4. Actualizar un solo campo de una transacción
export async function updateTransactionField(supabase: any, id: string, field: string, value: any): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ [field]: value })
    .eq('id', id)
    
  if (error) throw new Error(error.message)
}

// 5. Borrar transacciones masivamente
export async function deleteTransactions(supabase: any, ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .in('id', ids)
    
  if (error) throw new Error(error.message)
}

export const getPositions = async (supabase: any) => {
  const { data, error } = await supabase
    .from('positions')
    .select('*') // <-- QUITA EL JOIN DE AQUÍ
    .order('symbol', { ascending: true });
  if (error) throw error;
  return data || [];
}
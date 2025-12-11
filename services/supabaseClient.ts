import { createClient } from '@supabase/supabase-js';
import { Preset, AppSettings } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create Supabase client (will be null if env vars not set)
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Get current user ID (requires authentication)
export async function getUserId(): Promise<string | null> {
  if (!supabase) return null;
  
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

// ============ PRESETS ============

export async function fetchPresets(): Promise<Preset[]> {
  if (!supabase) return [];
  
  const userId = await getUserId();
  if (!userId) return [];
  
  const { data, error } = await supabase
    .from('presets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching presets:', error);
    return [];
  }
  
  return data.map(row => ({
    id: row.id,
    name: row.name,
    systemPrompt: row.system_prompt,
    speed: row.speed,
    temperature: row.temperature,
    voice: row.voice,
    model: row.model,
  }));
}

export async function savePreset(preset: Preset): Promise<boolean> {
  if (!supabase) return false;
  
  const userId = await getUserId();
  if (!userId) return false;
  
  const { error } = await supabase
    .from('presets')
    .upsert({
      id: preset.id,
      user_id: userId,
      name: preset.name,
      system_prompt: preset.systemPrompt,
      speed: preset.speed,
      temperature: preset.temperature,
      voice: preset.voice,
      model: preset.model,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  
  if (error) {
    console.error('Error saving preset:', error);
    return false;
  }
  
  return true;
}

export async function deletePresetFromDb(presetId: string): Promise<boolean> {
  if (!supabase) return false;
  
  const { error } = await supabase
    .from('presets')
    .delete()
    .eq('id', presetId);
  
  if (error) {
    console.error('Error deleting preset:', error);
    return false;
  }
  
  return true;
}

// ============ SETTINGS ============

export async function fetchSettings(): Promise<AppSettings | null> {
  if (!supabase) return null;
  
  const userId = await getUserId();
  if (!userId) return null;
  
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) {
    if (error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching settings:', error);
    }
    return null;
  }
  
  return {
    chunkSize: data.chunk_size,
    mergeOutput: data.merge_output,
    apiKey: data.api_key || undefined,
  };
}

export async function saveSettings(settings: AppSettings): Promise<boolean> {
  if (!supabase) return false;
  
  const userId = await getUserId();
  if (!userId) return false;
  
  const { error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: userId,
      chunk_size: settings.chunkSize,
      merge_output: settings.mergeOutput,
      api_key: settings.apiKey || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  
  if (error) {
    console.error('Error saving settings:', error);
    return false;
  }
  
  return true;
}

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

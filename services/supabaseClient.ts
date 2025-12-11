import { createClient } from '@supabase/supabase-js';
import { Preset, AppSettings } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create Supabase client (will be null if env vars not set)
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Device ID for anonymous users (stored in localStorage)
const DEVICE_ID_KEY = 'voxforge_device_id';

export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

// ============ PRESETS ============

export async function fetchPresets(): Promise<Preset[]> {
  if (!supabase) return [];
  
  const deviceId = getDeviceId();
  
  const { data, error } = await supabase
    .from('presets')
    .select('*')
    .eq('device_id', deviceId)
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
  
  const deviceId = getDeviceId();
  
  const { error } = await supabase
    .from('presets')
    .upsert({
      id: preset.id,
      device_id: deviceId,
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
  
  const deviceId = getDeviceId();
  
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('device_id', deviceId)
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
  
  const deviceId = getDeviceId();
  
  const { error } = await supabase
    .from('user_settings')
    .upsert({
      device_id: deviceId,
      chunk_size: settings.chunkSize,
      merge_output: settings.mergeOutput,
      api_key: settings.apiKey || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'device_id' });
  
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

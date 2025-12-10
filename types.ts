export enum VoiceName {
  // Row 1
  Zephyr = 'Zephyr',       // Bright
  Puck = 'Puck',           // Upbeat
  Charon = 'Charon',       // Informative
  // Row 2
  Kore = 'Kore',           // Firm
  Fenrir = 'Fenrir',       // Excitable
  Leda = 'Leda',           // Youthful
  // Row 3
  Orus = 'Orus',           // Firm
  Aoede = 'Aoede',         // Breezy
  Callirrhoe = 'Callirrhoe', // Casual
  // Row 4
  Autonoe = 'Autonoe',     // Bright
  Enceladus = 'Enceladus', // Breathy
  Iapetus = 'Iapetus',     // Clear
  // Row 5
  Umbriel = 'Umbriel',     // Casual
  Algieba = 'Algieba',     // Smooth
  Despina = 'Despina',     // Smooth
  // Row 6
  Erinome = 'Erinome',     // Clear
  Algenib = 'Algenib',     // Gravelly
  Rasalgethi = 'Rasalgethi', // Informative
  // Row 7
  Laomedeia = 'Laomedeia', // Upbeat
  Achernar = 'Achernar',   // Soft
  Alnilam = 'Alnilam',     // Firm
  // Row 8
  Schedar = 'Schedar',     // Even
  Gacrux = 'Gacrux',       // Mature
  Pulcherrima = 'Pulcherrima', // Forward
  // Row 9
  Achird = 'Achird',       // Friendly
  Zubenelgenubi = 'Zubenelgenubi', // Casual
  Vindemiatrix = 'Vindemiatrix', // Gentle
  // Row 10
  Sadachbia = 'Sadachbia', // Lively
  Sadaltager = 'Sadaltager', // Knowledgeable
  Sulafat = 'Sulafat',     // Warm
}

export enum SpeedSetting {
  Slow = 'Slow',
  Normal = 'Normal',
  Fast = 'Fast'
}

export interface AppSettings {
  chunkSize: number;
  mergeOutput: boolean;
  apiKey?: string; // Optional user override, though process.env is primary
}

export interface Preset {
  id: string;
  name: string;
  systemPrompt: string;
  speed: SpeedSetting;
  temperature: number;
  voice: VoiceName;
  model: string;
}

export interface AudioChunk {
  id: number;
  text: string;
  blob: Blob | null;
  status: 'pending' | 'generating' | 'completed' | 'error';
  error?: string;
  duration?: number;
}

export const DEFAULT_SYSTEM_PROMPT = "You are a professional narrator. Read the following text clearly and naturally.";

export const DEFAULT_PRESET: Preset = {
  id: 'default',
  name: 'Default Narrator',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  speed: SpeedSetting.Normal,
  temperature: 0.7,
  voice: VoiceName.Kore,
  model: 'gemini-2.5-flash-preview-tts'
};

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Settings, Play, Download, Mic2, FileAudio,
  Trash2, Plus, Save, Disc, Loader2, Volume2,
  ChevronRight, Activity, AlertCircle
} from 'lucide-react';

import { GeminiService } from './services/geminiService';
import SettingsModal from './components/SettingsModal';
import { createWavBlob, mergeBuffers } from './utils/audioUtils';
import {
  AppSettings, Preset, VoiceName, SpeedSetting,
  AudioChunk, DEFAULT_PRESET, DEFAULT_SYSTEM_PROMPT
} from './types';

// Constants
const STORAGE_KEY_PRESETS = 'gemini_voxforge_presets';
const STORAGE_KEY_SETTINGS = 'gemini_voxforge_settings';

const App: React.FC = () => {
  // Services
  const geminiServiceRef = useRef<GeminiService>(new GeminiService());

  // State: Configuration
  const [settings, setSettings] = useState<AppSettings>({
    chunkSize: 3000,
    mergeOutput: true,
    apiKey: ''
  });

  const [presets, setPresets] = useState<Preset[]>([DEFAULT_PRESET]);
  const [currentPreset, setCurrentPreset] = useState<Preset>(DEFAULT_PRESET);
  const [presetNameInput, setPresetNameInput] = useState('');

  // State: Inputs
  const [inputText, setInputText] = useState('');

  // State: Processing
  const [isGenerating, setIsGenerating] = useState(false);
  const [chunks, setChunks] = useState<AudioChunk[]>([]);
  const [progress, setProgress] = useState(0);

  // State: UI
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [playingChunkId, setPlayingChunkId] = useState<number | null>(null);

  // Audio Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Initialization ---
  useEffect(() => {
    // Load persisted data
    const savedPresets = localStorage.getItem(STORAGE_KEY_PRESETS);
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
      } catch (e) {
        console.error("Failed to load presets", e);
      }
    }

    const savedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
        if (parsed.apiKey) {
          geminiServiceRef.current.updateApiKey(parsed.apiKey);
        }
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }
  }, []);

  // --- Handlers: Configuration ---
  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
    if (newSettings.apiKey !== undefined) {
      geminiServiceRef.current.updateApiKey(newSettings.apiKey || '');
    }
  };

  const handlePresetChange = (key: keyof Preset, value: any) => {
    setCurrentPreset(prev => ({ ...prev, [key]: value }));
  };

  const savePreset = () => {
    if (!presetNameInput.trim()) return;
    const newPreset: Preset = {
      ...currentPreset,
      id: Date.now().toString(),
      name: presetNameInput
    };
    const newPresets = [...presets, newPreset];
    setPresets(newPresets);
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(newPresets));
    setPresetNameInput('');
  };

  const loadPreset = (preset: Preset) => {
    setCurrentPreset(preset);
  };

  const deletePreset = (id: string) => {
    const newPresets = presets.filter(p => p.id !== id);
    setPresets(newPresets);
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(newPresets));
    if (currentPreset.id === id) {
      setCurrentPreset(DEFAULT_PRESET);
    }
  };

  // --- Handlers: Generation ---
  const generateAudio = async () => {
    if (!inputText.trim()) return;

    // Check API Key availability
    // Check API Key availability
    const envApiKey = import.meta.env.VITE_API_KEY;
    const isEnvKeyValid = envApiKey && envApiKey !== 'PLACEHOLDER_API_KEY';

    if (!isEnvKeyValid && !settings.apiKey) {
      setIsSettingsOpen(true);
      alert("Please configure your Gemini API Key in Settings first.");
      return;
    }

    setIsGenerating(true);
    setChunks([]); // Clear previous
    setProgress(0);

    // 1. Smart Chunking - ตัดที่จุดสิ้นสุดประโยค/คำ ไม่ตัดกลางคำ
    const textChunks: string[] = [];
    let remaining = inputText;
    
    while (remaining.length > 0) {
      if (remaining.length <= settings.chunkSize) {
        textChunks.push(remaining);
        break;
      }
      
      // หา chunk ขนาด chunkSize
      let chunk = remaining.slice(0, settings.chunkSize);
      
      // หาจุดตัดที่เหมาะสม (จุดสิ้นสุดประโยค หรือ space)
      // ลำดับความสำคัญ: \n\n > \n > . > ! > ? > , > space
      const breakPoints = ['\n\n', '\n', '။', '。', '.', '!', '?', '،', ',', ' '];
      let breakIndex = -1;
      
      for (const bp of breakPoints) {
        const lastIndex = chunk.lastIndexOf(bp);
        // หาจุดตัดที่อยู่หลัง 50% ของ chunk เพื่อไม่ให้ chunk เล็กเกินไป
        if (lastIndex > settings.chunkSize * 0.5) {
          breakIndex = lastIndex + bp.length;
          break;
        }
      }
      
      // ถ้าหาจุดตัดไม่ได้ ให้ใช้ขนาดเต็ม
      if (breakIndex === -1) {
        breakIndex = settings.chunkSize;
      }
      
      textChunks.push(remaining.slice(0, breakIndex).trim());
      remaining = remaining.slice(breakIndex).trim();
    }

    const tempChunks: AudioChunk[] = textChunks.map((text, index) => ({
      id: index,
      text: text,
      blob: null,
      status: 'pending'
    }));

    setChunks(tempChunks);

    // 2. Processing with concurrency limit and retry
    const MAX_CONCURRENT = 3; // Process max 3 chunks at a time
    const MAX_RETRIES = 3;
    const audioBuffers: (Float32Array | null)[] = new Array(tempChunks.length).fill(null);
    let completedCount = 0;

    const processChunk = async (chunk: AudioChunk, index: number): Promise<void> => {
      // Update status to generating
      setChunks(prev => prev.map(c => c.id === index ? { ...c, status: 'generating' } : c));

      let lastError: Error | null = null;
      
      for (let retry = 0; retry < MAX_RETRIES; retry++) {
        try {
          const buffer = await geminiServiceRef.current.generateSpeech(
            chunk.text,
            currentPreset.model,
            currentPreset.voice,
            currentPreset.systemPrompt,
            currentPreset.speed,
            currentPreset.temperature
          );

          audioBuffers[index] = buffer;

          // If not merging, create blob immediately for this chunk
          if (!settings.mergeOutput) {
            const wavBlob = createWavBlob(buffer);
            setChunks(prev => prev.map(c => c.id === index ? { ...c, status: 'completed', blob: wavBlob } : c));
          } else {
            setChunks(prev => prev.map(c => c.id === index ? { ...c, status: 'completed' } : c));
          }

          completedCount++;
          setProgress((completedCount / tempChunks.length) * 100);
          return; // Success, exit retry loop
          
        } catch (err: any) {
          lastError = err;
          console.error(`Chunk ${index} attempt ${retry + 1} failed:`, err);
          
          // Check if it's a rate limit error (429)
          if (err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
            // Wait before retry (exponential backoff)
            const waitTime = Math.pow(2, retry) * 2000; // 2s, 4s, 8s
            console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            // Non-retryable error
            break;
          }
        }
      }

      // All retries failed
      setChunks(prev => prev.map(c => c.id === index ? { ...c, status: 'error', error: lastError?.message || 'Failed to generate' } : c));
      completedCount++;
      setProgress((completedCount / tempChunks.length) * 100);
    };

    // Process chunks with concurrency limit
    const queue = [...tempChunks];
    const processing: Promise<void>[] = [];

    while (queue.length > 0 || processing.length > 0) {
      // Fill up to MAX_CONCURRENT
      while (queue.length > 0 && processing.length < MAX_CONCURRENT) {
        const chunk = queue.shift()!;
        const promise = processChunk(chunk, chunk.id).then(() => {
          // Remove from processing array when done
          const idx = processing.indexOf(promise);
          if (idx > -1) processing.splice(idx, 1);
        });
        processing.push(promise);
      }

      // Wait for at least one to complete
      if (processing.length > 0) {
        await Promise.race(processing);
      }
    }

    // Collect successful buffers in order
    const successfulBuffers = audioBuffers.filter((b): b is Float32Array => b !== null);
    
    console.log(`Merging ${successfulBuffers.length} of ${tempChunks.length} chunks`);

    // 3. Merging (if enabled)
    if (settings.mergeOutput && successfulBuffers.length > 0) {
      try {
        console.log('Starting merge...');
        const mergedBuffer = mergeBuffers(successfulBuffers);
        console.log(`Merged buffer size: ${mergedBuffer.length} samples`);
        const finalBlob = createWavBlob(mergedBuffer);
        console.log(`Final blob size: ${finalBlob.size} bytes`);
        
        // Replace chunks with a single result
        setChunks([{
          id: 999,
          text: `Full Merged Audio (${successfulBuffers.length} chunks)`,
          blob: finalBlob,
          status: 'completed'
        }]);
      } catch (err) {
        console.error('Merge failed:', err);
        // Keep individual chunks if merge fails
        // Create blobs for each successful buffer
        const chunksWithBlobs = tempChunks.map((chunk, index) => {
          const buffer = audioBuffers[index];
          if (buffer) {
            return {
              ...chunk,
              blob: createWavBlob(buffer),
              status: 'completed' as const
            };
          }
          return { ...chunk, status: 'error' as const, error: 'Failed to generate' };
        });
        setChunks(chunksWithBlobs);
      }
    }

    setIsGenerating(false);
  };

  // --- Handlers: Playback ---
  const playAudio = (blob: Blob | null, id: number) => {
    if (!blob) return;

    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
    }

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;

    setPlayingChunkId(id);
    audio.play();
    audio.onended = () => setPlayingChunkId(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row font-sans">

      {/* Sidebar: Presets & Config */}
      <aside className="w-full md:w-80 bg-slate-950 border-r border-slate-800 flex flex-col h-screen sticky top-0 overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/20">
            <Mic2 size={18} className="text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            VoxForge
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">

          {/* Preset Selection */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Saved Presets</h3>
            <div className="space-y-2">
              {presets.map(preset => (
                <div
                  key={preset.id}
                  onClick={() => loadPreset(preset)}
                  className={`group p-3 rounded-lg border cursor-pointer transition-all ${currentPreset.id === preset.id
                    ? 'bg-blue-900/20 border-blue-500/50 shadow-md shadow-blue-900/10'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-sm text-slate-200">{preset.name}</div>
                      <div className="text-xs text-slate-500 mt-1 flex gap-2">
                        <span>{preset.voice}</span>
                        <span>•</span>
                        <span>{preset.speed}</span>
                      </div>
                    </div>
                    {preset.id !== 'default' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePreset(preset.id); }}
                        className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Save New Preset */}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                placeholder="New preset name..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-sm focus:border-blue-500 outline-none"
              />
              <button
                onClick={savePreset}
                disabled={!presetNameInput.trim()}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 p-2 rounded-md transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="h-px bg-slate-800" />

          {/* Configuration Form */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Voice Configuration</h3>

            {/* Model Selector */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Model</label>
              <select
                value={currentPreset.model}
                onChange={(e) => handlePresetChange('model', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm focus:border-blue-500 outline-none"
              >
                <option value="gemini-2.5-flash-preview-tts">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-pro-preview-tts">Gemini 2.5 Pro</option>
              </select>
            </div>

            {/* Voice Selector */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Voice ({Object.values(VoiceName).length} options)</label>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {Object.values(VoiceName).map((voice) => (
                  <button
                    key={voice}
                    onClick={() => handlePresetChange('voice', voice)}
                    className={`px-2 py-1.5 text-xs rounded-md border text-left transition-all ${currentPreset.voice === voice
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                  >
                    {voice}
                  </button>
                ))}
              </div>
            </div>

            {/* Speed Selector */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Speed</label>
              <div className="flex bg-slate-900 rounded-md p-1 border border-slate-700">
                {Object.values(SpeedSetting).map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handlePresetChange('speed', speed)}
                    className={`flex-1 py-1 text-xs rounded transition-colors ${currentPreset.speed === speed
                      ? 'bg-slate-700 text-white font-medium shadow-sm'
                      : 'text-slate-500 hover:text-slate-300'
                      }`}
                  >
                    {speed}
                  </button>
                ))}
              </div>
            </div>

            {/* Temperature */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <label className="text-xs text-slate-400">Variability (Temp)</label>
                <span className="text-xs text-blue-400 font-mono">{currentPreset.temperature}</span>
              </div>
              <input
                type="range"
                min="0" max="2" step="0.1"
                value={currentPreset.temperature}
                onChange={(e) => handlePresetChange('temperature', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white py-2 rounded-md hover:bg-slate-900 transition-colors text-sm"
          >
            <Settings size={16} />
            Global Settings
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">

        {/* Header */}
        <div className="h-16 border-b border-slate-800 bg-slate-900/95 backdrop-blur z-10 flex items-center px-6 justify-between shrink-0">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <span className="font-medium text-slate-200">Editor</span>
            <ChevronRight size={14} />
            <span>{currentPreset.voice}</span>
            <ChevronRight size={14} />
            <span>{currentPreset.speed}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs font-mono text-slate-500 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
              {inputText.length} chars
            </div>

            <button
              onClick={generateAudio}
              disabled={isGenerating || !inputText.trim()}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold text-white transition-all shadow-lg shadow-blue-900/20 ${isGenerating || !inputText.trim()
                ? 'bg-slate-700 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95'
                }`}
            >
              {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Activity size={18} />}
              {isGenerating ? 'Generating...' : 'Generate Audio'}
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">

          {/* Prompt / System Instruction */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-rose-500">
                Style & Prompt
              </span>
            </label>
            <textarea
              value={currentPreset.systemPrompt}
              onChange={(e) => handlePresetChange('systemPrompt', e.target.value)}
              className="w-full h-24 bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-slate-300 text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none resize-none transition-all placeholder-slate-600"
              placeholder="e.g., Read this like a classic 1950s radio announcer..."
            />
          </div>

          {/* Text Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Content</label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full h-64 bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-100 text-base leading-relaxed focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none resize-y transition-all font-light placeholder-slate-600"
              placeholder="Enter the text you want to convert to speech here..."
            />
          </div>

          {/* Results Area */}
          {(chunks.length > 0 || isGenerating) && (
            <div className="border-t border-slate-800 pt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <Disc size={20} className="text-purple-500" />
                Generated Audio
              </h3>

              {/* Progress Bar */}
              {isGenerating && (
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mb-6">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              <div className="grid gap-3">
                {chunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 flex items-center justify-between group hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${chunk.status === 'generating' ? 'bg-amber-900/30 text-amber-500' :
                        chunk.status === 'error' ? 'bg-red-900/30 text-red-500' :
                          'bg-emerald-900/30 text-emerald-500'
                        }`}>
                        {chunk.status === 'generating' ? <Loader2 size={20} className="animate-spin" /> :
                          chunk.status === 'error' ? <AlertCircle size={20} /> :
                            <FileAudio size={20} />
                        }
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-200 truncate">
                          {chunk.text.length > 50 ? chunk.text.substring(0, 50) + '...' : chunk.text}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {chunk.status === 'completed' ? 'Ready to play' : chunk.status}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {chunk.status === 'completed' && chunk.blob && (
                        <>
                          <button
                            onClick={() => playAudio(chunk.blob, chunk.id)}
                            className={`p-2 rounded-full transition-colors ${playingChunkId === chunk.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                              }`}
                          >
                            {playingChunkId === chunk.id ? <Volume2 size={18} className="animate-pulse" /> : <Play size={18} />}
                          </button>

                          <a
                            href={URL.createObjectURL(chunk.blob)}
                            download={`gemini-vox-${Date.now()}-${chunk.id}.wav`}
                            className="p-2 rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white transition-colors"
                          >
                            <Download size={18} />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  );
};

export default App;
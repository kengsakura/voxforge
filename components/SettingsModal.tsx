import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900/50">
          <h2 className="text-xl font-bold text-slate-100">Application Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* API Key Section */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">
              Gemini API Key
            </label>
            <input
              type="password"
              value={localSettings.apiKey || ''}
              onChange={(e) => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
              placeholder={process.env.API_KEY ? "Using process.env.API_KEY" : "Enter your Gemini API Key"}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-600"
            />
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <AlertCircle size={12} />
              Optional if set in environment. Stored locally in browser memory.
            </p>
          </div>

          {/* Chunk Size */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">
              Character Chunk Size
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="500"
                max="15000"
                step="100"
                value={localSettings.chunkSize}
                onChange={(e) => setLocalSettings({ ...localSettings, chunkSize: Number(e.target.value) })}
                className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <span className="text-sm font-mono text-blue-400 w-16 text-right">
                {localSettings.chunkSize}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Splits long text into smaller parts to prevent timeouts.
            </p>
          </div>

          {/* Merge Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-300">
                Merge Output
              </label>
              <p className="text-xs text-slate-500">
                Combine all chunks into a single audio file.
              </p>
            </div>
            <button
              onClick={() => setLocalSettings({ ...localSettings, mergeOutput: !localSettings.mergeOutput })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                localSettings.mergeOutput ? 'bg-blue-600' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  localSettings.mergeOutput ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex justify-end">
          <button
            onClick={() => {
              onSave(localSettings);
              onClose();
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20"
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

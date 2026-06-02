import { useState, useEffect } from 'react';
import { Bot, Key, Globe, FileText, Save, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AISettings {
  model_name: string;
  api_key: string;
  api_endpoint: string;
  system_instructions: string;
  temperature: number;
  max_tokens: number;
}

const DEFAULT_SETTINGS: AISettings = {
  model_name: 'gpt-4o',
  api_key: '',
  api_endpoint: 'https://api.openai.com/v1/chat/completions',
  system_instructions: '',
  temperature: 0.7,
  max_tokens: 2000,
};

const POPULAR_MODELS = [
  { label: 'GPT-4o', value: 'gpt-4o', endpoint: 'https://api.openai.com/v1/chat/completions' },
  { label: 'GPT-4o Mini', value: 'gpt-4o-mini', endpoint: 'https://api.openai.com/v1/chat/completions' },
  { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022', endpoint: 'https://api.anthropic.com/v1/messages' },
  { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307', endpoint: 'https://api.anthropic.com/v1/messages' },
  { label: 'Ollama Cloud', value: 'deepseek-v4-pro:cloud', endpoint: 'https://ollama.com/v1/chat/completions' },
  { label: 'Custom', value: 'custom', endpoint: '' },
];

export function AISettingsPage() {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('mag_pdf_app_settings')
        .select('*')
        .eq('key', 'ai_config')
        .maybeSingle();

      if (data?.value) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.value });
      }
    } catch (err) {
      console.error('Failed to load AI settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    try {
      const { error } = await supabase
        .from('mag_pdf_app_settings')
        .upsert(
          { key: 'ai_config', value: settings },
          { onConflict: 'key' }
        );

      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save AI settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleModelSelect = (modelValue: string) => {
    const model = POPULAR_MODELS.find((m) => m.value === modelValue);
    if (model) {
      setSettings((s) => ({
        ...s,
        model_name: model.value,
        api_endpoint: model.endpoint || s.api_endpoint,
      }));
    }
  };

  const isOllamaEndpoint = settings.api_endpoint.includes('ollama.com') || settings.api_endpoint.includes('localhost:11434');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
          {/* Model selection */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <Bot className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Модел</h2>
                <p className="text-xs text-gray-500">Избери AI модел за генериране на layout и предложения</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {POPULAR_MODELS.map((model) => (
                <button
                  key={model.value}
                  onClick={() => handleModelSelect(model.value)}
                  className={`
                    px-3 py-2.5 rounded-lg text-xs font-medium text-left transition-all border
                    ${settings.model_name === model.value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                  `}
                >
                  {model.label}
                </button>
              ))}
            </div>

            {(settings.model_name === 'custom' || isOllamaEndpoint) && (
              <div className="mt-4">
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                  {isOllamaEndpoint ? 'Ollama модел (напр. llama3, qwen3, mistral)' : 'Име на модела'}
                </label>
                <input
                  type="text"
                  value={settings.model_name}
                  onChange={(e) => setSettings((s) => ({ ...s, model_name: e.target.value }))}
                  placeholder={isOllamaEndpoint ? 'llama3' : 'my-custom-model'}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>
            )}
          </section>

          {/* API Configuration */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <Key className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">API Достъп</h2>
                <p className="text-xs text-gray-500">API ключ и endpoint за свързване с модела</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">API ключ</label>
                <input
                  type="password"
                  value={settings.api_key}
                  onChange={(e) => setSettings((s) => ({ ...s, api_key: e.target.value }))}
                  placeholder={isOllamaEndpoint ? 'Ollama API key от ollama.com/settings' : 'sk-...'}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  {isOllamaEndpoint ? 'Вземи ключа от ollama.com/settings > API Keys' : 'Ключът се пази в базата данни.'}
                </p>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  API Endpoint
                </label>
                <input
                  type="url"
                  value={settings.api_endpoint}
                  onChange={(e) => setSettings((s) => ({ ...s, api_endpoint: e.target.value }))}
                  placeholder="https://api.openai.com/v1/chat/completions"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 font-mono text-xs"
                />
              </div>
            </div>
          </section>

          {/* Model parameters */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Параметри</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                  Temperature ({settings.temperature})
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.temperature}
                  onChange={(e) => setSettings((s) => ({ ...s, temperature: parseFloat(e.target.value) }))}
                  className="w-full accent-gray-900"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>Прецизен</span>
                  <span>Креативен</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Max Tokens</label>
                <input
                  type="number"
                  value={settings.max_tokens}
                  onChange={(e) => setSettings((s) => ({ ...s, max_tokens: parseInt(e.target.value) || 2000 }))}
                  min={100}
                  max={16000}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>
            </div>
          </section>

          {/* System instructions */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Инструкции към модела</h2>
                <p className="text-xs text-gray-500">System prompt - как AI да обработва съдържанието</p>
              </div>
            </div>

            <textarea
              value={settings.system_instructions}
              onChange={(e) => setSettings((s) => ({ ...s, system_instructions: e.target.value }))}
              placeholder={`Примерни инструкции:\n\n- Анализирай статията и предложи оптимален layout за списание\n- Използвай pull quotes от най-въздействащите изречения\n- Разпредели снимките равномерно между текстовите блокове\n- Предложи подзаглавия ако липсват\n- Пиши на български език`}
              rows={10}
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-y font-mono leading-relaxed"
            />
            <p className="text-[10px] text-gray-400 mt-2">
              Тези инструкции се изпращат като system message при всяко обръщение към AI модела.
            </p>
          </section>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saved ? 'Запазено!' : 'Запази'}
            </button>
          </div>
        </div>
  );
}

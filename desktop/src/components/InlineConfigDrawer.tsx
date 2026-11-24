import { useId, useState, type FormEvent } from 'react'
import { Check, KeyRound, X } from 'lucide-react'
import type { Translations } from '../i18n/translations'
import type { ConfigPatch, ConfigResponse } from '../lib/types'

interface ProviderPreset {
  id: string
  label: string
  baseUrl: string
  modelName: string
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-4o',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    modelName: 'deepseek-chat',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelName: 'openai/gpt-4o',
  },
  {
    id: 'ollama',
    label: 'Ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
    modelName: 'qwen2.5vl:7b',
  },
]

interface InlineConfigDrawerProps {
  config: ConfigResponse | null
  t: Translations
  missingKeyBanner?: boolean
  onSave: (patch: ConfigPatch) => Promise<void>
  onClose: () => void
}

export function InlineConfigDrawer({
  config,
  t,
  missingKeyBanner = false,
  onSave,
  onClose,
}: InlineConfigDrawerProps) {
  const [modelName, setModelName] = useState(config?.model_name || 'gpt-4o')
  const [baseUrl, setBaseUrl] = useState(config?.base_url || 'https://api.openai.com/v1')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedNotice, setSavedNotice] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const modelId = useId()
  const baseUrlId = useId()
  const apiKeyId = useId()

  const activePresetId =
    PROVIDER_PRESETS.find((p) => baseUrl.trim().toLowerCase().startsWith(p.baseUrl.toLowerCase()))
      ?.id ?? 'custom'

  const applyPreset = (preset: ProviderPreset) => {
    setBaseUrl(preset.baseUrl)
    setModelName(preset.modelName)
    setSavedNotice(false)
    setErrorMsg(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrorMsg(null)
    try {
      const patch: ConfigPatch = {
        model_name: modelName.trim() || undefined,
        base_url: baseUrl.trim() || undefined,
      }
      if (apiKey.trim()) {
        patch.api_key = apiKey.trim()
      }
      await onSave(patch)
      setApiKey('')
      setSavedNotice(true)
      window.setTimeout(() => setSavedNotice(false), 1800)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      aria-label={t.configDrawerTitle}
      className="aef-fade-in border-t border-white/10 bg-slate-950/55 px-4 py-3"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <KeyRound className="w-3.5 h-3.5 text-indigo-400 shrink-0" aria-hidden="true" />
          <h2 className="text-xs font-medium text-slate-200 truncate">{t.configDrawerTitle}</h2>
          {config?.api_key_set && config.api_key_preview && (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-300 whitespace-nowrap shrink-0">
              {config.api_key_preview}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          title={t.close}
          className="aef-toolbar-btn inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-white/8 hover:text-slate-100"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {missingKeyBanner && (
        <p className="mb-2.5 rounded-lg border border-amber-400/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-200/90">
          {t.configMissingKeyNotice}
        </p>
      )}

      {/* Provider Presets */}
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5" role="group" aria-label={t.providerPresetLabel}>
        {PROVIDER_PRESETS.map((preset) => {
          const isActive = activePresetId === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => applyPreset(preset)}
              className={`aef-smooth-transition rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 ${
                isActive
                  ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-100'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-slate-200'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={modelId} className="mb-1 block text-[11px] text-slate-400">
              {t.modelLabel}
            </label>
            <input
              id={modelId}
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="gpt-4o"
              className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor={baseUrlId} className="mb-1 block text-[11px] text-slate-400">
              {t.baseUrlLabel}
            </label>
            <input
              id={baseUrlId}
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <label htmlFor={apiKeyId} className="mb-1 block text-[11px] text-slate-400">
              {t.apiKeyLabel}
            </label>
            <input
              id={apiKeyId}
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                config?.api_key_set ? t.apiKeyConfiguredPlaceholder : t.apiKeyEmptyPlaceholder
              }
              className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-2.5 py-1.5 text-xs font-mono text-slate-100 placeholder:font-sans placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="aef-smooth-transition inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-indigo-500 px-3 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {savedNotice ? (
              <>
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.saved}</span>
              </>
            ) : (
              <span>{saving ? t.saving : t.save}</span>
            )}
          </button>
        </div>

        {errorMsg && (
          <p role="alert" className="text-[11px] text-rose-300">
            {errorMsg}
          </p>
        )}
      </form>
    </section>
  )
}

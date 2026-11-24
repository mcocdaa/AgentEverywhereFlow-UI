import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Keyboard,
  RefreshCw,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { api } from '../api/client'
import type {
  AppConfigResponse,
  ExecutionMode,
  PatchConfigRequest,
  PermissionMode,
} from '../api/types'
import { useLanguage } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
import { ModalDialog } from './ModalDialog'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onConfigSaved?: (config: AppConfigResponse) => void
}

type ProviderId = 'openai' | 'deepseek' | 'openrouter' | 'ollama' | 'custom'

interface ProviderPreset {
  id: ProviderId
  labelKey: TranslationKey
  baseUrl: string
  defaultModel: string
}

const PROVIDER_PRESETS: ReadonlyArray<ProviderPreset> = [
  {
    id: 'openai',
    labelKey: 'settings.providerOpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
  },
  {
    id: 'deepseek',
    labelKey: 'settings.providerDeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
  },
  {
    id: 'openrouter',
    labelKey: 'settings.providerOpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o',
  },
  {
    id: 'ollama',
    labelKey: 'settings.providerOllama',
    baseUrl: 'http://127.0.0.1:11434/v1',
    defaultModel: 'qwen2.5vl',
  },
  {
    id: 'custom',
    labelKey: 'settings.providerCustom',
    baseUrl: '',
    defaultModel: '',
  },
]

function detectProvider(baseUrl: string): ProviderId {
  const normalized = baseUrl.trim().replace(/\/$/, '').toLowerCase()
  if (!normalized) return 'custom'
  if (normalized.includes('api.openai.com')) return 'openai'
  if (normalized.includes('api.deepseek.com')) return 'deepseek'
  if (normalized.includes('openrouter.ai')) return 'openrouter'
  if (normalized.includes('11434') || normalized.includes('ollama')) return 'ollama'
  return 'custom'
}

function normalizeExecutionMode(value: string | undefined): ExecutionMode {
  const v = (value || '').toLowerCase().trim()
  if (v === 'guarded' || v === 'control_guarded') return 'guarded'
  return 'minimal'
}

function normalizePermissionMode(value: string | undefined): PermissionMode {
  const v = (value || '').toLowerCase().trim()
  if (v === 'manual' || v === 'approval') return 'manual'
  return 'auto'
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const { t } = useLanguage()
  const baseId = useId()
  const titleId = `${baseId}-title`
  const keyHintId = `${baseId}-key-hint`
  const baseUrlInputRef = useRef<HTMLInputElement | null>(null)
  const modelInputRef = useRef<HTMLInputElement | null>(null)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('openai')
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1')
  const [modelName, setModelName] = useState('gpt-4o')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeySet, setApiKeySet] = useState(false)
  const [apiKeyPreview, setApiKeyPreview] = useState('')
  const [defaultMode, setDefaultMode] = useState<ExecutionMode>('minimal')
  const [defaultPermission, setDefaultPermission] = useState<PermissionMode>('auto')
  const [summonHotkey, setSummonHotkey] = useState('ctrl+shift+a')

  const [statusFeedback, setStatusFeedback] = useState<{
    kind: 'success' | 'error'
    key?: TranslationKey
    raw?: string
  } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    baseUrl?: TranslationKey
    modelName?: TranslationKey
  }>({})

  const loadConfig = useCallback(async () => {
    setLoading(true)
    setStatusFeedback(null)
    setFieldErrors({})
    try {
      const cfg = await api.getConfig()
      const loadedUrl = cfg.base_url || 'https://api.openai.com/v1'
      setBaseUrl(loadedUrl)
      setModelName(cfg.model_name || 'gpt-4o')
      setSelectedProvider(detectProvider(loadedUrl))
      setApiKeySet(Boolean(cfg.api_key_set))
      setApiKeyPreview(cfg.api_key_preview || '')
      setApiKeyInput('')
      setShowApiKey(false)
      setDefaultMode(normalizeExecutionMode(cfg.default_mode))
      setDefaultPermission(normalizePermissionMode(cfg.default_permission))
      setSummonHotkey(cfg.summon_hotkey || 'ctrl+shift+a')
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : ''
      const isGeneric =
        !rawMsg || /^(Failed to fetch|NetworkError|HTTP \d+|Load failed)/i.test(rawMsg)
      setStatusFeedback({
        kind: 'error',
        ...(isGeneric ? { key: 'settings.loadError' } : { raw: rawMsg }),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      void loadConfig()
    }
  }, [isOpen, loadConfig])

  const handleSelectProvider = (preset: ProviderPreset) => {
    setSelectedProvider(preset.id)
    setStatusFeedback(null)
    if (preset.id === 'custom') return

    const knownModels = new Set(
      PROVIDER_PRESETS.map((p) => p.defaultModel).filter(Boolean)
    )
    setBaseUrl(preset.baseUrl)
    setFieldErrors((prev) => ({ ...prev, baseUrl: undefined }))
    if (!modelName.trim() || knownModels.has(modelName.trim())) {
      setModelName(preset.defaultModel)
      setFieldErrors((prev) => ({ ...prev, modelName: undefined }))
    }
  }

  const hotkeyParts = useMemo(
    () =>
      summonHotkey
        .split('+')
        .map((part) => part.trim())
        .filter(Boolean),
    [summonHotkey]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatusFeedback(null)

    const trimmedUrl = baseUrl.trim()
    const trimmedModel = modelName.trim()
    const nextErrors: { baseUrl?: TranslationKey; modelName?: TranslationKey } = {}

    if (!trimmedUrl || !/^https?:\/\/.+/i.test(trimmedUrl)) {
      nextErrors.baseUrl = 'settings.validationBaseUrl'
    }
    if (!trimmedModel) {
      nextErrors.modelName = 'settings.validationModel'
    }

    if (nextErrors.baseUrl || nextErrors.modelName) {
      setFieldErrors(nextErrors)
      if (nextErrors.baseUrl) {
        baseUrlInputRef.current?.focus()
      } else if (nextErrors.modelName) {
        modelInputRef.current?.focus()
      }
      return
    }

    setFieldErrors({})
    setSaving(true)

    const payload: PatchConfigRequest = {
      base_url: trimmedUrl,
      model_name: trimmedModel,
      default_mode: defaultMode,
      default_permission: defaultPermission,
    }
    const trimmedKey = apiKeyInput.trim()
    if (trimmedKey) {
      payload.api_key = trimmedKey
    }

    try {
      const updated = await api.patchConfig(payload)
      setBaseUrl(updated.base_url || trimmedUrl)
      setModelName(updated.model_name || trimmedModel)
      setSelectedProvider(detectProvider(updated.base_url || trimmedUrl))
      setApiKeySet(Boolean(updated.api_key_set))
      setApiKeyPreview(updated.api_key_preview || '')
      setApiKeyInput('')
      setShowApiKey(false)
      setDefaultMode(normalizeExecutionMode(updated.default_mode))
      setDefaultPermission(normalizePermissionMode(updated.default_permission))
      if (updated.summon_hotkey) setSummonHotkey(updated.summon_hotkey)
      setStatusFeedback({ kind: 'success', key: 'settings.saved' })
      onConfigSaved?.(updated)
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : ''
      const isGeneric =
        !rawMsg || /^(Failed to fetch|NetworkError|HTTP \d+|Load failed)/i.test(rawMsg)
      setStatusFeedback({
        kind: 'error',
        ...(isGeneric ? { key: 'settings.saveError' } : { raw: rawMsg }),
      })
    } finally {
      setSaving(false)
    }
  }

  const feedbackText = statusFeedback
    ? statusFeedback.key
      ? t(statusFeedback.key)
      : statusFeedback.raw || ''
    : ''

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={titleId}
      className="w-full max-w-xl"
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 lg:px-6 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-950/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 id={titleId} className="text-sm lg:text-base font-semibold text-white truncate">
                {t('settings.title')}
              </h1>
              <p className="text-xs text-slate-400 truncate">{t('settings.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('settings.close')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 lg:p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="py-10 flex items-center justify-center gap-2 text-xs text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" aria-hidden="true" />
              <span>{t('settings.loading')}</span>
            </div>
          ) : (
            <>
              {/* 1. Provider Presets */}
              <fieldset className="space-y-2 border-0 p-0 m-0">
                <legend className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  {t('settings.providerPresets')}
                </legend>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {PROVIDER_PRESETS.map((preset) => {
                    const active = selectedProvider === preset.id
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => handleSelectProvider(preset)}
                        className={`px-2.5 py-2 rounded-lg text-xs font-medium border text-center transition cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-200'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        {t(preset.labelKey)}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              {/* 2. Base URL & Model Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor={`${baseId}-base-url`}
                    className="block text-xs font-medium text-slate-300"
                  >
                    {t('settings.baseUrl')}
                  </label>
                  <input
                    ref={baseUrlInputRef}
                    id={`${baseId}-base-url`}
                    name="base_url"
                    type="url"
                    required
                    value={baseUrl}
                    autoComplete="url"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={fieldErrors.baseUrl ? true : undefined}
                    aria-describedby={fieldErrors.baseUrl ? `${baseId}-base-url-err` : undefined}
                    onChange={(e) => {
                      const val = e.target.value
                      setBaseUrl(val)
                      setSelectedProvider(detectProvider(val))
                      setFieldErrors((prev) => ({ ...prev, baseUrl: undefined }))
                      setStatusFeedback(null)
                    }}
                    placeholder={t('settings.baseUrlPlaceholder')}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 font-mono focus:border-indigo-500 transition"
                  />
                  {fieldErrors.baseUrl && (
                    <p id={`${baseId}-base-url-err`} className="text-[11px] text-rose-400">
                      {t(fieldErrors.baseUrl)}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor={`${baseId}-model`}
                    className="block text-xs font-medium text-slate-300"
                  >
                    {t('settings.modelName')}
                  </label>
                  <input
                    ref={modelInputRef}
                    id={`${baseId}-model`}
                    name="model_name"
                    type="text"
                    required
                    value={modelName}
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={fieldErrors.modelName ? true : undefined}
                    aria-describedby={fieldErrors.modelName ? `${baseId}-model-err` : undefined}
                    onChange={(e) => {
                      setModelName(e.target.value)
                      setFieldErrors((prev) => ({ ...prev, modelName: undefined }))
                      setStatusFeedback(null)
                    }}
                    placeholder={t('settings.modelNamePlaceholder')}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 font-mono focus:border-indigo-500 transition"
                  />
                  {fieldErrors.modelName && (
                    <p id={`${baseId}-model-err`} className="text-[11px] text-rose-400">
                      {t(fieldErrors.modelName)}
                    </p>
                  )}
                </div>
              </div>

              {/* 3. Write-Only API Key Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor={`${baseId}-api-key`}
                    className="block text-xs font-medium text-slate-300"
                  >
                    {t('settings.apiKey')}
                  </label>
                  {apiKeySet ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 whitespace-nowrap">
                      <span>{t('settings.apiKeyConfigured')}</span>
                      {apiKeyPreview && (
                        <code className="font-mono text-[10px] text-emerald-200/90">
                          {apiKeyPreview}
                        </code>
                      )}
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 whitespace-nowrap">
                      {t('settings.apiKeyNotSet')}
                    </span>
                  )}
                </div>

                <p id={keyHintId} className="text-[11px] text-slate-400 leading-relaxed">
                  {t('settings.apiKeyHint')}
                </p>

                <div className="relative">
                  <input
                    id={`${baseId}-api-key`}
                    name="api_key"
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-describedby={keyHintId}
                    onChange={(e) => {
                      setApiKeyInput(e.target.value)
                      setStatusFeedback(null)
                    }}
                    placeholder={
                      apiKeySet
                        ? t('settings.apiKeyPlaceholderSet')
                        : t('settings.apiKeyPlaceholderUnset')
                    }
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-3 pr-10 py-2 text-xs text-slate-100 placeholder-slate-500 font-mono focus:border-indigo-500 transition"
                  />
                  <button
                    type="button"
                    aria-pressed={showApiKey}
                    aria-label={showApiKey ? t('settings.hideApiKey') : t('settings.showApiKey')}
                    onClick={() => setShowApiKey((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  >
                    {showApiKey ? (
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {/* 4. Default Execution & Permission Modes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <fieldset className="space-y-1.5 border-0 p-0 m-0">
                  <legend className="text-xs font-medium text-slate-300">
                    {t('settings.defaultMode')}
                  </legend>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      aria-pressed={defaultMode === 'minimal'}
                      onClick={() => setDefaultMode('minimal')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                        defaultMode === 'minimal'
                          ? 'bg-indigo-600/25 text-indigo-200 border border-indigo-500/40'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      {t('newSession.modeMinimalBadge')}
                    </button>
                    <button
                      type="button"
                      aria-pressed={defaultMode === 'guarded'}
                      onClick={() => setDefaultMode('guarded')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                        defaultMode === 'guarded'
                          ? 'bg-indigo-600/25 text-indigo-200 border border-indigo-500/40'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      {t('newSession.modeGuardedBadge')}
                    </button>
                  </div>
                </fieldset>

                <fieldset className="space-y-1.5 border-0 p-0 m-0">
                  <legend className="text-xs font-medium text-slate-300">
                    {t('settings.defaultPermission')}
                  </legend>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      aria-pressed={defaultPermission === 'auto'}
                      onClick={() => setDefaultPermission('auto')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                        defaultPermission === 'auto'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      {t('header.permissionAuto')}
                    </button>
                    <button
                      type="button"
                      aria-pressed={defaultPermission === 'manual'}
                      onClick={() => setDefaultPermission('manual')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                        defaultPermission === 'manual'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      {t('header.permissionManual')}
                    </button>
                  </div>
                </fieldset>
              </div>

              {/* 5. Global Summon Hotkey Display */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Keyboard className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-200">
                      {t('settings.summonHotkey')}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {t('settings.summonHotkeyDesc')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {hotkeyParts.map((part, index) => (
                    <React.Fragment key={`${part}-${index}`}>
                      {index > 0 && <span className="text-[10px] text-slate-500">+</span>}
                      <kbd className="px-2 py-0.5 text-[11px] font-mono uppercase rounded-md bg-slate-900 border border-slate-700 text-slate-200 whitespace-nowrap">
                        {part}
                      </kbd>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Status Feedback */}
              {statusFeedback && (
                <div
                  role={statusFeedback.kind === 'error' ? 'alert' : 'status'}
                  aria-live={statusFeedback.kind === 'error' ? 'assertive' : 'polite'}
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                    statusFeedback.kind === 'success'
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {statusFeedback.kind === 'success' ? (
                    <CheckCircle2
                      className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                  ) : (
                    <AlertCircle
                      className="w-4 h-4 text-rose-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                  )}
                  <span className="leading-relaxed">{feedbackText}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 lg:px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer whitespace-nowrap"
          >
            {t('settings.cancel')}
          </button>
          <button
            type="submit"
            disabled={saving || loading}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
            <span>{saving ? t('settings.saving') : t('settings.save')}</span>
          </button>
        </div>
      </form>
    </ModalDialog>
  )
}

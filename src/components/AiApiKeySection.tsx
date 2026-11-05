import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  EyeOff,
  Key,
  RefreshCw,
  Trash2,
  Save,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Layers,
  Activity,
  Sliders,
  ChevronDown,
  Sparkles,
  Zap,
  Info,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Check,
  X,
  FileText,
} from 'lucide-react';
import {
  AiConnectionStatus,
  AiConnectionTestResult,
  AiConfigSnapshot,
  AiModelDescriptor,
  AiStructuredChartAnalysis,
  AiAuditLogEntry,
  Signal,
  IndicatorMetrics,
} from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface AiApiKeySectionProps {
  activeAsset?: string;
  timeframe?: number;
  currentPrice?: number | null;
  activeSignal?: Signal | null;
  indicators?: IndicatorMetrics | null;
  onAnalysisComplete?: (analysis: AiStructuredChartAnalysis) => void;
}

export const AiApiKeySection: React.FC<AiApiKeySectionProps> = ({
  activeAsset = 'EURUSD_otc',
  timeframe = 60,
  currentPrice,
  activeSignal,
  indicators,
  onAnalysisComplete,
}) => {
  const { t, isRTL } = useLanguage();

  // Configuration and Connection State
  const [config, setConfig] = useState<AiConfigSnapshot | null>(null);
  const [keyInput, setKeyInput] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');

  // Loading States
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRemoving, setIsRemoving] = useState<boolean>(false);
  const [isAnalyzingChart, setIsAnalyzingChart] = useState<boolean>(false);

  // Results & Feedback
  const [testResult, setTestResult] = useState<AiConnectionTestResult | null>(null);
  const [chartAnalysis, setChartAnalysis] = useState<AiStructuredChartAnalysis | null>(null);
  const [statusNotice, setStatusNotice] = useState<{
    type: 'success' | 'error' | 'info' | 'warning';
    text: string;
    canRetry?: boolean;
    retryAction?: () => void;
  } | null>(null);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AiAuditLogEntry[]>([]);
  const [showAuditLogs, setShowAuditLogs] = useState<boolean>(false);

  // Fetch Current AI Config from Backend
  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/config');
      if (res.ok) {
        const data: AiConfigSnapshot = await res.json();
        setConfig(data);
        if (data.selectedModel) {
          setSelectedModel(data.selectedModel);
        }
      }
    } catch (err) {
      console.warn('[AI UI] Could not load AI config:', err);
    }
  }, []);

  // Fetch Audit Logs
  const loadAuditLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/audit-logs');
      if (res.ok) {
        const logs: AiAuditLogEntry[] = await res.json();
        setAuditLogs(logs);
      }
    } catch (err) {
      console.warn('[AI UI] Could not load audit logs:', err);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Handle Testing Connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setStatusNotice(null);
    setTestResult(null);

    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: keyInput.trim() || undefined,
          model: selectedModel,
        }),
      });

      const data: AiConnectionTestResult = await res.json();
      setTestResult(data);

      if (data.success) {
        setStatusNotice({
          type: 'success',
          text: `${t('aiApiKey.testSuccessNotice', 'API handshake verified with Google Gemini server.')} (${data.model})`,
        });
      } else {
        setStatusNotice({
          type: 'error',
          text: data.message || t('aiApiKey.connectionError', 'CONNECTION ERROR'),
        });
      }
      await loadConfig();
    } catch (err: any) {
      const errRes: AiConnectionTestResult = {
        success: false,
        status: 'CONNECTION ERROR',
        errorCategory: 'CONNECTION_ERROR',
        provider: 'Google Gemini',
        model: selectedModel,
        timestamp: Date.now(),
        message: err?.message || 'Network request failed',
      };
      setTestResult(errRes);
      setStatusNotice({
        type: 'error',
        text: err?.message || 'Network request failed while testing connection',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Handle Saving Key Securely
  const handleSaveKey = async () => {
    if (!keyInput.trim()) {
      setStatusNotice({
        type: 'error',
        text: 'Please enter a valid Google AI API key before saving.',
      });
      return;
    }

    setIsSaving(true);
    setStatusNotice(null);

    try {
      const res = await fetch('/api/ai/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyInput.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusNotice({
          type: 'success',
          text: t('aiApiKey.keySavedNotice', 'Google AI API key saved securely on backend.'),
        });
        setKeyInput('');
        setShowKey(false);
        if (data.config) {
          setConfig(data.config);
        } else {
          await loadConfig();
        }
      } else {
        setStatusNotice({
          type: 'error',
          text: data.error || 'Failed to save API key',
        });
      }
    } catch (err: any) {
      setStatusNotice({
        type: 'error',
        text: err?.message || 'Network error while saving API key',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Removing Key
  const handleRemoveKey = async () => {
    setIsRemoving(true);
    setStatusNotice(null);
    setTestResult(null);

    try {
      const res = await fetch('/api/ai/key/remove', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setStatusNotice({
          type: 'info',
          text: t('aiApiKey.keyRemovedNotice', 'Google AI API key has been removed.'),
        });
        setKeyInput('');
        if (data.config) {
          setConfig(data.config);
        } else {
          await loadConfig();
        }
      }
    } catch (err: any) {
      setStatusNotice({
        type: 'error',
        text: err?.message || 'Network error while removing API key',
      });
    } finally {
      setIsRemoving(false);
    }
  };

  // Handle Model Change
  const handleModelChange = async (newModel: string) => {
    setSelectedModel(newModel);
    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: newModel }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.config) setConfig(data.config);
      }
    } catch (err) {
      console.warn('[AI UI] Could not update model:', err);
    }
  };

  // Handle Data Permission Toggle
  const handleTogglePermission = async (key: string, value: boolean | number) => {
    if (!config) return;
    const newPerms = {
      ...config.permissions,
      [key]: value,
    };

    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: newPerms }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.config) setConfig(data.config);
      }
    } catch (err) {
      console.warn('[AI UI] Could not update permission:', err);
    }
  };

  // Handle Analyzing Real Chart
  const handleAnalyzeChart = async () => {
    setIsAnalyzingChart(true);
    setStatusNotice(null);

    try {
      const res = await fetch('/api/ai/analyze-chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: activeAsset,
          timeframe,
          forceRefresh: true,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const is503 = res.status === 503 || errJson?.errorCode === '503';
        const is429 = res.status === 429 || errJson?.errorCode === '429';

        if (is503) {
          setStatusNotice({
            type: 'warning',
            text: 'AI analysis is temporarily unavailable due to high demand on Gemini servers. Core trading strategy and signals remain 100% active and connected.',
            canRetry: true,
            retryAction: () => handleAnalyzeChart(),
          });
        } else if (is429) {
          setStatusNotice({
            type: 'warning',
            text: 'AI rate limit reached. The system backed off automatically. Strategy engine remains fully functional.',
            canRetry: true,
            retryAction: () => handleAnalyzeChart(),
          });
        } else {
          setStatusNotice({
            type: 'error',
            text: errJson.error || `AI service responded with status ${res.status}. Core engine operational.`,
            canRetry: Boolean(errJson.retryable),
            retryAction: () => handleAnalyzeChart(),
          });
        }
        return;
      }

      const analysis: AiStructuredChartAnalysis = await res.json();
      setChartAnalysis(analysis);
      if (onAnalysisComplete) {
        onAnalysisComplete(analysis);
      }
      loadAuditLogs();
      loadConfig();
    } catch (err: any) {
      console.warn('[AI UI] Analyze chart request failed:', err);
      setStatusNotice({
        type: 'warning',
        text: 'Network issue contacting AI analysis service. PocketOption and local signal engine remain unaffected.',
        canRetry: true,
        retryAction: () => handleAnalyzeChart(),
      });
    } finally {
      setIsAnalyzingChart(false);
    }
  };

  // Computed Status
  const status: AiConnectionStatus = config?.connectionStatus || 'NOT CONNECTED';

  const statusBadge = () => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {t('aiApiKey.connected', 'CONNECTED')}
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <RefreshCw className="w-3 h-3 animate-spin" />
            {t('aiApiKey.connecting', 'CONNECTING')}
          </span>
        );
      case 'TEMPORARILY_UNAVAILABLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            HIGH DEMAND (503)
          </span>
        );
      case 'INVALID API KEY':
      case 'INVALID_API_KEY':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" />
            {t('aiApiKey.invalidKey', 'INVALID API KEY')}
          </span>
        );
      case 'QUOTA EXCEEDED':
      case 'QUOTA_EXCEEDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            {t('aiApiKey.quotaExceeded', 'QUOTA EXCEEDED')}
          </span>
        );
      case 'MODEL UNAVAILABLE':
      case 'MODEL_UNAVAILABLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            {t('aiApiKey.modelUnavailable', 'MODEL UNAVAILABLE')}
          </span>
        );
      case 'CONNECTION ERROR':
      case 'CONNECTION_ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            {t('aiApiKey.connectionError', 'CONNECTION ERROR')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            {t('aiApiKey.notConnected', 'NOT CONNECTED')}
          </span>
        );
    }
  };

  const selectedModelDescriptor = config?.supportedModels.find((m) => m.id === selectedModel);

  return (
    <div id="ai-api-key-section" className="space-y-6">
      {/* ========================================================================= */}
      {/* SECTION 1: AI API KEY & GOOGLE GEMINI SETTINGS CARD                       */}
      {/* ========================================================================= */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100 tracking-wide">
                  {t('aiApiKey.title', 'AI API KEY')}
                </h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                  Google Gemini
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {t('aiApiKey.subtitle', 'Google Gemini Integration & Real-Time Chart Analysis')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{t('aiApiKey.connectionStatus', 'Connection Status')}:</span>
            {statusBadge()}
          </div>
        </div>

        {/* Status Notice Toast / Alert Banner with Retry Button */}
        {statusNotice && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              statusNotice.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : statusNotice.type === 'warning'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : statusNotice.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusNotice.type === 'success' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : statusNotice.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              ) : statusNotice.type === 'error' ? (
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-blue-400 shrink-0" />
              )}
              <span>{statusNotice.text}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {statusNotice.canRetry && statusNotice.retryAction && (
                <button
                  type="button"
                  onClick={statusNotice.retryAction}
                  className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Now</span>
                </button>
              )}
              <button
                onClick={() => setStatusNotice(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
                aria-label="Dismiss notice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Main Configuration Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Column 1: Provider, Key, and Model */}
          <div className="space-y-4">
            {/* AI Provider */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>{t('aiApiKey.provider', 'AI Provider')}</span>
                <span className="text-[11px] text-blue-400 font-mono">Official SDK</span>
              </label>
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-slate-200">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  Google Gemini (Official @google/genai)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  v0.1.4
                </span>
              </div>
            </div>

            {/* API Key Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>{t('aiApiKey.apiKeyLabel', 'API Key')}</span>
                {config?.isConfigured && (
                  <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Key Saved ({config.maskedKey})
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={
                    config?.isConfigured
                      ? `Using stored key (${config.maskedKey}). Enter new key to replace...`
                      : t('aiApiKey.apiKeyPlaceholder', 'Enter your real Google AI API key (AIzaSy...)')
                  }
                  className="w-full px-3.5 py-2.5 pr-20 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1"
                  title={showKey ? t('aiApiKey.hideKey', 'Hide Key') : t('aiApiKey.showKey', 'Show Key')}
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span className="text-[10px]">{showKey ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>{t('aiApiKey.securityNotice', 'Keys are stored on the local server and never exposed in browser scripts or HTML.')}</span>
              </p>
            </div>

            {/* Model Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>{t('aiApiKey.modelLabel', 'Model')}</span>
                {selectedModelDescriptor && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    {selectedModelDescriptor.status}
                  </span>
                )}
              </label>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-100 appearance-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  {config?.supportedModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.availability})
                    </option>
                  ))}
                  {!config?.supportedModels && (
                    <>
                      <option value="gemini-3.8-flash">Gemini 3.8 Flash (Primary Quantitative)</option>
                      <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (High-Throughput Fallback)</option>
                    </>
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Real-Time Health & Diagnostics Bar */}
              {config?.health && (
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Health State:</span>
                    <span
                      className={`font-bold ${
                        config.health.status === 'READY'
                          ? 'text-emerald-400'
                          : config.health.status === 'RETRYING'
                          ? 'text-amber-400 animate-pulse'
                          : config.health.status === 'TEMPORARILY_UNAVAILABLE'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {config.health.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Consecutive Failures:</span>
                    <span className={config.health.consecutiveFailures > 0 ? 'text-amber-400' : 'text-slate-300'}>
                      {config.health.consecutiveFailures}
                    </span>
                  </div>
                  {config.health.latencyMs != null && (
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Last Latency:</span>
                      <span className="text-slate-200">{config.health.latencyMs}ms</span>
                    </div>
                  )}
                  {config.health.cooldownUntil && (
                    <div className="flex items-center justify-between text-amber-400">
                      <span>Cooldown Remaining:</span>
                      <span>{Math.max(0, Math.round((config.health.cooldownUntil - Date.now()) / 1000))}s</span>
                    </div>
                  )}
                </div>
              )}

              {/* Model Spec Breakdown */}
              {selectedModelDescriptor && (
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>{t('aiApiKey.supportedInputTypes', 'Supported Input Types')}:</span>
                    <span className="text-slate-200 font-mono">
                      {(selectedModelDescriptor.inputTypes || selectedModelDescriptor.supportedInputTypes || []).join(', ') || 'Text, Structured JSON'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>{t('aiApiKey.modelStatus', 'Status')}:</span>
                    <span className="text-emerald-400 font-bold">
                      {selectedModelDescriptor.status}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons Row */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="flex-1 min-w-[150px] px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? t('aiApiKey.testing', 'Testing Connection...') : t('aiApiKey.testConnection', 'Test API Connection')}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveKey}
                disabled={isSaving || !keyInput.trim()}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? t('aiApiKey.saving', 'Saving...') : t('aiApiKey.saveSecurely', 'Save Securely')}</span>
              </button>

              {config?.isConfigured && (
                <button
                  type="button"
                  onClick={handleRemoveKey}
                  disabled={isRemoving}
                  className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                  title={t('aiApiKey.removeApiKey', 'Remove API Key')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('aiApiKey.removeApiKey', 'Remove API Key')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Column 2: Data Privacy & Control Permissions */}
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-400" />
                  {t('aiApiKey.dataPermissions', 'Data Privacy & AI Permissions')}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Strict User Control</span>
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 cursor-pointer hover:border-slate-700 transition-colors">
                  <span className="text-slate-300">{t('aiApiKey.sendCandles', 'Send Candle OHLC Data')}</span>
                  <input
                    type="checkbox"
                    checked={config?.permissions.sendCandles ?? true}
                    onChange={(e) => handleTogglePermission('sendCandles', e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 cursor-pointer hover:border-slate-700 transition-colors">
                  <span className="text-slate-300">{t('aiApiKey.sendIndicators', 'Send Indicator Calculations')}</span>
                  <input
                    type="checkbox"
                    checked={config?.permissions.sendIndicators ?? true}
                    onChange={(e) => handleTogglePermission('sendIndicators', e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 cursor-pointer hover:border-slate-700 transition-colors">
                  <span className="text-slate-300">{t('aiApiKey.sendStrategyConfig', 'Send Strategy Config & Threshold')}</span>
                  <input
                    type="checkbox"
                    checked={config?.permissions.sendStrategyConfig ?? true}
                    onChange={(e) => handleTogglePermission('sendStrategyConfig', e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 cursor-pointer hover:border-slate-700 transition-colors">
                  <span className="text-slate-300">{t('aiApiKey.sendPatterns', 'Send Candle-Pattern Calculations')}</span>
                  <input
                    type="checkbox"
                    checked={config?.permissions.sendPatterns ?? true}
                    onChange={(e) => handleTogglePermission('sendPatterns', e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 cursor-pointer hover:border-slate-700 transition-colors">
                  <span className="text-slate-300">{t('aiApiKey.sendVision', 'Send Chart Screenshot (Vision)')}</span>
                  <input
                    type="checkbox"
                    checked={config?.permissions.sendVision ?? false}
                    onChange={(e) => handleTogglePermission('sendVision', e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 cursor-pointer hover:border-slate-700 transition-colors">
                  <span className="text-slate-300 font-semibold text-blue-300">
                    {t('aiApiKey.autoAnalysis', 'Automatic AI Analysis Mode')}
                  </span>
                  <input
                    type="checkbox"
                    checked={config?.permissions.autoAnalysis ?? false}
                    onChange={(e) => handleTogglePermission('autoAnalysis', e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                {config?.permissions.autoAnalysis && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-blue-950/20 border border-blue-900/40 text-[11px]">
                    <span className="text-blue-300">{t('aiApiKey.autoInterval', 'Auto-Analysis Interval')}:</span>
                    <select
                      value={config.permissions.autoAnalysisIntervalCandles}
                      onChange={(e) => handleTogglePermission('autoAnalysisIntervalCandles', parseInt(e.target.value, 10))}
                      className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 text-[11px]"
                    >
                      <option value="1">Every confirmed closed candle</option>
                      <option value="3">Every 3 closed candles</option>
                      <option value="5">Every 5 closed candles</option>
                      <option value="10">Every 10 closed candles</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Test Connection Result Card (If tested) */}
            {testResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-1.5 font-mono ${
                  testResult.success
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>AI CONNECTION: {testResult.status}</span>
                  <span className="text-[10px] opacity-80">
                    {new Date(testResult.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 font-sans">
                  Provider: {testResult.provider} | Model: {testResult.model}
                </div>
                <div className="text-[11px] text-slate-300 font-sans">
                  Status: {testResult.success ? t('aiApiKey.realApiResponseReceived', 'REAL API RESPONSE RECEIVED') : testResult.message}
                </div>
                {testResult.lastVerified && (
                  <div className="text-[10px] text-slate-400">
                    {t('aiApiKey.lastVerified', 'Last Verified')}: {new Date(testResult.lastVerified).toLocaleString()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Audit Trail Toggle */}
        <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setShowAuditLogs(!showAuditLogs);
              if (!showAuditLogs) loadAuditLogs();
            }}
            className="text-slate-400 hover:text-slate-200 flex items-center gap-1.5 font-semibold transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span>{t('aiApiKey.auditLogs', 'AI Audit Trail')}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
              {auditLogs.length}
            </span>
          </button>

          {showAuditLogs && (
            <button
              type="button"
              onClick={loadAuditLogs}
              className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t('aiApiKey.refreshAudit', 'Refresh Audit Logs')}</span>
            </button>
          )}
        </div>

        {/* Audit Trail Drawer / Table */}
        {showAuditLogs && (
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 max-h-60 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-4">
                {t('aiApiKey.noAuditLogs', 'No AI requests logged yet.')}
              </p>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px] font-mono flex items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold ${
                            log.status === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {log.status}
                        </span>
                        <span className="text-slate-200">{log.symbol}</span>
                        <span className="text-slate-500">({log.timeframe}s)</span>
                        <span className="text-blue-400">[{log.model}]</span>
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        {log.tokensUsed ? `Tokens: ${log.tokensUsed.prompt} in / ${log.tokensUsed.completion} out` : log.summary}
                        {log.durationMs && ` • Latency: ${log.durationMs}ms`}
                        {log.engineSignal && ` | Engine: ${log.engineSignal} vs AI: ${log.aiBias || 'N/A'}`}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: DEDICATED AI MARKET ANALYSIS CARD (Requirement 12)             */}
      {/* ========================================================================= */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100 tracking-wide">
                  {t('aiApiKey.marketAnalysisTitle', 'AI MARKET ANALYSIS')}
                </h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  Quantitative Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Deterministic Engine Source of Truth + Probabilistic Gemini Analysis
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAnalyzeChart}
            disabled={isAnalyzingChart}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzingChart ? 'animate-spin' : ''}`} />
            <span>{isAnalyzingChart ? t('aiApiKey.analyzing', 'Analyzing Real Market Chart...') : t('aiApiKey.analyzeCurrentChart', 'ANALYZE CURRENT CHART')}</span>
          </button>
        </div>

        {/* Metadata Telemetry Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
            <div className="text-[10px] text-slate-500 font-sans">{t('aiApiKey.provider', 'Provider')}</div>
            <div className="font-bold text-slate-200 truncate">Google Gemini</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
            <div className="text-[10px] text-slate-500 font-sans">{t('aiApiKey.modelLabel', 'Model')}</div>
            <div className="font-bold text-blue-400 truncate">
              {chartAnalysis?.modelUsed || selectedModel}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
            <div className="text-[10px] text-slate-500 font-sans">{t('aiApiKey.connectionStatus', 'Connection')}</div>
            <div className={`font-bold ${status === 'CONNECTED' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {status}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
            <div className="text-[10px] text-slate-500 font-sans">{t('aiApiKey.dataSource', 'Data Source')}</div>
            <div className="font-bold text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {chartAnalysis?.dataSourceStatus || 'LIVE'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
            <div className="text-[10px] text-slate-500 font-sans">{t('aiApiKey.symbol', 'Symbol')}</div>
            <div className="font-bold text-slate-100">{activeAsset}</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
            <div className="text-[10px] text-slate-500 font-sans">{t('aiApiKey.timeframe', 'Timeframe')}</div>
            <div className="font-bold text-slate-100">{timeframe}s</div>
          </div>
        </div>

        {/* Deterministic Reconciliation Panel (Requirement 10) */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              {t('aiApiKey.engineComparison', 'Deterministic Engine vs AI Comparison')}
            </span>
            <span className="text-[11px] text-emerald-400 font-mono">
              Auto Quantitative Confidence
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Deterministic Engine Decision */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400">{t('aiApiKey.engineDecision', 'Engine Decision')}</div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-black tracking-wider ${
                    (activeSignal?.type || 'WAIT') === 'UP'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : (activeSignal?.type || 'WAIT') === 'DOWN'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  }`}
                >
                  {activeSignal?.type || 'WAIT'}
                </span>
                <span className="font-mono text-slate-400 text-[11px]">
                  ({activeSignal?.confidence ?? 0}%)
                </span>
              </div>
            </div>

            {/* AI Bias Interpretation */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400">{t('aiApiKey.aiInterpretation', 'AI Interpretation')}</div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-black tracking-wider ${
                    chartAnalysis?.aiBias === 'BULLISH'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : chartAnalysis?.aiBias === 'BEARISH'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {chartAnalysis?.aiBias || 'WAITING'}
                </span>
                {chartAnalysis?.aiConfidence != null && (
                  <span className="font-mono text-slate-400 text-[11px]">
                    ({chartAnalysis.aiConfidence}%)
                  </span>
                )}
              </div>
            </div>

            {/* Alignment Status */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400">{t('aiApiKey.alignmentStatus', 'Alignment Status')}</div>
              <div>
                {chartAnalysis?.engineVsAiAlignment ? (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold ${
                      chartAnalysis.engineVsAiAlignment === 'MATCH'
                        ? 'text-emerald-400'
                        : chartAnalysis.engineVsAiAlignment === 'CONFLICT'
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {chartAnalysis.engineVsAiAlignment === 'MATCH' && <Check className="w-3.5 h-3.5" />}
                    {chartAnalysis.engineVsAiAlignment === 'CONFLICT' && <AlertTriangle className="w-3.5 h-3.5" />}
                    {chartAnalysis.engineVsAiAlignment}
                  </span>
                ) : (
                  <span className="text-slate-500 font-mono text-[11px]">Pending Analysis</span>
                )}
              </div>
            </div>

            {/* Automatic Strategy Confidence Score */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400">Quantitative Score</div>
              <div className="font-mono text-xs text-slate-200 flex items-center gap-1.5">
                <span className={activeSignal?.type !== 'WAIT' ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                  {activeSignal?.confidence ?? 0}%
                </span>
                <span className="text-slate-500 text-[10px]">
                  ({activeSignal?.type !== 'WAIT' ? 'CONFIRMED' : 'WAITING'})
                </span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 italic">
            * Note: The deterministic strategy engine remains the primary source of truth for signal generation. AI provides probabilistic contextual analysis and does not override engine rules.
          </p>
        </div>

        {/* Structured Chart Breakdown Grid (Requirement 12) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-200 border-b border-slate-800/80 pb-2">
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-blue-400" />
              {t('aiApiKey.chartAnalysis', 'CHART ANALYSIS')}
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              {chartAnalysis?.timestamp ? `Generated at ${new Date(chartAnalysis.timestamp).toLocaleTimeString()}` : 'Ready to analyze'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {/* Trend */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase font-bold">{t('aiApiKey.trend', 'Trend')}</div>
              <div className="text-slate-200 font-semibold">
                {typeof chartAnalysis?.trendAnalysis === 'string'
                  ? chartAnalysis.trendAnalysis
                  : typeof chartAnalysis?.trend === 'object' && chartAnalysis.trend?.direction
                  ? chartAnalysis.trend.direction
                  : indicators?.volatilityState || 'UNKNOWN'}
              </div>
            </div>

            {/* Candle Structure */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase font-bold">{t('aiApiKey.candleStructure', 'Candle Structure')}</div>
              <div className="text-slate-200 font-semibold">
                {typeof chartAnalysis?.candleStructureAnalysis === 'string'
                  ? chartAnalysis.candleStructureAnalysis
                  : typeof chartAnalysis?.candleStructure === 'object' && chartAnalysis.candleStructure?.pattern
                  ? `${chartAnalysis.candleStructure.pattern}${chartAnalysis.candleStructure.direction ? ` (${chartAnalysis.candleStructure.direction})` : ''}`
                  : activeSignal?.candle?.pattern || 'UNKNOWN'}
              </div>
            </div>

            {/* Momentum */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase font-bold">{t('aiApiKey.momentum', 'Momentum')}</div>
              <div className="text-slate-200 font-semibold">
                {typeof chartAnalysis?.momentumAnalysis === 'string'
                  ? chartAnalysis.momentumAnalysis
                  : typeof chartAnalysis?.momentum === 'object' && chartAnalysis.momentum?.state
                  ? chartAnalysis.momentum.state
                  : indicators?.rsi ? `RSI: ${indicators.rsi.toFixed(1)}` : 'UNKNOWN'}
              </div>
            </div>

            {/* MACD */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase font-bold">{t('aiApiKey.macd', 'MACD')}</div>
              <div className="text-slate-200 font-semibold">
                {typeof chartAnalysis?.macdInterpretation === 'object' && chartAnalysis.macdInterpretation !== null
                  ? `${chartAnalysis.macdInterpretation.signal || ''}${chartAnalysis.macdInterpretation.value ? ` (${chartAnalysis.macdInterpretation.value})` : ''}`
                  : typeof chartAnalysis?.macdInterpretation === 'string'
                  ? chartAnalysis.macdInterpretation
                  : indicators?.macd
                  ? `Hist: ${indicators.macd.histogram.toFixed(4)}`
                  : 'UNKNOWN'}
              </div>
            </div>

            {/* Strategy Conditions */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase font-bold">{t('aiApiKey.strategyConditions', 'Strategy Conditions')}</div>
              <div className="text-slate-200 font-semibold">
                {typeof chartAnalysis?.strategyConditionsState === 'string'
                  ? chartAnalysis.strategyConditionsState
                  : typeof chartAnalysis?.strategyConditions === 'object' && chartAnalysis.strategyConditions?.status
                  ? chartAnalysis.strategyConditions.status
                  : activeSignal?.type !== 'WAIT' ? t('aiApiKey.passed', 'Passed') : t('aiApiKey.incomplete', 'Incomplete')}
              </div>
            </div>

            {/* Conflicts */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase font-bold">{t('aiApiKey.conflicts', 'Conflicts')}</div>
              <div className="text-slate-200 font-semibold">
                {Array.isArray(chartAnalysis?.conflicts) && chartAnalysis.conflicts.length > 0
                  ? chartAnalysis.conflicts.map(c => typeof c === 'object' ? JSON.stringify(c) : String(c)).join('; ')
                  : Array.isArray(chartAnalysis?.detectedConflicts) && chartAnalysis.detectedConflicts.length > 0
                  ? chartAnalysis.detectedConflicts.map(c => typeof c === 'object' ? JSON.stringify(c) : String(c)).join('; ')
                  : t('aiApiKey.noneDetected', 'NONE DETECTED')}
              </div>
            </div>
          </div>

          {/* AI Summary Text Box */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-400 font-bold">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Brain className="w-3.5 h-3.5 text-amber-400" />
                {t('aiApiKey.aiSummary', 'AI Summary')}
              </span>
              {chartAnalysis?.modelUsed && (
                <span className="text-[10px] font-mono text-slate-500">
                  Model: {chartAnalysis.modelUsed}
                </span>
              )}
            </div>

            <p className="text-slate-300 leading-relaxed text-xs">
              {chartAnalysis?.summary ||
                'No chart analysis performed yet. Click [ ANALYZE CURRENT CHART ] above to run deep quantitative Gemini reasoning over real closed candles and indicator readings.'}
            </p>

            {chartAnalysis?.riskNote && (
              <div className="pt-2 border-t border-slate-800/60 text-[11px] text-amber-300/90 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>Risk Note: {chartAnalysis.riskNote}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

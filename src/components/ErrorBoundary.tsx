import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleSoftReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private sanitizeMessage(msg?: string): string {
    if (!msg) return '';
    // Mask potential token/hash sequences of length >= 16
    return msg
      .replace(/[a-f0-9]{24,}/gi, '[REDACTED_CREDENTIAL]')
      .replace(/[A-Za-z0-9_-]{28,}/g, '[REDACTED_TOKEN]');
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full p-6 flex flex-col items-center justify-center text-center bg-[#05070B] text-slate-100 relative overflow-hidden font-sans">
          {/* Ambient background glow */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

          <div className="relative z-10 w-full max-w-lg bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col items-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2 max-w-md">
              <h2 className="text-lg font-black text-slate-100 tracking-tight">
                {this.props.fallbackTitle || 'استعادة بيئة عمل المنصة (Platform Recovery)'}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                {this.props.fallbackMessage ||
                  'حدث توقف مؤقت أثناء معالجة عناصر الشاشة. البيانات والمحركات الأساسية مؤمنة في الخادم. يمكنك استعادة الواجهة أو إعادة التحميل فوراً.'}
              </p>
              {this.state.error?.message && (
                <div className="mt-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 font-mono overflow-x-auto text-left max-h-24">
                  {this.sanitizeMessage(this.state.error.message)}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 w-full">
              <button
                onClick={this.handleSoftReset}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                استعادة الواجهة (Soft Reset)
              </button>
              <button
                onClick={this.handleRetry}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة المحاولة (Reload)</span>
              </button>
            </div>

            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  try {
                    localStorage.removeItem('sabaa_session_token');
                    localStorage.removeItem('sabaa_device_token');
                    sessionStorage.clear();
                  } catch {}
                  window.location.reload();
                }
              }}
              className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors cursor-pointer underline pt-1"
            >
              مسح الذاكرة المؤقتة التالفة والبدء من جديد (Clear Corrupted Cache)
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

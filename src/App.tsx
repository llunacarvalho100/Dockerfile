import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Film,
  History,
  ListFilter,
  Loader2,
  Play,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import type {
  ActiveTab,
  AppStateResponse,
  ShopeeProduct,
  VideoCopyPackage,
} from './types.ts';
import {
  buildDefaultCopyTemplate,
  getProductEligibilityReason,
  selectNextEligibleProduct,
} from './lib/shopeePipeline.ts';
import { StudioWorkspace } from './components/StudioWorkspace.tsx';
import { CurationTable } from './components/CurationTable.tsx';
import { HistoryLedger } from './components/HistoryLedger.tsx';
import { IntegrationsView } from './components/IntegrationsView.tsx';

const TAB_LABELS: Record<ActiveTab, { label: string; breadcrumb: string }> = {
  studio: { label: 'Estúdio de Produção', breadcrumb: 'Estúdio / Produção 9:16' },
  curation: { label: 'Curadoria Shopee', breadcrumb: 'Catálogo / Curadoria' },
  history: { label: 'Histórico & Filtro', breadcrumb: 'Conta / Anti-Duplicidade' },
  integrations: { label: 'Agenda & Integrações', breadcrumb: 'Sistema / Agenda & APIs' },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('studio');
  const [appState, setAppState] = useState<AppStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const [activeSlot, setActiveSlot] = useState<1 | 2 | 3>(1);
  const [selectedProduct, setSelectedProduct] = useState<ShopeeProduct | null>(null);
  const [copy, setCopy] = useState<VideoCopyPackage>({
    termo_busca_principal: 'Mini Processador Elétrico',
    tipo_gancho: 'dor_pratica',
    titulo_curto_capa: 'Vale cada centavo!',
    narracao_locucao: '',
    legenda_postagem: '',
    hashtags: ['#AchadinhosShopee', '#ShopeeBrasil'],
    aigc_label: true,
    google_flow: {
      ingredient_instruction: 'Suba a foto principal do produto como Ingredient no Google Flow.',
      scene_prompts: [
        {
          cena: 'Cena 1 · Gancho Visual',
          intervalo: '0–3s',
          prompt_en: 'Vertical 9:16 sunlit Brazilian kitchen hook shot.',
        },
        {
          cena: 'Cena 2 · Demonstração Dinâmica',
          intervalo: '3–15s',
          prompt_en: 'Vertical 9:16 product demo showing crisp textures.',
        },
        {
          cena: 'Cena 3 · Resultado & CTA',
          intervalo: '15–22s',
          prompt_en: 'Vertical 9:16 clean hero framing for orange cart CTA.',
        },
      ],
      veo_master_prompt: 'Vertical 9:16 photorealistic product showcase in a sunlit Brazilian home.',
    },
  });

  const [voiceName, setVoiceName] = useState('Kore');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFilename, setAudioFilename] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(10);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFilename, setVideoFilename] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [isGeneratingVeo, setIsGeneratingVeo] = useState(false);
  const [isMuxingFlow, setIsMuxingFlow] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRunningCycle, setIsRunningCycle] = useState(false);

  const loadProductIntoStudio = useCallback((prod: ShopeeProduct | null) => {
    setSelectedProduct(prod);
    setAudioUrl(null);
    setAudioFilename(null);
    setVideoUrl(null);
    setVideoFilename(null);
    if (prod) {
      setCopy(buildDefaultCopyTemplate(prod));
    }
  }, []);

  const fetchState = useCallback(
    async (preserveSelection = true) => {
      try {
        const res = await fetch('/api/state');
        if (!res.ok) throw new Error('Falha ao carregar estado do servidor.');
        const data = (await res.json()) as AppStateResponse;
        setAppState(data);

        if (!preserveSelection || !selectedProduct) {
          const postedIds = data.history.map((h) => h.itemId);
          const next = selectNextEligibleProduct(data.catalog, postedIds);
          loadProductIntoStudio(next);
        }
      } catch (err) {
        setErrorBanner(err instanceof Error ? err.message : 'Erro ao conectar com servidor.');
      } finally {
        setLoading(false);
      }
    },
    [loadProductIntoStudio, selectedProduct]
  );

  useEffect(() => {
    void fetchState(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const postedIds = useMemo(
    () => (appState ? appState.history.map((h) => h.itemId) : []),
    [appState]
  );

  const eligibleProducts = useMemo(() => {
    if (!appState) return [];
    return appState.catalog.filter(
      (p) => getProductEligibilityReason(p, postedIds).eligible
    );
  }, [appState, postedIds]);

  const handlePickNextEligible = () => {
    if (eligibleProducts.length === 0) {
      loadProductIntoStudio(null);
      return;
    }
    const currentIdx = selectedProduct
      ? eligibleProducts.findIndex((p) => p.itemId === selectedProduct.itemId)
      : -1;
    const next = eligibleProducts[(currentIdx + 1) % eligibleProducts.length];
    loadProductIntoStudio(next);
  };

  const handleSyncShopee = async () => {
    setIsSyncing(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/shopee/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao sincronizar Shopee.');
      await fetchState(true);
      setSuccessBanner('Catálogo Shopee atualizado.');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Erro ao sincronizar catálogo.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGenerateCopy = async () => {
    if (!selectedProduct) return;
    setIsGeneratingCopy(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/ai/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produto: selectedProduct, slotNumber: activeSlot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao gerar roteiro com Gemini.');
      setCopy(data.copy);
      setSuccessBanner('Roteiro, legenda e hashtags gerados com Gemini.');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Erro na geração de roteiro.');
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!selectedProduct || !copy.narracao_locucao.trim()) return;
    setIsGeneratingAudio(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: copy.narracao_locucao,
          voiceName,
          itemId: selectedProduct.itemId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao gerar áudio neural.');
      setAudioUrl(data.audioUrl);
      setAudioFilename(data.filename);
      setAudioDuration(data.durationSec || 10);
      setSuccessBanner('Locução WAV gerada com sucesso.');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Erro ao gerar áudio.');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleRenderVideo = async () => {
    if (!selectedProduct) return;
    setIsRenderingVideo(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/video/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produto: selectedProduct,
          slotNumber: activeSlot,
          audioFilename,
          durationSec: audioDuration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao renderizar vídeo MP4.');
      setVideoUrl(data.videoUrl);
      setVideoFilename(data.filename);
      setSuccessBanner('Vídeo vertical 9:16 (MP4) renderizado com FFmpeg.');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Erro ao renderizar vídeo.');
    } finally {
      setIsRenderingVideo(false);
    }
  };

  const handleGenerateVeo = async () => {
    if (!selectedProduct) return;
    setIsGeneratingVeo(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/flow/generate-veo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produto: selectedProduct,
          veoMasterPrompt: copy.google_flow?.veo_master_prompt,
          slotNumber: activeSlot,
          audioFilename,
          durationSec: audioDuration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao gerar cena com Veo.');
      setVideoUrl(data.videoUrl);
      setVideoFilename(data.filename);
      setSuccessBanner(
        data.engine === 'veo_2'
          ? 'Cena vertical 9:16 gerada com Veo 2.0 e pronta para envio!'
          : data.fallbackReason || 'Vídeo 9:16 gerado via fallback FFmpeg Ken Burns.'
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Erro ao gerar cena com Veo.');
    } finally {
      setIsGeneratingVeo(false);
    }
  };

  const handleImportFlowVideo = async (file: File) => {
    if (!selectedProduct) return;
    setIsMuxingFlow(true);
    setErrorBanner(null);
    try {
      const params = new URLSearchParams({
        itemId: selectedProduct.itemId,
        slotNumber: String(activeSlot),
        ...(audioFilename ? { audioFilename } : {}),
      });
      const res = await fetch(`/api/flow/mux-custom-video?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'video/mp4' },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao mixar vídeo do Google Flow.');
      setVideoUrl(data.videoUrl);
      setVideoFilename(data.filename);
      setSuccessBanner(
        data.audioMuxed
          ? 'Vídeo do Google Flow normalizado em 1080×1920 com voz em português mixada!'
          : 'Vídeo do Google Flow normalizado em 1080×1920 (gere o áudio antes se quiser mixar a locução).'
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Erro ao importar vídeo .mp4 do Google Flow.');
    } finally {
      setIsMuxingFlow(false);
    }
  };

  const handlePublishDispatch = async () => {
    if (!selectedProduct) return;
    setIsPublishing(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/publish/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produto: selectedProduct,
          copy,
          slotNumber: activeSlot,
          videoFilename,
          videoUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao registrar publicação.');
      setAppState((prev) =>
        prev ? { ...prev, history: data.history, slots: data.slots } : prev
      );
      setSuccessBanner(data.telegramDetail || 'Pacote registrado em produtos_postados.json.');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Erro ao publicar pacote.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRunFullCycle = async () => {
    setIsRunningCycle(true);
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      const res = await fetch('/api/pipeline/run-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotNumber: activeSlot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao executar ciclo completo do slot.');
      setSelectedProduct(data.produto);
      setCopy(data.copy);
      setAudioUrl(data.audioUrl);
      setVideoUrl(data.videoUrl);
      setAppState((prev) =>
        prev ? { ...prev, history: data.history, slots: data.slots } : prev
      );
      setActiveTab('studio');
      setSuccessBanner(
        `Slot #${activeSlot} concluído: vídeo renderizado e ${data.historyEntry.itemId} salvo no histórico.`
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Falha ao executar ciclo automático.');
    } finally {
      setIsRunningCycle(false);
    }
  };

  const handleRemoveHistoryItem = async (itemId: string) => {
    setErrorBanner(null);
    const res = await fetch('/api/history/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId }),
    });
    const data = await res.json();
    if (res.ok) {
      setAppState((prev) => (prev ? { ...prev, history: data.history } : prev));
      setSuccessBanner(`Produto ${itemId} reativado para elegibilidade.`);
    }
  };

  const handleClearHistory = async () => {
    setErrorBanner(null);
    const res = await fetch('/api/history/clear', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setAppState((prev) => (prev ? { ...prev, history: data.history } : prev));
      setSuccessBanner('Histórico anti-duplicidade limpo.');
    }
  };

  const handleSaveIntegrations = async (payload: Record<string, unknown>) => {
    setErrorBanner(null);
    const res = await fetch('/api/integrations/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha ao salvar configurações.');
    setAppState((prev) =>
      prev
        ? {
            ...prev,
            slots: data.slots,
            integrationsStatus: data.integrationsStatus,
          }
        : prev
    );
  };

  const navItems: Array<{ id: ActiveTab; label: string; icon: typeof Film }> = [
    { id: 'studio', label: 'Estúdio de Produção', icon: Film },
    { id: 'curation', label: 'Curadoria Shopee', icon: ListFilter },
    { id: 'history', label: 'Histórico & Filtro', icon: History },
    { id: 'integrations', label: 'Agenda & Integrações', icon: CalendarClock },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#FAFAFA] text-[#0F172A]">
      {/* Sidebar Navigation */}
      <aside className="lg:w-64 lg:shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col">
        <div className="h-16 px-5 border-b border-slate-200 flex items-center">
          <span className="font-display font-bold text-base tracking-tight text-slate-900 whitespace-nowrap">
            Shopee Vídeo Studio
          </span>
        </div>

        <nav
          aria-label="Navegação principal"
          className="p-2.5 lg:p-3 grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-col gap-1"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-2.5 lg:px-3 py-2 lg:py-2.5 rounded-lg text-xs lg:text-sm font-medium transition-colors whitespace-nowrap shrink-0 text-left ${
                  isActive
                    ? 'bg-[#EE4D2D]/10 text-[#EE4D2D]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {appState ? (
          <div className="hidden lg:flex flex-col gap-2 mt-auto p-4 border-t border-slate-100 text-xs text-slate-500">
            <div className="flex items-center justify-between">
              <span>Elegíveis agora</span>
              <span className="font-mono-tabular font-semibold text-slate-800">
                {eligibleProducts.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Postados (janela 150)</span>
              <span className="font-mono-tabular font-semibold text-slate-800">
                {appState.history.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Agenda automática</span>
              <span className="font-medium text-slate-800">
                {appState.integrationsStatus.autoScheduleEnabled ? 'Ativa' : 'Manual'}
              </span>
            </div>
          </div>
        ) : null}
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left, 1 primary CTA on right */}
        <header className="min-h-14 lg:h-16 bg-white border-b border-slate-200 px-4 py-2.5 lg:py-0 lg:px-8 flex flex-wrap items-center justify-between gap-3 lg:gap-6">
          <div className="text-xs lg:text-sm font-medium text-slate-600">
            {TAB_LABELS[activeTab].breadcrumb}
          </div>

          <button
            type="button"
            disabled={isRunningCycle || loading}
            onClick={handleRunFullCycle}
            className="inline-flex items-center gap-2 px-3.5 lg:px-4 py-2 text-xs font-semibold rounded-lg bg-[#EE4D2D] text-white hover:bg-[#D93E20] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            {isRunningCycle ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>
              {isRunningCycle
                ? `Executando Slot #${activeSlot}...`
                : `Executar Slot #${activeSlot} Completo`}
            </span>
          </button>
        </header>

        <main className="flex-1 p-5 lg:p-8 max-w-[1280px] w-full mx-auto flex flex-col gap-5">
          {errorBanner ? (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs font-medium"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                aria-label="Fechar alerta de erro"
                className="p-1 text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : null}

          {successBanner ? (
            <div
              role="status"
              className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs font-medium"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessBanner(null)}
                aria-label="Fechar aviso de sucesso"
                className="p-1 text-emerald-600 hover:text-emerald-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : null}

          {loading || !appState ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 flex items-center justify-center gap-2 text-sm text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin text-[#EE4D2D]" />
              <span>Carregando pipeline Shopee Vídeo...</span>
            </div>
          ) : (
            <>
              {activeTab === 'studio' ? (
                <StudioWorkspace
                  slots={appState.slots}
                  activeSlot={activeSlot}
                  onSelectSlot={setActiveSlot}
                  produto={selectedProduct}
                  eligibleCount={eligibleProducts.length}
                  onPickNextEligible={handlePickNextEligible}
                  onOpenCuration={() => setActiveTab('curation')}
                  copy={copy}
                  onChangeCopy={setCopy}
                  onGenerateCopy={handleGenerateCopy}
                  isGeneratingCopy={isGeneratingCopy}
                  voiceName={voiceName}
                  onVoiceChange={setVoiceName}
                  audioUrl={audioUrl}
                  audioFilename={audioFilename}
                  videoUrl={videoUrl}
                  isGeneratingAudio={isGeneratingAudio}
                  isRenderingVideo={isRenderingVideo}
                  isGeneratingVeo={isGeneratingVeo}
                  isMuxingFlow={isMuxingFlow}
                  isPublishing={isPublishing}
                  onGenerateAudio={handleGenerateAudio}
                  onRenderVideo={handleRenderVideo}
                  onGenerateVeo={handleGenerateVeo}
                  onImportFlowVideo={handleImportFlowVideo}
                  onPublishDispatch={handlePublishDispatch}
                />
              ) : null}

              {activeTab === 'curation' ? (
                <CurationTable
                  catalog={appState.catalog}
                  postedIds={postedIds}
                  shopeeMode={appState.shopeeMode}
                  selectedProductId={selectedProduct?.itemId ?? null}
                  isSyncing={isSyncing}
                  onSync={handleSyncShopee}
                  onSelectProduct={(prod) => {
                    loadProductIntoStudio(prod);
                    setActiveTab('studio');
                  }}
                />
              ) : null}

              {activeTab === 'history' ? (
                <HistoryLedger
                  history={appState.history}
                  dataDir={appState.dataDir || './data'}
                  onRemoveItem={handleRemoveHistoryItem}
                  onClearAll={handleClearHistory}
                />
              ) : null}

              {activeTab === 'integrations' ? (
                <IntegrationsView
                  slots={appState.slots}
                  status={appState.integrationsStatus}
                  onSaveConfig={handleSaveIntegrations}
                />
              ) : null}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Loader2,
  Send,
  Sparkles,
  Shuffle,
  Clapperboard,
} from 'lucide-react';
import type {
  HookType,
  ShopeeProduct,
  SlotConfig,
  VideoCopyPackage,
} from '../types.ts';
import {
  HOOK_TYPE_LABELS,
  buildTelegramOperationalMessage,
  calculateConversionIndex,
  calculatePriorityScore,
  isSeoPrefixValid,
} from '../lib/shopeePipeline.ts';
import { ProductImage } from './ProductImage.tsx';
import { VideoStagePreview } from './VideoStagePreview.tsx';

interface StudioWorkspaceProps {
  slots: SlotConfig[];
  activeSlot: 1 | 2 | 3;
  onSelectSlot: (slot: 1 | 2 | 3) => void;
  produto: ShopeeProduct | null;
  eligibleCount: number;
  onPickNextEligible: () => void;
  onOpenCuration: () => void;
  copy: VideoCopyPackage;
  onChangeCopy: (next: VideoCopyPackage) => void;
  onGenerateCopy: () => void;
  isGeneratingCopy: boolean;
  voiceName: string;
  onVoiceChange: (voice: string) => void;
  audioUrl: string | null;
  audioFilename: string | null;
  videoUrl: string | null;
  videoFilename?: string | null;
  isGeneratingAudio: boolean;
  isRenderingVideo: boolean;
  isGeneratingVeo: boolean;
  isMuxingFlow: boolean;
  isPublishing: boolean;
  onGenerateAudio: () => void;
  onRenderVideo: () => void;
  onGenerateVeo: () => void;
  onImportFlowVideo: (file: File) => void;
  onPublishDispatch: () => void;
}

const SLOT_STATUS_TEXT: Record<SlotConfig['lastStatus'], string> = {
  idle: 'Aguardando',
  running: 'Processando',
  completed: 'Concluído',
  error: 'Erro',
};

export function StudioWorkspace({
  slots,
  activeSlot,
  onSelectSlot,
  produto,
  eligibleCount,
  onPickNextEligible,
  onOpenCuration,
  copy,
  onChangeCopy,
  onGenerateCopy,
  isGeneratingCopy,
  voiceName,
  onVoiceChange,
  audioUrl,
  audioFilename,
  videoUrl,
  videoFilename,
  isGeneratingAudio,
  isRenderingVideo,
  isGeneratingVeo,
  isMuxingFlow,
  isPublishing,
  onGenerateAudio,
  onRenderVideo,
  onGenerateVeo,
  onImportFlowVideo,
  onPublishDispatch,
}: StudioWorkspaceProps) {
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedPackage, setCopiedPackage] = useState(false);
  const [flowOpen, setFlowOpen] = useState(true);
  const [copiedFlowIdx, setCopiedFlowIdx] = useState<number | 'master' | null>(null);

  const wordCount = copy.narracao_locucao
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const operational = produto
    ? buildTelegramOperationalMessage(produto, copy, activeSlot)
    : null;

  const handleCopyCaption = async () => {
    if (!operational) return;
    await navigator.clipboard.writeText(operational.legendaCompleta);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 1800);
  };

  const handleCopyPackage = async () => {
    if (!operational) return;
    await navigator.clipboard.writeText(operational.mensagemOperacional);
    setCopiedPackage(true);
    setTimeout(() => setCopiedPackage(false), 1800);
  };

  const handleCopyFlowPrompt = async (text: string, idx: number | 'master') => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedFlowIdx(idx);
    setTimeout(() => setCopiedFlowIdx(null), 1800);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 3 Daily Slots Strip */}
      <section aria-label="Agenda de slots diários" className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {slots.map((slot) => {
          const isSelected = slot.slot === activeSlot;
          return (
            <button
              key={slot.slot}
              type="button"
              onClick={() => onSelectSlot(slot.slot)}
              className={`text-left rounded-xl border p-4 transition-colors ${
                isSelected
                  ? 'bg-white border-[#EE4D2D] ring-1 ring-[#EE4D2D]/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 font-mono-tabular">
                  <Clock className={`w-3.5 h-3.5 ${isSelected ? 'text-[#EE4D2D]' : 'text-slate-400'}`} />
                  <span>{slot.time}</span>
                </span>
                <span
                  className={`text-xs font-medium ${
                    slot.lastStatus === 'completed'
                      ? 'text-emerald-700'
                      : slot.lastStatus === 'error'
                        ? 'text-red-700'
                        : slot.lastStatus === 'running'
                          ? 'text-amber-700'
                          : 'text-slate-500'
                  }`}
                >
                  {SLOT_STATUS_TEXT[slot.lastStatus]}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-700 mt-1.5">
                Slot #{slot.slot} · {slot.label}
              </p>
            </button>
          );
        })}
      </section>

      {/* Main 2-Column Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (7/12): Product + AI Script + Operational Package */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Selected Product Card */}
          <section
            aria-label="Produto selecionado para o vídeo"
            className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  1. Produto Elegível Selecionado
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {eligibleCount} ofertas disponíveis com nota ≥ 4.7 e ≥ 50 vendas
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onPickNextEligible}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Próximo Elegível</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenCuration}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  Ver Tabela
                </button>
              </div>
            </div>

            {produto ? (
              <div className="border-t border-slate-100 pt-4 flex items-center gap-4">
                <ProductImage
                  src={produto.imageUrl}
                  alt={produto.productName}
                  className="w-16 h-16 rounded-lg border border-slate-200 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 line-clamp-2">
                    {produto.productName}
                  </p>
                  <p className="text-xs text-slate-600 font-mono-tabular mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="whitespace-nowrap">ID {produto.itemId}</span>
                    <span aria-hidden="true">·</span>
                    <span className="whitespace-nowrap">R$ {produto.price.toFixed(2).replace('.', ',')}</span>
                    <span aria-hidden="true">·</span>
                    <span className="whitespace-nowrap">{produto.ratingStar.toFixed(1)} ★</span>
                    <span aria-hidden="true">·</span>
                    <span className="whitespace-nowrap">{produto.sales.toLocaleString('pt-BR')} vendas</span>
                    <span aria-hidden="true">·</span>
                    <span className="whitespace-nowrap">{(produto.commissionRate * 100).toFixed(0)}% comissão</span>
                    <span aria-hidden="true">·</span>
                    <span className="whitespace-nowrap font-semibold text-slate-800">
                      Conv {calculateConversionIndex(produto).toLocaleString('pt-BR')} (Score {calculatePriorityScore(produto).toLocaleString('pt-BR')})
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="border-t border-slate-100 pt-4 text-xs text-amber-700">
                Todos os produtos elegíveis do catálogo já foram postados. Reative itens no Histórico ou atualize as ofertas na Curadoria.
              </div>
            )}
          </section>

          {/* AI Copywriting Form */}
          <section
            aria-label="Roteiro e legenda com Inteligência Artificial"
            className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  2. Roteiro e Legenda IA (Shopee Vídeo)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Gancho nos 3 primeiros segundos, linguagem natural de achadinho e CTA para o carrinho laranja.
                </p>
              </div>

              <button
                type="button"
                disabled={!produto || isGeneratingCopy}
                onClick={onGenerateCopy}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
              >
                {isGeneratingCopy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{isGeneratingCopy ? 'Gerando...' : 'Gerar Roteiro com IA'}</span>
              </button>
            </div>

            <div className="border-t border-slate-100 pt-4 flex flex-col gap-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="copy-search-term" className="block text-xs font-medium text-slate-700 mb-1">
                    Termo de busca SEO (2 a 3 palavras)
                  </label>
                  <input
                    id="copy-search-term"
                    type="text"
                    value={copy.termo_busca_principal}
                    onChange={(e) =>
                      onChangeCopy({ ...copy, termo_busca_principal: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/20 focus:border-[#EE4D2D]"
                  />
                </div>

                <div>
                  <label htmlFor="copy-hook-type" className="block text-xs font-medium text-slate-700 mb-1">
                    Estratégia de gancho (3s iniciais)
                  </label>
                  <select
                    id="copy-hook-type"
                    value={copy.tipo_gancho}
                    onChange={(e) =>
                      onChangeCopy({ ...copy, tipo_gancho: e.target.value as HookType })
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/20 focus:border-[#EE4D2D]"
                  >
                    {(Object.entries(HOOK_TYPE_LABELS) as Array<[HookType, string]>).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="copy-cover-title" className="block text-xs font-medium text-slate-700 mb-1">
                  Título curto da capa (máx. 4 palavras)
                </label>
                <input
                  id="copy-cover-title"
                  type="text"
                  value={copy.titulo_curto_capa}
                  onChange={(e) =>
                    onChangeCopy({ ...copy, titulo_curto_capa: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/20 focus:border-[#EE4D2D]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="copy-narration" className="text-xs font-medium text-slate-700">
                    Narração da locução (45 a 60 palavras · sem saudações)
                  </label>
                  <span className="text-[11px] font-mono-tabular text-slate-500">
                    {wordCount} palavras
                  </span>
                </div>
                <textarea
                  id="copy-narration"
                  rows={3}
                  value={copy.narracao_locucao}
                  onChange={(e) =>
                    onChangeCopy({ ...copy, narracao_locucao: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/20 focus:border-[#EE4D2D]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label htmlFor="copy-caption" className="text-xs font-medium text-slate-700">
                    Legenda da postagem (SEO nos 40 primeiros caracteres · máx. 140)
                  </label>
                  <span
                    className={`text-[11px] font-mono-tabular whitespace-nowrap ${
                      copy.legenda_postagem.length > 140 ? 'text-red-600 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {isSeoPrefixValid(copy.legenda_postagem, copy.termo_busca_principal)
                      ? 'SEO OK'
                      : 'Incluir termo no início'}{' '}
                    · {copy.legenda_postagem.length}/140
                  </span>
                </div>
                <input
                  id="copy-caption"
                  type="text"
                  value={copy.legenda_postagem}
                  onChange={(e) =>
                    onChangeCopy({ ...copy, legenda_postagem: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/20 focus:border-[#EE4D2D]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label htmlFor="copy-hashtags" className="block text-xs font-medium text-slate-700 mb-1">
                    Hashtags
                  </label>
                  <input
                    id="copy-hashtags"
                    type="text"
                    value={copy.hashtags.join(' ')}
                    onChange={(e) =>
                      onChangeCopy({
                        ...copy,
                        hashtags: e.target.value.split(/\s+/).filter(Boolean),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/20 focus:border-[#EE4D2D]"
                  />
                </div>

                <label className="inline-flex items-center gap-2 py-2 px-3 border border-slate-200 rounded-lg cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={copy.aigc_label}
                    onChange={(e) =>
                      onChangeCopy({ ...copy, aigc_label: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#EE4D2D] rounded"
                  />
                  <span className="text-xs font-medium text-slate-800">
                    Ativar marcação AIGC (IA)
                  </span>
                </label>
              </div>

              {/* Google Flow Collapsible Panel */}
              <div className="border-t border-slate-100 pt-3.5 mt-1">
                <button
                  type="button"
                  aria-expanded={flowOpen}
                  onClick={() => setFlowOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-2 py-1.5 text-left text-xs font-semibold text-slate-900 hover:text-[#EE4D2D] transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <Clapperboard className="w-4 h-4 text-[#EE4D2D] shrink-0" />
                    <span>Google Flow (Prompts de Cenas &amp; Veo 9:16)</span>
                  </span>
                  {flowOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>

                {flowOpen && copy.google_flow ? (
                  <div className="mt-3 flex flex-col gap-3">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      <span className="font-semibold text-slate-800">Ingredients:</span>{' '}
                      {copy.google_flow.ingredient_instruction}
                    </p>

                    <div className="flex flex-col gap-2.5 divide-y divide-slate-100">
                      {copy.google_flow.scene_prompts.map((scene, index) => (
                        <div key={`${scene.cena}-${index}`} className="pt-2.5 first:pt-0 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-800">
                              {scene.cena}{' '}
                              <span className="font-mono-tabular font-normal text-slate-500">
                                ({scene.intervalo})
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyFlowPrompt(scene.prompt_en, index)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                            >
                              {copiedFlowIdx === index ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>{copiedFlowIdx === index ? 'Copiado' : 'Copiar Prompt Flow'}</span>
                            </button>
                          </div>
                          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5 leading-relaxed font-mono-tabular">
                            {scene.prompt_en}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor="veo-master-prompt" className="text-xs font-semibold text-slate-800">
                          Veo Master Prompt (Image-to-Video 9:16)
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyFlowPrompt(copy.google_flow.veo_master_prompt, 'master')
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                        >
                          {copiedFlowIdx === 'master' ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedFlowIdx === 'master' ? 'Copiado' : 'Copiar Master'}</span>
                        </button>
                      </div>
                      <textarea
                        id="veo-master-prompt"
                        rows={4}
                        value={copy.google_flow.veo_master_prompt}
                        onChange={(e) =>
                          onChangeCopy({
                            ...copy,
                            google_flow: {
                              ...copy.google_flow,
                              veo_master_prompt: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-slate-200 rounded-lg text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/20 focus:border-[#EE4D2D]"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {/* Module 4: Operational Dispatch Package */}
          <section
            aria-label="Pacote operacional e disparo"
            className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  3. Pacote Pronto (Carrinho Laranja & Telegram)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Copie a legenda ou envie o pacote completo e registre o Item ID no filtro anti-duplicidade.
                </p>
              </div>
            </div>

            {operational ? (
              <div className="border-t border-slate-100 pt-4 flex flex-col gap-3">
                <pre className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono-tabular text-slate-800 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  {operational.mensagemOperacional}
                </pre>

                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyCaption}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
                    >
                      {copiedCaption ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedCaption ? 'Legenda Copiada' : 'Copiar Legenda'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyPackage}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
                    >
                      {copiedPackage ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedPackage ? 'Pacote Copiado' : 'Copiar Pacote'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={isPublishing}
                    onClick={onPublishDispatch}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#EE4D2D] text-white hover:bg-[#D93E20] disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {isPublishing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isPublishing ? 'Registrando...' : 'Publicar e Salvar no Histórico'}
                    </span>
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        {/* Right Column (5/12): 9:16 Vertical Stage */}
        <div className="lg:col-span-5 lg:sticky lg:top-6">
          <VideoStagePreview
            produto={produto}
            copy={copy}
            activeSlot={activeSlot}
            voiceName={voiceName}
            onVoiceChange={onVoiceChange}
            audioUrl={audioUrl}
            audioFilename={audioFilename}
            videoUrl={videoUrl}
            videoFilename={videoFilename}
            isGeneratingAudio={isGeneratingAudio}
            isRenderingVideo={isRenderingVideo}
            isGeneratingVeo={isGeneratingVeo}
            isMuxingFlow={isMuxingFlow}
            onGenerateAudio={onGenerateAudio}
            onRenderVideo={onRenderVideo}
            onGenerateVeo={onGenerateVeo}
            onImportFlowVideo={onImportFlowVideo}
          />
        </div>
      </div>
    </div>
  );
}

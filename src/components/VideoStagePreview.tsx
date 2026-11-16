import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  Clapperboard,
  Download,
  Film,
  Pause,
  Play,
  ShoppingBag,
  Upload,
  Volume2,
  Loader2,
} from 'lucide-react';
import type { ShopeeProduct, VideoCopyPackage } from '../types.ts';
import { ProductImage } from './ProductImage.tsx';

interface VideoStagePreviewProps {
  produto: ShopeeProduct | null;
  copy: VideoCopyPackage;
  activeSlot: number;
  voiceName: string;
  onVoiceChange: (voice: string) => void;
  audioUrl: string | null;
  audioFilename: string | null;
  videoUrl: string | null;
  isGeneratingAudio: boolean;
  isRenderingVideo: boolean;
  isGeneratingVeo: boolean;
  isMuxingFlow: boolean;
  onGenerateAudio: () => void;
  onRenderVideo: () => void;
  onGenerateVeo: () => void;
  onImportFlowVideo: (file: File) => void;
}

export function VideoStagePreview({
  produto,
  copy,
  activeSlot,
  voiceName,
  onVoiceChange,
  audioUrl,
  videoUrl,
  isGeneratingAudio,
  isRenderingVideo,
  isGeneratingVeo,
  isMuxingFlow,
  onGenerateAudio,
  onRenderVideo,
  onGenerateVeo,
  onImportFlowVideo,
}: VideoStagePreviewProps) {
  const [isPlayingPreview, setIsPlayingPreview] = useState(true);
  const [viewMode, setViewMode] = useState<'canvas' | 'mp4'>('canvas');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (videoUrl) {
      setViewMode('mp4');
    }
  }, [videoUrl]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportFlowVideo(file);
    }
    e.target.value = '';
  };

  const effectiveView = videoUrl && viewMode === 'mp4' ? 'mp4' : 'canvas';

  return (
    <section
      aria-label="Pré-visualização vertical 9:16"
      className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Palco 9:16 · Slot #{activeSlot}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            1080×1920 · Zoompan Ken Burns · Anti-duplicidade
          </p>
        </div>

        {videoUrl ? (
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('canvas')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                effectiveView === 'canvas'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Simulação
            </button>
            <button
              type="button"
              onClick={() => setViewMode('mp4')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                effectiveView === 'mp4'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              MP4 Renderizado
            </button>
          </div>
        ) : null}
      </div>

      {/* 9:16 Phone Viewport */}
      <div className="mx-auto w-full max-w-[290px] aspect-[9/16] rounded-xl overflow-hidden bg-slate-900 border border-slate-200 relative">
        {effectiveView === 'mp4' && videoUrl ? (
          <video
            key={videoUrl}
            src={videoUrl}
            controls
            playsInline
            className="w-full h-full object-cover"
          />
        ) : produto ? (
          <div className="relative w-full h-full overflow-hidden select-none">
            <div
              className={`w-full h-full ${isPlayingPreview ? 'animate-kenburns' : ''}`}
              style={{ filter: 'contrast(1.04) saturate(1.06) brightness(1.01)' }}
            >
              <ProductImage
                src={produto.imageUrl}
                alt={produto.productName}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Scrim top & bottom for >=4.5:1 contrast */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/85 pointer-events-none" />

            {/* Top Hook Cover Title */}
            <div className="absolute top-11 inset-x-4 text-center px-2">
              <p className="text-white font-display font-bold text-lg leading-tight drop-shadow-sm">
                {copy.titulo_curto_capa || 'Achadinho Shopee'}
              </p>
              {copy.aigc_label ? (
                <p className="text-[11px] text-white/85 mt-1.5 font-medium">
                  Conteúdo assistido por IA · AIGC
                </p>
              ) : null}
            </div>

            {/* Play/Pause Simulation Button */}
            <button
              type="button"
              onClick={() => setIsPlayingPreview((prev) => !prev)}
              aria-label={isPlayingPreview ? 'Pausar simulação Ken Burns' : 'Reproduzir simulação Ken Burns'}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/75 transition-colors"
            >
              {isPlayingPreview ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5 ml-0.5" />
              )}
            </button>

            {/* Bottom Shopee Video Overlay + Carrinho Laranja */}
            <div className="absolute bottom-3.5 inset-x-3.5 flex flex-col gap-2.5 text-left">
              <p className="text-white/95 text-xs leading-snug line-clamp-3 font-medium">
                {copy.narracao_locucao}
              </p>

              <div className="bg-white/95 rounded-lg p-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-[#EE4D2D] text-white flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-900 truncate">
                      {produto.productName}
                    </p>
                    <p className="text-[11px] font-mono-tabular text-[#EE4D2D] font-semibold">
                      R$ {produto.price.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-[#EE4D2D] whitespace-nowrap shrink-0">
                  Comprar
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
            <Film className="w-8 h-8 mb-2 stroke-[1.5]" />
            <p className="text-xs text-slate-300">
              Selecione um produto na Curadoria para visualizar a cena 9:16.
            </p>
          </div>
        )}
      </div>

      {/* Voice & Audio Controls */}
      <div className="border-t border-slate-100 pt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="tts-voice-select" className="text-xs font-medium text-slate-700">
            Voz Neural (Gemini TTS)
          </label>
          <select
            id="tts-voice-select"
            value={voiceName}
            onChange={(e) => onVoiceChange(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/20 focus:border-[#EE4D2D]"
          >
            <option value="Kore">Kore · Feminina Natural</option>
            <option value="Zephyr">Zephyr · Dinâmica</option>
            <option value="Puck">Puck · Jovem Expressiva</option>
            <option value="Fenrir">Fenrir · Masculina Firme</option>
            <option value="Charon">Charon · Masculina Clara</option>
          </select>
        </div>

        {audioUrl ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
              <Volume2 className="w-3.5 h-3.5" />
              <span>Áudio WAV pronto</span>
            </div>
            <audio controls src={audioUrl} className="w-full h-9" />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={!produto || isGeneratingAudio || !copy.narracao_locucao.trim()}
            onClick={onGenerateAudio}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {isGeneratingAudio ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
            <span>Gerar Áudio</span>
          </button>

          <button
            type="button"
            disabled={!produto || isRenderingVideo || isGeneratingVeo || isMuxingFlow}
            onClick={() => {
              setViewMode('mp4');
              onRenderVideo();
            }}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {isRenderingVideo ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Film className="w-3.5 h-3.5" />
            )}
            <span>Renderizar MP4</span>
          </button>
        </div>

        {/* Google Flow / Veo Integration Actions */}
        <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
          <button
            type="button"
            disabled={!produto || isGeneratingVeo || isRenderingVideo || isMuxingFlow}
            onClick={() => {
              setViewMode('mp4');
              onGenerateVeo();
            }}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {isGeneratingVeo ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Clapperboard className="w-3.5 h-3.5 text-[#EE4D2D]" />
            )}
            <span>
              {isGeneratingVeo ? 'Gerando Cena Veo (9:16)...' : 'Gerar Cena com Veo (API)'}
            </span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,.mp4"
            onChange={handleFileChange}
            aria-label="Selecionar arquivo .mp4 exportado do Google Flow"
            className="hidden"
          />
          <button
            type="button"
            disabled={!produto || isMuxingFlow || isGeneratingVeo || isRenderingVideo}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isMuxingFlow ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <Upload className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="truncate">
              {isMuxingFlow
                ? 'Mixando Voz + 1080×1920...'
                : 'Importar .mp4 do Google Flow (Mixar Voz + Telegram)'}
            </span>
          </button>
        </div>

        {videoUrl ? (
          <a
            href={videoUrl}
            download
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar Vídeo MP4 (1080×1920)</span>
          </a>
        ) : null}
      </div>
    </section>
  );
}

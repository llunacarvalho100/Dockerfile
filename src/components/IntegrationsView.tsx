import { useState, type FormEvent } from 'react';
import { CheckCircle2, Clock, Save, Send, ShieldCheck } from 'lucide-react';
import type { IntegrationsStatus, SlotConfig } from '../types.ts';

interface IntegrationsViewProps {
  slots: SlotConfig[];
  status: IntegrationsStatus;
  onSaveConfig: (payload: {
    shopeeAppId?: string;
    shopeeAppSecret?: string;
    telegramBotToken?: string;
    telegramChatId?: string;
    autoScheduleEnabled?: boolean;
    slotToggles?: Array<{ slot: number; enabled: boolean }>;
  }) => Promise<void>;
}

export function IntegrationsView({
  slots,
  status,
  onSaveConfig,
}: IntegrationsViewProps) {
  const [shopeeAppId, setShopeeAppId] = useState('');
  const [shopeeAppSecret, setShopeeAppSecret] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState(status.telegramChatId || '');
  const [autoSchedule, setAutoSchedule] = useState(status.autoScheduleEnabled);
  const [slotStates, setSlotStates] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(slots.map((s) => [s.slot, s.enabled]))
  );
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedFeedback(null);
    try {
      await onSaveConfig({
        ...(shopeeAppId.trim() ? { shopeeAppId: shopeeAppId.trim() } : {}),
        ...(shopeeAppSecret.trim() ? { shopeeAppSecret: shopeeAppSecret.trim() } : {}),
        ...(telegramBotToken.trim() ? { telegramBotToken: telegramBotToken.trim() } : {}),
        telegramChatId: telegramChatId.trim(),
        autoScheduleEnabled: autoSchedule,
        slotToggles: slots.map((s) => ({
          slot: s.slot,
          enabled: slotStates[s.slot] ?? s.enabled,
        })),
      });
      setShopeeAppSecret('');
      setTelegramBotToken('');
      setSavedFeedback('Configurações salvas no servidor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-4xl">
      {/* Agenda Automática dos 3 Slots */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Agenda dos 3 Disparos Diários
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Horários de pico de engajamento do Shopee Vídeo Brasil (08:30, 13:00 e 19:30).
            </p>
          </div>

          <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoSchedule}
              onChange={(e) => setAutoSchedule(e.target.checked)}
              className="w-4 h-4 accent-[#EE4D2D] rounded"
            />
            <span className="text-xs font-semibold text-slate-800 whitespace-nowrap">
              Ativar agendamento automático
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-100 pt-4">
          {slots.map((slot) => {
            const enabled = slotStates[slot.slot] ?? slot.enabled;
            return (
              <label
                key={slot.slot}
                className="border border-slate-200 rounded-lg p-3.5 flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 font-mono-tabular">
                    <Clock className="w-3.5 h-3.5 text-[#EE4D2D]" />
                    <span>{slot.time}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-700 mt-1">
                    Slot #{slot.slot} · {slot.label}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) =>
                    setSlotStates((prev) => ({ ...prev, [slot.slot]: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#EE4D2D] mt-0.5"
                />
              </label>
            );
          })}
        </div>
      </section>

      {/* Credenciais Shopee Affiliate & Telegram */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Integrações Shopee Affiliate & Telegram
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Credenciais opcionais para consulta GraphQL ao vivo e envio direto do MP4 para seu canal/bot do Telegram. A IA de roteiro e locução utiliza o ambiente do servidor automaticamente.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 pt-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#EE4D2D]" />
                <span>Shopee Affiliate Open API</span>
              </h3>
              <span className="text-xs font-medium text-slate-600">
                {status.shopeeConfigured
                  ? `Conectada (${status.shopeeAppIdPreview})`
                  : 'Modo Catálogo Curado'}
              </span>
            </div>

            <div>
              <label htmlFor="shopee-app-id" className="block text-xs font-medium text-slate-700 mb-1">
                SHOPEE_APP_ID
              </label>
              <input
                id="shopee-app-id"
                type="text"
                value={shopeeAppId}
                onChange={(e) => setShopeeAppId(e.target.value)}
                placeholder={status.shopeeAppIdPreview || 'Ex: 183920194'}
                className="w-full px-3 py-2 text-sm font-mono-tabular bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/20 focus:border-[#EE4D2D]"
              />
            </div>

            <div>
              <label htmlFor="shopee-app-secret" className="block text-xs font-medium text-slate-700 mb-1">
                SHOPEE_APP_SECRET
              </label>
              <input
                id="shopee-app-secret"
                type="password"
                value={shopeeAppSecret}
                onChange={(e) => setShopeeAppSecret(e.target.value)}
                placeholder={status.shopeeConfigured ? '•••••••• (já configurado)' : 'Cole o App Secret'}
                className="w-full px-3 py-2 text-sm font-mono-tabular bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/20 focus:border-[#EE4D2D]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <Send className="w-4 h-4 text-[#EE4D2D]" />
                <span>Disparo Telegram Bot</span>
              </h3>
              <span className="text-xs font-medium text-slate-600">
                {status.telegramConfigured ? 'Bot Configurado' : 'Apenas Histórico Local'}
              </span>
            </div>

            <div>
              <label htmlFor="telegram-bot-token" className="block text-xs font-medium text-slate-700 mb-1">
                TELEGRAM_BOT_TOKEN
              </label>
              <input
                id="telegram-bot-token"
                type="password"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                placeholder={status.telegramConfigured ? '•••••••• (já configurado)' : '123456:ABC-DEF...'}
                className="w-full px-3 py-2 text-sm font-mono-tabular bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/20 focus:border-[#EE4D2D]"
              />
            </div>

            <div>
              <label htmlFor="telegram-chat-id" className="block text-xs font-medium text-slate-700 mb-1">
                TELEGRAM_CHAT_ID
              </label>
              <input
                id="telegram-chat-id"
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="Ex: -1001234567890"
                className="w-full px-3 py-2 text-sm font-mono-tabular bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/20 focus:border-[#EE4D2D]"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <div className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
            {savedFeedback ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{savedFeedback}</span>
              </>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#EE4D2D] text-white hover:bg-[#D93E20] disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Salvando...' : 'Salvar Configurações'}</span>
          </button>
        </div>
      </section>
    </form>
  );
}

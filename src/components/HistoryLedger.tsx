import { useMemo, useState } from 'react';
import { Copy, Check, RotateCcw, Search, Trash2, ExternalLink } from 'lucide-react';
import type { PostedHistoryEntry } from '../types.ts';

interface HistoryLedgerProps {
  history: PostedHistoryEntry[];
  dataDir: string;
  onRemoveItem: (itemId: string) => void;
  onClearAll: () => void;
}

export function HistoryLedger({
  history,
  dataDir,
  onRemoveItem,
  onClearAll,
}: HistoryLedgerProps) {
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const ordered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...history]
      .reverse()
      .filter((entry) => {
        if (!q) return true;
        return (
          entry.productName.toLowerCase().includes(q) ||
          entry.itemId.includes(q)
        );
      });
  }, [history, query]);

  const handleCopy = async (entry: PostedHistoryEntry) => {
    if (!entry.legendaCompleta) return;
    await navigator.clipboard.writeText(entry.legendaCompleta);
    setCopiedId(entry.itemId);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Histórico de Postagens (Anti-Duplicidade)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Registro persistido em {dataDir}/produtos_postados.json · Janela ativa dos últimos 150 produtos ({history.length}/150)
            </p>
          </div>

          {history.length > 0 ? (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Histórico</span>
            </button>
          ) : null}
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <label htmlFor="history-search" className="sr-only">
              Filtrar histórico por produto ou Item ID
            </label>
            <input
              id="history-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar histórico por produto ou Item ID..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/20 focus:border-[#EE4D2D]"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {ordered.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center gap-2">
            <p className="text-sm font-medium text-slate-800">
              Nenhuma postagem registrada ainda.
            </p>
            <p className="text-xs text-slate-500 max-w-md">
              Quando você publicar um pacote no Estúdio ou executar um Slot Diário, o Item ID é salvo aqui para evitar repetição na conta.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Produto</th>
                  <th className="py-2.5 px-3">Slot</th>
                  <th className="py-2.5 px-3">Data / Hora</th>
                  <th className="py-2.5 px-3">Entrega</th>
                  <th className="py-2.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {ordered.map((entry) => (
                  <tr key={entry.itemId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 min-w-[260px]">
                      <p className="font-medium text-slate-900 line-clamp-1">
                        {entry.productName}
                      </p>
                      <p className="text-xs text-slate-500 font-mono-tabular mt-0.5">
                        ID {entry.itemId} · {entry.aigcLabel ? 'AIGC Ativo' : 'Sem AIGC'}
                      </p>
                    </td>
                    <td className="py-3 px-3 font-mono-tabular text-xs font-medium text-slate-800 whitespace-nowrap">
                      Slot #{entry.slotNumber}
                    </td>
                    <td className="py-3 px-3 font-mono-tabular text-xs text-slate-600 whitespace-nowrap">
                      {new Date(entry.postedAt).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-700 whitespace-nowrap">
                      {entry.telegramSent ? 'Telegram + Histórico' : 'Salvo no Histórico'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {entry.legendaCompleta ? (
                          <button
                            type="button"
                            onClick={() => handleCopy(entry)}
                            aria-label={`Copiar legenda de ${entry.productName}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          >
                            {copiedId === entry.itemId ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedId === entry.itemId ? 'Copiado' : 'Legenda'}</span>
                          </button>
                        ) : null}

                        {entry.videoUrl ? (
                          <a
                            href={entry.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>MP4</span>
                          </a>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => onRemoveItem(entry.itemId)}
                          aria-label={`Reativar elegibilidade de ${entry.productName}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reativar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

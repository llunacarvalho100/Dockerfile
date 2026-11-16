import { useMemo, useState } from 'react';
import { RefreshCw, Search, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import type { ShopeeProduct } from '../types.ts';
import { getProductEligibilityReason, calculateConversionIndex, calculatePriorityScore, sortProductsByPriority } from '../lib/shopeePipeline.ts';
import { ProductImage } from './ProductImage.tsx';

interface CurationTableProps {
  catalog: ShopeeProduct[];
  postedIds: string[];
  shopeeMode: 'live' | 'catalog';
  selectedProductId: string | null;
  isSyncing: boolean;
  onSync: () => void;
  onSelectProduct: (product: ShopeeProduct) => void;
}

type FilterMode = 'all' | 'eligible' | 'posted' | 'ineligible';

export function CurationTable({
  catalog,
  postedIds,
  shopeeMode,
  selectedProductId,
  isSyncing,
  onSync,
  onSelectProduct,
}: CurationTableProps) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortProductsByPriority(catalog)
      .map((prod) => {
        const status = getProductEligibilityReason(prod, postedIds);
        const isPosted = postedIds.includes(prod.itemId);
        const conversionIndex = calculateConversionIndex(prod);
        const priorityScore = calculatePriorityScore(prod);
        return { prod, status, isPosted, conversionIndex, priorityScore };
      })
      .filter(({ prod, status, isPosted }) => {
        if (q && !prod.productName.toLowerCase().includes(q) && !prod.itemId.includes(q)) {
          return false;
        }
        if (filterMode === 'eligible') return status.eligible;
        if (filterMode === 'posted') return isPosted;
        if (filterMode === 'ineligible') return !status.eligible && !isPosted;
        return true;
      });
  }, [catalog, postedIds, search, filterMode]);

  const eligibleCount = useMemo(
    () => catalog.filter((p) => getProductEligibilityReason(p, postedIds).eligible).length,
    [catalog, postedIds]
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Curadoria Shopee Affiliate
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Filtro de elegibilidade: nota mínima 4.7 estrelas · mínimo 50 vendas · anti-repetição ativo ·{' '}
              {shopeeMode === 'live' ? 'API GraphQL Ao Vivo' : 'Catálogo Curado (Demonstração)'}
            </p>
          </div>

          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Atualizar Ofertas</span>
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <label htmlFor="curation-search" className="sr-only">
              Buscar produto por nome ou Item ID
            </label>
            <input
              id="curation-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou Item ID..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/20 focus:border-[#EE4D2D]"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {(
              [
                { id: 'all', label: `Todos (${catalog.length})` },
                { id: 'eligible', label: `Elegíveis (${eligibleCount})` },
                { id: 'posted', label: `Já Postados (${postedIds.length})` },
                { id: 'ineligible', label: 'Fora do Critério' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filterMode === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-slate-800">
              Nenhum produto encontrado neste filtro.
            </p>
            <p className="text-xs text-slate-500">
              Limpe a busca ou ajuste o filtro para visualizar os itens disponíveis.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilterMode('all');
              }}
              className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-800 hover:bg-slate-50"
            >
              Mostrar Todos
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Produto</th>
                  <th className="py-2.5 px-3 text-right">Preço</th>
                  <th className="py-2.5 px-3 text-right">Comissão</th>
                  <th className="py-2.5 px-3 text-right">Vendas</th>
                  <th className="py-2.5 px-3 text-right">Nota</th>
                  <th className="py-2.5 px-3 text-right">Score Conv.</th>
                  <th className="py-2.5 px-3">Elegibilidade</th>
                  <th className="py-2.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {rows.map(({ prod, status, conversionIndex, priorityScore }) => {
                  const isSelected = selectedProductId === prod.itemId;
                  return (
                    <tr
                      key={prod.itemId}
                      className={`transition-colors ${
                        isSelected ? 'bg-[#EE4D2D]/[0.03]' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="py-2.5 px-4 min-w-[240px]">
                        <div className="flex items-center gap-3">
                          <ProductImage
                            src={prod.imageUrl}
                            alt={prod.productName}
                            className="w-10 h-10 rounded-lg border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 line-clamp-1">
                              {prod.productName}
                            </p>
                            <p className="text-xs text-slate-500 font-mono-tabular mt-0.5">
                              ID {prod.itemId} · {prod.category}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-xs font-medium text-slate-900 whitespace-nowrap">
                        R$ {prod.price.toFixed(2).replace('.', ',')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-xs font-medium text-slate-700 whitespace-nowrap">
                        {(prod.commissionRate * 100).toFixed(0)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-xs text-slate-700 whitespace-nowrap">
                        {prod.sales.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-xs font-medium text-slate-900 whitespace-nowrap">
                        {prod.ratingStar.toFixed(1)} ★
                      </td>
                      <td
                        className="py-2.5 px-3 text-right font-mono-tabular text-xs text-slate-800 whitespace-nowrap"
                        title={`Índice: ${conversionIndex.toFixed(0)} · Prioridade visual: ${priorityScore.toFixed(0)}`}
                      >
                        <span className="font-semibold">{priorityScore.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                        <span className="text-slate-400 ml-1">({conversionIndex.toLocaleString('pt-BR', { maximumFractionDigits: 0 })})</span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            status.eligible ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {status.eligible ? (
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>{status.reason}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectProduct(prod)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                            isSelected
                              ? 'bg-[#EE4D2D] text-white'
                              : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <span>{isSelected ? 'No Estúdio' : 'Usar no Estúdio'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

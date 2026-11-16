export interface ShopeeProduct {
  itemId: string;
  productName: string;
  commissionRate: number;
  price: number;
  sales: number;
  ratingStar: number;
  imageUrl: string;
  productLink: string;
  offerLink: string;
  category: string;
  isAMSOffer: boolean;
}

export type HookType =
  | 'dor_pratica'
  | 'teste_real'
  | 'choque_preco'
  | 'substituicao_inteligente';

export const HOOK_TYPE_LABELS: Record<HookType, string> = {
  dor_pratica: 'Dor Prática',
  teste_real: 'Teste Real',
  choque_preco: 'Choque de Preço',
  substituicao_inteligente: 'Substituição Inteligente',
};

export interface GoogleFlowScenePrompt {
  cena: string;
  intervalo: string;
  prompt_en: string;
}

export interface GoogleFlowPackage {
  ingredient_instruction: string;
  scene_prompts: GoogleFlowScenePrompt[];
  veo_master_prompt: string;
}

export interface VideoCopyPackage {
  termo_busca_principal: string;
  tipo_gancho: HookType;
  titulo_curto_capa: string;
  narracao_locucao: string;
  legenda_postagem: string;
  hashtags: string[];
  aigc_label: boolean;
  google_flow: GoogleFlowPackage;
}

export interface PostedHistoryEntry {
  itemId: string;
  productName: string;
  slotNumber: number;
  postedAt: string;
  offerLink: string;
  legendaCompleta: string;
  aigcLabel: boolean;
  videoUrl: string | null;
  telegramSent: boolean;
}

export interface SlotConfig {
  slot: 1 | 2 | 3;
  time: '08:30' | '13:00' | '19:30';
  label: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: 'idle' | 'running' | 'completed' | 'error';
  lastProductId: string | null;
  lastError?: string;
}

export const DEFAULT_MIN_RATING = 4.7;
export const DEFAULT_MIN_SALES = 50;
export const MAX_HISTORY_ENTRIES = 150;

export const INITIAL_SLOTS: SlotConfig[] = [
  {
    slot: 1,
    time: '08:30',
    label: 'Manhã · Descoberta',
    enabled: true,
    lastRunAt: null,
    lastStatus: 'idle',
    lastProductId: null,
  },
  {
    slot: 2,
    time: '13:00',
    label: 'Almoço · Pico de Conversão',
    enabled: true,
    lastRunAt: null,
    lastStatus: 'idle',
    lastProductId: null,
  },
  {
    slot: 3,
    time: '19:30',
    label: 'Noite · Achadinhos',
    enabled: true,
    lastRunAt: null,
    lastStatus: 'idle',
    lastProductId: null,
  },
];

export const CATALOG_SEED_PRODUCTS: ShopeeProduct[] = [
  {
    itemId: '22984710531',
    productName: 'Mini Processador Elétrico Sem Fio 250ml Recarregável USB',
    commissionRate: 0.14,
    price: 38.9,
    sales: 4820,
    ratingStar: 4.9,
    imageUrl: '/src/assets/images/produto_mini_processador_1794867139318.jpg',
    productLink: 'https://shopee.com.br/product/22984710531',
    offerLink: 'https://shope.ee/afiliado-miniprocessador',
    category: 'Casa e Cozinha',
    isAMSOffer: true,
  },
  {
    itemId: '18492038471',
    productName: 'Luminária Sunset Projetor Pôr do Sol 360° Alumínio USB',
    commissionRate: 0.12,
    price: 44.5,
    sales: 2340,
    ratingStar: 4.8,
    imageUrl: '/src/assets/images/produto_luminaria_sunset_1794867140170.jpg',
    productLink: 'https://shopee.com.br/product/18492038471',
    offerLink: 'https://shope.ee/afiliado-sunset',
    category: 'Decoração',
    isAMSOffer: true,
  },
  {
    itemId: '24019283745',
    productName: 'Fone Bluetooth TWS Display Digital LED Bateria Longa Duração',
    commissionRate: 0.11,
    price: 52.0,
    sales: 6150,
    ratingStar: 4.8,
    imageUrl: '/src/assets/images/produto_fone_bluetooth_1794867140327.jpg',
    productLink: 'https://shopee.com.br/product/24019283745',
    offerLink: 'https://shope.ee/afiliado-fonetws',
    category: 'Acessórios Tech',
    isAMSOffer: true,
  },
  {
    itemId: '19384756102',
    productName: 'Escova Elétrica Giratória 5 em 1 Limpeza Pesada Sem Fio',
    commissionRate: 0.15,
    price: 79.9,
    sales: 1490,
    ratingStar: 4.9,
    imageUrl: '/src/assets/images/produto_escova_limpeza_1794867141279.jpg',
    productLink: 'https://shopee.com.br/product/19384756102',
    offerLink: 'https://shope.ee/afiliado-escova5em1',
    category: 'Limpeza Prática',
    isAMSOffer: true,
  },
  {
    itemId: '21509834120',
    productName: 'Garrafa Térmica Inox 500ml Tampa Display Digital Temperatura',
    commissionRate: 0.13,
    price: 34.9,
    sales: 3180,
    ratingStar: 4.8,
    imageUrl: '/src/assets/images/produto_garrafa_termica_1794867141746.jpg',
    productLink: 'https://shopee.com.br/product/21509834120',
    offerLink: 'https://shope.ee/afiliado-garrafadigital',
    category: 'Casa e Organização',
    isAMSOffer: true,
  },
  {
    itemId: '25910293841',
    productName: 'Kit 3 Potes Herméticos Vidro Borossilicato Micro-ondas',
    commissionRate: 0.10,
    price: 68.0,
    sales: 940,
    ratingStar: 4.7,
    imageUrl: '/src/assets/images/produto_mini_processador_1794867139318.jpg',
    productLink: 'https://shopee.com.br/product/25910293841',
    offerLink: 'https://shope.ee/afiliado-potesvidro',
    category: 'Cozinha Inteligente',
    isAMSOffer: true,
  },
  {
    itemId: '26112233445',
    productName: 'Suporte Articulado Mesa Alumínio Para Celular e Tablet',
    commissionRate: 0.09,
    price: 29.9,
    sales: 38,
    ratingStar: 4.8,
    imageUrl: '/src/assets/images/produto_fone_bluetooth_1794867140327.jpg',
    productLink: 'https://shopee.com.br/product/26112233445',
    offerLink: 'https://shope.ee/afiliado-suporte',
    category: 'Acessórios Tech',
    isAMSOffer: true,
  },
  {
    itemId: '27998877665',
    productName: 'Difusor Aromatizador Ultrassônico Madeira Claro 300ml',
    commissionRate: 0.12,
    price: 59.9,
    sales: 410,
    ratingStar: 4.4,
    imageUrl: '/src/assets/images/produto_luminaria_sunset_1794867140170.jpg',
    productLink: 'https://shopee.com.br/product/27998877665',
    offerLink: 'https://shope.ee/afiliado-difusor',
    category: 'Decoração',
    isAMSOffer: true,
  },
];

const HIGH_INTENT_KEYWORDS = [
  'casa',
  'cozinha',
  'organiz',
  'limpeza',
  'escova',
  'processador',
  'pote',
  'beleza',
  'skincare',
  'tech',
  'fone',
  'bluetooth',
  'suporte',
  'garrafa',
  'sem fio',
  'usb',
  'led',
];

export function calculateConversionIndex(product: ShopeeProduct): number {
  const raw = Number(product.sales || 0) * Number(product.ratingStar || 0) * Number(product.commissionRate || 0);
  return Number(raw.toFixed(2));
}

export function calculateVisualUtilityBoost(product: ShopeeProduct): number {
  const haystack = `${product.category} ${product.productName}`.toLowerCase();
  const matches = HIGH_INTENT_KEYWORDS.filter((kw) => haystack.includes(kw)).length;
  if (matches >= 2) return 1.25;
  if (matches === 1) return 1.12;
  return 1.0;
}

export function calculatePriorityScore(product: ShopeeProduct): number {
  const index = calculateConversionIndex(product);
  const boost = calculateVisualUtilityBoost(product);
  return Number((index * boost).toFixed(2));
}

export function sortProductsByPriority(products: ShopeeProduct[]): ShopeeProduct[] {
  return [...products].sort((a, b) => calculatePriorityScore(b) - calculatePriorityScore(a));
}

export function getProductEligibilityReason(
  product: ShopeeProduct,
  postedIds: string[],
  minRating: number = DEFAULT_MIN_RATING,
  minSales: number = DEFAULT_MIN_SALES
): { eligible: boolean; reason: string } {
  if (postedIds.includes(String(product.itemId))) {
    return { eligible: false, reason: 'Já postado no histórico' };
  }
  if (Number(product.ratingStar || 0) < minRating) {
    return { eligible: false, reason: `Nota abaixo de ${minRating.toFixed(1)}` };
  }
  if (Number(product.sales || 0) < minSales) {
    return { eligible: false, reason: `Menos de ${minSales} vendas` };
  }
  return { eligible: true, reason: 'Elegível' };
}

export function isProductEligible(
  product: ShopeeProduct,
  postedIds: string[],
  minRating: number = DEFAULT_MIN_RATING,
  minSales: number = DEFAULT_MIN_SALES
): boolean {
  return getProductEligibilityReason(product, postedIds, minRating, minSales).eligible;
}

export function selectNextEligibleProduct(
  products: ShopeeProduct[],
  postedIds: string[],
  minRating: number = DEFAULT_MIN_RATING,
  minSales: number = DEFAULT_MIN_SALES
): ShopeeProduct | null {
  const ranked = sortProductsByPriority(products);
  for (const prod of ranked) {
    if (isProductEligible(prod, postedIds, minRating, minSales)) {
      return prod;
    }
  }
  return null;
}

export function appendHistory(
  history: PostedHistoryEntry[],
  entry: PostedHistoryEntry,
  maxEntries: number = MAX_HISTORY_ENTRIES
): PostedHistoryEntry[] {
  const filtered = history.filter((item) => item.itemId !== entry.itemId);
  const next = [...filtered, entry];
  if (next.length <= maxEntries) {
    return next;
  }
  return next.slice(next.length - maxEntries);
}

export function extractSearchTerm(productName: string): string {
  const stopWords = new Set(['de', 'da', 'do', 'em', 'para', 'com', 'sem', 'e', 'kit']);
  const tokens = productName
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w.toLowerCase()));
  return tokens.slice(0, 3).join(' ') || productName.slice(0, 24);
}

export function isSeoPrefixValid(caption: string, searchTerm: string): boolean {
  const normalizedTerm = searchTerm.trim().toLowerCase();
  if (!normalizedTerm) return false;
  const first40 = caption.trim().slice(0, 40).toLowerCase();
  return first40.includes(normalizedTerm);
}

export function buildTelegramOperationalMessage(
  produto: ShopeeProduct,
  copy: VideoCopyPackage,
  slot: number
): { legendaCompleta: string; mensagemOperacional: string } {
  const hashtagsStr = copy.hashtags.join(' ').trim();
  const legendaCompleta = `${copy.legenda_postagem.trim()} ${hashtagsStr}`.trim();
  const aigcText = copy.aigc_label ? 'Ativar (Conteúdo assistido por IA)' : 'Não aplicável';
  const hookLabel = HOOK_TYPE_LABELS[copy.tipo_gancho] || copy.tipo_gancho;

  const mensagemOperacional = [
    `🎬 *VÍDEO #${slot} DO DIA PRONTO (SHOPEE VÍDEO)*`,
    '',
    `📦 *Produto:* ${produto.productName}`,
    `🔎 *Busca SEO:* ${copy.termo_busca_principal} (${hookLabel})`,
    `🆔 *Item ID (Carrinho Laranja):* \`${produto.itemId}\``,
    `🔗 *Link Afiliado:* ${produto.offerLink}`,
    `🤖 *Marcação AIGC:* \`${aigcText}\``,
    '',
    `📝 *LEGENDA PRONTA PARA COPIAR:*`,
    `\`${legendaCompleta}\``,
  ].join('\n');

  return { legendaCompleta, mensagemOperacional };
}

export function buildFfmpegFilterComplex(options?: {
  zoomStep?: number;
  maxZoom?: number;
  frames?: number;
  contrast?: number;
  saturation?: number;
  brightness?: number;
}): string {
  const zoomStep = options?.zoomStep ?? 0.0012;
  const maxZoom = options?.maxZoom ?? 1.25;
  const frames = options?.frames ?? 600;
  const contrast = options?.contrast ?? 1.04;
  const saturation = options?.saturation ?? 1.06;
  const brightness = options?.brightness ?? 0.01;

  return [
    'scale=1080:1920:force_original_aspect_ratio=increase',
    'crop=1080:1920',
    `zoompan=z='min(zoom+${zoomStep},${maxZoom})':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`,
    `eq=contrast=${contrast}:saturation=${saturation}:brightness=${brightness}`,
    'format=yuv420p',
  ].join(',');
}

export function getNextScheduledSlot(
  slots: SlotConfig[],
  now: Date
): { slot: SlotConfig; minutesUntil: number } | null {
  const enabledSlots = slots.filter((s) => s.enabled);
  if (enabledSlots.length === 0) return null;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let best: { slot: SlotConfig; minutesUntil: number } | null = null;

  for (const slot of enabledSlots) {
    const [hh, mm] = slot.time.split(':').map(Number);
    const slotMinutes = hh * 60 + mm;
    let diff = slotMinutes - nowMinutes;
    if (diff <= 0) {
      diff += 24 * 60;
    }
    if (!best || diff < best.minutesUntil) {
      best = { slot, minutesUntil: diff };
    }
  }

  return best;
}

export function buildDefaultGoogleFlowPackage(
  produto: ShopeeProduct,
  searchTerm: string
): GoogleFlowPackage {
  return {
    ingredient_instruction: `Suba a foto principal de "${searchTerm}" (fundo limpo) e 1 foto de detalhe/uso como Ingredients no Google Flow para manter consistência do produto.`,
    scene_prompts: [
      {
        cena: 'Cena 1 · Gancho Visual',
        intervalo: '0–3s',
        prompt_en: `Vertical 9:16 handheld lifestyle shot in a sunlit modern Brazilian home kitchen or living space, natural morning window light, fast attention-grabbing close-up showing the everyday problem before using ${produto.productName}, shallow depth of field, authentic smartphone creator aesthetic, photorealistic 4k.`,
      },
      {
        cena: 'Cena 2 · Demonstração Dinâmica',
        intervalo: '3–15s',
        prompt_en: `Vertical 9:16 smooth slow push-in macro shot of ${produto.productName} actively working on a clean granite or wood countertop in a warm Brazilian apartment, crisp material textures, natural motion, soft bounce lighting, demonstrating effortless efficiency, photorealistic commercial UGC style.`,
      },
      {
        cena: 'Cena 3 · Resultado & CTA',
        intervalo: '15–22s',
        prompt_en: `Vertical 9:16 clean hero framing of ${produto.productName} beside the finished spotless result on a bright neutral counter, generous negative space at the bottom third for Shopee orange cart overlay, gentle camera orbit, warm natural home lighting, high-end creator video.`,
      },
    ],
    veo_master_prompt: `Vertical 9:16 photorealistic UGC product showcase video in a bright contemporary Brazilian home: smooth cinematic push-in and subtle parallax around ${produto.productName} in real practical use, natural window light, crisp textures, clean lower-third framing for mobile e-commerce CTA, fluid realistic motion.`,
  };
}

export function buildDefaultCopyTemplate(produto: ShopeeProduct): VideoCopyPackage {
  const searchTerm = extractSearchTerm(produto.productName);
  const priceStr = produto.price.toFixed(2).replace('.', ',');

  return {
    termo_busca_principal: searchTerm,
    tipo_gancho: 'dor_pratica',
    titulo_curto_capa: 'Vale cada centavo!',
    narracao_locucao: `Cansou de perder tempo na rotina por causa de improviso? O ${searchTerm} resolve isso em segundos sem esforço, tem nota ${produto.ratingStar.toFixed(1)} com mais de ${produto.sales.toLocaleString('pt-BR')} vendas e custa só R$ ${priceStr}. Clica no carrinho laranja aqui embaixo para garantir o seu.`,
    legenda_postagem: `${searchTerm} que resolve sua rotina por R$ ${priceStr}! Garanta no carrinho laranja 👇`,
    hashtags: [
      '#AchadinhosShopee',
      '#ShopeeBrasil',
      `#${searchTerm.replace(/\s+/g, '')}`,
      '#RotinaPratica',
      '#CustoBeneficio',
    ],
    aigc_label: true,
    google_flow: buildDefaultGoogleFlowPackage(produto, searchTerm),
  };
}

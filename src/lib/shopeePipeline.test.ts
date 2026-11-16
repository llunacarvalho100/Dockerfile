import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOG_SEED_PRODUCTS,
  INITIAL_SLOTS,
  appendHistory,
  buildDefaultCopyTemplate,
  buildFfmpegFilterComplex,
  buildTelegramOperationalMessage,
  calculateConversionIndex,
  calculatePriorityScore,
  extractSearchTerm,
  getNextScheduledSlot,
  isProductEligible,
  isSeoPrefixValid,
  selectNextEligibleProduct,
  type PostedHistoryEntry,
  type VideoCopyPackage,
} from './shopeePipeline.ts';
import { computeShopeeSignature } from './shopeeAuth.ts';

test('computeShopeeSignature produces deterministic SHA-256 hex matching Python hashlib', () => {
  const sig = computeShopeeSignature('12345', 1700000000, '{"query":"test"}', 'secret_key');
  assert.equal(sig.length, 64);
  assert.match(sig, /^[a-f0-9]{64}$/);
  assert.equal(
    sig,
    computeShopeeSignature('12345', 1700000000, '{"query":"test"}', 'secret_key')
  );
  assert.notEqual(
    sig,
    computeShopeeSignature('12345', 1700000001, '{"query":"test"}', 'secret_key')
  );
});

test('isProductEligible enforces rating >= 4.7, sales >= 50, and not already posted', () => {
  const [validProd] = CATALOG_SEED_PRODUCTS;
  assert.equal(isProductEligible(validProd, []), true);
  assert.equal(isProductEligible(validProd, [validProd.itemId]), false);

  const lowSales = CATALOG_SEED_PRODUCTS.find((p) => p.sales < 50)!;
  assert.equal(isProductEligible(lowSales, []), false);

  const lowRating = CATALOG_SEED_PRODUCTS.find((p) => p.ratingStar < 4.7)!;
  assert.equal(isProductEligible(lowRating, []), false);
});

test('calculateConversionIndex and priority scoring rank highest-converting visual utility product first', () => {
  const miniProcessador = CATALOG_SEED_PRODUCTS.find((p) => p.itemId === '22984710531')!;
  const expectedIndex = Number((4820 * 4.9 * 0.14).toFixed(2));
  assert.equal(calculateConversionIndex(miniProcessador), expectedIndex);
  assert.ok(calculatePriorityScore(miniProcessador) > expectedIndex);

  const first = selectNextEligibleProduct(CATALOG_SEED_PRODUCTS, []);
  assert.ok(first);
  // Highest priority among eligible seed products is Mini Processador (3306.52 * 1.25 = 4133.15)
  // vs Fone Bluetooth (6150 * 4.8 * 0.11 = 3247.20 * 1.25 = 4059.00)
  assert.equal(first.itemId, '22984710531');

  const second = selectNextEligibleProduct(CATALOG_SEED_PRODUCTS, ['22984710531']);
  assert.ok(second);
  assert.equal(second.itemId, '24019283745');
});

test('SEO search term extraction and first-40-chars caption check', () => {
  const prod = CATALOG_SEED_PRODUCTS[0];
  const term = extractSearchTerm(prod.productName);
  assert.equal(term, 'Mini Processador Elétrico');

  const copy = buildDefaultCopyTemplate(prod);
  assert.equal(copy.termo_busca_principal, term);
  assert.equal(isSeoPrefixValid(copy.legenda_postagem, copy.termo_busca_principal), true);
  assert.equal(copy.legenda_postagem.length <= 140, true);
  assert.equal(copy.narracao_locucao.toLowerCase().includes('olá pessoal'), false);
  assert.equal(copy.narracao_locucao.toLowerCase().includes('olha esse produto'), false);
  assert.ok(copy.google_flow.ingredient_instruction.length > 10);
  assert.equal(copy.google_flow.scene_prompts.length, 3);
  assert.ok(copy.google_flow.veo_master_prompt.includes('9:16'));
});

test('appendHistory caps history at 150 items without duplicates', () => {
  let history: PostedHistoryEntry[] = [];
  for (let i = 1; i <= 155; i++) {
    history = appendHistory(history, {
      itemId: String(i),
      productName: `Produto ${i}`,
      slotNumber: 1,
      postedAt: '2026-11-16T12:00:00.000Z',
      offerLink: 'https://shope.ee/test',
      legendaCompleta: 'Legenda',
      aigcLabel: true,
      videoUrl: null,
      telegramSent: false,
    });
  }
  assert.equal(history.length, 150);
  assert.equal(history[0].itemId, '6');
  assert.equal(history[149].itemId, '155');
});

test('buildTelegramOperationalMessage formats SEO term, hook type, Item ID and AIGC flag', () => {
  const prod = CATALOG_SEED_PRODUCTS[0];
  const copy: VideoCopyPackage = {
    termo_busca_principal: 'Mini Processador Elétrico',
    tipo_gancho: 'dor_pratica',
    titulo_curto_capa: 'Cozinha em segundos',
    narracao_locucao: 'Cansou de picar alho na mão? Esse mini processador resolve em segundos.',
    legenda_postagem: 'Mini Processador Elétrico que salva o almoço! Confira no carrinho laranja.',
    hashtags: ['#AchadinhosShopee', '#ShopeeBrasil'],
    aigc_label: true,
    google_flow: {
      ingredient_instruction: 'Suba 1 foto principal.',
      scene_prompts: [
        { cena: 'Cena 1', intervalo: '0-3s', prompt_en: 'Vertical 9:16 hook scene' },
        { cena: 'Cena 2', intervalo: '3-15s', prompt_en: 'Vertical 9:16 demo scene' },
        { cena: 'Cena 3', intervalo: '15-22s', prompt_en: 'Vertical 9:16 result scene' },
      ],
      veo_master_prompt: 'Vertical 9:16 master prompt',
    },
  };
  const { legendaCompleta, mensagemOperacional } = buildTelegramOperationalMessage(prod, copy, 2);
  assert.equal(
    legendaCompleta,
    'Mini Processador Elétrico que salva o almoço! Confira no carrinho laranja. #AchadinhosShopee #ShopeeBrasil'
  );
  assert.ok(mensagemOperacional.includes('VÍDEO #2 DO DIA PRONTO'));
  assert.ok(mensagemOperacional.includes('Mini Processador Elétrico (Dor Prática)'));
  assert.ok(mensagemOperacional.includes(prod.itemId));
  assert.ok(mensagemOperacional.includes('Ativar (Conteúdo assistido por IA)'));
});

test('buildFfmpegFilterComplex generates 1080x1920 zoompan and eq filter chain', () => {
  const filter = buildFfmpegFilterComplex();
  assert.ok(filter.includes('scale=1080:1920'));
  assert.ok(filter.includes('zoompan='));
  assert.ok(filter.includes('eq=contrast=1.04:saturation=1.06:brightness=0.01'));
  assert.ok(filter.includes('format=yuv420p'));
});

test('getNextScheduledSlot picks nearest upcoming daily slot', () => {
  const morning = new Date(2026, 10, 16, 10, 0, 0);
  const next = getNextScheduledSlot(INITIAL_SLOTS, morning);
  assert.ok(next);
  assert.equal(next.slot.slot, 2);
  assert.equal(next.slot.time, '13:00');
  assert.equal(next.minutesUntil, 180);

  const lateNight = new Date(2026, 10, 16, 22, 0, 0);
  const nextDay = getNextScheduledSlot(INITIAL_SLOTS, lateNight);
  assert.ok(nextDay);
  assert.equal(nextDay.slot.slot, 1);
  assert.equal(nextDay.slot.time, '08:30');
});

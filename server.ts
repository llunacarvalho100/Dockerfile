import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  CATALOG_SEED_PRODUCTS,
  INITIAL_SLOTS,
  appendHistory,
  buildFfmpegFilterComplex,
  buildTelegramOperationalMessage,
  calculatePriorityScore,
  buildDefaultGoogleFlowPackage,
  extractSearchTerm,
  selectNextEligibleProduct,
  sortProductsByPriority,
  type PostedHistoryEntry,
  type ShopeeProduct,
  type SlotConfig,
  type VideoCopyPackage,
} from './src/lib/shopeePipeline.ts';
import { computeShopeeSignature } from './src/lib/shopeeAuth.ts';

const execFileAsync = promisify(execFile);

const PORT = 3000;
const SHOPEE_GRAPHQL_URL = 'https://open-api.affiliate.shopee.com.br/graphql';
const DATA_DIR_RAW = process.env.DATA_DIR || './data';
const DATA_DIR = path.resolve(process.cwd(), DATA_DIR_RAW);
const HISTORICO_ARQUIVO = path.join(DATA_DIR, 'produtos_postados.json');
const PASTA_SAIDA = path.resolve(process.cwd(), 'videos_renderizados');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(PASTA_SAIDA, { recursive: true });

interface RuntimeConfig {
  shopeeAppId: string;
  shopeeAppSecret: string;
  telegramBotToken: string;
  telegramChatId: string;
  autoScheduleEnabled: boolean;
}

const runtimeConfig: RuntimeConfig = {
  shopeeAppId: process.env.SHOPEE_APP_ID || '',
  shopeeAppSecret: process.env.SHOPEE_APP_SECRET || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  autoScheduleEnabled: false,
};

let cachedCatalog: ShopeeProduct[] = sortProductsByPriority(CATALOG_SEED_PRODUCTS);
let shopeeMode: 'live' | 'catalog' = 'catalog';
let slots: SlotConfig[] = INITIAL_SLOTS.map((s) => ({ ...s }));
let lastSchedulerTickMinute = '';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no ambiente do servidor.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function loadHistory(): PostedHistoryEntry[] {
  try {
    if (!fs.existsSync(HISTORICO_ARQUIVO)) return [];
    const raw = fs.readFileSync(HISTORICO_ARQUIVO, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      if (typeof item === 'string') {
        return {
          itemId: item,
          productName: `Produto #${item}`,
          slotNumber: 1,
          postedAt: new Date().toISOString(),
          offerLink: `https://shopee.com.br/product/${item}`,
          legendaCompleta: '',
          aigcLabel: true,
          videoUrl: null,
          telegramSent: false,
        };
      }
      return item as PostedHistoryEntry;
    });
  } catch {
    return [];
  }
}

function saveHistory(history: PostedHistoryEntry[]): void {
  fs.writeFileSync(HISTORICO_ARQUIVO, JSON.stringify(history, null, 2), 'utf8');
}

async function fetchShopeeProductsLive(limit = 25): Promise<ShopeeProduct[]> {
  if (!runtimeConfig.shopeeAppId || !runtimeConfig.shopeeAppSecret) {
    throw new Error('Credenciais Shopee Affiliate (App ID e App Secret) não configuradas.');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const query = `
    query {
      productOfferV2(listType: 0, sortType: 2, page: 1, limit: ${limit}, isAMSOffer: true) {
        nodes {
          itemId
          productName
          commissionRate
          price
          sales
          ratingStar
          imageUrl
          productLink
          offerLink
        }
      }
    }
  `;

  const payloadStr = JSON.stringify({ query });
  const signature = computeShopeeSignature(
    runtimeConfig.shopeeAppId,
    timestamp,
    payloadStr,
    runtimeConfig.shopeeAppSecret
  );

  const response = await fetch(SHOPEE_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `SHA256 Credential=${runtimeConfig.shopeeAppId}, Timestamp=${timestamp}, Signature=${signature}`,
    },
    body: payloadStr,
  });

  if (!response.ok) {
    throw new Error(`Shopee API retornou status ${response.status}`);
  }

  const json = (await response.json()) as {
    data?: { productOfferV2?: { nodes?: Array<Record<string, unknown>> } };
    errors?: Array<{ message?: string }>;
  };

  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0].message || 'Erro GraphQL na Shopee Affiliate API');
  }

  const nodes = json.data?.productOfferV2?.nodes || [];
  return nodes.map((node) => ({
    itemId: String(node.itemId ?? ''),
    productName: String(node.productName ?? 'Produto Shopee'),
    commissionRate: Number(node.commissionRate ?? 0),
    price: Number(node.price ?? 0),
    sales: Number(node.sales ?? 0),
    ratingStar: Number(node.ratingStar ?? 0),
    imageUrl: String(node.imageUrl ?? ''),
    productLink: String(node.productLink ?? ''),
    offerLink: String(node.offerLink ?? node.productLink ?? ''),
    category: 'Shopee Em Alta',
    isAMSOffer: true,
  }));
}

function formatGeminiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return 'O modelo Gemini está temporariamente sobrecarregado (503). Aguarde alguns segundos e tente novamente.';
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return 'Limite de requisições atingido (429). Verifique a cota da chave Gemini no painel Secrets.';
  }
  if (raw.includes('403') || raw.includes('400') || raw.includes('API_KEY_INVALID')) {
    return 'Chave Gemini ausente ou inválida. Verifique a configuração em Settings > Secrets.';
  }
  return raw;
}

async function withGeminiRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429');
      if (!isTransient || attempt === maxRetries) {
        throw new Error(formatGeminiError(err));
      }
      await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
    }
  }
  throw new Error(formatGeminiError(lastError));
}

function ensureWavBuffer(rawBuffer: Buffer): Buffer {
  if (rawBuffer.length >= 44 && rawBuffer.subarray(0, 4).toString('ascii') === 'RIFF') {
    return rawBuffer;
  }
  // Wrap raw L16 PCM (24kHz, mono, 16-bit LE) in a standard 44-byte RIFF/WAVE header
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = rawBuffer.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, rawBuffer]);
}

async function generateCopyWithGemini(
  produto: ShopeeProduct,
  slotNumber: number
): Promise<VideoCopyPackage> {
  const ai = getAiClient();
  const priorityScore = calculatePriorityScore(produto);

  const systemInstruction = [
    'Você é um Especialista em Retenção, SEO de Busca e Conversão do Shopee Vídeo Brasil.',
    'Crie um roteiro dinâmico, autêntico e humanizado para um vídeo vertical de 20 a 25 segundos.',
    'Regras estritas:',
    '1. Linguagem de consumidor real indicando um achadinho útil (proibido tom robótico de locutor).',
    '2. Os primeiros 3 segundos da narração DEVEM começar com um gancho forte sem saudações genéricas (PROIBIDO usar "Olá pessoal", "Oi gente" ou "Olha esse produto").',
    '3. Resolução prática da dor e fechamento com chamada direta para clicar no carrinho laranja abaixo.',
    '4. A legenda deve começar obrigatoriamente com o termo_busca_principal dentro dos primeiros 40 caracteres para indexação no SEO da Shopee Vídeo.',
    '5. Retorne apenas JSON válido seguindo o schema solicitado.',
  ].join('\n');

  const promptUsuario = [
    `Gere o planejamento completo para o vídeo #${slotNumber} do dia:`,
    `- Produto: ${produto.productName}`,
    `- Categoria: ${produto.category}`,
    `- Preço médio: R$ ${produto.price.toFixed(2)}`,
    `- Avaliação: ${produto.ratingStar} estrelas (${produto.sales} vendidos · Score Prioridade ${priorityScore})`,
    '',
    'Requisitos obrigatórios:',
    '- termo_busca_principal: Extraia do nome longo do anúncio o termo curto e exato que um comprador digita na barra de pesquisa da Shopee (2 a 3 palavras).',
    '- tipo_gancho: Escolha estrategicamente entre "dor_pratica", "teste_real", "choque_preco" ou "substituicao_inteligente".',
    '- titulo_curto_capa: Headline de até 4 palavras focada em curiosidade ou benefício imediato (ex: "Salvou minha faxina!", "Vale cada centavo").',
    '- narracao_locucao: Texto natural em português do Brasil (45 a 60 palavras) começando direto no gancho dos primeiros 3s sem saudações genéricas, resolvendo a dor e fechando com CTA para o carrinho laranja abaixo.',
    '- legenda_postagem: Até 140 caracteres, iniciando obrigatoriamente com o termo_busca_principal nos primeiros 40 caracteres, seguido do benefício curto e CTA para o carrinho laranja.',
    '- hashtags: Exatamente 5 hashtags misturando 2 amplas (#AchadinhosShopee e #ShopeeBrasil) e 3 de cauda longa exatas do produto e da dor que ele resolve.',
    '- aigc_label: true.',
    '- google_flow: objeto com:',
    '  * ingredient_instruction: instrução rápida em português de quais fotos do produto subir como Ingredients no Google Flow.',
    '  * scene_prompts: lista com exatamente 3 cenas em inglês cinematográfico vertical 9:16 com iluminação realista de casa brasileira, câmera suave e produto em uso real:',
    '    1) Cena 1 (0-3s): Gancho visual de impacto resolvendo a dor prática.',
    '    2) Cena 2 (3-15s): Demonstração dinâmica do produto em funcionamento mostrando texturas e eficiência.',
    '    3) Cena 3 (15-22s): Resultado final satisfatório + enquadramento limpo para chamada do carrinho laranja.',
    '  * veo_master_prompt: prompt único consolidado em inglês para geração Image-to-Video em 9:16 a partir da imagem do produto.',
  ].join('\n');

  const requestConfig = {
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        termo_busca_principal: { type: Type.STRING },
        tipo_gancho: {
          type: Type.STRING,
          enum: ['dor_pratica', 'teste_real', 'choque_preco', 'substituicao_inteligente'],
        },
        titulo_curto_capa: { type: Type.STRING },
        narracao_locucao: { type: Type.STRING },
        legenda_postagem: { type: Type.STRING },
        hashtags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        aigc_label: { type: Type.BOOLEAN },
        google_flow: {
          type: Type.OBJECT,
          properties: {
            ingredient_instruction: { type: Type.STRING },
            scene_prompts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  cena: { type: Type.STRING },
                  intervalo: { type: Type.STRING },
                  prompt_en: { type: Type.STRING },
                },
                required: ['cena', 'intervalo', 'prompt_en'],
              },
            },
            veo_master_prompt: { type: Type.STRING },
          },
          required: ['ingredient_instruction', 'scene_prompts', 'veo_master_prompt'],
        },
      },
      required: [
        'termo_busca_principal',
        'tipo_gancho',
        'titulo_curto_capa',
        'narracao_locucao',
        'legenda_postagem',
        'hashtags',
        'aigc_label',
        'google_flow',
      ],
    },
  };

  let response;
  try {
    response = await withGeminiRetry(() =>
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptUsuario,
        config: requestConfig,
      })
    );
  } catch (primaryErr) {
    console.warn(
      '[Copy Primary fallback]',
      primaryErr instanceof Error ? primaryErr.message : primaryErr
    );
    response = await withGeminiRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptUsuario,
        config: requestConfig,
      })
    );
  }

  const text = (response.text ?? '').trim();
  if (!text) {
    throw new Error('O modelo Gemini retornou resposta vazia.');
  }

  const parsed = JSON.parse(text) as VideoCopyPackage;
  if (!parsed.google_flow || !Array.isArray(parsed.google_flow.scene_prompts) || parsed.google_flow.scene_prompts.length === 0) {
    parsed.google_flow = buildDefaultGoogleFlowPackage(
      produto,
      parsed.termo_busca_principal || extractSearchTerm(produto.productName)
    );
  }
  return parsed;
}

async function callTtsModel(
  ai: GoogleGenAI,
  model: string,
  text: string,
  voiceName: string
): Promise<string | undefined> {
  const isLite38 = model === 'gemini-3.8-flash-lite-tts';
  const parts = isLite38
    ? [
        {
          text,
          speechMetadata: {
            style: 'Criador brasileiro dinâmico e natural recomendando um achadinho útil',
          },
        } as unknown as { text: string },
      ]
    : [{ text: `Fale em português do Brasil com tom natural, dinâmico e envolvente de criador de vídeo curto: ${text}` }];

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    })
  );

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
}

async function generateTtsWithGemini(
  text: string,
  voiceName: string,
  prefix: string
): Promise<{ audioUrl: string; filename: string; filePath: string; durationSec: number; modelUsed: string }> {
  const ai = getAiClient();
  const safeVoice = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'].includes(voiceName)
    ? voiceName
    : 'Kore';

  let base64Audio: string | undefined;
  let modelUsed = 'gemini-2.5-flash-preview-tts';

  try {
    base64Audio = await callTtsModel(ai, 'gemini-2.5-flash-preview-tts', text, safeVoice);
  } catch (primaryErr) {
    console.warn(
      '[TTS Primary fallback]',
      primaryErr instanceof Error ? primaryErr.message : primaryErr
    );
    modelUsed = 'gemini-3.8-flash-lite-tts';
    base64Audio = await callTtsModel(ai, 'gemini-3.8-flash-lite-tts', text, safeVoice);
  }

  if (!base64Audio) {
    throw new Error('Não foi possível extrair o áudio WAV da resposta do Gemini TTS.');
  }

  const rawBuffer = Buffer.from(base64Audio, 'base64');
  const wavBuffer = ensureWavBuffer(rawBuffer);
  const filename = `${prefix}_voz.wav`;
  const filePath = path.join(PASTA_SAIDA, filename);
  fs.writeFileSync(filePath, wavBuffer);

  // 24kHz mono 16-bit PCM = 48000 bytes/sec after 44-byte RIFF header
  const pcmBytes = Math.max(0, wavBuffer.length - 44);
  const durationSec = Math.max(5, Math.min(35, Number((pcmBytes / 48000).toFixed(1))));

  return {
    audioUrl: `/api/media/${filename}`,
    filename,
    filePath,
    durationSec,
    modelUsed,
  };
}

async function resolveImagePathForFfmpeg(imageUrl: string, prefix: string): Promise<{
  localPath: string;
  isTemp: boolean;
}> {
  if (imageUrl.startsWith('/src/assets/')) {
    const candidate = path.resolve(process.cwd(), imageUrl.slice(1));
    if (fs.existsSync(candidate)) {
      return { localPath: candidate, isTemp: false };
    }
  }

  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      throw new Error(`Falha ao baixar imagem do produto (${res.status}).`);
    }
    const arrayBuf = await res.arrayBuffer();
    const tempPath = path.join(PASTA_SAIDA, `${prefix}_raw.jpg`);
    fs.writeFileSync(tempPath, Buffer.from(arrayBuf));
    return { localPath: tempPath, isTemp: true };
  }

  throw new Error('URL de imagem do produto inválida ou indisponível.');
}

async function renderVideoWithFfmpeg(params: {
  produto: ShopeeProduct;
  prefix: string;
  audioFilename?: string;
  durationSec?: number;
}): Promise<{ videoUrl: string; filename: string; sizeBytes: number; durationSec: number }> {
  const { produto, prefix, audioFilename } = params;
  const durationSec = Math.max(6, Math.min(28, Math.round(params.durationSec || 10)));
  const frames = durationSec * 30;
  const { localPath: imgPath, isTemp } = await resolveImagePathForFfmpeg(produto.imageUrl, prefix);

  const outputFilename = `${prefix}_final.mp4`;
  const outputPath = path.join(PASTA_SAIDA, outputFilename);

  const audioPath =
    audioFilename && fs.existsSync(path.join(PASTA_SAIDA, path.basename(audioFilename)))
      ? path.join(PASTA_SAIDA, path.basename(audioFilename))
      : null;

  const filterComplex = buildFfmpegFilterComplex({ frames });

  const args: string[] = ['-y', '-loop', '1', '-i', imgPath];
  if (audioPath) {
    args.push('-i', audioPath);
  } else {
    args.push(
      '-f',
      'lavfi',
      '-i',
      'anullsrc=channel_layout=mono:sample_rate=24000',
      '-t',
      String(durationSec)
    );
  }

  args.push(
    '-vf',
    filterComplex,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '26',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-shortest',
    '-movflags',
    '+faststart',
    outputPath
  );

  try {
    await execFileAsync('ffmpeg', args, { timeout: 60000 });
  } finally {
    if (isTemp && fs.existsSync(imgPath)) {
      fs.unlinkSync(imgPath);
    }
  }

  const stat = fs.statSync(outputPath);
  return {
    videoUrl: `/api/media/${outputFilename}`,
    filename: outputFilename,
    sizeBytes: stat.size,
    durationSec,
  };
}

async function dispatchToTelegramIfConfigured(params: {
  produto: ShopeeProduct;
  copy: VideoCopyPackage;
  slot: number;
  videoFilename?: string | null;
}): Promise<{ sent: boolean; detail: string }> {
  const { mensagemOperacional } = buildTelegramOperationalMessage(
    params.produto,
    params.copy,
    params.slot
  );

  if (!runtimeConfig.telegramBotToken || !runtimeConfig.telegramChatId) {
    return {
      sent: false,
      detail: 'Telegram não configurado; pacote salvo no histórico local.',
    };
  }

  const token = runtimeConfig.telegramBotToken;
  const chatId = runtimeConfig.telegramChatId;
  const videoPath =
    params.videoFilename && fs.existsSync(path.join(PASTA_SAIDA, path.basename(params.videoFilename)))
      ? path.join(PASTA_SAIDA, path.basename(params.videoFilename))
      : null;

  if (videoPath) {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', mensagemOperacional);
    form.append('parse_mode', 'Markdown');
    const fileBuf = fs.readFileSync(videoPath);
    form.append('video', new Blob([fileBuf], { type: 'video/mp4' }), path.basename(videoPath));

    const res = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Erro Telegram sendVideo (${res.status}): ${errBody}`);
    }
    return { sent: true, detail: 'Vídeo e legenda enviados ao Telegram.' };
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: mensagemOperacional,
      parse_mode: 'Markdown',
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Erro Telegram sendMessage (${res.status}): ${errBody}`);
  }
  return { sent: true, detail: 'Pacote operacional enviado ao Telegram.' };
}

async function runSlotCycle(slotNumber: 1 | 2 | 3): Promise<{
  produto: ShopeeProduct;
  copy: VideoCopyPackage;
  audioUrl: string | null;
  videoUrl: string;
  historyEntry: PostedHistoryEntry;
  telegramDetail: string;
}> {
  const slotObj = slots.find((s) => s.slot === slotNumber);
  if (slotObj) {
    slotObj.lastStatus = 'running';
    slotObj.lastError = undefined;
  }

  try {
    const history = loadHistory();
    const postedIds = history.map((h) => h.itemId);
    const produto = selectNextEligibleProduct(cachedCatalog, postedIds);
    if (!produto) {
      throw new Error('Nenhum produto novo cumpriu os critérios de elegibilidade (★ >= 4.7 e >= 50 vendas).');
    }

    const prefix = `slot${slotNumber}_${produto.itemId}_${Date.now()}`;
    const copy = await generateCopyWithGemini(produto, slotNumber);

    let audioUrl: string | null = null;
    let audioFilename: string | undefined;
    let durationSec = 10;

    try {
      const tts = await generateTtsWithGemini(copy.narracao_locucao, 'Kore', prefix);
      audioUrl = tts.audioUrl;
      audioFilename = tts.filename;
      durationSec = tts.durationSec;
    } catch (ttsErr) {
      console.warn('[TTS fallback]', ttsErr instanceof Error ? ttsErr.message : ttsErr);
    }

    const video = await renderVideoWithFfmpeg({
      produto,
      prefix,
      audioFilename,
      durationSec,
    });

    const telegramResult = await dispatchToTelegramIfConfigured({
      produto,
      copy,
      slot: slotNumber,
      videoFilename: video.filename,
    });

    const { legendaCompleta } = buildTelegramOperationalMessage(produto, copy, slotNumber);
    const entry: PostedHistoryEntry = {
      itemId: produto.itemId,
      productName: produto.productName,
      slotNumber,
      postedAt: new Date().toISOString(),
      offerLink: produto.offerLink,
      legendaCompleta,
      aigcLabel: copy.aigc_label,
      videoUrl: video.videoUrl,
      telegramSent: telegramResult.sent,
    };

    const nextHistory = appendHistory(history, entry);
    saveHistory(nextHistory);

    if (slotObj) {
      slotObj.lastStatus = 'completed';
      slotObj.lastRunAt = entry.postedAt;
      slotObj.lastProductId = produto.itemId;
    }

    return {
      produto,
      copy,
      audioUrl,
      videoUrl: video.videoUrl,
      historyEntry: entry,
      telegramDetail: telegramResult.detail,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido no ciclo do slot';
    if (slotObj) {
      slotObj.lastStatus = 'error';
      slotObj.lastError = msg;
    }
    throw err;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/state', (_req, res) => {
    const history = loadHistory();
    const renderedFiles = fs
      .readdirSync(PASTA_SAIDA)
      .filter((f) => f.endsWith('.mp4'))
      .map((f) => {
        const stat = fs.statSync(path.join(PASTA_SAIDA, f));
        return {
          filename: f,
          videoUrl: `/api/media/${f}`,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json({
      catalog: sortProductsByPriority(cachedCatalog),
      shopeeMode,
      history,
      slots,
      renderedVideos: renderedFiles,
      dataDir: DATA_DIR_RAW,
      integrationsStatus: {
        shopeeConfigured: Boolean(runtimeConfig.shopeeAppId && runtimeConfig.shopeeAppSecret),
        telegramConfigured: Boolean(runtimeConfig.telegramBotToken && runtimeConfig.telegramChatId),
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        autoScheduleEnabled: runtimeConfig.autoScheduleEnabled,
        shopeeAppIdPreview: runtimeConfig.shopeeAppId
          ? `${runtimeConfig.shopeeAppId.slice(0, 4)}••••`
          : '',
        telegramChatId: runtimeConfig.telegramChatId || '',
      },
    });
  });

  app.post('/api/shopee/sync', async (_req, res) => {
    try {
      if (runtimeConfig.shopeeAppId && runtimeConfig.shopeeAppSecret) {
        const liveNodes = await fetchShopeeProductsLive(25);
        cachedCatalog = sortProductsByPriority(liveNodes);
        shopeeMode = 'live';
        res.json({ catalog: cachedCatalog, shopeeMode });
        return;
      }
      cachedCatalog = sortProductsByPriority(CATALOG_SEED_PRODUCTS);
      shopeeMode = 'catalog';
      res.json({ catalog: cachedCatalog, shopeeMode });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao sincronizar catálogo Shopee';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/ai/generate-copy', async (req, res) => {
    try {
      const { produto, slotNumber } = req.body as {
        produto?: ShopeeProduct;
        slotNumber?: number;
      };
      if (!produto || !produto.productName) {
        res.status(400).json({ error: 'Produto inválido para geração de roteiro.' });
        return;
      }
      const copy = await generateCopyWithGemini(produto, Number(slotNumber || 1));
      res.json({ copy });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha na geração com Gemini.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/tts/generate', async (req, res) => {
    try {
      const { text, voiceName, itemId } = req.body as {
        text?: string;
        voiceName?: string;
        itemId?: string;
      };
      if (!text || !text.trim()) {
        res.status(400).json({ error: 'Texto da narração é obrigatório.' });
        return;
      }
      const prefix = `tts_${String(itemId || 'manual').replace(/[^a-zA-Z0-9_-]/g, '')}_${Date.now()}`;
      const result = await generateTtsWithGemini(text.trim(), voiceName || 'Kore', prefix);
      res.json({
        audioUrl: result.audioUrl,
        filename: result.filename,
        durationSec: result.durationSec,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao gerar locução neural.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/video/render', async (req, res) => {
    try {
      const { produto, slotNumber, audioFilename, durationSec } = req.body as {
        produto?: ShopeeProduct;
        slotNumber?: number;
        audioFilename?: string;
        durationSec?: number;
      };
      if (!produto || !produto.itemId || !produto.imageUrl) {
        res.status(400).json({ error: 'Produto e imagem são obrigatórios para renderizar MP4.' });
        return;
      }
      const prefix = `slot${Number(slotNumber || 1)}_${String(produto.itemId).replace(/[^a-zA-Z0-9_-]/g, '')}_${Date.now()}`;
      const video = await renderVideoWithFfmpeg({
        produto,
        prefix,
        audioFilename,
        durationSec,
      });
      res.json(video);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao renderizar vídeo FFmpeg.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/flow/generate-veo', async (req, res) => {
    const { produto, veoMasterPrompt, slotNumber, audioFilename, durationSec } = req.body as {
      produto?: ShopeeProduct;
      veoMasterPrompt?: string;
      slotNumber?: number;
      audioFilename?: string;
      durationSec?: number;
    };

    if (!produto || !produto.itemId || !produto.imageUrl) {
      res.status(400).json({ error: 'Produto e imagem são obrigatórios para gerar cena com Veo.' });
      return;
    }

    const prefix = `veo_slot${Number(slotNumber || 1)}_${String(produto.itemId).replace(/[^a-zA-Z0-9_-]/g, '')}_${Date.now()}`;

    try {
      const ai = getAiClient();
      const { localPath: imgPath, isTemp } = await resolveImagePathForFfmpeg(produto.imageUrl, prefix);
      let base64Image = '';
      try {
        base64Image = fs.readFileSync(imgPath).toString('base64');
      } finally {
        if (isTemp && fs.existsSync(imgPath)) {
          fs.unlinkSync(imgPath);
        }
      }

      const prompt =
        (veoMasterPrompt || '').trim() ||
        `Vertical 9:16 photorealistic product showcase in a sunlit Brazilian home featuring ${produto.productName}, smooth camera push-in, natural textures.`;

      let operation = await ai.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt,
        image: {
          imageBytes: base64Image,
          mimeType: 'image/jpeg',
        },
        config: {
          aspectRatio: '9:16',
          numberOfVideos: 1,
        },
      });

      const pollDeadline = Date.now() + 90_000;
      while (!operation.done && Date.now() < pollDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 6000));
        operation = await ai.operations.getVideosOperation({ operation });
      }

      if (!operation.done || operation.error) {
        throw new Error(
          operation.error
            ? JSON.stringify(operation.error)
            : 'Tempo limite aguardando renderização Veo.'
        );
      }

      const generated = operation.response?.generatedVideos?.[0]?.video;
      const rawVeoPath = path.join(PASTA_SAIDA, `${prefix}_veo_raw.mp4`);

      if (generated?.videoBytes) {
        fs.writeFileSync(rawVeoPath, Buffer.from(generated.videoBytes, 'base64'));
      } else if (generated?.uri) {
        const videoRes = await fetch(generated.uri, {
          headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY || '' },
        });
        if (!videoRes.ok) {
          throw new Error(`Falha ao baixar vídeo Veo (${videoRes.status}).`);
        }
        fs.writeFileSync(rawVeoPath, Buffer.from(await videoRes.arrayBuffer()));
      } else {
        throw new Error('Resposta Veo não retornou bytes ou URI do vídeo.');
      }

      const finalFilename = `${prefix}_final.mp4`;
      const finalPath = path.join(PASTA_SAIDA, finalFilename);
      const audioPath =
        audioFilename && fs.existsSync(path.join(PASTA_SAIDA, path.basename(audioFilename)))
          ? path.join(PASTA_SAIDA, path.basename(audioFilename))
          : null;

      try {
        if (audioPath) {
          await execFileAsync(
            'ffmpeg',
            [
              '-y',
              '-i',
              rawVeoPath,
              '-i',
              audioPath,
              '-vf',
              'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,format=yuv420p',
              '-map',
              '0:v:0',
              '-map',
              '1:a:0',
              '-c:v',
              'libx264',
              '-preset',
              'veryfast',
              '-crf',
              '24',
              '-c:a',
              'aac',
              '-b:a',
              '192k',
              '-shortest',
              '-movflags',
              '+faststart',
              finalPath,
            ],
            { timeout: 60000 }
          );
          if (fs.existsSync(rawVeoPath)) fs.unlinkSync(rawVeoPath);
        } else {
          fs.renameSync(rawVeoPath, finalPath);
        }
      } catch (muxErr) {
        if (fs.existsSync(rawVeoPath) && !fs.existsSync(finalPath)) {
          fs.renameSync(rawVeoPath, finalPath);
        }
        console.warn('[Veo audio mux warning]', muxErr);
      }

      const stat = fs.statSync(finalPath);
      res.json({
        videoUrl: `/api/media/${finalFilename}`,
        filename: finalFilename,
        sizeBytes: stat.size,
        durationSec: durationSec || 8,
        engine: 'veo_2',
      });
    } catch (veoErr) {
      const reason = formatGeminiError(veoErr);
      console.warn('[Veo fallback to FFmpeg Ken Burns]', reason);
      try {
        const fallbackVideo = await renderVideoWithFfmpeg({
          produto,
          prefix: `${prefix}_kb`,
          audioFilename,
          durationSec,
        });
        res.json({
          ...fallbackVideo,
          engine: 'ffmpeg_fallback',
          fallbackReason:
            'Veo 2.0 indisponível nesta chave/faturamento no momento; vídeo 9:16 gerado via FFmpeg Ken Burns automaticamente.',
        });
      } catch (ffErr) {
        const ffMsg = ffErr instanceof Error ? ffErr.message : 'Erro no fallback FFmpeg.';
        res.status(500).json({ error: `${reason} | Fallback FFmpeg falhou: ${ffMsg}` });
      }
    }
  });

  app.post(
    '/api/flow/mux-custom-video',
    express.raw({ type: ['video/mp4', 'application/octet-stream'], limit: '100mb' }),
    async (req, res) => {
      try {
        const rawBody = req.body as Buffer;
        if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
          res.status(400).json({ error: 'Arquivo .mp4 vazio ou inválido.' });
          return;
        }

        const itemId = String(req.query.itemId || 'flow').replace(/[^a-zA-Z0-9_-]/g, '');
        const slotNumber = Number(req.query.slotNumber || 1);
        const audioFilename =
          typeof req.query.audioFilename === 'string' && req.query.audioFilename.trim()
            ? path.basename(req.query.audioFilename.trim())
            : '';

        const prefix = `flow_slot${slotNumber}_${itemId}_${Date.now()}`;
        const rawPath = path.join(PASTA_SAIDA, `${prefix}_upload.mp4`);
        const finalFilename = `${prefix}_final.mp4`;
        const finalPath = path.join(PASTA_SAIDA, finalFilename);

        fs.writeFileSync(rawPath, rawBody);

        const audioPath =
          audioFilename && fs.existsSync(path.join(PASTA_SAIDA, audioFilename))
            ? path.join(PASTA_SAIDA, audioFilename)
            : null;

        const normalizeFilter =
          'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=yuv420p';

        const args: string[] = ['-y', '-i', rawPath];
        if (audioPath) {
          args.push(
            '-i',
            audioPath,
            '-vf',
            normalizeFilter,
            '-map',
            '0:v:0',
            '-map',
            '1:a:0',
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '24',
            '-c:a',
            'aac',
            '-b:a',
            '192k',
            '-shortest',
            '-movflags',
            '+faststart',
            finalPath
          );
        } else {
          args.push(
            '-vf',
            normalizeFilter,
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '24',
            '-c:a',
            'aac',
            '-b:a',
            '192k',
            '-movflags',
            '+faststart',
            finalPath
          );
        }

        try {
          await execFileAsync('ffmpeg', args, { timeout: 90000 });
        } finally {
          if (fs.existsSync(rawPath)) {
            fs.unlinkSync(rawPath);
          }
        }

        const stat = fs.statSync(finalPath);
        res.json({
          videoUrl: `/api/media/${finalFilename}`,
          filename: finalFilename,
          sizeBytes: stat.size,
          audioMuxed: Boolean(audioPath),
          engine: 'google_flow_mux',
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao processar .mp4 do Google Flow com FFmpeg.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.post('/api/publish/dispatch', async (req, res) => {
    try {
      const { produto, copy, slotNumber, videoFilename, videoUrl } = req.body as {
        produto?: ShopeeProduct;
        copy?: VideoCopyPackage;
        slotNumber?: number;
        videoFilename?: string | null;
        videoUrl?: string | null;
      };
      if (!produto || !copy) {
        res.status(400).json({ error: 'Produto e roteiro são obrigatórios para publicação.' });
        return;
      }
      const slot = Number(slotNumber || 1) as 1 | 2 | 3;
      const telegram = await dispatchToTelegramIfConfigured({
        produto,
        copy,
        slot,
        videoFilename,
      });

      const { legendaCompleta } = buildTelegramOperationalMessage(produto, copy, slot);
      const history = loadHistory();
      const entry: PostedHistoryEntry = {
        itemId: produto.itemId,
        productName: produto.productName,
        slotNumber: slot,
        postedAt: new Date().toISOString(),
        offerLink: produto.offerLink,
        legendaCompleta,
        aigcLabel: copy.aigc_label,
        videoUrl: videoUrl || null,
        telegramSent: telegram.sent,
      };
      const nextHistory = appendHistory(history, entry);
      saveHistory(nextHistory);

      const slotObj = slots.find((s) => s.slot === slot);
      if (slotObj) {
        slotObj.lastStatus = 'completed';
        slotObj.lastRunAt = entry.postedAt;
        slotObj.lastProductId = produto.itemId;
      }

      res.json({
        history: nextHistory,
        slots,
        entry,
        telegramDetail: telegram.detail,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao publicar pacote.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/pipeline/run-slot', async (req, res) => {
    try {
      const { slotNumber } = req.body as { slotNumber?: number };
      const slot = ([1, 2, 3].includes(Number(slotNumber)) ? Number(slotNumber) : 1) as 1 | 2 | 3;
      const result = await runSlotCycle(slot);
      res.json({
        ...result,
        history: loadHistory(),
        slots,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro na execução automática do slot.';
      res.status(500).json({ error: message, slots });
    }
  });

  app.post('/api/history/remove', (req, res) => {
    const { itemId } = req.body as { itemId?: string };
    if (!itemId) {
      res.status(400).json({ error: 'itemId é obrigatório.' });
      return;
    }
    const nextHistory = loadHistory().filter((h) => h.itemId !== String(itemId));
    saveHistory(nextHistory);
    res.json({ history: nextHistory });
  });

  app.post('/api/history/clear', (_req, res) => {
    saveHistory([]);
    res.json({ history: [] });
  });

  app.post('/api/integrations/config', (req, res) => {
    const body = req.body as {
      shopeeAppId?: string;
      shopeeAppSecret?: string;
      telegramBotToken?: string;
      telegramChatId?: string;
      autoScheduleEnabled?: boolean;
      slotToggles?: Array<{ slot: number; enabled: boolean }>;
    };

    if (typeof body.shopeeAppId === 'string') runtimeConfig.shopeeAppId = body.shopeeAppId.trim();
    if (typeof body.shopeeAppSecret === 'string' && body.shopeeAppSecret.trim()) {
      runtimeConfig.shopeeAppSecret = body.shopeeAppSecret.trim();
    }
    if (typeof body.telegramBotToken === 'string' && body.telegramBotToken.trim()) {
      runtimeConfig.telegramBotToken = body.telegramBotToken.trim();
    }
    if (typeof body.telegramChatId === 'string') {
      runtimeConfig.telegramChatId = body.telegramChatId.trim();
    }
    if (typeof body.autoScheduleEnabled === 'boolean') {
      runtimeConfig.autoScheduleEnabled = body.autoScheduleEnabled;
    }
    if (Array.isArray(body.slotToggles)) {
      for (const toggle of body.slotToggles) {
        const target = slots.find((s) => s.slot === toggle.slot);
        if (target) target.enabled = Boolean(toggle.enabled);
      }
    }

    res.json({
      slots,
      integrationsStatus: {
        shopeeConfigured: Boolean(runtimeConfig.shopeeAppId && runtimeConfig.shopeeAppSecret),
        telegramConfigured: Boolean(runtimeConfig.telegramBotToken && runtimeConfig.telegramChatId),
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        autoScheduleEnabled: runtimeConfig.autoScheduleEnabled,
        shopeeAppIdPreview: runtimeConfig.shopeeAppId
          ? `${runtimeConfig.shopeeAppId.slice(0, 4)}••••`
          : '',
        telegramChatId: runtimeConfig.telegramChatId || '',
      },
    });
  });

  app.get('/api/media/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename);
    const fullPath = path.join(PASTA_SAIDA, safeName);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Arquivo de mídia não encontrado.' });
      return;
    }
    res.sendFile(fullPath);
  });

  // Scheduler loop every 30s (mirrors Python schedule.every().day.at("08:30" | "13:00" | "19:30"))
  setInterval(() => {
    if (!runtimeConfig.autoScheduleEnabled) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentHHMM = `${hh}:${mm}`;
    const tickKey = `${now.toDateString()}-${currentHHMM}`;
    if (tickKey === lastSchedulerTickMinute) return;

    const matchingSlot = slots.find((s) => s.enabled && s.time === currentHHMM);
    if (matchingSlot) {
      lastSchedulerTickMinute = tickKey;
      runSlotCycle(matchingSlot.slot).catch((err) => {
        console.error(`[Scheduler Slot #${matchingSlot.slot}]`, err);
      });
    }
  }, 30_000);

  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(distDir, 'index.html'));

  if (isProd) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Shopee Vídeo Studio servidor ativo em http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Erro fatal ao iniciar servidor:', err);
  process.exit(1);
});

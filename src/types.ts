import type {
  GoogleFlowPackage,
  GoogleFlowScenePrompt,
  HookType,
  PostedHistoryEntry,
  ShopeeProduct,
  SlotConfig,
  VideoCopyPackage,
} from './lib/shopeePipeline.ts';

export type ActiveTab = 'studio' | 'curation' | 'history' | 'integrations';

export interface IntegrationsStatus {
  shopeeConfigured: boolean;
  telegramConfigured: boolean;
  geminiConfigured: boolean;
  autoScheduleEnabled: boolean;
  shopeeAppIdPreview: string;
  telegramChatId: string;
  ffmpegAvailable?: boolean;
}

export interface RenderedVideoFile {
  filename: string;
  videoUrl: string;
  sizeBytes: number;
  createdAt: string;
}

export interface AppStateResponse {
  catalog: ShopeeProduct[];
  shopeeMode: 'live' | 'catalog';
  history: PostedHistoryEntry[];
  slots: SlotConfig[];
  renderedVideos: RenderedVideoFile[];
  dataDir?: string;
  integrationsStatus: IntegrationsStatus;
}

export type {
  GoogleFlowPackage,
  GoogleFlowScenePrompt,
  HookType,
  PostedHistoryEntry,
  ShopeeProduct,
  SlotConfig,
  VideoCopyPackage,
};

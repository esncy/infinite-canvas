import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";

import i18n from "@/i18n";

export type ApiCallFormat = "openai" | "gemini";
export type ModelCapability = "image" | "video" | "text" | "audio";
export type ReasoningEffort = "auto" | "low" | "medium" | "high" | "xhigh";

export type ChannelModel = {
    name: string;
    capability: ModelCapability;
    script?: string;
};

export type ModelChannel = {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    apiFormat: ApiCallFormat;
    models: ChannelModel[];
};

export type AiConfig = {
    channelMode: "remote" | "local";
    baseUrl: string;
    apiKey: string;
    apiFormat: ApiCallFormat;
    channels: ModelChannel[];
    model: string;
    imageModel: string;
    videoModel: string;
    textModel: string;
    audioModel: string;
    audioVoice: string;
    audioFormat: string;
    audioSpeed: string;
    audioInstructions: string;
    videoSeconds: string;
    vquality: string;
    videoGenerateAudio: string;
    videoWatermark: string;
    systemPrompt: string;
    reasoningEffort: ReasoningEffort;
    models: string[];
    quality: string;
    size: string;
    background: string;
    count: string;
    canvasImageCount: string;
};

export type WebdavSyncConfig = {
    url: string;
    username: string;
    password: string;
    directory: string;
    lastSyncedAt: string;
};
export type ConfigTabKey = "channels" | "preferences" | "prompt-sources" | "webdav" | "local-storage";

export const CONFIG_STORE_KEY = "infinite-canvas:ai_config_store";
export const DEFAULT_CHANNEL_ID = "dagouai";
const CHANNEL_MODEL_SEPARATOR = "::";
const OPENAI_BASE_URL = "https://api.openai.com";
const DAGOUI_BASE_URL = "https://dagouai.cc.cd";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_CHANNEL_MODELS: ChannelModel[] = [
    { name: "gpt-image-2", capability: "image" },
    { name: "grok-imagine-video", capability: "video" },
    { name: "gpt-5.6-luna", capability: "text" },
    { name: "gpt-4o-mini-tts", capability: "audio" },
];
const DAGOUI_DEFAULT_MODEL_VALUES: Record<string, string> = {
    "default::gpt-image-2": "dagouai::gpt-image-2",
    "default::grok-imagine-video": "dagouai::grok-imagine-video",
    "default::gpt-5.5": "dagouai::gpt-5.6-luna",
    "dagouai::gpt-5.5": "dagouai::gpt-5.6-luna",
    "default::gpt-4o-mini-tts": "dagouai::gpt-4o-mini-tts",
};
const LEGACY_DEFAULT_CHANNEL_NAMES = new Set(["openai", "默认渠道", "default provider"]);
const LEGACY_DEFAULT_MODEL_NAMES = new Set(["gpt-image-2", "grok-imagine-video", "gpt-5.5", "gpt-4o-mini-tts"]);

export const defaultConfig: AiConfig = {
    channelMode: "local",
    baseUrl: DAGOUI_BASE_URL,
    apiKey: "",
    apiFormat: "openai",
    channels: [
        {
            id: DEFAULT_CHANNEL_ID,
            name: i18n.t("config.channels.dagouName"),
            baseUrl: DAGOUI_BASE_URL,
            apiKey: "",
            apiFormat: "openai",
            models: DEFAULT_CHANNEL_MODELS.map((model) => ({ ...model })),
        },
    ],
    model: "dagouai::gpt-image-2",
    imageModel: "dagouai::gpt-image-2",
    videoModel: "dagouai::grok-imagine-video",
    textModel: "dagouai::gpt-5.6-luna",
    audioModel: "dagouai::gpt-4o-mini-tts",
    audioVoice: "alloy",
    audioFormat: "mp3",
    audioSpeed: "1",
    audioInstructions: "",
    videoSeconds: "6",
    vquality: "720",
    videoGenerateAudio: "true",
    videoWatermark: "false",
    systemPrompt: "",
    reasoningEffort: "auto",
    models: ["dagouai::gpt-image-2", "dagouai::grok-imagine-video", "dagouai::gpt-5.6-luna", "dagouai::gpt-4o-mini-tts"],
    quality: "auto",
    size: "1:1",
    background: "",
    count: "1",
    canvasImageCount: "1",
};

export const defaultWebdavSyncConfig: WebdavSyncConfig = {
    url: "",
    username: "",
    password: "",
    directory: "infinite-canvas",
    lastSyncedAt: "",
};

type ConfigStore = {
    config: AiConfig;
    webdav: WebdavSyncConfig;
    isConfigOpen: boolean;
    configTab: ConfigTabKey;
    shouldPromptContinue: boolean;
    updateConfig: <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;
    updateWebdavConfig: <K extends keyof WebdavSyncConfig>(key: K, value: WebdavSyncConfig[K]) => void;
    isAiConfigReady: (config: AiConfig, model: string) => boolean;
    openConfigDialog: (shouldPromptContinue?: boolean, tab?: ConfigTabKey) => void;
    setConfigDialogOpen: (isOpen: boolean) => void;
    clearPromptContinue: () => void;
};

const VIDEO_KEYWORDS = ["video", "sora", "veo", "kling", "wan", "hailuo"];

export function boolConfig(value: string, fallback: boolean) {
    return value ? value === "true" : fallback;
}
const AUDIO_KEYWORDS = ["audio", "tts", "speech", "voice", "music", "sound"];
const IMAGE_KEYWORDS = ["seedream", "gpt-image", "image", "dall-e", "dalle", "imagen", "flux", "sdxl", "stable-diffusion", "midjourney"];

/** Best-effort default capability for a freshly fetched model name; user can override in the channel editor. */
export function guessCapability(name: string): ModelCapability {
    const value = name.toLowerCase();
    if (VIDEO_KEYWORDS.some((keyword) => value.includes(keyword))) return "video";
    if (AUDIO_KEYWORDS.some((keyword) => value.includes(keyword))) return "audio";
    if (IMAGE_KEYWORDS.some((keyword) => value.includes(keyword))) return "image";
    return "text";
}

function findChannelModel(config: AiConfig, value: string): { channel: ModelChannel; model: ChannelModel } | null {
    const decoded = decodeChannelModel(value);
    const name = decoded?.model || value;
    const channel = decoded ? config.channels.find((item) => item.id === decoded.channelId) : config.channels.find((item) => item.models.some((model) => model.name === name));
    const model = channel?.models.find((item) => item.name === name);
    return channel && model ? { channel, model } : null;
}

export function modelCapabilityOf(config: AiConfig, value: string): ModelCapability | undefined {
    return findChannelModel(config, value)?.model.capability;
}

export function modelMatchesCapability(config: AiConfig, value: string, capability?: ModelCapability) {
    if (!capability) return true;
    return modelCapabilityOf(config, value) === capability;
}

export function resolveModelForCapability(config: AiConfig, currentModel: string | undefined, capability: ModelCapability) {
    const defaultModel = capability === "image" ? config.imageModel : capability === "video" ? config.videoModel : capability === "audio" ? config.audioModel : config.textModel;
    const fallbackModel = capability === "image" ? defaultConfig.imageModel : capability === "video" ? defaultConfig.videoModel : capability === "audio" ? defaultConfig.audioModel : defaultConfig.textModel;
    if (currentModel && modelMatchesCapability(config, currentModel, capability)) return currentModel;
    if (defaultModel && modelMatchesCapability(config, defaultModel, capability)) return defaultModel;
    return fallbackModel;
}

export function selectableModelsByCapability(config: AiConfig, capability?: ModelCapability) {
    if (!capability) return config.models;
    return config.channels.flatMap((channel) => channel.models.filter((model) => model.capability === capability).map((model) => encodeChannelModel(channel.id, model.name)));
}

/** The user script (if any) attached to a model; empty string means use the system default call. */
export function resolveModelScript(config: AiConfig, value: string) {
    return findChannelModel(config, value)?.model.script?.trim() || "";
}

function isAiConfigReady(config: AiConfig, model: string) {
    const channel = resolveModelChannel(config, model);
    return Boolean(model.trim() && channel.baseUrl.trim() && channel.apiKey.trim());
}

export const useConfigStore = create<ConfigStore>()(
    persist(
        (set, get) => ({
            config: defaultConfig,
            webdav: defaultWebdavSyncConfig,
            isConfigOpen: false,
            configTab: "channels",
            shouldPromptContinue: false,
            updateConfig: (key, value) =>
                set((state) => ({
                    config: {
                        ...state.config,
                        [key]: value,
                    },
                })),
            updateWebdavConfig: (key, value) =>
                set((state) => ({
                    webdav: {
                        ...state.webdav,
                        [key]: value,
                    },
                })),
            isAiConfigReady: (config, model) => isAiConfigReady(config, model),
            openConfigDialog: (shouldPromptContinue = false, configTab = "channels") => set({ isConfigOpen: true, shouldPromptContinue, configTab }),
            setConfigDialogOpen: (isConfigOpen) => set({ isConfigOpen }),
            clearPromptContinue: () => set({ shouldPromptContinue: false }),
        }),
        {
            name: CONFIG_STORE_KEY,
            partialize: (state) => ({ config: state.config, webdav: state.webdav }),
            merge: (persisted, current) => {
                const persistedState = (persisted || {}) as Partial<ConfigStore>;
                const persistedConfig = (persistedState.config || {}) as Partial<AiConfig>;
                const persistedWebdav = (persistedState.webdav || {}) as Partial<WebdavSyncConfig>;
                const config = { ...defaultConfig, ...persistedConfig };
                const hasPersistedChannelList = Array.isArray(persistedConfig.channels);
                if (persistedState.config && !hasPersistedChannelList) config.channels = legacyChannelsFromConfig(persistedConfig);
                const channels = normalizeChannels(config, !persistedState.config || !hasPersistedChannelList);
                const preserveLegacyDefault = channels.some((channel) => channel.id === "default");
                const models = modelOptionsFromChannels(channels);
                return {
                    ...current,
                    webdav: { ...defaultWebdavSyncConfig, ...persistedWebdav },
                    config: {
                        ...config,
                        channelMode: "local",
                        apiFormat: normalizeApiFormat(config.apiFormat),
                        channels,
                        models,
                        model: normalizeModelOptionValue(migrateDefaultModel(config.model, preserveLegacyDefault), channels),
                        imageModel: normalizeModelOptionValue(migrateDefaultModel(config.imageModel || config.model, preserveLegacyDefault), channels),
                        videoModel: normalizeModelOptionValue(migrateDefaultModel(config.videoModel, preserveLegacyDefault), channels),
                        textModel: normalizeModelOptionValue(migrateDefaultModel(config.textModel || config.model, preserveLegacyDefault), channels),
                        audioModel: normalizeModelOptionValue(migrateDefaultModel(config.audioModel || defaultConfig.audioModel, preserveLegacyDefault), channels),
                        audioVoice: config.audioVoice || defaultConfig.audioVoice,
                        audioFormat: config.audioFormat || defaultConfig.audioFormat,
                        audioSpeed: config.audioSpeed || defaultConfig.audioSpeed,
                        audioInstructions: config.audioInstructions || "",
                        reasoningEffort: config.reasoningEffort || "auto",
                        videoSeconds: config.videoSeconds || "6",
                        vquality: config.vquality || "720",
                        videoGenerateAudio: config.videoGenerateAudio || "true",
                        videoWatermark: config.videoWatermark || "false",
                        canvasImageCount: config.canvasImageCount === "3" ? "1" : config.canvasImageCount || "1",
                    },
                };
            },
        },
    ),
);

export function useEffectiveConfig() {
    const config = useConfigStore((state) => state.config);
    return useMemo(() => ({ ...config, channelMode: "local" as const }), [config]);
}

/** Normalize a mixed list of raw model names or model objects into deduped ChannelModel entries. */
export function normalizeChannelModels(models: Array<string | ChannelModel> | undefined): ChannelModel[] {
    const seen = new Set<string>();
    const result: ChannelModel[] = [];
    for (const item of models || []) {
        const name = (typeof item === "string" ? item : item?.name || "").trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        const capability = typeof item === "string" ? guessCapability(name) : item.capability || guessCapability(name);
        const script = typeof item === "string" ? undefined : item.script?.trim() || undefined;
        result.push({ name, capability, script });
    }
    return result;
}

export function createModelChannel(channel?: Partial<ModelChannel>): ModelChannel {
    const apiFormat = normalizeApiFormat(channel?.apiFormat);
    return {
        id: channel?.id?.trim() || nanoid(),
        name: channel?.name?.trim() || i18n.t("config.channels.newName"),
        baseUrl: channel?.baseUrl?.trim() || defaultBaseUrlForApiFormat(apiFormat),
        apiKey: channel?.apiKey || "",
        apiFormat,
        models: normalizeChannelModels(channel?.models),
    };
}

export function encodeChannelModel(channelId: string, model: string) {
    return `${channelId}${CHANNEL_MODEL_SEPARATOR}${model.trim()}`;
}

export function isChannelModelValue(value: string) {
    return value.includes(CHANNEL_MODEL_SEPARATOR);
}

export function decodeChannelModel(value: string) {
    const index = value.indexOf(CHANNEL_MODEL_SEPARATOR);
    if (index < 0) return null;
    return { channelId: value.slice(0, index), model: value.slice(index + CHANNEL_MODEL_SEPARATOR.length) };
}

export function modelOptionName(value: string) {
    return decodeChannelModel(value)?.model || value;
}

export function modelOptionLabel(config: AiConfig, value: string) {
    const decoded = decodeChannelModel(value);
    if (!decoded) return value;
    const channel = config.channels.find((item) => item.id === decoded.channelId);
    return channel ? `${decoded.model}（${channel.name}）` : decoded.model;
}

export function modelOptionsFromChannels(channels: ModelChannel[]) {
    return uniqueModelOptions(channels.flatMap((channel) => channel.models.map((model) => encodeChannelModel(channel.id, model.name))));
}

export function normalizeModelOptionValue(value: string | undefined, channels: ModelChannel[]) {
    const model = (value || "").trim();
    if (!model) return "";
    const decoded = decodeChannelModel(model);
    if (decoded) {
        const channel = channels.find((item) => item.id === decoded.channelId);
        return channel && channel.models.some((item) => item.name === decoded.model) ? model : "";
    }
    const channel = channels.find((item) => item.models.some((entry) => entry.name === model)) || channels[0];
    return channel && channel.models.some((item) => item.name === model) ? encodeChannelModel(channel.id, model) : model;
}

export function resolveModelChannel(config: AiConfig, value: string) {
    const decoded = decodeChannelModel(value);
    const model = decoded?.model || value;
    const matched = decoded ? config.channels.find((channel) => channel.id === decoded.channelId) : config.channels.find((channel) => channel.models.some((item) => item.name === model));
    return matched || config.channels[0] || createModelChannel({ id: DEFAULT_CHANNEL_ID, name: i18n.t("config.channels.dagouName"), baseUrl: DAGOUI_BASE_URL, apiKey: "", apiFormat: "openai", models: DEFAULT_CHANNEL_MODELS });
}

export function resolveModelRequestConfig(config: AiConfig, value: string) {
    const channel = resolveModelChannel(config, value);
    return {
        ...config,
        model: modelOptionName(value || config.model),
        baseUrl: channel.baseUrl,
        apiKey: channel.apiKey,
        apiFormat: channel.apiFormat,
    };
}

function normalizeChannels(config: AiConfig, seedDefault = true) {
    const persistedChannels = (Array.isArray(config.channels) ? config.channels : []).filter((channel) => {
        const id = channel.id?.trim();
        const name = channel.name?.trim().toLowerCase();
        const legacyDefault = id === "default" || (!id && LEGACY_DEFAULT_CHANNEL_NAMES.has(name || ""));
        return !legacyDefault || hasLegacyChannelConfiguration(channel);
    });
    const channels = persistedChannels.map((channel, index) =>
        (() => {
            const id = channel.id || `channel-${index + 1}`;
            const name = channel.name?.trim() || i18n.t("config.channels.indexedName", { index: index + 1 });
            return createModelChannel({ ...channel, id, name, models: normalizeChannelModels(channel.models) });
        })(),
    );
    if (!channels.length && seedDefault) {
        channels.push(
            createModelChannel({
                id: DEFAULT_CHANNEL_ID,
                name: i18n.t("config.channels.dagouName"),
                baseUrl: DAGOUI_BASE_URL,
                apiKey: "",
                apiFormat: "openai",
                models: DEFAULT_CHANNEL_MODELS,
            }),
        );
    }
    return channels;
}

function legacyChannelsFromConfig(config: Partial<AiConfig>) {
    const apiFormat = normalizeApiFormat(config.apiFormat);
    const baseUrl = config.baseUrl?.trim() || OPENAI_BASE_URL;
    const models = normalizeChannelModels([config.model, config.imageModel, config.videoModel, config.textModel, config.audioModel].filter((model): model is string => Boolean(model)));
    const hasCustomModel = models.some((model) => !LEGACY_DEFAULT_MODEL_NAMES.has(model.name));
    if (!config.apiKey?.trim() && baseUrl === OPENAI_BASE_URL && apiFormat === "openai" && !hasCustomModel) return [];
    return [createModelChannel({ id: "default", name: "OpenAI", baseUrl, apiKey: config.apiKey || "", apiFormat, models })];
}

function hasLegacyChannelConfiguration(channel: Partial<ModelChannel>) {
    const baseUrl = channel.baseUrl?.trim().replace(/\/+$/, "").toLowerCase() || "";
    const models = normalizeChannelModels(channel.models);
    const isDefaultModels = models.length === 0 || models.every((model) => LEGACY_DEFAULT_MODEL_NAMES.has(model.name));
    return Boolean(channel.apiKey?.trim() || (baseUrl && baseUrl !== OPENAI_BASE_URL) || channel.apiFormat === "gemini" || !isDefaultModels);
}

function migrateDefaultModel(value: string | undefined, preserveLegacyDefault = false) {
    const normalized = (value || "").trim();
    if (preserveLegacyDefault) return normalized;
    return DAGOUI_DEFAULT_MODEL_VALUES[normalized] || normalized;
}

export function defaultBaseUrlForApiFormat(apiFormat: ApiCallFormat) {
    if (apiFormat === "gemini") return GEMINI_BASE_URL;
    return OPENAI_BASE_URL;
}

function normalizeApiFormat(apiFormat: unknown): ApiCallFormat {
    return apiFormat === "gemini" ? apiFormat : "openai";
}

function uniqueModelOptions(models: string[]) {
    return Array.from(new Set((models || []).map((model) => model.trim()).filter(Boolean)));
}

export function buildApiUrl(baseUrl: string, path: string) {
    const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
    const lowerBaseUrl = normalizedBaseUrl.toLowerCase();
    const apiBaseUrl = lowerBaseUrl.endsWith("/v1") ? normalizedBaseUrl : `${normalizedBaseUrl}/v1`;
    return `${apiBaseUrl}${path}`;
}

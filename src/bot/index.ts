import { autoChatAction } from "@grammyjs/auto-chat-action";
import { hydrate } from "@grammyjs/hydrate";
import { hydrateReply, parseMode } from "@grammyjs/parse-mode";
import { autoRetry } from "@grammyjs/auto-retry";
import { limit } from "@grammyjs/ratelimiter";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { Bot as TelegramBot, BotConfig, StorageAdapter } from "grammy";
import { Context, createContextConstructor } from "~/bot/context";
import {
  botAdminFeature,
  languageFeature,
  unhandledFeature,
  welcomeFeature,
} from "~/bot/features";
import { errorHandler } from "~/bot/handlers";
import { isMultipleLocales } from "~/bot/i18n";
import {
  i18n,
  metrics,
  session,
  setScope,
  updateLogger,
} from "~/bot/middlewares";
import type { Container } from "~/container";
import { saveMessage } from "~/bot/middlewares/save-message.middleware.ts";

type Dependencies = {
  container: Container;
  sessionStorage: StorageAdapter<unknown>;
};

export const createBot = (
  token: string,
  { container, sessionStorage }: Dependencies,
  botConfig?: Omit<BotConfig<Context>, "ContextConstructor">,
) => {
  const { config } = container;
  const bot = new TelegramBot(token, {
    ...botConfig,
    ContextConstructor: createContextConstructor(container),
  });

  // Middlewares

  bot.api.config.use(autoRetry());
  bot.api.config.use(apiThrottler());
  bot.api.config.use(parseMode("HTML"));

  if (config.isDev) {
    bot.use(updateLogger());
  }

  bot.use(metrics());
  bot.use(limit());
  bot.use(autoChatAction());
  bot.use(hydrateReply);
  bot.use(hydrate());
  bot.use(session(sessionStorage));
  bot.use(setScope());
  bot.use(saveMessage());
  bot.use(i18n());

  // Handlers

  bot.use(botAdminFeature);
  bot.use(welcomeFeature);

  if (isMultipleLocales) {
    bot.use(languageFeature);
  }

  bot.use(unhandledFeature);

  if (config.isDev) {
    bot.catch(errorHandler);
  }

  return bot;
};

export type Bot = ReturnType<typeof createBot>;

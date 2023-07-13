#!/usr/bin/env tsx
import { Role } from "@prisma/client";
import { onShutdown } from "node-graceful-shutdown";
import { createBot } from "~/bot";
import { createAppContainer } from "~/container";
import { createServer } from "~/server";
import { PrismaAdapter } from "@grammyjs/storage-prisma";
import * as Sentry from "@sentry/node";
import { getSentryConfig } from "~/sentry.config.ts";

const container = createAppContainer();

try {
  const { config, logger, prisma } = container;

  if (config.SENTRY_DSN) {
    Sentry.init(getSentryConfig(container));
  }

  const bot = createBot(config.BOT_TOKEN, {
    container,
    sessionStorage: new PrismaAdapter(prisma.session),
  });
  await bot.init();

  const server = await createServer(bot, container);

  // Graceful shutdown
  onShutdown(async () => {
    logger.info("shutdown");

    await bot.stop();
    await server.close();
  });

  await prisma.$connect();

  // update bot owner role
  await prisma.user.upsert({
    where: prisma.user.byTelegramId(config.BOT_ADMIN_USER_ID),
    create: {
      telegramId: config.BOT_ADMIN_USER_ID,
      role: Role.OWNER,
    },
    update: {
      role: Role.OWNER,
    },
  });

  if (config.isProd) {
    await server.listen({
      host: config.BOT_SERVER_HOST,
      port: config.BOT_SERVER_PORT,
    });
  }
  // eslint-disable-next-line unicorn/prefer-ternary
  if (config.BOT_WEBHOOK) {
    await bot.api.setWebhook(config.BOT_WEBHOOK, {
      allowed_updates: config.BOT_ALLOWED_UPDATES,
    });
  } else {
    await bot.start({
      allowed_updates: config.BOT_ALLOWED_UPDATES,
      onStart: ({ username }) =>
        logger.info({
          msg: "bot running...",
          username,
        }),
    });
  }
} catch (error) {
  container.logger.error(error);
  process.exit(1);
}

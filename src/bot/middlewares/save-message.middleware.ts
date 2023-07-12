import { Context } from "~/bot/context.ts";
import { Middleware } from "grammy";
import { Prisma } from "@prisma/client";

export const saveMessage = (): Middleware<Context> => {
  return async (ctx, next) => {
    if (ctx.from?.is_bot === false) {
      const { message, prisma, logger } = ctx;
      const queries: Prisma.PrismaPromise<unknown>[] = [];
      if (message?.chat) {
        const { chat } = message;
        const chatDto: Prisma.ChatCreateInput = {
          id: chat.id,
          type: chat.type,
        };
        queries.push(
          prisma.chat.upsert({
            where: {
              id: chat.id,
            },
            create: chatDto,
            update: {},
          }),
        );
      }
      if (message) {
        if (message.from) {
          const {
            from,
            chat,
            message_id: messageId,
            date,
            text,
            ...meta
          } = message;
          try {
            const json = JSON.parse(JSON.stringify(meta));
            const messageData = {
              messageId,
              date: new Date(date * 1000),
              userId: from.id,
              chatId: chat.id,
              text,
              meta: Object.keys(meta).length > 0 ? json : undefined,
            };
            queries.push(
              prisma.message.create({
                data: messageData,
              }),
              prisma.user.update({
                where: { telegramId: from.id },
                data: {
                  chats: {
                    connect: {
                      id: chat.id,
                    },
                  },
                },
              }),
            );
          } catch (error) {
            logger.error(
              "[save-message] Error while parsing",
              JSON.stringify(error),
            );
          }
        } else {
          logger.error(
            "[save-message] Message without author",
            JSON.stringify(message),
          );
        }
      }

      await prisma.$transaction(queries);

      return next();
    }
  };
};

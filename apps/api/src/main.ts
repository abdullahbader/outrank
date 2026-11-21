import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { assertSafeConfig, config } from './config';
import { ChatService } from './chat.service';
import { ContentService } from './content.service';
import { GameGateway } from './game.gateway';
import { GamesService } from './games.service';
import { HttpController } from './http.controller';
import { PrismaService } from './prisma.service';
import { RealtimeService } from './realtime.service';
import { DeviceGuard } from './auth';

@Module({
  controllers: [HttpController],
  providers: [PrismaService, ContentService, RealtimeService, GamesService, ChatService, GameGateway, DeviceGuard],
})
class AppModule {}

async function bootstrap() {
  assertSafeConfig();
  const app = await NestFactory.create(AppModule, { logger: process.env.NODE_ENV === 'test' ? ['error', 'warn'] : ['error', 'warn', 'log'] });
  app.enableCors({ origin: true });
  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
  console.log(`Outrank API on http://localhost:${config.port}${config.devTools ? ' (dev tools on)' : ''}`);
}

bootstrap();

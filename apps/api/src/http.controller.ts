import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { CurrentDevice, DeviceGuard, GameError, hashToken, newToken, type AuthedDevice } from './auth';
import { config } from './config';
import { ContentService } from './content.service';
import { GamesService } from './games.service';
import { PrismaService } from './prisma.service';
import { actionSchema, botsBody, createGameBody, deviceBody, joinBody, recoverBody } from './schemas';

function parse<T>(schema: ZodSchema<T>, body: unknown): T {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw new GameError('INVALID_INPUT');
  return r.data;
}

@Controller()
export class HttpController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly games: GamesService,
    private readonly content: ContentService,
  ) {}

  @Get('health')
  health() { return { ok: true, devTools: config.devTools }; }

  /** Settings the apps read at start: support contacts (shown only when set). */
  @Get('app-config')
  appConfig() {
    return { support: { whatsapp: process.env.SUPPORT_WHATSAPP || null, email: process.env.SUPPORT_EMAIL || null } };
  }

  // ── devices (guest identity)

  @Post('devices')
  async createDevice(@Body() body: unknown) {
    const b = parse(deviceBody, body);
    const token = newToken();
    const d = await this.prisma.device.create({ data: { tokenHash: hashToken(token), displayName: b.displayName, avatarColor: b.avatarColor, avatarEmoji: b.avatarEmoji, locale: b.locale } });
    return { deviceId: d.id, token };
  }

  @Patch('devices/me')
  @UseGuards(DeviceGuard)
  async updateDevice(@CurrentDevice() dev: AuthedDevice, @Body() body: unknown) {
    const b = parse(deviceBody, body);
    const d = await this.prisma.device.update({ where: { id: dev.id }, data: b });
    return { deviceId: d.id, displayName: d.displayName, avatarColor: d.avatarColor, avatarEmoji: d.avatarEmoji, locale: d.locale };
  }

  @Get('devices/me')
  @UseGuards(DeviceGuard)
  async me(@CurrentDevice() dev: AuthedDevice) {
    const d = await this.prisma.device.findUniqueOrThrow({ where: { id: dev.id } });
    return { deviceId: d.id, displayName: d.displayName, avatarColor: d.avatarColor, avatarEmoji: d.avatarEmoji, locale: d.locale };
  }

  @Get('devices/me/stats')
  @UseGuards(DeviceGuard)
  stats(@CurrentDevice() dev: AuthedDevice) { return this.games.stats(dev.id); }

  /** Games this phone is in right now (to come back after closing the app). */
  @Get('devices/me/active-games')
  @UseGuards(DeviceGuard)
  async active(@CurrentDevice() dev: AuthedDevice) {
    const hosted = await this.prisma.game.findMany({ where: { hostDeviceId: dev.id, status: { in: ['lobby', 'playing'] } }, select: { id: true, code: true, status: true } });
    const joined = await this.prisma.gameParticipant.findMany({
      where: { deviceId: dev.id, removedAt: null, game: { status: { in: ['lobby', 'playing'] } } },
      select: { game: { select: { id: true, code: true, status: true } } },
    });
    return [
      ...hosted.map((g) => ({ gameId: g.id, code: g.code, status: g.status, role: 'host' as const })),
      ...joined.map((j) => ({ gameId: j.game.id, code: j.game.code, status: j.game.status, role: 'player' as const })),
    ];
  }

  // ── content

  @Get('categories')
  categories() { return this.content.categoriesWithCounts(); }

  // ── games

  @Post('games')
  @UseGuards(DeviceGuard)
  create(@CurrentDevice() dev: AuthedDevice, @Body() body: unknown) {
    const b = parse(createGameBody, body);
    return this.games.create(dev.id, b.categories ?? [], b.answerSeconds, !!b.hostOnly);
  }

  /** One-phone game: the host adds a player by name (that player has no phone of their own). */
  @Post('games/:id/players')
  @UseGuards(DeviceGuard)
  @HttpCode(200)
  addPlayer(@CurrentDevice() dev: AuthedDevice, @Param('id') id: string, @Body() body: unknown) {
    return this.games.addLocalPlayer(id, dev.id, parse(joinBody, body).name);
  }

  @Get('games/by-code/:code')
  @UseGuards(DeviceGuard)
  byCode(@Param('code') code: string) { return this.games.byCode(code); }

  @Post('games/:id/join')
  @UseGuards(DeviceGuard)
  @HttpCode(200)
  join(@CurrentDevice() dev: AuthedDevice, @Param('id') id: string, @Body() body: unknown) {
    return this.games.join(id, dev.id, parse(joinBody, body).name);
  }

  @Post('games/:id/host/recover')
  @UseGuards(DeviceGuard)
  @HttpCode(200)
  recover(@CurrentDevice() dev: AuthedDevice, @Param('id') id: string, @Body() body: unknown) {
    return this.games.recoverHost(id, dev.id, parse(recoverBody, body).recoveryCode);
  }

  @Get('games/:id/state')
  @UseGuards(DeviceGuard)
  async state(@CurrentDevice() dev: AuthedDevice, @Param('id') id: string) {
    const { viewer } = await this.games.actorFor(id, dev.id);
    return this.games.view(id, viewer);
  }

  @Get('games/:id/results')
  @UseGuards(DeviceGuard)
  async results(@CurrentDevice() dev: AuthedDevice, @Param('id') id: string) {
    const { viewer } = await this.games.actorFor(id, dev.id);
    return this.games.results(id, viewer);
  }

  // ── dev tools (refused in production)

  @Post('dev/games/:id/bots')
  @UseGuards(DeviceGuard)
  async bots(@CurrentDevice() dev: AuthedDevice, @Param('id') id: string, @Body() body: unknown) {
    this.devOnly();
    const { actor } = await this.games.actorFor(id, dev.id);
    if (actor.role !== 'host') throw new GameError('NOT_HOST');
    return this.games.addBots(id, parse(botsBody, body).count);
  }

  /** Practise as a player: a game with an automatic host and test players. */
  @Post('dev/practice')
  @UseGuards(DeviceGuard)
  @HttpCode(200)
  practice(@CurrentDevice() dev: AuthedDevice) {
    this.devOnly();
    return this.games.startPractice(dev.id);
  }

  @Post('dev/games/:id/host-act')
  @UseGuards(DeviceGuard)
  @HttpCode(200)
  practiceHost(@CurrentDevice() dev: AuthedDevice, @Param('id') id: string, @Body() body: unknown) {
    this.devOnly();
    return this.games.practiceHostAct(id, dev.id, parse(actionSchema, body) as never);
  }

  @Post('dev/games/:id/bots/:playerId/act')
  @UseGuards(DeviceGuard)
  @HttpCode(200)
  async botAct(@CurrentDevice() dev: AuthedDevice, @Param('id') id: string, @Param('playerId') playerId: string, @Body() body: unknown) {
    this.devOnly();
    const { actor } = await this.games.actorFor(id, dev.id);
    if (actor.role !== 'host') throw new GameError('NOT_HOST');
    return this.games.botAct(id, playerId, parse(actionSchema, body) as never);
  }

  private devOnly() {
    if (!config.devTools || config.production) throw new GameError('NOT_AVAILABLE', 404);
  }
}

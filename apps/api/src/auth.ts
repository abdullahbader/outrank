import { createHash, randomBytes } from 'node:crypto';
import {
  CanActivate, createParamDecorator, ExecutionContext, HttpException, HttpStatus, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

export interface AuthedDevice { id: string; displayName: string | null }

export function tokenFromHeader(h: string | undefined): string | null {
  if (!h) return null;
  const m = /^Device\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : null;
}

@Injectable()
export class DeviceGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const token = tokenFromHeader(req.headers['authorization']);
    if (!token) throw new UnauthorizedException({ error: 'NO_DEVICE' });
    const device = await this.prisma.device.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!device) throw new UnauthorizedException({ error: 'UNKNOWN_DEVICE' });
    req.device = { id: device.id, displayName: device.displayName } satisfies AuthedDevice;
    // last-seen is informative only; do not block the request on it
    this.prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
    return true;
  }
}

export const CurrentDevice = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthedDevice => {
  return ctx.switchToHttp().getRequest().device;
});

/** Error with the engine-style code the apps translate. */
export class GameError extends HttpException {
  constructor(code: string, status = HttpStatus.BAD_REQUEST) {
    super({ error: code }, status);
  }
}

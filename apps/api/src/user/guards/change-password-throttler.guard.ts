import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class ChangePasswordThrottlerGuard extends ThrottlerGuard {
  async getTracker(req: Request): Promise<string> {
    const userId = (req.user as { sub?: string } | undefined)?.sub ?? 'anonymous';
    return `${userId}:${req.ip}`;
  }
}

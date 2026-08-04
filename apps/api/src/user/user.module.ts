import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MulterModule } from '@nestjs/platform-express';
import { ThrottlerModule } from '@nestjs/throttler';
import { join, resolve } from 'node:path';
import { MIME_TYPE_DETECTOR, UPLOAD_DIR } from '../files/files.constants';
import { FileTypeMimeDetector } from '../files/mime-type-detector';
import { avatarDiskOptions } from './avatar.options';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { GetUserProfileHandler } from './queries/get-user-profile.handler';
import { UpdateUserProfileHandler } from './commands/update-user-profile.handler';
import { UserRegisteredHandler } from './events/user-registered.handler';
import { UserLoggedInHandler } from './events/user-logged-in.handler';

@Module({
  imports: [
    CqrsModule,
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL_MS ?? 15 * 60 * 1000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 5),
      },
    ]),
    MulterModule.registerAsync({
      useFactory: () =>
        avatarDiskOptions(resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'))),
    }),
  ],
  controllers: [UserController],
  providers: [
    UserService,
    GetUserProfileHandler,
    UpdateUserProfileHandler,
    UserRegisteredHandler,
    UserLoggedInHandler,
    {
      provide: UPLOAD_DIR,
      useValue: resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads')),
    },
    {
      provide: MIME_TYPE_DETECTOR,
      useClass: FileTypeMimeDetector,
    },
  ],
  exports: [UserService],
})
export class UserModule {}

import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { MeetingsModule } from './meetings/meeting.module';
import { FilesModule } from './files/files.module';
import { PrismaModule } from './prisma/prisma.module';
import { TranscriptionModule } from './transcription/transcription.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL_MS ?? 15 * 60 * 1000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 5),
      },
    ]),
    AuthModule,
    UserModule,
    MeetingsModule,
    FilesModule,
    PrismaModule,
    TranscriptionModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { MeetingsModule } from './meetings/meeting.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [AuthModule, MeetingsModule, PrismaModule],
})
export class AppModule {}

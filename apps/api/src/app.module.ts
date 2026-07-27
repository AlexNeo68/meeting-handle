import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { MeetingsModule } from './meetings/meeting.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [AuthModule, UserModule, MeetingsModule, PrismaModule],
})
export class AppModule {}

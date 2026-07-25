import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { RegisterHandler } from './commands/register.handler';
import { LoginHandler } from './queries/login.handler';

@Module({
  imports: [
    CqrsModule,
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'test-secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [RegisterHandler, LoginHandler],
})
export class AuthModule {}

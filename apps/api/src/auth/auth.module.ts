import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { RegisterHandler } from './commands/register.handler';
import { GetMeHandler } from './queries/get-me.handler';
import { LoginHandler } from './queries/login.handler';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    CqrsModule,
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'test-secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [RegisterHandler, LoginHandler, GetMeHandler, JwtStrategy],
  exports: [PassportModule, JwtModule],
})
export class AuthModule {}

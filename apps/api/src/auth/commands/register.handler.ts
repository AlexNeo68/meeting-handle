import { ConflictException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterCommand } from './register.command';
import { UserRegisteredEvent } from '../../user/events/user-registered.event';

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RegisterCommand) {
    const email = command.email.trim().toLowerCase();
    const hashedPassword = await bcrypt.hash(command.password, 10);

    const trimmedName = command.name?.trim();

    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: trimmedName || null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Registration failed');
      }
      throw err;
    }

    this.eventBus.publish(new UserRegisteredEvent(user.id, user.email));

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
    });

    return {
      token,
      userId: user.id,
    };
  }
}

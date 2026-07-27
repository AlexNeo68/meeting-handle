import { UnauthorizedException } from '@nestjs/common';
import { EventBus, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginQuery } from './login.query';
import { UserLoggedInEvent } from '../../user/events/user-logged-in.event';

@QueryHandler(LoginQuery)
export class LoginHandler implements IQueryHandler<LoginQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(query: LoginQuery) {
    const user = await this.prisma.user.findUnique({
      where: { email: query.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(query.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.eventBus.publish(new UserLoggedInEvent(user.id, user.email));

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      token,
      userId: user.id,
    };
  }
}

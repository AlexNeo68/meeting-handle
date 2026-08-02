import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserId } from '../common/decorators/user-id.decorator';
import { RegisterCommand } from './commands/register.command';
import { GetMeQuery } from './queries/get-me.query';
import { LoginQuery } from './queries/login.query';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.commandBus.execute(new RegisterCommand(dto.email, dto.password));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.queryBus.execute(new LoginQuery(dto.email, dto.password));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@UserId() userId: string) {
    return this.queryBus.execute(new GetMeQuery(userId));
  }
}

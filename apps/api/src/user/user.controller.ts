import { Body, Controller, Get, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserId } from '../common/decorators/user-id.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GetUserProfileQuery } from './queries/get-user-profile.query';
import { UpdateUserProfileCommand } from './commands/update-user-profile.command';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('profile')
  async getProfile(@UserId() userId: string) {
    return this.queryBus.execute(new GetUserProfileQuery(userId));
  }

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(@UserId() userId: string, @Body() dto: UpdateProfileDto) {
    return this.commandBus.execute(new UpdateUserProfileCommand(userId, dto.name, dto.email));
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserId } from '../common/decorators/user-id.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GetUserProfileQuery } from './queries/get-user-profile.query';
import { UpdateUserProfileCommand } from './commands/update-user-profile.command';
import { UserService } from './user.service';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly userService: UserService,
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

  @Patch('password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  async changePassword(@UserId() userId: string, @Body() dto: ChangePasswordDto) {
    return this.userService.changePassword(userId, dto.password);
  }

  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File, @UserId() userId: string) {
    return this.userService.uploadAvatar(userId, file);
  }

  @Delete('profile/avatar')
  @HttpCode(HttpStatus.OK)
  async removeAvatar(@UserId() userId: string) {
    return this.userService.removeAvatar(userId);
  }

  @Get('profile/avatar')
  @Header('X-Content-Type-Options', 'nosniff')
  async getAvatar(@UserId() userId: string) {
    return this.userService.getAvatar(userId);
  }
}

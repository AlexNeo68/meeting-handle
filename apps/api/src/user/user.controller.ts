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
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserId } from '../common/decorators/user-id.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordThrottlerGuard } from './guards/change-password-throttler.guard';
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
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @UseGuards(ChangePasswordThrottlerGuard)
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
  @Header('Cache-Control', 'private, max-age=31536000, immutable')
  @Header('Vary', 'Authorization')
  async getAvatar(
    @UserId() userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const avatar = await this.userService.getAvatar(userId);

    res.setHeader('ETag', avatar.etag);
    if (req.headers['if-none-match'] === avatar.etag) {
      res.status(HttpStatus.NOT_MODIFIED).send();
      return;
    }

    return avatar.stream;
  }
}

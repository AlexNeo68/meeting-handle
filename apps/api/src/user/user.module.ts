import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { GetUserProfileHandler } from './queries/get-user-profile.handler';
import { UpdateUserProfileHandler } from './commands/update-user-profile.handler';
import { UserRegisteredHandler } from './events/user-registered.handler';
import { UserLoggedInHandler } from './events/user-logged-in.handler';

@Module({
  imports: [CqrsModule],
  controllers: [UserController],
  providers: [
    UserService,
    GetUserProfileHandler,
    UpdateUserProfileHandler,
    UserRegisteredHandler,
    UserLoggedInHandler,
  ],
  exports: [UserService],
})
export class UserModule {}

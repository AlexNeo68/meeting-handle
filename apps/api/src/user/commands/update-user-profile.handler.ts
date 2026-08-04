import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserService } from '../user.service';
import { UpdateUserProfileCommand } from './update-user-profile.command';

@CommandHandler(UpdateUserProfileCommand)
export class UpdateUserProfileHandler implements ICommandHandler<UpdateUserProfileCommand> {
  constructor(private readonly userService: UserService) {}

  async execute(command: UpdateUserProfileCommand) {
    return this.userService.updateProfile(command.userId, {
      name: command.name,
      email: command.email,
    });
  }
}

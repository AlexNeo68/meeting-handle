import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UserService } from '../user.service';
import { GetUserProfileQuery } from './get-user-profile.query';

@QueryHandler(GetUserProfileQuery)
export class GetUserProfileHandler implements IQueryHandler<GetUserProfileQuery> {
  constructor(private readonly userService: UserService) {}

  async execute(query: GetUserProfileQuery) {
    return this.userService.getProfile(query.userId);
  }
}

import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { UserLoggedInEvent } from './user-logged-in.event';

@EventsHandler(UserLoggedInEvent)
export class UserLoggedInHandler implements IEventHandler<UserLoggedInEvent> {
  handle(event: UserLoggedInEvent) {
    console.log(`[UserModule] User logged in: ${event.email} (${event.userId})`);
  }
}

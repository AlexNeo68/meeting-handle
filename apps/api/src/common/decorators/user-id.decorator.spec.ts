import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { UserId } from './user-id.decorator';

class TestController {
  handler(@UserId() _userId: string) {}
}

describe('UserId decorator', () => {
  const getFactory = () => {
    const metadata: Record<string, { factory: unknown }> = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      TestController,
      'handler',
    );
    const factory = Object.values(metadata)[0].factory;
    return factory as (data: unknown, ctx: ExecutionContext) => unknown;
  };

  const decorate = (request: Record<string, unknown>) => {
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return getFactory()(undefined, ctx);
  };

  it('should return sub from request.user', () => {
    expect(decorate({ user: { sub: 'jwt-sub' }, headers: {} })).toBe('jwt-sub');
  });

  it('should ignore the x-user-id header', () => {
    expect(
      decorate({ user: { sub: 'jwt-sub' }, headers: { 'x-user-id': 'attacker-controlled-id' } }),
    ).toBe('jwt-sub');
  });

  it('should return undefined when request.user is absent', () => {
    expect(decorate({ headers: { 'x-user-id': 'attacker-controlled-id' } })).toBeUndefined();
  });
});

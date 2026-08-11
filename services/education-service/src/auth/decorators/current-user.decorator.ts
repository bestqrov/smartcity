import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUserDto } from '../jwt.strategy';

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserDto | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: CurrentUserDto }>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);

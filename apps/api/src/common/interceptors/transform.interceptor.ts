import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Paginated } from '../dto/pagination';

/** Wraps every controller result in the `{ success: true, data, meta? }` envelope. */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<{ headersSent?: boolean }>();
    return next.handle().pipe(
      map((result) => {
        if (res.headersSent) return result;
        if (result instanceof Paginated) return { success: true, data: result.items, meta: result.meta };
        return { success: true, data: result ?? null };
      }),
    );
  }
}

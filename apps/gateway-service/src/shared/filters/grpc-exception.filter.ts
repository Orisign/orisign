import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { grpcToHttpStatus } from '../utils';
import type { Response } from 'express';

@Catch()
export class GrpcExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GrpcExceptionFilter.name);

  public catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (this.isGrpcError(exception)) {
      const status = grpcToHttpStatus[exception.code] || 500;

      return response.status(status).json({
        statusCode: status,
        message: exception.details || 'gRPC error',
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();

      this.logger.warn(exception.message);

      return response.status(status).json({
        statusCode: status,
        message: exception.message,
      });
    }

    this.logger.error(
      exception?.message || 'Unhandled exception',
      exception?.stack,
    );

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: 'Internal Server Error',
    });
  }

  private isGrpcError(exception: any) {
    return (
      typeof exception === 'object' &&
      'code' in exception &&
      'details' in exception
    );
  }
}

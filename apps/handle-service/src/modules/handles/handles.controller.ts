import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type {
  CheckHandleAvailabilityRequest,
  GetHandleByTargetRequest,
  ReleaseHandleRequest,
  ReserveHandleRequest,
  ResolveHandleRequest,
} from '@repo/contracts/gen/ts/handles';
import { HandlesService } from './handles.service';

@Controller()
export class HandlesController {
  public constructor(private readonly handlesService: HandlesService) {}

  @GrpcMethod('HandlesService', 'ReserveHandle')
  public reserveHandle(data: ReserveHandleRequest) {
    return this.handlesService.reserveHandle(data);
  }

  @GrpcMethod('HandlesService', 'ReleaseHandle')
  public releaseHandle(data: ReleaseHandleRequest) {
    return this.handlesService.releaseHandle(data);
  }

  @GrpcMethod('HandlesService', 'ResolveHandle')
  public resolveHandle(data: ResolveHandleRequest) {
    return this.handlesService.resolveHandle(data);
  }

  @GrpcMethod('HandlesService', 'CheckHandleAvailability')
  public checkHandleAvailability(data: CheckHandleAvailabilityRequest) {
    return this.handlesService.checkHandleAvailability(data);
  }

  @GrpcMethod('HandlesService', 'GetHandleByTarget')
  public getHandleByTarget(data: GetHandleByTargetRequest) {
    return this.handlesService.getHandleByTarget(data);
  }
}

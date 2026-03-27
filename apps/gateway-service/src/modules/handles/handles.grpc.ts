import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import type {
  CheckHandleAvailabilityRequest,
  GetHandleByTargetRequest,
  HandlesServiceClient,
  ResolveHandleRequest,
} from '@repo/contracts/gen/ts/handles';

@Injectable()
export class HandlesClientGrpc implements OnModuleInit {
  private handlesClient!: HandlesServiceClient;

  public constructor(@Inject('HANDLES_PACKAGE') private readonly client: ClientGrpc) {}

  public onModuleInit() {
    this.handlesClient = this.client.getService<HandlesServiceClient>('HandlesService');
  }

  public resolveHandle(request: ResolveHandleRequest) {
    return this.handlesClient.resolveHandle(request);
  }

  public checkHandleAvailability(request: CheckHandleAvailabilityRequest) {
    return this.handlesClient.checkHandleAvailability(request);
  }

  public getHandleByTarget(request: GetHandleByTargetRequest) {
    return this.handlesClient.getHandleByTarget(request);
  }
}

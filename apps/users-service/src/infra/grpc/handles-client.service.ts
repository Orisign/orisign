import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import type {
  CheckHandleAvailabilityRequest,
  GetHandleByTargetRequest,
  HandlesServiceClient,
  ReleaseHandleRequest,
  ReserveHandleRequest,
  ResolveHandleRequest,
} from '@repo/contracts/gen/ts/handles';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class HandlesClientService implements OnModuleInit {
  private handlesClient!: HandlesServiceClient;

  public constructor(@Inject('HANDLES_PACKAGE') private readonly client: ClientGrpc) {}

  public onModuleInit() {
    this.handlesClient = this.client.getService<HandlesServiceClient>('HandlesService');
  }

  public async reserveHandle(request: ReserveHandleRequest) {
    return await lastValueFrom(this.handlesClient.reserveHandle(request));
  }

  public async releaseHandle(request: ReleaseHandleRequest) {
    return await lastValueFrom(this.handlesClient.releaseHandle(request));
  }

  public async resolveHandle(request: ResolveHandleRequest) {
    return await lastValueFrom(this.handlesClient.resolveHandle(request));
  }

  public async checkHandleAvailability(request: CheckHandleAvailabilityRequest) {
    return await lastValueFrom(this.handlesClient.checkHandleAvailability(request));
  }

  public async getHandleByTarget(request: GetHandleByTargetRequest) {
    return await lastValueFrom(this.handlesClient.getHandleByTarget(request));
  }
}

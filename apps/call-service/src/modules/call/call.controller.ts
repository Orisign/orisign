import { Controller } from '@nestjs/common';
import { CallService } from './call.service';
import { Observable } from 'rxjs';
import { CallMessage } from '@repo/contracts/gen/ts/call';
import { GrpcMethod } from '@nestjs/microservices';

@Controller()
export class CallController {
  constructor(private readonly callService: CallService) {}

  @GrpcMethod('CallService', 'CallStream')
  callStream(request: Observable<CallMessage>): Observable<CallMessage> {
    return this.callService.handleStream(request);
  }
}

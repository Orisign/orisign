import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import type {
  DeleteAvatarRequest,
  GetAvatarUrlRequest,
  MediaServiceClient,
  UploadAvatarRequest,
} from '@repo/contracts/gen/ts/media';

@Injectable()
export class MediaClientGrpc implements OnModuleInit {
  private mediaClient!: MediaServiceClient;

  public constructor(
    @Inject('MEDIA_PACKAGE') private readonly client: ClientGrpc,
  ) {}

  public onModuleInit() {
    this.mediaClient = this.client.getService<MediaServiceClient>('MediaService');
  }

  public uploadAvatar(request: UploadAvatarRequest) {
    return this.mediaClient.uploadAvatar(request);
  }

  public deleteAvatar(request: DeleteAvatarRequest) {
    return this.mediaClient.deleteAvatar(request);
  }

  public getAvatarUrl(request: GetAvatarUrlRequest) {
    return this.mediaClient.getAvatarUrl(request);
  }
}

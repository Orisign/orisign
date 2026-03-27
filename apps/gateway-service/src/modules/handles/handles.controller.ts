import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { HandleKind } from '@repo/contracts/gen/ts/handles';
import { lastValueFrom } from 'rxjs';
import { Protected } from 'src/shared/decorators';
import { HandlesClientGrpc } from './handles.grpc';

@ApiTags('Handles')
@Controller('handles')
export class HandlesController {
  public constructor(private readonly handlesClient: HandlesClientGrpc) {}

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Resolve global username to entity kind and target' })
  @ApiOkResponse({ description: 'Resolved handle' })
  @Protected()
  @Post('resolve')
  @HttpCode(HttpStatus.OK)
  public async resolve(@Body() dto: { username: string }) {
    return await lastValueFrom(
      this.handlesClient.resolveHandle({
        username: dto.username ?? '',
      }),
    );
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Check global username availability' })
  @ApiOkResponse({ description: 'Availability response' })
  @Protected()
  @Post('check')
  @HttpCode(HttpStatus.OK)
  public async check(@Body() dto: { username: string; kind: HandleKind }) {
    return await lastValueFrom(
      this.handlesClient.checkHandleAvailability({
        username: dto.username ?? '',
        kind: dto.kind,
      }),
    );
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get handle by target' })
  @ApiParam({ name: 'kind', enum: HandleKind })
  @ApiParam({ name: 'targetId' })
  @ApiOkResponse({ description: 'Handle by target response' })
  @Protected()
  @Get(':kind/:targetId')
  @HttpCode(HttpStatus.OK)
  public async getByTarget(@Param('kind') kind: string, @Param('targetId') targetId: string) {
    return await lastValueFrom(
      this.handlesClient.getHandleByTarget({
        kind: kind as HandleKind,
        targetId,
      }),
    );
  }
}

import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type {
  AnswerCallbackQueryRequest,
  AuthenticateBotTokenRequest,
  BotChatMutationRequest,
  BotMutationRequest,
  ConsumeExternalEventRequest,
  CreateBotRequest,
  DeleteBotRequest,
  DeleteBotMessageRequest,
  EditBotMessageReplyMarkupRequest,
  EditBotMessageTextRequest,
  GetBotCommandsRequest,
  GetBotByUserIdRequest,
  GetBotMeRequest,
  GetBotRequest,
  ListBotAuditLogsRequest,
  GetUpdatesRequest,
  ListBotChatsRequest,
  ListBotsRequest,
  RevokeBotTokenRequest,
  RotateBotTokenRequest,
  SendBotMessageRequest,
  SetBotCommandsRequest,
  SetBotWebhookRequest,
  UpdateBotRequest,
} from '@repo/contracts/gen/ts/bots';
import { BotsService } from './bots.service';

@Controller()
export class BotsController {
  public constructor(private readonly botsService: BotsService) {}

  @GrpcMethod('BotsService', 'CreateBot')
  public createBot(data: CreateBotRequest) { return this.botsService.createBot(data); }

  @GrpcMethod('BotsService', 'ListBots')
  public listBots(data: ListBotsRequest) { return this.botsService.listBots(data); }

  @GrpcMethod('BotsService', 'GetBot')
  public getBot(data: GetBotRequest) { return this.botsService.getBot(data); }

  @GrpcMethod('BotsService', 'GetBotByUserId')
  public getBotByUserId(data: GetBotByUserIdRequest) { return this.botsService.getBotByUserId(data); }

  @GrpcMethod('BotsService', 'GetBotStats')
  public getBotStats(data: BotMutationRequest) { return this.botsService.getBotStats(data); }

  @GrpcMethod('BotsService', 'ListBotAuditLogs')
  public listBotAuditLogs(data: ListBotAuditLogsRequest) { return this.botsService.listBotAuditLogs(data); }

  @GrpcMethod('BotsService', 'UpdateBot')
  public updateBot(data: UpdateBotRequest) { return this.botsService.updateBot(data); }

  @GrpcMethod('BotsService', 'DeleteBot')
  public deleteBot(data: DeleteBotRequest) { return this.botsService.deleteBot(data); }

  @GrpcMethod('BotsService', 'RegenerateBotToken')
  public regenerateBotToken(data: RotateBotTokenRequest) { return this.botsService.regenerateBotToken(data); }

  @GrpcMethod('BotsService', 'RevokeBotToken')
  public revokeBotToken(data: RevokeBotTokenRequest) { return this.botsService.revokeBotToken(data); }

  @GrpcMethod('BotsService', 'EnableBot')
  public enableBot(data: BotMutationRequest) { return this.botsService.enableBot(data); }

  @GrpcMethod('BotsService', 'DisableBot')
  public disableBot(data: BotMutationRequest) { return this.botsService.disableBot(data); }

  @GrpcMethod('BotsService', 'SetBotWebhook')
  public setBotWebhook(data: SetBotWebhookRequest) { return this.botsService.setBotWebhook(data); }

  @GrpcMethod('BotsService', 'DeleteBotWebhook')
  public deleteBotWebhook(data: BotMutationRequest) { return this.botsService.deleteBotWebhook(data); }

  @GrpcMethod('BotsService', 'GetBotWebhookInfo')
  public getBotWebhookInfo(data: BotMutationRequest) { return this.botsService.getBotWebhookInfo(data); }

  @GrpcMethod('BotsService', 'SetBotCommands')
  public setBotCommands(data: SetBotCommandsRequest) { return this.botsService.setBotCommands(data); }

  @GrpcMethod('BotsService', 'GetBotCommands')
  public getBotCommands(data: GetBotCommandsRequest) { return this.botsService.getBotCommands(data); }

  @GrpcMethod('BotsService', 'ListBotChats')
  public listBotChats(data: ListBotChatsRequest) { return this.botsService.listBotChats(data); }

  @GrpcMethod('BotsService', 'AllowBotChat')
  public allowBotChat(data: BotChatMutationRequest) { return this.botsService.allowBotChat(data); }

  @GrpcMethod('BotsService', 'DenyBotChat')
  public denyBotChat(data: BotChatMutationRequest) { return this.botsService.denyBotChat(data); }

  @GrpcMethod('BotsService', 'AuthenticateBotToken')
  public authenticateBotToken(data: AuthenticateBotTokenRequest) { return this.botsService.authenticateBotToken(data); }

  @GrpcMethod('BotsService', 'GetBotMe')
  public getBotMe(data: GetBotMeRequest) { return this.botsService.getBotMe(data); }

  @GrpcMethod('BotsService', 'SendMessage')
  public sendMessage(data: SendBotMessageRequest) { return this.botsService.sendMessage(data); }

  @GrpcMethod('BotsService', 'EditMessageText')
  public editMessageText(data: EditBotMessageTextRequest) { return this.botsService.editMessageText(data); }

  @GrpcMethod('BotsService', 'EditMessageReplyMarkup')
  public editMessageReplyMarkup(data: EditBotMessageReplyMarkupRequest) { return this.botsService.editMessageReplyMarkup(data); }

  @GrpcMethod('BotsService', 'DeleteMessage')
  public deleteMessage(data: DeleteBotMessageRequest) { return this.botsService.deleteMessage(data); }

  @GrpcMethod('BotsService', 'AnswerCallbackQuery')
  public answerCallbackQuery(data: AnswerCallbackQueryRequest) { return this.botsService.answerCallbackQuery(data); }

  @GrpcMethod('BotsService', 'GetUpdates')
  public getUpdates(data: GetUpdatesRequest) { return this.botsService.getUpdates(data); }

  @GrpcMethod('BotsService', 'ConsumeExternalEvent')
  public consumeExternalEvent(data: ConsumeExternalEventRequest) { return this.botsService.consumeExternalEvent(data); }
}

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import type {
  AnswerCallbackQueryRequest,
  AuthenticateBotTokenRequest,
  BotChatMutationRequest,
  BotMutationRequest,
  BotsServiceClient,
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

@Injectable()
export class BotsClientGrpc implements OnModuleInit {
  private botsClient!: BotsServiceClient;

  public constructor(@Inject('BOTS_PACKAGE') private readonly client: ClientGrpc) {}

  public onModuleInit() {
    this.botsClient = this.client.getService<BotsServiceClient>('BotsService');
  }

  public createBot(request: CreateBotRequest) { return this.botsClient.createBot(request); }
  public listBots(request: ListBotsRequest) { return this.botsClient.listBots(request); }
  public getBot(request: GetBotRequest) { return this.botsClient.getBot(request); }
  public getBotByUserId(request: GetBotByUserIdRequest) { return this.botsClient.getBotByUserId(request); }
  public getBotStats(request: BotMutationRequest) { return this.botsClient.getBotStats(request); }
  public listBotAuditLogs(request: ListBotAuditLogsRequest) { return this.botsClient.listBotAuditLogs(request); }
  public updateBot(request: UpdateBotRequest) { return this.botsClient.updateBot(request); }
  public deleteBot(request: DeleteBotRequest) { return this.botsClient.deleteBot(request); }
  public regenerateBotToken(request: RotateBotTokenRequest) { return this.botsClient.regenerateBotToken(request); }
  public revokeBotToken(request: RevokeBotTokenRequest) { return this.botsClient.revokeBotToken(request); }
  public enableBot(request: BotMutationRequest) { return this.botsClient.enableBot(request); }
  public disableBot(request: BotMutationRequest) { return this.botsClient.disableBot(request); }
  public setBotWebhook(request: SetBotWebhookRequest) { return this.botsClient.setBotWebhook(request); }
  public deleteBotWebhook(request: BotMutationRequest) { return this.botsClient.deleteBotWebhook(request); }
  public getBotWebhookInfo(request: BotMutationRequest) { return this.botsClient.getBotWebhookInfo(request); }
  public setBotCommands(request: SetBotCommandsRequest) { return this.botsClient.setBotCommands(request); }
  public getBotCommands(request: GetBotCommandsRequest) { return this.botsClient.getBotCommands(request); }
  public listBotChats(request: ListBotChatsRequest) { return this.botsClient.listBotChats(request); }
  public allowBotChat(request: BotChatMutationRequest) { return this.botsClient.allowBotChat(request); }
  public denyBotChat(request: BotChatMutationRequest) { return this.botsClient.denyBotChat(request); }
  public authenticateBotToken(request: AuthenticateBotTokenRequest) { return this.botsClient.authenticateBotToken(request); }
  public getBotMe(request: GetBotMeRequest) { return this.botsClient.getBotMe(request); }
  public sendMessage(request: SendBotMessageRequest) { return this.botsClient.sendMessage(request); }
  public editMessageText(request: EditBotMessageTextRequest) { return this.botsClient.editMessageText(request); }
  public editMessageReplyMarkup(request: EditBotMessageReplyMarkupRequest) { return this.botsClient.editMessageReplyMarkup(request); }
  public deleteMessage(request: DeleteBotMessageRequest) { return this.botsClient.deleteMessage(request); }
  public answerCallbackQuery(request: AnswerCallbackQueryRequest) { return this.botsClient.answerCallbackQuery(request); }
  public getUpdates(request: GetUpdatesRequest) { return this.botsClient.getUpdates(request); }
  public consumeExternalEvent(request: ConsumeExternalEventRequest) { return this.botsClient.consumeExternalEvent(request); }
}

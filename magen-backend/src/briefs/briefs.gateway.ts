import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import { Server, Socket } from 'socket.io'
import { MemeBrief } from '@prisma/client'

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class BriefsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server: Server

  private readonly logger = new Logger(BriefsGateway.name)

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`)
  }

  // Called by DebateService after a brief is saved
  emitBrief(brief: MemeBrief): void {
    this.server.emit('brief:new', brief)
    this.logger.log(`Emitted brief:new for ${brief.tokenAddress}`)
  }

  // Emitted when the pipeline encounters a non-crashing error
  // Joshua's dashboard can surface this to show pipeline health
  emitPipelineError(detail: { tokenAddress: string; reason: string }): void {
    this.server.emit('pipeline:error', detail)
    this.logger.warn(`Emitted pipeline:error — ${detail.reason} for ${detail.tokenAddress}`)
  }
}
import { Logger } from '@nestjs/common';
import {
  type OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

/**
 * Realtime gateway base (AR3). Channels are scoped by **property + role** and
 * events are **server-authoritative and persisted** — clients reconcile on
 * reconnect (architecture.md#API-&-Communication-Patterns). Feature epics will
 * join rooms like `property:<id>:housekeeping` and emit persisted events.
 *
 * Auth seam: connections without a token are rejected now; real JWT
 * verification + permission-scoped room joins land in Epic 2 (AR6).
 */
@WebSocketGateway({ cors: { origin: true } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket): void {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`Rejected tokenless socket connection ${client.id}`);
      client.disconnect(true);
      return;
    }
    // TODO(Epic 2 / AR6): verify the JWT, attach the user + permissions, and
    // join property/role-scoped rooms. For now only token presence is enforced.
    this.logger.log(`Socket connected: ${client.id}`);
  }

  private extractToken(client: Socket): string | undefined {
    const authToken: unknown = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) return authToken;

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }
    return undefined;
  }
}

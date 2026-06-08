import { describe, it, expect, vi } from 'vitest';
import { RealtimeGateway } from './realtime.gateway';
import type { Socket } from 'socket.io';

function mockSocket(opts: { token?: string; header?: string } = {}) {
  const disconnect = vi.fn();
  const socket = {
    id: 'socket-1',
    handshake: {
      auth: opts.token ? { token: opts.token } : {},
      headers: opts.header ? { authorization: opts.header } : {},
    },
    disconnect,
  } as unknown as Socket;
  return { socket, disconnect };
}

describe('RealtimeGateway', () => {
  it('disconnects a connection that presents no token', () => {
    const gateway = new RealtimeGateway();
    const { socket, disconnect } = mockSocket();
    gateway.handleConnection(socket);
    expect(disconnect).toHaveBeenCalledWith(true);
  });

  it('accepts a connection with a handshake auth token', () => {
    const gateway = new RealtimeGateway();
    const { socket, disconnect } = mockSocket({ token: 'jwt-abc' });
    gateway.handleConnection(socket);
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('accepts a Bearer Authorization header', () => {
    const gateway = new RealtimeGateway();
    const { socket, disconnect } = mockSocket({ header: 'Bearer jwt-xyz' });
    gateway.handleConnection(socket);
    expect(disconnect).not.toHaveBeenCalled();
  });
});

'use client';

import { io, type Socket } from 'socket.io-client';
import { getApiBaseUrl } from '@/lib/runtime-config';

let socketClient: Socket | null = null;
let activeToken: string | null = null;

const resolveSocketUrl = () => getApiBaseUrl();

const ensureSocketClient = () => {
  if (!socketClient) {
    socketClient = io(resolveSocketUrl(), {
      autoConnect: false,
      timeout: 5000,
      transports: ['polling', 'websocket'],
      upgrade: true
    });
  }

  return socketClient;
};

export const connectAuthenticatedSocket = (token: string) => {
  const socket = ensureSocketClient();

  if (activeToken !== token) {
    activeToken = token;
    socket.auth = { token };

    if (socket.connected) {
      socket.disconnect();
    }
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
};

export const getSocketClient = () => socketClient;

export const disconnectSocketClient = () => {
  if (!socketClient) {
    return;
  }

  socketClient.disconnect();
};

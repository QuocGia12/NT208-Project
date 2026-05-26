import type { FriendUser } from '@/lib/types/friend';

export type ChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  isOwnMessage: boolean;
};

export type ChatConversation = {
  friend: FriendUser;
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    isOwnMessage: boolean;
  } | null;
};

export type FetchConversationsResponse = {
  conversations: ChatConversation[];
};

export type FetchMessagesResponse = {
  messages: ChatMessage[];
  nextCursor: string | null;
};

export type SendMessageResponse = {
  message: ChatMessage;
};

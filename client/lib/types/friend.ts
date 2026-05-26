export type FriendRelationshipStatus =
  | 'NONE'
  | 'PENDING_INCOMING'
  | 'PENDING_OUTGOING'
  | 'FRIENDS';

export type FriendUser = {
  id: string;
  username: string;
  avatar: string | null;
  elo: number;
  coins: number;
  gems: number;
};

export type SearchUserResult = FriendUser & {
  relationshipStatus: FriendRelationshipStatus;
};

export type SearchUsersResponse = {
  results: SearchUserResult[];
};

export type SendFriendRequestPayload = {
  targetUserId?: string;
  targetUsername?: string;
};

export type SendFriendRequestResponse = {
  request: {
    id: string;
    status: 'PENDING';
    createdAt: string;
    toUser: FriendUser;
  };
};

export type PendingFriendRequest = {
  id: string;
  createdAt: string;
  fromUser: FriendUser;
};

export type PendingRequestsResponse = {
  requests: PendingFriendRequest[];
};

export type FriendListResponse = {
  friends: FriendUser[];
};

export type RespondFriendRequestAction = 'accept' | 'decline';

export type RespondFriendRequestResponse = {
  message: string;
  friend?: FriendUser;
  requestId?: string;
};

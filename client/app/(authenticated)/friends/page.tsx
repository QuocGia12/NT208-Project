'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchFriendList,
  fetchPendingRequests,
  respondToFriendRequest,
  searchUsers,
  sendFriendRequest
} from '@/lib/api/friends';
import { getRankLabel } from '@/lib/rank-system';
import type {
  FriendRelationshipStatus,
  FriendUser,
  PendingFriendRequest,
  SearchUserResult
} from '@/lib/types/friend';
import { useAuthStore } from '@/store/auth-store';

type FriendsTab = 'search' | 'pending' | 'friends';

const getMockOnlineStatus = (userId: string) => {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return hash % 3 !== 0;
};

const getRelationshipLabel = (status: FriendRelationshipStatus) => {
  if (status === 'PENDING_OUTGOING') return 'Request Sent';
  if (status === 'PENDING_INCOMING') return 'Incoming Request';
  if (status === 'FRIENDS') return 'Already Friends';
  return 'Send Request';
};

const UserAvatar = ({ user }: { user: FriendUser }) => (
  <div
    className="friends-avatar h-11 w-11 rounded-xl bg-slate-900/80 bg-cover bg-center"
    style={user.avatar ? { backgroundImage: `url(${user.avatar})` } : undefined}
  >
    {!user.avatar ? (
      <span className="moba-heading text-sm text-cyan-100">
        {user.username.charAt(0).toUpperCase()}
      </span>
    ) : null}
  </div>
);

/*
  panel-friends.png is 4009x1944.
  Tab shelf positions from Figma (x, y, w, h):
    BẠN BÈ   (friends): 394, 349, 111, 40 -> left=9.83% top=17.95% w=2.77% h=2.06%
    YÊU CẦU  (pending): 382, 470, 132, 40 -> left=9.53% top=24.17% w=3.29% h=2.06%
    TÌM KIẾM (search):  371, 591, 157, 40 -> left=9.25% top=30.40% w=3.92% h=2.06%
*/
export default function FriendsPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  const [activeTab, setActiveTab] = useState<FriendsTab>('friends');

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingUserId, setSendingUserId] = useState<string | null>(null);

  const [pendingRequests, setPendingRequests] = useState<PendingFriendRequest[]>([]);
  const [isPendingLoading, setIsPendingLoading] = useState(true);
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);

  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [isFriendsLoading, setIsFriendsLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearNotices = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const loadPendingRequests = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetchPendingRequests(token);
      setPendingRequests(response.requests);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load pending friend requests.'
      );
    } finally {
      setIsPendingLoading(false);
    }
  }, [token]);

  const loadFriendList = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetchFriendList(token);
      setFriends(response.friends);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load friend list.'
      );
    } finally {
      setIsFriendsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setIsPendingLoading(true);
    setIsFriendsLoading(true);
    loadPendingRequests();
    loadFriendList();
  }, [token, loadPendingRequests, loadFriendList]);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearNotices();
    if (!token) { setErrorMessage('Please login first.'); return; }
    const query = searchTerm.trim();
    if (query.length < 2) {
      setErrorMessage('Enter at least 2 characters to search.');
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const response = await searchUsers(token, query);
      setSearchResults(response.results);
      setSuccessMessage(`Found ${response.results.length} player(s).`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to search players.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (targetUserId: string) => {
    if (!token) return;
    clearNotices();
    setSendingUserId(targetUserId);
    try {
      await sendFriendRequest(token, { targetUserId });
      setSearchResults((prev) =>
        prev.map((item) =>
          item.id === targetUserId ? { ...item, relationshipStatus: 'PENDING_OUTGOING' } : item
        )
      );
      setSuccessMessage('Friend request sent.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to send friend request.');
    } finally {
      setSendingUserId(null);
    }
  };

  const handleRespondRequest = async (requestId: string, action: 'accept' | 'decline') => {
    if (!token) return;
    clearNotices();
    setRespondingRequestId(requestId);
    try {
      const response = await respondToFriendRequest(token, requestId, action);
      setSuccessMessage(response.message);
      await loadPendingRequests();
      if (action === 'accept') await loadFriendList();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to update friend request.'
      );
    } finally {
      setRespondingRequestId(null);
    }
  };

  const friendsWithStatus = useMemo(
    () => friends.map((friend) => ({ ...friend, isOnline: getMockOnlineStatus(friend.id) })),
    [friends]
  );

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div className="panel-container panel-container-friends">
        <img
          src="/images/ui-game/panel-friends.png"
          className="panel-bg"
          alt=""
        />

        <div className="panel-tabs" role="tablist" aria-label="Friends tabs">
          <button
            onClick={() => setActiveTab('friends')}
            type="button"
            className={`panel-tab ${activeTab === 'friends' ? 'panel-tab-active' : ''}`}
            aria-label="Tab Ban Be"
            aria-selected={activeTab === 'friends'}
            role="tab"
          >
            <span className="tab-label">BẠN BÈ</span>
            <span className="panel-tab-arrow tab-arrow">&gt;</span>
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            type="button"
            className={`panel-tab ${activeTab === 'pending' ? 'panel-tab-active' : ''}`}
            aria-label="Tab Yeu Cau"
            aria-selected={activeTab === 'pending'}
            role="tab"
          >
            <span className="tab-label">YÊU CẦU</span>
            <span className="panel-tab-arrow tab-arrow">&gt;</span>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            type="button"
            className={`panel-tab ${activeTab === 'search' ? 'panel-tab-active' : ''}`}
            aria-label="Tab Tim Kiem"
            aria-selected={activeTab === 'search'}
            role="tab"
          >
            <span className="tab-label">TÌM KIẾM</span>
            <span className="panel-tab-arrow tab-arrow">&gt;</span>
          </button>
        </div>

        <div className="panel-content space-y-4">
          {errorMessage ? (
            <div className="friends-alert friends-alert-error animate-fade-in">{errorMessage}</div>
          ) : null}
          {successMessage ? (
            <div className="friends-alert friends-alert-success animate-fade-in">{successMessage}</div>
          ) : null}

          {/* BẠN BÈ tab */}
          {activeTab === 'friends' && (
            <section className="friends-panel animate-fade-in-up">
              <header className="friends-header-panel mb-4">
                <p className="moba-heading text-xs uppercase tracking-[0.26em] text-cyan-300/90">
                  Social System
                </p>
                <h1 className="moba-heading mt-1 text-2xl uppercase tracking-[0.12em] text-amber-100">
                  Bạn Bè
                </h1>
              </header>
              {isFriendsLoading ? (
                <div className="empty-state">
                  <p className="text-sm text-slate-300/90">Loading your squad...</p>
                </div>
              ) : friendsWithStatus.length === 0 ? (
                <div className="empty-state">
                  <p className="text-sm text-slate-300/90">
                    You have no friends yet. Search players and send invitations.
                  </p>
                </div>
              ) : (
                <div className="friends-list">
                  {friendsWithStatus.map((friend) => (
                    <article className="friends-list-item" key={friend.id}>
                      <div className="flex items-center gap-3">
                        <UserAvatar user={friend} />
                        <div>
                          <p className="text-sm font-bold uppercase tracking-[0.08em] text-amber-100">
                            {friend.username}
                          </p>
                          <p className="flex items-center gap-1.5 text-xs text-slate-400">
                            <span
                              className={`friends-status-dot ${
                                friend.isOnline ? 'friends-status-online' : 'friends-status-offline'
                              }`}
                            />
                            {friend.isOnline ? 'Online' : 'Offline'}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* YÊU CẦU tab */}
          {activeTab === 'pending' && (
            <section className="friends-panel animate-fade-in-up">
              <header className="friends-header-panel mb-4">
                <p className="moba-heading text-xs uppercase tracking-[0.26em] text-cyan-300/90">
                  Social System
                </p>
                <h1 className="moba-heading mt-1 text-2xl uppercase tracking-[0.12em] text-amber-100">
                  Yêu Cầu Kết Bạn
                </h1>
              </header>
              {isPendingLoading ? (
                <div className="empty-state">
                  <p className="text-sm text-slate-300/90">Loading pending requests...</p>
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="empty-state">
                  <p className="text-sm text-slate-300/90">No incoming friend requests right now.</p>
                </div>
              ) : (
                <div className="friends-list">
                  {pendingRequests.map((request) => {
                    const isBusy = respondingRequestId === request.id;
                    return (
                      <article className="friends-list-item" key={request.id}>
                        <div className="flex items-center gap-3">
                          <UserAvatar user={request.fromUser} />
                          <div>
                            <p className="text-sm font-bold uppercase tracking-[0.08em] text-amber-100">
                              {request.fromUser.username}
                            </p>
                            <p className="text-xs text-slate-400">
                              Sent {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="friends-action-button friends-action-button-primary"
                            disabled={isBusy}
                            onClick={() => handleRespondRequest(request.id, 'accept')}
                            type="button"
                          >
                            {isBusy ? '...' : 'Accept'}
                          </button>
                          <button
                            className="friends-action-button friends-action-button-danger"
                            disabled={isBusy}
                            onClick={() => handleRespondRequest(request.id, 'decline')}
                            type="button"
                          >
                            {isBusy ? '...' : 'Decline'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* TÌM KIẾM tab */}
          {activeTab === 'search' && (
            <section className="friends-panel animate-fade-in-up">
              <header className="friends-header-panel mb-4">
                <p className="moba-heading text-xs uppercase tracking-[0.26em] text-cyan-300/90">
                  Social System
                </p>
                <h1 className="moba-heading mt-1 text-2xl uppercase tracking-[0.12em] text-amber-100">
                  Tìm Kiếm
                </h1>
              </header>
              <form className="friends-search-form" onSubmit={handleSearch}>
                <input
                  className="moba-input"
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Enter username..."
                  value={searchTerm}
                />
                <button className="moba-button" disabled={isSearching} type="submit">
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </form>
              <div className="friends-list mt-4">
                {searchResults.length === 0 ? (
                  <div className="empty-state">
                    <p className="text-sm text-slate-300/90">
                      Search for a player to send a friend request.
                    </p>
                  </div>
                ) : (
                  searchResults.map((user) => {
                    const isActionable = user.relationshipStatus === 'NONE';
                    const isBusy = sendingUserId === user.id;
                    return (
                      <article className="friends-list-item" key={user.id}>
                        <div className="flex items-center gap-3">
                          <UserAvatar user={user} />
                          <div>
                            <p className="text-sm font-bold uppercase tracking-[0.08em] text-amber-100">
                              {user.username}
                            </p>
                            <p className="text-xs text-slate-400">
                              Rank {getRankLabel(user.elo)} | ELO {user.elo}
                            </p>
                          </div>
                        </div>
                        <button
                          className={`friends-action-button ${
                            isActionable ? 'friends-action-button-primary' : 'friends-action-button-muted'
                          }`}
                          disabled={!isActionable || isBusy}
                          onClick={() => handleSendRequest(user.id)}
                          type="button"
                        >
                          {isBusy ? 'Sending...' : getRelationshipLabel(user.relationshipStatus)}
                        </button>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      <button
        className="panel-back-button"
        onClick={() => router.push('/lobby')}
        type="button"
      >
        <img src="/images/ui-game/btn-back.png" className="w-full" alt="Trở về" />
      </button>
    </div>
  );
}

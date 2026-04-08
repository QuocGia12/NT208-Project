import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket/socketClient";
import GameCanvas from "../components/GameCanvas";

export default function GamePage() {
  const navigate = useNavigate();
  const myUserId = localStorage.getItem("userId");
  const roomCode = localStorage.getItem("roomCode");

  const initialState = useMemo(() => {
    try {
      const saved = localStorage.getItem("gameState");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  const initialMe = initialState?.players.find((p) => p.userId === myUserId);

  const [gameState, setGameState] = useState(initialState);
  const [myTurn, setMyTurn] = useState(initialMe?.isMyTurn ?? false);
  const [phase, setPhase] = useState(initialState?.phase ?? "");
  const [log, setLog] = useState(initialState ? ["Ván game bắt đầu!"] : []);
  const [stackAlert, setStackAlert] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [waitingForTurn, setWaitingForTurn] = useState(
    !(initialMe?.isMyTurn === true),
  ); // true nếu không phải lượt mình
  const sceneRef = useRef(null);
  const countdownRef = useRef(null);
  const [discardModal, setDiscardModal] = useState(null);

  function addLog(msg) {
    setLog((prev) =>
      [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20),
    );
  }

  function startCountdown(seconds) {
    setCountdown(seconds);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function stopCountdown() {
    clearInterval(countdownRef.current);
    setCountdown(0);
  }

  function handleRollDice() {
    if (!socket.connected) {
      addLog("❌ Chưa kết nối với server");
      return;
    }
    socket.emit("game:rollDice", { roomCode, userId: myUserId });
  }

  function handleCellClick(cellId) {
    if (!socket.connected) {
      addLog("❌ Chưa kết nối với server");
      return;
    }
    socket.emit("game:movePlayer", {
      roomCode,
      userId: myUserId,
      targetCellId: cellId,
    });
  }

  function handleEndTurn() {
    if (!socket.connected) {
      addLog("❌ Chưa kết nối với server");
      return;
    }
    socket.emit("game:turnEnd", { roomCode, userId: myUserId });
    setMyTurn(false);
    setWaitingForTurn(true);
  }

  function handleUseCard(cardCode, targetUserId = null) {
    if (!socket.connected) {
      addLog("❌ Chưa kết nối với server");
      return;
    }
    socket.emit("game:playCard", {
      roomCode,
      userId: myUserId,
      cardId: cardCode,
      targetUserId,
    });
  }

  function handleInterruptCard(cardCode, targetUserId = null) {
    if (!socket.connected) {
      addLog("❌ Chưa kết nối với server");
      return;
    }
    socket.emit("game:stackInterrupt", {
      roomCode,
      userId: myUserId,
      cardId: cardCode,
      targetUserId,
    });
  }

  function handleUseSkill(targetUserId = null) {
    if (!socket.connected) {
      addLog("❌ Chưa kết nối với server");
      return;
    }
    socket.emit("game:useSkill", {
      roomCode,
      userId: myUserId,
      targetUserId,
    });
  }

  useEffect(() => {
    console.log("GamePage: mounting, initialState:", initialState);
    console.log("GamePage: socket.connected =", socket.connected);

    socket.on("game:mustDiscard", ({ handCards, excess, newCard, targetUserId }) => {
      // Chỉ hiển thị modal nếu event này là cho người chơi hiện tại
      if (targetUserId === myUserId) {
        setDiscardModal({ handCards, excess, newCard });
        addLog(`⚠️ Tay bài vượt quá 6 lá, cần bỏ ${excess} lá`);
      } else {
        // Nếu không phải lượt mình, chỉ log thông tin
        addLog(`⏳ ${targetUserId} đang bỏ bài...`);
      }
    });

    // Socket nên đã kết nối từ LobbyPage, nhưng connect lại nếu cần
    if (!socket.connected) {
      console.log("GamePage: socket not connected, connecting...");
      socket.connect();
    }

    socket.on("connect", () => {
      console.log("GamePage: Socket connected!");
      addLog("✅ Kết nối server thành công");

      // Request state từ server nếu chưa có
      if (!gameState && roomCode) {
        console.log(
          "GamePage: No gameState, requesting from server for room:",
          roomCode,
        );
        socket.emit("game:requestState", { roomCode });
      }
    });

    socket.on("disconnect", () => {
      console.log("GamePage: Socket disconnected");
      addLog("❌ Mất kết nối server");
    });

    socket.on("game:started", ({ state, message }) => {
      console.log("GamePage: nhận game:started event, state:", state);
      if (state) {
        setGameState(state);
        localStorage.setItem("gameState", JSON.stringify(state));
        setPhase(state.phase);
        const isMe = state.players?.some(
          (p) => p.userId === myUserId && p.isMyTurn,
        );
        setMyTurn(isMe);
        setWaitingForTurn(!isMe); // Nếu là lượt mình → không chờ
        addLog(message || "🎮 Trạng thái game");
        // Cập nhật bàn cờ Phaser để hiển thị tokens
        if (sceneRef.current?.updateBoard) {
          sceneRef.current.updateBoard(state);
        }
      }
    });

    socket.on("game:turnSkipped", ({ userId, reason }) => {
      addLog(
        `⏭️ ${userId === myUserId ? "Bạn" : userId} bị bỏ lượt: ${reason ?? "skip_turn"}`,
      );
      setWaitingForTurn(false);
    });

    socket.on("game:diceRolled", ({ userId, result, paths, phase, state }) => {
      console.log("game:diceRolled:", {
        userId,
        result,
        pathsCount: paths?.length,
        phaseFromEvent: phase,
        phaseFromState: state?.phase
      });
      console.log("sceneRef.current:", sceneRef.current ? "có" : "null"); // kiểm tra
      
      // Merge state và đảm bảo phase đúng
      const updatedState = { ...state, phase: phase || state?.phase };
      setGameState(updatedState);
      sessionStorage.setItem("gameState", JSON.stringify(updatedState));
      setPhase(phase || state?.phase);
      addLog(`🎲 ${userId === myUserId ? "Bạn" : userId} đổ được ${result}`);
      
      // Cập nhật bàn cờ trước highlight
      if (sceneRef.current?.updateBoard) {
        sceneRef.current.updateBoard(updatedState);
      }
      
      if (userId === myUserId) {
        if (sceneRef.current) {
          console.log("Gọi highlightPaths với", paths?.length, "paths");
          sceneRef.current.highlightPaths(paths);
        } else {
          console.error("sceneRef.current null — highlight thất bại");
        }
      }
    });

    // Tạo helper function dùng chung
    function applyStateUpdate(state) {
      setGameState(state);
      sessionStorage.setItem("gameState", JSON.stringify(state));
      // Cập nhật bàn cờ Phaser
      if (sceneRef.current?.updateBoard) {
        sceneRef.current.updateBoard(state);
      }
    }

    // Dùng trong tất cả các socket handlers
    socket.on("game:stateUpdate", ({ state }) => {
      applyStateUpdate(state);
      const me = state.players.find((p) => p.userId === myUserId);
      setMyTurn(me?.isMyTurn ?? false);
      setPhase(state.phase);
    });

    socket.on("game:turnStarted", ({ currentPlayer, drawnCard, state }) => {
      applyStateUpdate(state);
      const isMe = currentPlayer === myUserId;
      setMyTurn(isMe);
      setPhase(state.phase);
      setWaitingForTurn(false);
      if (isMe) addLog("👉 Đến lượt bạn!");
      else
        addLog(
          `⏳ Lượt của ${state.players.find((p) => p.userId === currentPlayer)?.username ?? currentPlayer}`,
        );
      if (drawnCard) addLog(`🃏 Rút bài: ${drawnCard.name}`);
    });

    socket.on("game:playerMoved", async ({ userId, path, state, combatResults }) => {
      if (sceneRef.current) {
        await sceneRef.current.animateMove(userId, path);
      }
      applyStateUpdate(state); // ← update board với state final (food đã thay đổi)
      setPhase(state.phase);
      
      // Log combat results nếu có
      if (combatResults && combatResults.length > 0) {
        combatResults.forEach((r) => {
          if (r.type === "pickup") addLog("🛒 Nhặt được lương thực!");
          if (r.type === "steal" && r.success) addLog("⚔️ Cướp lương thực!");
          if (r.type === "push") addLog("💥 Húc văng đối thủ!");
          if (r.type === "domino") addLog("🎯 Hiệu ứng Domino!");
        });
      }
      
      addLog(
        `🚶 ${userId === myUserId ? "Bạn" : userId} di chuyển đến ô ${path[path.length - 1]}`,
      );
    });

    socket.on("game:combatResolved", ({ results, state }) => {
      if (state) applyStateUpdate(state); // ← update food count sau combat
      results.flat().forEach((r) => {
        if (r.type === "pickup") addLog("🛒 Nhặt được lương thực!");
        if (r.type === "steal" && r.success) addLog("⚔️ Cướp lương thực!");
        if (r.type === "push") addLog("💥 Húc văng đối thủ!");
        if (r.type === "domino") addLog("🎯 Hiệu ứng Domino!");
      });
    });

    socket.on("stack:windowOpen", ({ message, windowMs }) => {
      setStackAlert(message);
      startCountdown(windowMs / 1000);
      addLog(`⚡ Stack mở: ${message}`);
    });

    socket.on("stack:interrupted", ({ interruptor, cardName }) => {
      addLog(`🛡️ ${interruptor} phản đòn bằng ${cardName}!`);
    });

    socket.on("stack:resolved", ({ message }) => {
      setStackAlert(null);
      stopCountdown();
      addLog(`✅ ${message}`);
    });

    socket.on("game:skillResolved", ({ result }) => {
      if (result?.message) addLog(`✨ ${result.message}`);
    });

    socket.on("game:monsterEvent", ({ targetShopId, message, state }) => {
      addLog(`👹 ${message}`);
      // Update board để hiển thị shop bị hủy
      if (state && sceneRef.current?.updateBoard) {
        sceneRef.current.updateBoard(state);
      }
    });

    socket.on("game:chooseStation", ({ stations }) => {
      addLog(`🚉 Chọn Trạm Ngựa (${stations.length} khả dụng)`);
    });

    socket.on("game:chooseShop", ({ shops }) => {
      addLog(`🏪 Chọn Shop để đến (${shops.length} có đồ)`);
    });

    socket.on("game:chooseDice", () => {
      addLog("🎲 Chọn số xúc xắc từ 1–6");
    });

    socket.on("game:over", ({ rankings, endReason }) => {
      localStorage.removeItem("gameState");
      navigate("/result", { state: { rankings, endReason } });
    });

    socket.on("error", ({ message }) => {
      console.error("GamePage: Socket error:", message);

      // Nếu game không tồn tại, cần redirect về lobby để start game lại
      if (message.includes("không tồn tại")) {
        addLog(`❌ Game không tồn tại, sẽ redirect về lobby...`);
        localStorage.removeItem("gameState");
        setTimeout(() => {
          navigate("/lobby");
        }, 2000);
      } else {
        addLog(`❌ Lỗi: ${message}`);
      }
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("game:started");
      socket.off("game:stateUpdate");
      socket.off("game:turnStarted");
      socket.off("game:turnSkipped");
      socket.off("game:diceRolled");
      socket.off("game:playerMoved");
      socket.off("game:combatResolved");
      socket.off("stack:windowOpen");
      socket.off("stack:interrupted");
      socket.off("stack:resolved");
      socket.off("game:skillResolved");
      socket.off("game:monsterEvent");
      socket.off("game:chooseStation");
      socket.off("game:chooseShop");
      socket.off("game:chooseDice");
      socket.off("game:over");
      socket.off("error");
    };
  }, []); // Chỉ chạy 1 lần khi mount

  const myPlayer = gameState?.players.find((p) => p.userId === myUserId);
  const canAct = myTurn && !waitingForTurn;

  // Debug logs
  if (gameState) {
    console.log("GamePage render:", {
      phase,
      myTurn,
      waitingForTurn,
      canAct,
      myPlayer: myPlayer
        ? {
            username: myPlayer.username,
            isMyTurn: myPlayer.isMyTurn,
            position: myPlayer.position,
          }
        : null,
      players: gameState.players?.map((p) => ({
        userId: p.userId,
        isMyTurn: p.isMyTurn,
      })),
    });
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        padding: 16,
        background: "#0f0f1a",
        minHeight: "100vh",
        color: "#fff",
        boxSizing: "border-box",
      }}
    >
      {/* Bàn cờ Phaser */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <GameCanvas
          gameState={gameState}
          myUserId={myUserId}
          onCellClick={handleCellClick}
          sceneRef={sceneRef}
        />
      </div>

      {/* Panel bên phải */}
      <div
        style={{
          width: 280,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flexShrink: 0,
        }}
      >
        {/* Danh sách người chơi */}
        <div style={panelStyle}>
          <div style={panelTitleStyle}>Người chơi</div>
          {gameState?.players.map((p, i) => (
            <div
              key={p.userId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 0",
                borderBottom: "1px solid #2a2a4a",
                color: p.isMyTurn
                  ? "#FFD700"
                  : p.userId === myUserId
                    ? "#9FE1CB"
                    : "#aaa",
                fontWeight: p.isMyTurn ? 600 : 400,
              }}
            >
              <span style={{ fontSize: 13 }}>
                {p.isMyTurn ? "▶ " : `${i + 1}. `}
                {p.username}
                {p.userId === myUserId && (
                  <span
                    style={{ color: "#534AB7", fontSize: 11, marginLeft: 4 }}
                  >
                    (bạn)
                  </span>
                )}
                {p.isSleeping && (
                  <span style={{ color: "#888", fontSize: 10, marginLeft: 4 }}>
                    💤
                  </span>
                )}
                {p.isSkipTurn && (
                  <span
                    style={{ color: "#E24B4A", fontSize: 10, marginLeft: 4 }}
                  >
                    🔒
                  </span>
                )}
              </span>
              <span style={{ fontSize: 13 }}>{p.foodCount} 🌾</span>
            </div>
          ))}
        </div>

        {/* Stack alert */}
        {stackAlert && (
          <div
            style={{
              background: "#2d0f0f",
              border: "1px solid #D85A30",
              borderRadius: 8,
              padding: 12,
            }}
          >
            <div
              style={{
                color: "#F0997B",
                fontWeight: 600,
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              ⚡ Stack window: {countdown}s
            </div>
            <div style={{ fontSize: 12, color: "#F5C4B3" }}>{stackAlert}</div>
            {!myTurn && (
              <button
                onClick={() => {
                  const card = myPlayer?.handCards.find(
                    (c) => c.timing === "+",
                  );
                  if (card) handleUseCard(card.card_code);
                  else addLog("Không có thẻ (+) để phản đòn");
                }}
                style={{
                  ...btnStyle("#993C1D"),
                  marginTop: 8,
                  fontSize: 12,
                  padding: "6px 12px",
                }}
              >
                Phản đòn
              </button>
            )}
          </div>
        )}

        {/* Tay bài */}
        <div style={panelStyle}>
          <div style={panelTitleStyle}>
            Tay bài ({myPlayer?.handCards.length ?? 0}/6)
          </div>
          {(!myPlayer?.handCards || myPlayer.handCards.length === 0) && (
            <div
              style={{
                color: "#555",
                fontSize: 12,
                textAlign: "center",
                padding: 8,
              }}
            >
              Chưa có bài
            </div>
          )}
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {myPlayer?.handCards.map((card) => (
              <div
                key={card.card_code}
                onClick={() => {
                  if (card.timing === "+") {
                    // (+) cards can always be used as interrupts
                    handleInterruptCard(card.card_code);
                  } else if (card.timing === "-" && canAct) {
                    // (-) cards can only be used during your turn
                    handleUseCard(card.card_code);
                  }
                }}
                style={{
                  background: card.timing === "+" ? "#0a2e20" : "#1a1040",
                  border: `1px solid ${card.timing === "+" ? "#1D9E75" : "#534AB7"}`,
                  borderRadius: 6,
                  padding: "8px 10px",
                  marginBottom: 6,
                  fontSize: 12,
                  cursor:
                    card.timing === "+" || (canAct && card.timing === "-")
                      ? "pointer"
                      : "default",
                  opacity:
                    card.timing === "+" || (canAct && card.timing === "-")
                      ? 1
                      : 0.6,
                  transition: "opacity 0.2s, transform 0.1s",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    color: card.timing === "+" ? "#5DCAA5" : "#AFA9EC",
                    marginBottom: 2,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{card.name}</span>
                  <span style={{ fontSize: 10, color: "#888" }}>
                    {card.timing === "+" ? "(+)" : "(-)"}
                  </span>
                </div>
                <div style={{ color: "#666", fontSize: 11 }}>
                  {card.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nút hành động */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {canAct && (phase === "draw" || phase === "action") && (
            <button onClick={handleRollDice} style={btnStyle("#378ADD")}>
              🎲 Đổ xúc xắc
            </button>
          )}
          {canAct && phase === "interact" && (
            <button onClick={handleEndTurn} style={btnStyle("#1D9E75")}>
              ✅ Kết thúc lượt
            </button>
          )}
          {canAct && (
            <button
              onClick={() => handleUseSkill()}
              style={btnStyle("#854F0B")}
            >
              ✨ Dùng kỹ năng
            </button>
          )}
          {!canAct && !stackAlert && (
            <div
              style={{
                textAlign: "center",
                color: "#444",
                fontSize: 12,
                padding: "8px 0",
              }}
            >
              {waitingForTurn
                ? "⏳ Đang chờ server..."
                : "⏳ Chờ lượt người khác..."}
            </div>
          )}
        </div>

        {/* Log */}
        <div
          style={{
            ...panelStyle,
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={panelTitleStyle}>Log</div>
          <div style={{ overflowY: "auto", flex: 1, maxHeight: 200 }}>
            {log.length === 0 && (
              <div style={{ color: "#444", fontSize: 11 }}>Chưa có sự kiện</div>
            )}
            {log.map((entry, i) => (
              <div
                key={i}
                style={{
                  fontSize: 11,
                  color: entry.includes("❌")
                    ? "#F0997B"
                    : entry.includes("👹")
                      ? "#E24B4A"
                      : entry.includes("⚡")
                        ? "#EF9F27"
                        : entry.includes("✅")
                          ? "#5DCAA5"
                          : entry.includes("👉")
                            ? "#FFD700"
                            : "#777",
                  marginBottom: 4,
                  lineHeight: 1.5,
                  wordBreak: "break-word",
                }}
              >
                {entry}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Modal bỏ bài */}
      {discardModal && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#1e1e3a",
              borderRadius: 16,
              padding: 24,
              width: 400,
              border: "1px solid #534AB7",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              ⚠️ Tay bài quá 6 lá
            </div>
            <div style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
              Chọn {discardModal?.excess ?? 0} lá để bỏ trước khi xem lá mới
            </div>

            <DiscardSelector
              cards={discardModal?.handCards ?? []}
              excess={discardModal?.excess ?? 0}
              newCard={discardModal?.newCard}
              onConfirm={(selectedIds) => {
                socket.emit("game:discardCards", {
                  roomCode,
                  userId: myUserId,
                  cardIds: selectedIds,
                });
                setDiscardModal(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const panelStyle = {
  background: "#1e1e3a",
  borderRadius: 8,
  padding: 12,
};

const panelTitleStyle = {
  fontWeight: 600,
  fontSize: 11,
  marginBottom: 10,
  color: "#666",
  textTransform: "uppercase",
  letterSpacing: 1,
};

const btnStyle = (bg) => ({
  background: bg,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  width: "100%",
  transition: "opacity 0.2s",
});

function DiscardSelector({ cards, excess, newCard, onConfirm }) {
  const [selected, setSelected] = useState([]);

  function toggle(cardCode) {
    setSelected(prev =>
      prev.includes(cardCode)
        ? prev.filter(id => id !== cardCode)
        : prev.length < excess
          ? [...prev, cardCode]
          : prev
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        {cards.map(card => (
          <div
            key={card.card_code}
            onClick={() => toggle(card.card_code)}
            style={{
              background: selected.includes(card.card_code)
                ? '#4a1b0c'
                : (card.timing === '+' ? '#0a2e20' : '#1a1040'),
              border: `2px solid ${
                selected.includes(card.card_code)
                  ? '#D85A30'
                  : card.timing === '+' ? '#1D9E75' : '#534AB7'
              }`,
              borderRadius: 8,
              padding: '8px 12px',
              marginBottom: 6,
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{
                fontWeight: 600, fontSize: 13,
                color: selected.includes(card.card_code) ? '#F0997B'
                  : card.timing === '+' ? '#5DCAA5' : '#AFA9EC'
              }}>
                {card.name}
                {selected.includes(card.card_code) && (
                  <span style={{ marginLeft: 8, fontSize: 11 }}>✕ Bỏ</span>
                )}
              </div>
              <div style={{ color: '#666', fontSize: 11 }}>{card.description}</div>
            </div>
            <span style={{ fontSize: 11, color: '#555' }}>
              {card.timing === '+' ? '(+)' : '(-)'}
            </span>
          </div>
        ))}
      </div>

      {/* Lá bài mới — ẩn nội dung cho đến khi confirm */}
      <div style={{
        background: '#0f0f1a',
        border: '1px dashed #444',
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 16,
        textAlign: 'center',
        color: '#555',
        fontSize: 13
      }}>
        🃏 Lá bài mới — sẽ hiện sau khi bạn chọn xong
      </div>

      <button
        onClick={() => selected.length === excess && onConfirm(selected)}
        disabled={selected.length !== excess}
        style={{
          width: '100%',
          background: selected.length === excess ? '#534AB7' : '#2a2a4a',
          color: selected.length === excess ? '#fff' : '#555',
          border: 'none',
          borderRadius: 8,
          padding: '10px 0',
          fontSize: 14,
          fontWeight: 600,
          cursor: selected.length === excess ? 'pointer' : 'not-allowed'
        }}
      >
        {selected.length === excess
          ? `Bỏ ${excess} lá đã chọn`
          : `Chọn thêm ${excess - selected.length} lá nữa`}
      </button>
    </div>
  );
}
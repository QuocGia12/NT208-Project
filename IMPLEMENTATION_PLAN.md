# 🎮 Game UI Implementation Plan - Quick Reference

## ✨ Setup Complete!

✅ Figma MCP Server configured  
✅ Design data extracted  
✅ Components mapped  
✅ Ready for implementation  

---

## 📊 Summary

| Status | Count | Details |
|--------|-------|---------|
| ✅ Designed & Coded | 9 | Need positioning update |
| 🔧 Need Design | 6 | Timer, Popups, Overlays, Topbar |
| 📐 Figma Frame | 1920×1080 | Main Game |
| 🎯 Canvas Size | 1280×720 | Current (scale: 0.667) |

---

## 🎯 Components Ready to Fix

### 🔴 **PRIORITY: CRITICAL** (High visibility, immediate update)

1. **Dice Display** (gr_XucXac)
   - Current: Top right area
   - Figma: x=122, y=239, 247×236
   - File: `client/phaser/objects/DiceDisplay.ts`
   - Action: ✏️ Update positioning

2. **Stop Phase Button** (btn_TungXucXac)
   - Current: Below Dice
   - Figma: x=116, y=525, 266×72
   - File: `client/phaser/scenes/UIScene.ts`
   - Action: ✏️ Update positioning

3. **Movement Pad** (gr_ArrowButton)
   - Current: Bottom right
   - Figma: x=84, y=817, 325×320.92
   - File: `client/phaser/scenes/UIScene.ts`
   - Action: ✏️ Update positioning

### 🟠 **PRIORITY: HIGH** (Important gameplay elements)

4. **Card Panel** (gr_Card)
   - Current: Bottom of screen
   - Figma: x=-880, y=1029, 849.72×219.59
   - File: `client/phaser/objects/CardPanel.ts`
   - Action: ✏️ Verify sizing/positioning

5. **Player Info Panel** (gr_PlayerInfo)
   - Current: Top left
   - Figma: x=-1349, y=254, 413×901
   - File: `client/phaser/objects/PlayerInfoPanel.ts`
   - Action: ✏️ Verify sizing/positioning

6. **Game Board** (gr_MainTable)
   - Current: Center
   - Figma: x=-756, y=235, 601×750.99
   - File: `client/phaser/objects/BoardRenderer.ts`
   - Action: ✏️ Verify sizing/positioning

7. **Skip/Wait Button** (btn_Skip) 
   - Current: Below Stop Phase Button
   - Figma: x=116, y=628, 266×72
   - File: `client/phaser/scenes/UIScene.ts`
   - Action: ✏️ Update positioning (for "Dừng chờ")

---

## 🔄 Next Steps

### **For Codex/You:**

1. **Run this command:**
   ```
   "Lấy dữ liệu từ Figma và xác định tất cả components cần update positioning"
   ```

2. **Codex will:**
   - ✅ Call `figma_get_frame_details` from MCP
   - ✅ Compare with current code
   - ✅ Create detailed update plan

3. **Then implement:**
   ```
   "Update toàn bộ game UI components theo Figma design"
   ```

---

## 📁 Key Files for Codex

**UI Implementation:**
- `client/phaser/scenes/UIScene.ts` - Main scene with button setup
- `client/phaser/objects/DiceDisplay.ts` - Dice component
- `client/phaser/objects/CardPanel.ts` - Card display
- `client/phaser/objects/PlayerInfoPanel.ts` - Player info
- `client/phaser/objects/BoardRenderer.ts` - Game board

**Styling/Layout:**
- `client/app/globals.css` - Global styles
- `client/phaser/objects/*.ts` - Component positioning

**Config:**
- `codeium_config.json` - MCP Figma setup
- `figma-design-data.json` - Design data reference

---

## 🛠️ Tools Available

| Tool | Purpose | Command |
|------|---------|---------|
| MCP Figma | Get design data | `figma_get_frame_details` |
| Design Data | Reference | `figma-design-data.json` |
| Instructions | Implementation guide | `.CODEX_GAMEUI_AGENT.md` |

---

## 📈 Progress Tracking

- [ ] **Phase 1:** Update component positioning (Days 1-2)
- [ ] **Phase 2:** Test responsive design (Day 3)
- [ ] **Phase 3:** Design & implement missing components (Days 4+)
- [ ] **Phase 4:** Final polish & validation

---

## 💡 Tips for Implementation

1. **Use Figma data directly** - Coordinates in `figma-design-data.json`
2. **Convert coordinates** - Scale by 0.667 if canvas is 1280×720
3. **Test on multiple sizes** - Ensure responsive
4. **Validate visually** - Compare screenshots with Figma
5. **Update CSS carefully** - Keep styling consistent with design

---

## 🚀 Ready?

**Tell Codex:**
> "Bạn là UI Implementation Expert. Hãy lấy Figma data từ MCP tool, phân tích tất cả components cần update, và tạo detailed plan để fix positioning cho toàn bộ game UI. Sau đó, implement từng component một để khớp với Figma design."

---

**Status:** 🟢 Ready for implementation  
**Last Updated:** 2026-05-28  
**MCP:** ✅ Connected & Verified

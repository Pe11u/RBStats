# RBStats
### Premium Roblox Account Management & Statistics Utility

A professional-grade browser extension designed for power users to manage multiple Roblox accounts, monitor statistics in real-time, and perform bulk operations with a sleek, glassmorphic interface.

---

## Core Features

### 📊 Comprehensive Account Statistics
*   **Real-time Data**: Automatically fetches RAP (Recent Average Price), Total Value, Robux Balance, and Online status.
*   **Identity Verification**: Monitors Verified Badge status and Email verification.
*   **Visual Summaries**: Generate high-quality stats images for sharing or archival.
*   **Token Login**: Seamlessly switch or log into accounts using `.ROBLOSECURITY` tokens.

### 👥 Advanced Alt Manager
*   **Bulk Import**: Beta support for importing accounts via custom formats (e.g., `%user%:%pass%:%token%`).
*   **Smart Filtering**: Select accounts based on RAP or Robux thresholds (Greater Than, Less Than, Ranges).
*   **Bulk Check**: Refresh the status and stats of dozens of accounts simultaneously.
*   **Reliable Storage**: Persistent account management with pinning and a dedicated Trash Bin for safe deletion.
*   **Selection Tools**: "Select All", "Reverse Selection", and "Add to Selection" for efficient management.

---

## 🎨 Design System
*   **Aesthetics**: Modern dark mode with ultra-sleek glassmorphism.
*   **Typography**: Optimized for readability using *Inter* and *Outfit* fonts.
*   **Responsive**: Fluid layout designed for both quick popup access and full-page Alt Management.

---

## 🛠️ Installation

1.  **Clone/Download**: Extract the repository to a local directory.
2.  **Chrome Extensions**: Navigate to `chrome://extensions/` in your browser.
3.  **Developer Mode**: Toggle the **Developer mode** switch in the top-right corner.
4.  **Load Unpacked**: Click the **Load unpacked** button and select the project folder.
5.  **Pin Extension**: Click the puzzle piece icon and pin **RBStats** for quick access.

---

## 📂 Project Architecture

```text
├── icons/            # Visual assets
├── manifest.json     # Extension configuration
├── background.js     # Service worker for API requests
├── popup.html/css/js # Primary interaction interface
└── alt_manager.html/css/js # Advanced account utility suite
```

---

## 🛡️ Security & Privacy
*   **Local Storage**: All account data and tokens are stored locally within your browser's secure storage.
*   **No External Servers**: Data is fetched directly from Roblox and Rolimons APIs; no third-party tracking or data collection.

---

*Note: This tool is intended for personal account management and research purposes. Please adhere to Roblox's Terms of Service.*

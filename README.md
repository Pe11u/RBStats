# RBStats Chrome Extension

A Chrome extension designed to beautifully summarize Roblox account information and enable session login via tokens.

## 🚀 Key Features
- **Premium UI Design**: A sophisticated menu using dark mode and glassmorphism.
- **Token Login**: Login to Roblox instantly by pasting your `.ROBLOSECURITY` token.
- **Stats Image Generation**: Export account details into a high-quality summary card, perfect for sharing or records.
- **Automatic Data Retrieval**: Automatically fetches:
    - Username & ID
    - Verified Badge Status
    - Email Verification Status
    - RAP & Total Value (via Rolimons API)
    - Inventory Visibility
    - Account Creation Date
    - Real-time Online Presence

## 📁 File Structure
- `manifest.json`: Extension configuration and permissions.
- `popup.html`: Main user interface.
- `popup.css`: Styling and design system.
- `popup.js`: Core logic for API integration and image generation.
- `background.js`: Background service worker.
- `icons/`: Logo assets.

## 🛠️ How to Install
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `RBStats` folder.
5. Click the extension icon to start managing your Roblox stats.

# BigQuery Release Pulse ⚡

An interactive web application built with **Python Flask** and plain vanilla **HTML, JS, and CSS** that fetches, parses, and formats the BigQuery Release Notes from Google's live feed, allowing developers to filter updates, search details in real-time, and compose custom shares directly to X/Twitter.

---

## ✨ Features

- **Smart Feed Splitting:** Google's Atom feed puts all updates of a day in one block. The backend parses and splits them into distinct, categorizable cards (`Feature`, `Breaking`, `Issue`, `Change`, `Announcement`) for individual reading and sharing.
- **Dynamic CSS glows & Badging:** A premium, dark-mode dashboard styled with Google Fonts ("Outfit" and "JetBrains Mono"). Each release update type glows dynamically in its respective color category on hover.
- **Client-Side Live Indexing:** Instant keyword search and multi-filtering based on release types. Results are updated instantly as you type without reloading the page.
- **Custom Twitter/X Share Intent:** 
  - Selecting any update opens a custom modal composer.
  - Automatically truncates descriptions to fit within the 280-character limit.
  - Implements Twitter's URL-shortening logic (all URLs count as exactly 23 characters).
  - Features an interactive circular SVG character progress bar that turns amber and red based on usage.
- **Efficient Caching:** Server-side in-memory caching keeps the feed stored for 5 minutes. Clicking the **Refresh** button on the header bypasses the cache and forces a live request.

---

## 📂 Project Structure

```
bq-releases-notes/
├── app.py              # Flask server, feed parsing engine & caching logic
├── requirements.txt    # Python project dependencies
├── .gitignore          # Version control ignore lists
├── templates/
│   └── index.html      # Main application markup & modal layouts
└── static/
    ├── css/
    │   └── style.css   # Custom dark theme variables, spinner, grid, and animations
    └── js/
        └── main.js     # State manager, search filter, character validator & event listeners
```

---

## 🚀 Getting Started

### Prerequisites
Make sure you have Python 3.8+ installed on your computer.

### Setup and Running

1. **Clone the Repository & Navigate:**
   ```bash
   git clone https://github.com/HieuPhung1003/5dayGoogleVibeCode-event-talks-app.git
   cd 5dayGoogleVibeCode-event-talks-app
   ```

2. **Create & Activate a Virtual Environment:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Launch the Server:**
   ```bash
   python app.py
   ```

5. **Open in Browser:**
   Go to **[http://127.0.0.1:5000](http://127.0.0.1:5000)** to view the application.

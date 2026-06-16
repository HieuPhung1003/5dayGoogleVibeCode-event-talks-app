// GLOBAL STATE
let appState = {
    releaseNotes: [], // Raw feed data
    filteredNotes: [], // Filtered feed data
    searchQuery: '',
    selectedCategory: 'all', // 'all' or specific category
    sortOrder: 'desc', // 'desc' (newest first) or 'asc' (oldest first)
    lastUpdatedTime: null,
    
    // Tweet composer context
    activeTweetUpdate: null
};

// CONSTANTS
const CATEGORY_COLORS = {
    'feature': { rgb: '16, 185, 129', hex: '#10b981' },
    'breaking': { rgb: '244, 63, 94', hex: '#f43f5e' },
    'issue': { rgb: '245, 158, 11', hex: '#f59e0b' },
    'change': { rgb: '59, 130, 246', hex: '#3b82f6' },
    'announcement': { rgb: '139, 92, 246', hex: '#8b5cf6' },
    'update': { rgb: '107, 114, 128', hex: '#6b7280' }
};

const TWITTER_URL_LEN = 23; // Twitter URL shortener length for counting

// DOM ELEMENTS
const elements = {
    fullPageLoader: document.getElementById('full-page-loader'),
    refreshBtn: document.getElementById('refresh-btn'),
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    filterPillsContainer: document.getElementById('filter-pills-container'),
    resetFiltersBtn: document.getElementById('reset-filters-btn'),
    sortDescBtn: document.getElementById('sort-desc'),
    sortAscBtn: document.getElementById('sort-asc'),
    exportCsvBtn: document.getElementById('export-csv-btn'),
    statTotalDays: document.getElementById('stat-total-days'),
    statTotalUpdates: document.getElementById('stat-total-updates'),
    lastCheckTimestamp: document.getElementById('last-check-timestamp'),
    resultsCountBadge: document.getElementById('results-count-badge'),
    feedContainer: document.getElementById('feed-container'),
    emptyState: document.getElementById('empty-state'),
    clearAllFiltersBtn: document.getElementById('clear-all-filters-btn'),
    
    // Modal Elements
    tweetModal: document.getElementById('tweet-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    cancelTweetBtn: document.getElementById('cancel-tweet-btn'),
    postTweetBtn: document.getElementById('post-tweet-btn'),
    modalNoteTypeBadge: document.getElementById('modal-note-type-badge'),
    modalNoteDate: document.getElementById('modal-note-date'),
    modalNoteTextPreview: document.getElementById('modal-note-text-preview'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charProgressFill: document.getElementById('char-progress-fill'),
    charCount: document.getElementById('char-count'),
    
    // Toast Container
    toastContainer: document.getElementById('toast-container')
};

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchReleaseNotes(false);
});

// EVENT LISTENERS SETUP
function setupEventListeners() {
    // Refresh button
    elements.refreshBtn.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });

    // Search input
    elements.searchInput.addEventListener('input', (e) => {
        appState.searchQuery = e.target.value.toLowerCase().trim();
        elements.clearSearchBtn.style.display = appState.searchQuery ? 'block' : 'none';
        applyFiltersAndRender();
    });

    elements.clearSearchBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        appState.searchQuery = '';
        elements.clearSearchBtn.style.display = 'none';
        elements.searchInput.focus();
        applyFiltersAndRender();
    });

    // Reset Filters Buttons
    elements.resetFiltersBtn.addEventListener('click', resetFilters);
    elements.clearAllFiltersBtn.addEventListener('click', resetFilters);

    // Sort order toggles
    elements.sortDescBtn.addEventListener('click', () => {
        setSortOrder('desc');
    });
    elements.sortAscBtn.addEventListener('click', () => {
        setSortOrder('asc');
    });

    // Export CSV button
    if (elements.exportCsvBtn) {
        elements.exportCsvBtn.addEventListener('click', exportToCSV);
    }

    // Modal Close handlers
    elements.closeModalBtn.addEventListener('click', closeTweetModal);
    elements.cancelTweetBtn.addEventListener('click', closeTweetModal);
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) closeTweetModal();
    });

    // Tweet text change character count listener
    elements.tweetTextarea.addEventListener('input', updateCharCount);

    // Post to Twitter button
    elements.postTweetBtn.addEventListener('click', postTweetToTwitter);
}

// FETCH DATA
async function fetchReleaseNotes(forceRefresh = false) {
    // Set loading UI states
    setLoadingState(true, forceRefresh);
    
    try {
        const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Server returned code ${response.status}`);
        }
        
        const resData = await response.json();
        
        if (resData.status === 'success') {
            appState.releaseNotes = resData.data;
            appState.lastUpdatedTime = resData.last_updated_time;
            
            // Format feed status UI
            updateStatusUI(resData.source);
            
            // Render filter controls & feed
            applyFiltersAndRender();
            
            showToast(forceRefresh ? 'Feeds refreshed successfully!' : 'Release notes loaded.', 'success');
        } else {
            throw new Error(resData.message || 'Unknown backend error');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showToast(`Failed to fetch release notes: ${error.message}`, 'error');
        
        // Error state dot indicator
        elements.statusDot.className = 'dot yellow';
        elements.statusText.textContent = 'Connection Error';
    } finally {
        setLoadingState(false, forceRefresh);
    }
}

// UI STATE MANAGERS
function setLoadingState(isLoading, isRefreshing) {
    if (isLoading) {
        if (isRefreshing) {
            elements.refreshBtn.disabled = true;
            elements.refreshBtn.querySelector('.refresh-icon').classList.add('spinning');
            elements.refreshBtn.querySelector('span').textContent = 'Refreshing...';
        } else {
            elements.fullPageLoader.classList.remove('fade-out');
        }
    } else {
        // Stop spinners
        elements.refreshBtn.disabled = false;
        elements.refreshBtn.querySelector('.refresh-icon').classList.remove('spinning');
        elements.refreshBtn.querySelector('span').textContent = 'Refresh';
        
        // Fade out screen overlay
        setTimeout(() => {
            elements.fullPageLoader.classList.add('fade-out');
        }, 300);
    }
}

function updateStatusUI(source) {
    const timeString = new Date(appState.lastUpdatedTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = new Date(appState.lastUpdatedTime * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' });
    
    elements.lastCheckTimestamp.textContent = `${dateString} at ${timeString}`;
    
    if (source === 'cached') {
        elements.statusDot.className = 'dot blue';
        elements.statusText.textContent = `Cached (Last checked: ${timeString})`;
    } else if (source === 'fresh') {
        elements.statusDot.className = 'dot green';
        elements.statusText.textContent = 'Live Feed Feed';
    } else if (source.startsWith('error_fallback')) {
        elements.statusDot.className = 'dot yellow';
        elements.statusText.textContent = 'Offline Fallback';
        showToast('Running on cached fallback data due to connection issues.', 'info');
    }
}

// FILTER & SORT CONTROLLERS
function resetFilters() {
    elements.searchInput.value = '';
    appState.searchQuery = '';
    elements.clearSearchBtn.style.display = 'none';
    appState.selectedCategory = 'all';
    applyFiltersAndRender();
    showToast('Filters cleared', 'info');
}

function setSortOrder(order) {
    if (appState.sortOrder !== order) {
        appState.sortOrder = order;
        elements.sortDescBtn.classList.toggle('active', order === 'desc');
        elements.sortAscBtn.classList.toggle('active', order === 'asc');
        applyFiltersAndRender();
        showToast(`Sorted by date: ${order === 'desc' ? 'newest first' : 'oldest first'}`, 'info');
    }
}

function getCategoryFromText(typeStr) {
    if (!typeStr) return 'update';
    const normalized = typeStr.toLowerCase().trim();
    if (normalized.includes('feature')) return 'feature';
    if (normalized.includes('breaking')) return 'breaking';
    if (normalized.includes('issue')) return 'issue';
    if (normalized.includes('change')) return 'change';
    if (normalized.includes('announcement')) return 'announcement';
    return 'update';
}

// MAIN FILTERING ENGINE
function applyFiltersAndRender() {
    let dayCount = 0;
    let updateCount = 0;
    
    // Deep clone state to filter
    const filteredDays = [];
    
    // Calculate total stats from raw data
    let totalRawUpdates = 0;
    appState.releaseNotes.forEach(day => {
        totalRawUpdates += (day.updates ? day.updates.length : 0);
    });
    
    elements.statTotalDays.textContent = appState.releaseNotes.length;
    elements.statTotalUpdates.textContent = totalRawUpdates;

    // Compile dynamic category counts for the filter sidebar based on current search query (but ignoring category filter itself)
    const categoryCounts = {
        all: 0,
        feature: 0,
        breaking: 0,
        issue: 0,
        change: 0,
        announcement: 0,
        update: 0
    };

    appState.releaseNotes.forEach(day => {
        let hasMatchingUpdates = false;
        
        day.updates.forEach(update => {
            const cat = getCategoryFromText(update.type);
            const matchesSearch = !appState.searchQuery || 
                update.text.toLowerCase().includes(appState.searchQuery) ||
                update.type.toLowerCase().includes(appState.searchQuery) ||
                day.date.toLowerCase().includes(appState.searchQuery);
                
            if (matchesSearch) {
                categoryCounts.all++;
                categoryCounts[cat]++;
            }
        });
    });

    // Apply filters
    appState.releaseNotes.forEach(day => {
        const matchingUpdates = day.updates.filter(update => {
            const cat = getCategoryFromText(update.type);
            
            // Check Category filter
            const matchesCategory = appState.selectedCategory === 'all' || cat === appState.selectedCategory;
            
            // Check Search query
            const matchesSearch = !appState.searchQuery || 
                update.text.toLowerCase().includes(appState.searchQuery) ||
                update.type.toLowerCase().includes(appState.searchQuery) ||
                day.date.toLowerCase().includes(appState.searchQuery);
                
            return matchesCategory && matchesSearch;
        });
        
        if (matchingUpdates.length > 0) {
            filteredDays.push({
                date: day.date,
                updated: day.updated,
                link: day.link,
                updates: matchingUpdates
            });
            dayCount++;
            updateCount += matchingUpdates.length;
        }
    });

    // Sort days
    filteredDays.sort((a, b) => {
        const dateA = new Date(a.updated || a.date);
        const dateB = new Date(b.updated || b.date);
        return appState.sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    appState.filteredNotes = filteredDays;
    
    // Render
    renderFilterPills(categoryCounts);
    renderFeedList(updateCount);
}

// RENDER DOM ELEMENTS
function renderFilterPills(counts) {
    const container = elements.filterPillsContainer;
    container.innerHTML = '';
    
    const categories = [
        { id: 'all', label: 'All Updates' },
        { id: 'feature', label: 'Features' },
        { id: 'breaking', label: 'Breaking' },
        { id: 'issue', label: 'Issues' },
        { id: 'change', label: 'Changes' },
        { id: 'announcement', label: 'Announcements' }
    ];
    
    categories.forEach(cat => {
        const count = counts[cat.id];
        
        const pill = document.createElement('button');
        pill.id = `pill-${cat.id}`;
        pill.className = `pill-btn ${appState.selectedCategory === cat.id ? 'active' : ''}`;
        
        // Inject color variables
        const colors = CATEGORY_COLORS[cat.id] || CATEGORY_COLORS.update;
        pill.style.setProperty('--pill-color', colors.hex);
        
        pill.innerHTML = `
            <span>${cat.label}</span>
            <span class="pill-count">${count}</span>
        `;
        
        pill.addEventListener('click', () => {
            appState.selectedCategory = cat.id;
            applyFiltersAndRender();
        });
        
        container.appendChild(pill);
    });
}

function renderFeedList(totalUpdatesCount) {
    const container = elements.feedContainer;
    container.innerHTML = '';
    
    elements.resultsCountBadge.textContent = `Showing ${totalUpdatesCount} note${totalUpdatesCount !== 1 ? 's' : ''}`;

    if (appState.filteredNotes.length === 0) {
        elements.emptyState.style.display = 'flex';
        return;
    }
    
    elements.emptyState.style.display = 'none';
    
    appState.filteredNotes.forEach(day => {
        const dateCard = document.createElement('article');
        dateCard.className = 'date-group';
        
        // Header
        const header = document.createElement('div');
        header.className = 'date-header';
        header.innerHTML = `
            <svg class="date-title-icon" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <h3 class="date-title">${day.date}</h3>
        `;
        dateCard.appendChild(header);
        
        // Content container
        const contentContainer = document.createElement('div');
        contentContainer.className = 'date-group-content';
        
        day.updates.forEach((update, idx) => {
            const cat = getCategoryFromText(update.type);
            const styleMeta = CATEGORY_COLORS[cat] || CATEGORY_COLORS.update;
            
            const updateItem = document.createElement('div');
            updateItem.className = 'update-item';
            updateItem.style.setProperty('--type-color', styleMeta.hex);
            updateItem.style.setProperty('--type-glow', `rgba(${styleMeta.rgb}, 0.12)`);
            updateItem.style.setProperty('--type-rgb', styleMeta.rgb);
            
            // Header for update (Badge & Action Buttons)
            const badgeWrapper = document.createElement('div');
            badgeWrapper.className = 'update-badge-wrapper';
            badgeWrapper.innerHTML = `
                <span class="badge category-badge">${update.type}</span>
                <div class="update-actions">
                    <button class="tweet-action-btn copy-btn" title="Copy update text to clipboard">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Copy</span>
                    </button>
                    <button class="tweet-action-btn tweet-btn" title="Tweet about this update">
                        <svg viewBox="0 0 24 24" fill="currentColor" class="icon">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                        </svg>
                        <span>Tweet</span>
                    </button>
                </div>
            `;
            
            // Attach copy click event
            badgeWrapper.querySelector('.copy-btn').addEventListener('click', () => {
                navigator.clipboard.writeText(update.text).then(() => {
                    showToast('Copied to clipboard!', 'success');
                }).catch(err => {
                    console.error('Copy failed:', err);
                    showToast('Failed to copy to clipboard', 'error');
                });
            });
            
            // Attach tweet composer click event
            badgeWrapper.querySelector('.tweet-btn').addEventListener('click', () => {
                openTweetModal(update);
            });
            
            // HTML content
            const content = document.createElement('div');
            content.className = 'update-content';
            content.innerHTML = update.content;
            
            // Append
            updateItem.appendChild(badgeWrapper);
            updateItem.appendChild(content);
            contentContainer.appendChild(updateItem);
        });
        
        dateCard.appendChild(contentContainer);
        container.appendChild(dateCard);
    });
}

// TWEET COMPOSER SYSTEM
function openTweetModal(update) {
    appState.activeTweetUpdate = update;
    
    // Set static UI tags in modal
    elements.modalNoteTypeBadge.textContent = update.type;
    elements.modalNoteTypeBadge.className = `badge`;
    
    const cat = getCategoryFromText(update.type);
    const styleMeta = CATEGORY_COLORS[cat] || CATEGORY_COLORS.update;
    elements.modalNoteTypeBadge.style.backgroundColor = `rgba(${styleMeta.rgb}, 0.15)`;
    elements.modalNoteTypeBadge.style.color = styleMeta.hex;
    elements.modalNoteTypeBadge.style.borderColor = `rgba(${styleMeta.rgb}, 0.3)`;
    
    elements.modalNoteDate.textContent = update.date;
    elements.modalNoteTextPreview.textContent = update.text;

    // Generate initial tweet content
    const tweetText = composeInitialTweet(update);
    elements.tweetTextarea.value = tweetText;
    
    // Display modal
    elements.tweetModal.style.display = 'flex';
    elements.tweetTextarea.focus();
    
    // Trigger count validation
    updateCharCount();
}

function closeTweetModal() {
    elements.tweetModal.style.display = 'none';
    appState.activeTweetUpdate = null;
}

function composeInitialTweet(update) {
    // Generate URL and hashtags
    const hashtags = "#BigQuery #GoogleCloud";
    const shareUrl = update.link || "https://docs.cloud.google.com/bigquery/docs/release-notes";
    
    // Compute budget. Maximum Twitter length: 280
    // Twitter counts any URL as exactly 23 characters.
    // Length calculation: prefix + bodyText + space + URL + space + hashtags
    const prefix = `BigQuery [${update.type}]: `;
    const suffix = ` ${hashtags}`; // URL will be appended at the very end
    
    // Total static characters
    const staticLen = prefix.length + suffix.length + 1 + TWITTER_URL_LEN; // +1 for spacing
    const availableLen = 280 - staticLen;
    
    let textBody = update.text;
    
    // Truncate textBody to fit inside available length
    if (textBody.length > availableLen) {
        // Leave room for '...'
        textBody = textBody.substring(0, availableLen - 3) + "...";
    }
    
    return `${prefix}${textBody}${suffix} ${shareUrl}`;
}

function updateCharCount() {
    const rawText = elements.tweetTextarea.value;
    
    // Accurately calculate Twitter length
    // Search for URLs in the text since Twitter shortens all URLs to 23 chars
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = rawText.match(urlRegex) || [];
    
    // Replace all URLs in text with dummy 23 char strings to measure length
    let lengthText = rawText;
    urls.forEach(url => {
        lengthText = lengthText.replace(url, 'a'.repeat(TWITTER_URL_LEN));
    });
    
    const count = lengthText.length;
    const isOverLimit = count > 280;
    
    elements.charCount.textContent = `${count} / 280`;
    
    // Progress fill circle
    const percentage = Math.min((count / 280) * 100, 100);
    // stroke-dasharray values represent "active_offset, total_circumference"
    // Total circumference of circle is 100 in our SVG definition
    elements.charProgressFill.setAttribute('stroke-dasharray', `${percentage}, 100`);
    
    // Update warning classes
    if (count > 280) {
        elements.charCount.className = 'char-count danger';
        elements.charProgressFill.className.baseVal = 'circle-fill danger';
        elements.postTweetBtn.disabled = true;
    } else if (count > 250) {
        elements.charCount.className = 'char-count warning';
        elements.charProgressFill.className.baseVal = 'circle-fill warning';
        elements.postTweetBtn.disabled = false;
    } else {
        elements.charCount.className = 'char-count';
        elements.charProgressFill.className.baseVal = 'circle-fill';
        elements.postTweetBtn.disabled = false;
    }
}

function postTweetToTwitter() {
    const tweetText = elements.tweetTextarea.value;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    
    // Open in new tab
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
    
    closeTweetModal();
    showToast('Redirected to Twitter/X to share!', 'success');
}

// TOAST NOTIFICATIONS
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Determine SVG icon based on toast status
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg class="toast-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg class="toast-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    } else {
        iconSvg = `<svg class="toast-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    }
    
    toast.innerHTML = `
        ${iconSvg}
        <span>${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Fade out and remove toast after 3.5s
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3500);
}

// EXPORT TO CSV
function exportToCSV() {
    if (!appState.filteredNotes || appState.filteredNotes.length === 0) {
        showToast('No updates found to export', 'error');
        return;
    }
    
    // Headers setup
    const headers = ['Date', 'Type', 'Content Text', 'Source Link'];
    const csvRows = [headers.join(',')];
    
    appState.filteredNotes.forEach(day => {
        day.updates.forEach(update => {
            // Escape double quotes inside values for CSV conformity
            const escapeCSV = (val) => `"${val.replace(/"/g, '""')}"`;
            
            const date = escapeCSV(day.date);
            const type = escapeCSV(update.type);
            const text = escapeCSV(update.text);
            const link = escapeCSV(update.link);
            
            csvRows.push([date, type, text, link].join(','));
        });
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Create temporary download element
    const downloadLink = document.createElement('a');
    const timestamp = new Date().toISOString().split('T')[0];
    
    downloadLink.setAttribute('href', url);
    downloadLink.setAttribute('download', `bigquery_release_notes_${timestamp}.csv`);
    downloadLink.style.visibility = 'hidden';
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    showToast('Exported CSV successfully!', 'success');
}

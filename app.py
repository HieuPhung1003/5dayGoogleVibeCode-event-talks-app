import os
import re
import xml.etree.ElementTree as ET
import time
from flask import Flask, jsonify, render_template, request
import requests

app = Flask(__name__)

# Feed URL for BigQuery Release Notes
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache configuration
cache = {
    "data": None,
    "last_fetched": 0
}
CACHE_TTL = 300  # 5 minutes in seconds

def parse_updates_from_html(html_content, date_str, base_link):
    """
    Parses the HTML description from the feed and splits it into individual updates
    categorized by their headers (<h3>Feature</h3>, <h3>Breaking</h3>, etc.)
    """
    if not html_content:
        return []
    
    # Normalize headers to standard casing for split operations
    # Match any <h3>...</h3> tags
    pattern = re.compile(r'<h3>(.*?)</h3>', re.IGNORECASE)
    matches = list(pattern.finditer(html_content))
    updates = []
    
    for i, match in enumerate(matches):
        type_str = match.group(1).strip()
        start_idx = match.end()
        end_idx = matches[i+1].start() if i + 1 < len(matches) else len(html_content)
        
        update_html = html_content[start_idx:end_idx].strip()
        
        # Strip HTML tags to get clean plain text for tweeting
        clean_text = re.sub(r'<[^>]+>', '', update_html)
        # Collapse multiple spaces/newlines into a single space
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
        
        updates.append({
            'type': type_str,
            'content': update_html,  # Keep original HTML with links and formatting
            'text': clean_text,      # Clean text for Twitter
            'date': date_str,
            'link': base_link
        })
        
    # If no <h3> header was found, return the whole content as a single update
    if not updates and html_content.strip():
        clean_text = re.sub(r'<[^>]+>', '', html_content)
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
        updates.append({
            'type': 'Update',
            'content': html_content,
            'text': clean_text,
            'date': date_str,
            'link': base_link
        })
        
    return updates

def get_feed_data(force_refresh=False):
    """
    Fetches XML feed from Google, parses it, and returns a structured list.
    Implements a 5-minute memory cache, which can be bypassed using force_refresh.
    """
    now = time.time()
    if not force_refresh and cache["data"] and (now - cache["last_fetched"] < CACHE_TTL):
        return cache["data"], "cached"
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(FEED_URL, headers=headers, timeout=15)
        response.raise_for_status()
        
        xml_content = response.content
        root = ET.fromstring(xml_content)
        
        # Atom feed namespace
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        entries = []
        for entry in root.findall('atom:entry', ns):
            title = entry.find('atom:title', ns)
            date_str = title.text if title is not None else ""
            
            updated = entry.find('atom:updated', ns)
            updated_str = updated.text if updated is not None else ""
            
            link_elem = entry.find('atom:link', ns)
            link_str = link_elem.attrib.get('href') if link_elem is not None else ""
            
            content_elem = entry.find('atom:content', ns)
            content_html = content_elem.text if content_elem is not None else ""
            
            updates = parse_updates_from_html(content_html, date_str, link_str)
            
            entries.append({
                'date': date_str,
                'updated': updated_str,
                'link': link_str,
                'updates': updates
            })
        
        cache["data"] = entries
        cache["last_fetched"] = now
        return entries, "fresh"
        
    except Exception as e:
        # Fallback to cache if fetch fails but we have cached data
        if cache["data"]:
            return cache["data"], f"error_fallback: {str(e)}"
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        data, source = get_feed_data(force_refresh=force_refresh)
        return jsonify({
            'status': 'success',
            'source': source,
            'last_updated_time': cache["last_fetched"],
            'data': data
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    # Bind to localhost to facilitate testing
    app.run(debug=True, host='127.0.0.1', port=5000)

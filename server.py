#!/usr/bin/env python3
"""Local Perkdrop community affiliate link board. Python standard library only."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, unquote, urlsplit
from datetime import datetime, timezone
import json, re, uuid, os

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'offers.json'
CATEGORIES = {'Keyboards','Mice','Watches','Audio','Desk Gear','Shopping','Software','Learning','Travel','Finance','Wellness','Creator tools','Other'}

def read_offers():
    try:
        data = json.loads(DATA.read_text(encoding='utf-8'))
        return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return []

def save_offers(offers):
    tmp = DATA.with_suffix('.tmp')
    tmp.write_text(json.dumps(offers, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(DATA)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        print('[perkdrop] ' + (fmt % args))

    def send_json(self, status, data):
        raw = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        if path == '/api/offers':
            return self.send_json(200, read_offers())
        if path.startswith('/go/'):
            offer_id = path.removeprefix('/go/').strip('/')
            offers = read_offers()
            offer = next((o for o in offers if o.get('id') == offer_id), None)
            if not offer:
                return self.send_error(404, 'Link not found')
            offer['click_count'] = int(offer.get('click_count', 0)) + 1
            save_offers(offers)
            self.send_response(302)
            self.send_header('Location', offer['url'])
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            return
        if path == '/':
            self.path = '/index.html'
        return super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != '/api/offers':
            return self.send_error(404)
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if size < 1 or size > 12000:
                return self.send_json(413, {'error':'Please submit a shorter form.'})
            body = json.loads(self.rfile.read(size))
        except (ValueError, json.JSONDecodeError):
            return self.send_json(400, {'error':'Invalid form data.'})
        if not isinstance(body, dict):
            return self.send_json(400, {'error':'Invalid form data.'})
        clean = {key: str(body.get(key, '')).strip() for key in ('title','brand','category','url','image_url','description','publisher','commission')}
        clean['title'] = clean['title'][:90]
        clean['image_url'] = clean['image_url'][:2048]
        clean['brand'] = clean['brand'][:60]
        clean['description'] = clean['description'][:280]
        clean['publisher'] = clean['publisher'][:40]
        clean['commission'] = clean['commission'][:50]
        if not clean['title'] or not clean['brand'] or clean['category'] not in CATEGORIES:
            return self.send_json(400, {'error':'Add a title, brand, and valid category.'})
        if clean['image_url'] and (not re.fullmatch(r'https://[^\s]+', clean['image_url'], re.I) or not urlsplit(clean['image_url']).hostname):
            return self.send_json(400, {'error':'Cover image must be a valid HTTPS URL.'})
        if len(clean['url']) > 2048 or not re.fullmatch(r'https://[^\s]+', clean['url'], re.I):
            return self.send_json(400, {'error':'Affiliate links must use a valid HTTPS URL.'})
        parsed = urlsplit(clean['url'])
        if not parsed.hostname or parsed.username or parsed.password:
            return self.send_json(400, {'error':'Please enter a valid HTTPS link.'})
        clean.update({'id':uuid.uuid4().hex[:12], 'created_at':datetime.now(timezone.utc).isoformat(), 'click_count':0})
        offers = read_offers()
        offers.insert(0, clean)
        save_offers(offers)
        return self.send_json(201, {'offer':clean})

if __name__ == '__main__':
    port = int(os.environ.get('PERKDROP_PORT', '8766'))
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f'Perkdrop is running at http://127.0.0.1:{port}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nPerkdrop stopped.')
    finally:
        server.server_close()

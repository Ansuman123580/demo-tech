#!/usr/bin/env python3
"""Perkdrop backend server with full Admin API, Authentication, Analytics, Image Upload, and Dynamic Categories."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, unquote, urlsplit
from datetime import datetime, timezone
import json, re, uuid, os, base64

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'offers.json'
CATEGORIES_FILE = ROOT / 'categories.json'
UPLOADS = ROOT / 'uploads'
UPLOADS.mkdir(parents=True, exist_ok=True)

ADMIN_EMAIL = os.environ.get('PERKDROP_ADMIN_EMAIL', 'admin@gmail.com')
ADMIN_PASS = os.environ.get('PERKDROP_ADMIN_PASS', 'admin@0044')

# Active auth session tokens in memory
ACTIVE_TOKENS = set()

def read_offers():
    try:
        data = json.loads(DATA.read_text(encoding='utf-8'))
        return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return []

def read_categories():
    try:
        data = json.loads(CATEGORIES_FILE.read_text(encoding='utf-8'))
        return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return [
            {"id": "keyboards", "name": "Keyboards", "icon": "⌨️"},
            {"id": "mice", "name": "Mice", "icon": "🖱️"},
            {"id": "watches", "name": "Watches", "icon": "⌚"},
            {"id": "audio", "name": "Audio", "icon": "🎧"},
            {"id": "desk-gear", "name": "Desk Gear", "icon": "🪵"}
        ]

CATALOG_VERSION = str(int(datetime.now(timezone.utc).timestamp() * 1000))

def bump_catalog_version():
    global CATALOG_VERSION
    CATALOG_VERSION = str(int(datetime.now(timezone.utc).timestamp() * 1000))

def save_offers(offers):
    tmp = DATA.with_suffix('.tmp')
    tmp.write_text(json.dumps(offers, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(DATA)
    bump_catalog_version()

def save_categories(categories):
    tmp = CATEGORIES_FILE.with_suffix('.tmp')
    tmp.write_text(json.dumps(categories, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(CATEGORIES_FILE)
    bump_catalog_version()

def sanitize_filename(filename):
    clean = re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)
    return clean[:80] or 'upload'

def slugify(text):
    slug = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    return slug or f'cat-{uuid.uuid4().hex[:6]}'

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        print('[perkdrop] ' + (fmt % args))

    def send_json(self, status, data):
        raw = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.end_headers()
        self.wfile.write(raw)

    def check_auth(self):
        auth_header = self.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:].strip()
            if token in ACTIVE_TOKENS:
                return True
        custom_token = self.headers.get('X-Admin-Token', '').strip()
        if custom_token and custom_token in ACTIVE_TOKENS:
            return True
        return False

    def read_json_body(self, max_bytes=10 * 1024 * 1024):
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > max_bytes:
                return None, 'Payload too large or empty'
            raw = self.rfile.read(length)
            return json.loads(raw.decode('utf-8')), None
        except Exception as e:
            return None, str(e)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        # Route /admin to /admin.html
        if path == '/admin' or path == '/admin/':
            self.path = '/admin.html'
            return super().do_GET()

        # Public offers list
        if path == '/api/offers':
            return self.send_json(200, read_offers())

        # Public categories list
        if path == '/api/categories':
            return self.send_json(200, read_categories())

        # Catalog real-time version check for auto-refresh
        if path == '/api/catalog-version':
            offers = read_offers()
            categories = read_categories()
            return self.send_json(200, {
                'version': CATALOG_VERSION,
                'count': len(offers),
                'category_count': len(categories)
            })

        # Auth verify
        if path == '/api/auth/me':
            if self.check_auth():
                return self.send_json(200, {'authenticated': True, 'email': ADMIN_EMAIL})
            return self.send_json(401, {'authenticated': False})

        # Admin offers list (with full analytics)
        if path == '/api/admin/offers':
            if not self.check_auth():
                return self.send_json(401, {'error': 'Unauthorized. Please log in.'})
            offers = read_offers()
            total_clicks = sum(int(o.get('click_count', 0)) for o in offers)
            return self.send_json(200, {
                'offers': offers,
                'total_products': len(offers),
                'total_clicks': total_clicks
            })

        # Admin categories list (with product counts)
        if path == '/api/admin/categories':
            if not self.check_auth():
                return self.send_json(401, {'error': 'Unauthorized. Please log in.'})
            categories = read_categories()
            offers = read_offers()
            
            # Compute product count per category
            cat_counts = {}
            for o in offers:
                cat_name = o.get('category', 'Other')
                cat_counts[cat_name] = cat_counts.get(cat_name, 0) + 1

            enriched = []
            for c in categories:
                c_copy = dict(c)
                c_copy['product_count'] = cat_counts.get(c['name'], 0)
                enriched.append(c_copy)

            return self.send_json(200, {'categories': enriched})

        # Full catalog backup
        if path == '/api/admin/backup':
            if not self.check_auth():
                return self.send_json(401, {'error': 'Unauthorized'})
            return self.send_json(200, {
                'offers': read_offers(),
                'categories': read_categories(),
                'version': CATALOG_VERSION,
                'exported_at': datetime.now(timezone.utc).isoformat()
            })

        # Instant Affiliate Link Redirection (Amazon / Flipkart / etc.)
        if path.startswith('/go/'):
            offer_id = path.removeprefix('/go/').strip('/')
            offers = read_offers()
            offer = next((o for o in offers if o.get('id') == offer_id), None)
            if not offer:
                return self.send_error(404, 'Product link not found')
            
            # Increment click count for analytics
            offer['click_count'] = int(offer.get('click_count', 0)) + 1
            save_offers(offers)

            # Redirect immediately to target URL
            target_url = offer.get('url', '/')
            self.send_response(302)
            self.send_header('Location', target_url)
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            return

        if path == '/':
            self.path = '/index.html'

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        # Admin Login
        if path == '/api/auth/login':
            body, err = self.read_json_body(max_bytes=10000)
            if err or not isinstance(body, dict):
                return self.send_json(400, {'error': 'Invalid credentials format'})
            
            email = str(body.get('email', '')).strip().lower()
            password = str(body.get('password', '')).strip()

            if email == ADMIN_EMAIL.lower() and password == ADMIN_PASS:
                token = uuid.uuid4().hex
                ACTIVE_TOKENS.add(token)
                return self.send_json(200, {
                    'token': token,
                    'user': {'email': ADMIN_EMAIL}
                })
            return self.send_json(401, {'error': 'Invalid email or password'})

        # Admin Logout
        if path == '/api/auth/logout':
            auth_header = self.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                token = auth_header[7:].strip()
                ACTIVE_TOKENS.discard(token)
            return self.send_json(200, {'message': 'Logged out successfully'})

        # Admin Image File Upload (Base64)
        if path == '/api/admin/upload':
            if not self.check_auth():
                return self.send_json(401, {'error': 'Unauthorized'})
            body, err = self.read_json_body(max_bytes=12 * 1024 * 1024)
            if err or not isinstance(body, dict):
                return self.send_json(400, {'error': 'Upload failed: ' + (err or 'Invalid payload')})
            
            raw_data = body.get('data', '')
            original_name = body.get('filename', 'image.jpg')
            
            if ',' in raw_data:
                header, encoded = raw_data.split(',', 1)
            else:
                encoded = raw_data

            try:
                file_bytes = base64.b64decode(encoded)
            except Exception:
                return self.send_json(400, {'error': 'Invalid base64 image data'})

            if len(file_bytes) > 8 * 1024 * 1024:
                return self.send_json(413, {'error': 'Image size exceeds 8MB limit'})

            ext = Path(original_name).suffix.lower()
            if ext not in ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'):
                ext = '.jpg'

            unique_filename = f"{uuid.uuid4().hex[:8]}_{sanitize_filename(Path(original_name).stem)}{ext}"
            file_path = UPLOADS / unique_filename
            file_path.write_bytes(file_bytes)

            file_url = f"/uploads/{unique_filename}"
            return self.send_json(201, {'url': file_url})

        # Admin Create New Category
        if path == '/api/admin/categories':
            if not self.check_auth():
                return self.send_json(401, {'error': 'Unauthorized'})

            body, err = self.read_json_body(max_bytes=10000)
            if err or not isinstance(body, dict):
                return self.send_json(400, {'error': 'Invalid category data'})

            name = str(body.get('name', '')).strip()
            if not name:
                return self.send_json(400, {'error': 'Category name is required'})

            categories = read_categories()
            if any(c['name'].lower() == name.lower() for c in categories):
                return self.send_json(400, {'error': f'Category "{name}" already exists.'})

            icon = str(body.get('icon', '📦')).strip() or '📦'
            description = str(body.get('description', '')).strip()
            cat_id = slugify(name)

            new_category = {
                'id': cat_id,
                'name': name,
                'icon': icon,
                'description': description
            }
            categories.append(new_category)
            save_categories(categories)
            return self.send_json(201, {'category': new_category})

        # Admin Create New Product / Offer
        if path == '/api/admin/offers' or path == '/api/offers':
            is_admin_endpoint = path == '/api/admin/offers'
            if is_admin_endpoint and not self.check_auth():
                return self.send_json(401, {'error': 'Unauthorized'})

            body, err = self.read_json_body(max_bytes=20000)
            if err or not isinstance(body, dict):
                return self.send_json(400, {'error': 'Invalid form data'})

            clean = {
                key: str(body.get(key, '')).strip()
                for key in ('title', 'brand', 'category', 'url', 'image_url', 'description', 'publisher', 'commission')
            }
            clean['title'] = clean['title'][:120]
            clean['brand'] = clean['brand'][:80]
            clean['category'] = clean['category'][:50] or 'Other'
            clean['description'] = clean['description'][:500]
            clean['publisher'] = clean['publisher'][:60] or 'Admin'
            clean['commission'] = clean['commission'][:60]

            if not clean['title'] or not clean['brand'] or not clean['url']:
                return self.send_json(400, {'error': 'Title, Brand, and Redirect URL are required.'})

            if not clean['url'].startswith('http://') and not clean['url'].startswith('https://'):
                clean['url'] = 'https://' + clean['url']

            new_offer = {
                'id': uuid.uuid4().hex[:12],
                'title': clean['title'],
                'brand': clean['brand'],
                'category': clean['category'],
                'url': clean['url'],
                'image_url': clean['image_url'],
                'description': clean['description'],
                'publisher': clean['publisher'],
                'commission': clean['commission'],
                'created_at': datetime.now(timezone.utc).isoformat(),
                'click_count': 0,
                'is_demo': False
            }

            offers = read_offers()
            offers.insert(0, new_offer)
            save_offers(offers)
            return self.send_json(201, {'offer': new_offer})

        return self.send_error(404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        # Admin Edit Category: /api/admin/categories/<id>
        if path.startswith('/api/admin/categories/'):
            if not self.check_auth():
                return self.send_json(401, {'error': 'Unauthorized'})

            cat_id = path.removeprefix('/api/admin/categories/').strip('/')
            body, err = self.read_json_body(max_bytes=10000)
            if err or not isinstance(body, dict):
                return self.send_json(400, {'error': 'Invalid category data'})

            categories = read_categories()
            target_cat = next((c for c in categories if c.get('id') == cat_id), None)
            if not target_cat:
                return self.send_json(404, {'error': 'Category not found'})

            old_name = target_cat.get('name')
            new_name = str(body.get('name', target_cat.get('name'))).strip()
            target_cat['name'] = new_name
            if 'icon' in body:
                target_cat['icon'] = str(body.get('icon', '')).strip()
            if 'description' in body:
                target_cat['description'] = str(body.get('description', '')).strip()

            save_categories(categories)

            # If category name changed, update products that had old category name
            if old_name and new_name and old_name != new_name:
                offers = read_offers()
                changed = False
                for o in offers:
                    if o.get('category') == old_name:
                        o['category'] = new_name
                        changed = True
                if changed:
                    save_offers(offers)

            return self.send_json(200, {'category': target_cat})

        # Admin Edit Offer: /api/admin/offers/<id>
        if path.startswith('/api/admin/offers/'):
            if not self.check_auth():
                return self.send_json(401, {'error': 'Unauthorized'})

            offer_id = path.removeprefix('/api/admin/offers/').strip('/')
            body, err = self.read_json_body(max_bytes=20000)
            if err or not isinstance(body, dict):
                return self.send_json(400, {'error': 'Invalid payload'})

            offers = read_offers()
            target = next((o for o in offers if o.get('id') == offer_id), None)
            if not target:
                return self.send_json(404, {'error': 'Product not found'})

            for field in ('title', 'brand', 'category', 'url', 'image_url', 'description', 'publisher', 'commission'):
                if field in body:
                    val = str(body[field]).strip()
                    if field == 'url' and val and not val.startswith(('http://', 'https://')):
                        val = 'https://' + val
                    target[field] = val

            target['updated_at'] = datetime.now(timezone.utc).isoformat()
            save_offers(offers)
            return self.send_json(200, {'offer': target})

        return self.send_error(404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        # Admin Delete Category: /api/admin/categories/<id>
        if path.startswith('/api/admin/categories/'):
            if not self.check_auth():
                return self.send_json(401, {'error': 'Unauthorized'})

            cat_id = path.removeprefix('/api/admin/categories/').strip('/')
            categories = read_categories()
            target_cat = next((c for c in categories if c.get('id') == cat_id), None)
            if not target_cat:
                return self.send_json(404, {'error': 'Category not found'})

            categories = [c for c in categories if c.get('id') != cat_id]
            save_categories(categories)
            return self.send_json(200, {'success': True, 'deleted_id': cat_id})

        # Admin Delete Offer: /api/admin/offers/<id>
        if path.startswith('/api/admin/offers/'):
            if not self.check_auth():
                return self.send_json(401, {'error': 'Unauthorized'})

            offer_id = path.removeprefix('/api/admin/offers/').strip('/')
            offers = read_offers()
            initial_count = len(offers)
            offers = [o for o in offers if o.get('id') != offer_id]

            if len(offers) == initial_count:
                return self.send_json(404, {'error': 'Product not found'})

            save_offers(offers)
            return self.send_json(200, {'success': True, 'deleted_id': offer_id})

        return self.send_error(404)

if __name__ == '__main__':
    port = int(os.environ.get('PERKDROP_PORT', '8766'))
    server = ThreadingHTTPServer(('0.0.0.0', port), Handler)
    print(f'Perkdrop server running at http://127.0.0.1:{port}')
    print(f'Admin dashboard at http://127.0.0.1:{port}/admin')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nPerkdrop stopped.')
    finally:
        server.server_close()

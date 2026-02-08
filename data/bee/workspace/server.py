#!/usr/bin/env python3
import http.server
import socketserver
import os
import json
from urllib.parse import urlparse, parse_qs

class BeeServer(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Parse the URL
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/':
            # Main endpoint - Hello World + file list
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            # Get list of files in current directory
            try:
                files = os.listdir('.')
                file_list = []
                for f in files:
                    if os.path.isfile(f):
                        size = os.path.getsize(f)
                        file_list.append({'name': f, 'size': size, 'type': 'file'})
                    elif os.path.isdir(f):
                        file_list.append({'name': f, 'type': 'directory'})
            except Exception as e:
                file_list = [{'error': str(e)}]
            
            # Create HTML response
            html_response = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <title>BuzyBeez Worker Bee Server</title>
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 40px; background: #fff3cd; }}
                    h1 {{ color: #ff6b00; }}
                    .file-list {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                    .file-item {{ padding: 8px; border-bottom: 1px solid #eee; }}
                    .file-item:last-child {{ border-bottom: none; }}
                    .bee {{ font-size: 2em; }}
                </style>
            </head>
            <body>
                <h1>🐝 Hello World from BuzyBeez Worker Bee! 🐝</h1>
                <p>This is Worker Bee (bee-001) serving from the hive!</p>
                <p>Current time: {self.date_time_string()}</p>
                
                <div class="file-list">
                    <h2>📁 Files in my workspace:</h2>
                    {''.join([f'<div class="file-item">📄 {item["name"]} ({item.get("size", "N/A")} bytes) - {item["type"]}</div>' for item in file_list])}
                </div>
                
                <h3>🛠️ Available endpoints:</h3>
                <ul>
                    <li><a href="/">/ - This page</a></li>
                    <li><a href="/api/files">/api/files - JSON file list</a></li>
                    <li><a href="/health">/health - Health check</a></li>
                </ul>
            </body>
            </html>
            """
            
            self.wfile.write(html_response.encode('utf-8'))
            
        elif parsed_path.path == '/api/files':
            # JSON API endpoint for file list
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            try:
                files = os.listdir('.')
                file_list = []
                for f in files:
                    if os.path.isfile(f):
                        size = os.path.getsize(f)
                        file_list.append({'name': f, 'size': size, 'type': 'file'})
                    elif os.path.isdir(f):
                        file_list.append({'name': f, 'type': 'directory'})
                        
                response = {
                    'message': 'Hello World from BuzyBeez!',
                    'bee_id': 'bee-001',
                    'files': file_list,
                    'total_files': len(file_list)
                }
            except Exception as e:
                response = {'error': str(e)}
                
            self.wfile.write(json.dumps(response, indent=2).encode('utf-8'))
            
        elif parsed_path.path == '/health':
            # Health check endpoint
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'OK - BuzyBeez Worker Bee is buzzing!')
            
        else:
            # 404 for other paths
            self.send_response(404)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b'<h1>404 - Buzz off! Page not found</h1><p>🐝 This bee worker only knows certain routes!</p>')

if __name__ == "__main__":
    PORT = 8000
    
    print(f"🐝 BuzyBeez Worker Bee Server starting on port {PORT}")
    print(f"🐝 Access via: http://localhost:{PORT}")
    print(f"🐝 For local network access: http://[YOUR_IP]:{PORT}")
    print(f"🐝 Press Ctrl+C to stop the server")
    
    with socketserver.TCPServer(("", PORT), BeeServer) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🐝 Server stopped. Bee going back to the hive!")
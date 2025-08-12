#!/usr/bin/env python3
"""
Simple HTTP Server for testing AR applications
Serves files with proper MIME types and CORS headers for AR.js compatibility
"""

import http.server
import socketserver
import socket
import os
import sys
from urllib.parse import unquote

class ARHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for AR.js compatibility
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def guess_type(self, path):
        """Override to ensure proper MIME types for AR content"""
        # Ensure proper MIME types for AR.js
        if path.endswith('.html'):
            return 'text/html'
        elif path.endswith('.js'):
            return 'application/javascript'
        elif path.endswith('.json'):
            return 'application/json'
        elif path.endswith('.gltf'):
            return 'model/gltf+json'
        elif path.endswith('.glb'):
            return 'model/gltf-binary'
        
        # Fall back to parent class implementation
        return super().guess_type(path)

def get_local_ip():
    """Get the local IP address"""
    try:
        # Connect to a remote address to determine local IP
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"

def main():
    # Change to the directory containing the HTML file
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    PORT = 8080
    local_ip = get_local_ip()
    
    # Try different ports if 8080 is busy
    for port in range(8080, 8090):
        try:
            with socketserver.TCPServer(("", port), ARHTTPRequestHandler) as httpd:
                PORT = port
                break
        except OSError:
            continue
    else:
        print("Could not find an available port between 8080-8089")
        sys.exit(1)

    with socketserver.TCPServer(("", PORT), ARHTTPRequestHandler) as httpd:
        print(f"🚀 AR Server started!")
        print(f"📱 Local access: http://localhost:{PORT}/artest.html")
        print(f"📱 Network access: http://{local_ip}:{PORT}/artest.html")
        print(f"")
        print(f"📍 To access from your phone:")
        print(f"   1. Make sure your phone is on the same WiFi network")
        print(f"   2. Open your phone's browser")
        print(f"   3. Go to: http://{local_ip}:{PORT}/artest.html")
        print(f"")
        print(f"🛑 Press Ctrl+C to stop the server")
        print(f"📂 Serving files from: {os.getcwd()}")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print(f"\n🛑 Server stopped")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
HTTPS Server for AR.js applications
Creates self-signed certificates and serves over HTTPS for camera access
"""

import http.server
import socketserver
import ssl
import socket
import os
import sys
import subprocess
from urllib.parse import unquote

class ARHTTPSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for AR.js compatibility
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Add security headers for HTTPS
        self.send_header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
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

def create_self_signed_cert():
    """Create a self-signed certificate for HTTPS"""
    cert_file = 'server.crt'
    key_file = 'server.key'
    
    if os.path.exists(cert_file) and os.path.exists(key_file):
        print("📜 Using existing certificate files")
        return cert_file, key_file
    
    print("📜 Creating self-signed certificate...")
    
    try:
        # Create self-signed certificate using OpenSSL (if available)
        cmd = [
            'openssl', 'req', '-x509', '-newkey', 'rsa:4096', '-keyout', key_file,
            '-out', cert_file, '-days', '365', '-nodes', '-subj',
            '/C=US/ST=State/L=City/O=AR-Test/CN=localhost'
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Certificate created successfully using OpenSSL")
            return cert_file, key_file
        else:
            raise Exception("OpenSSL failed")
            
    except (subprocess.CalledProcessError, FileNotFoundError, Exception):
        print("⚠️  OpenSSL not available, creating certificate with Python...")
        
        # Fallback: Create certificate using Python's cryptography library
        try:
            from cryptography import x509
            from cryptography.x509.oid import NameOID
            from cryptography.hazmat.primitives import hashes, serialization
            from cryptography.hazmat.primitives.asymmetric import rsa
            import datetime
            import ipaddress
            
            # Generate private key
            private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048,
            )
            
            # Create certificate
            subject = issuer = x509.Name([
                x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
                x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "State"),
                x509.NameAttribute(NameOID.LOCALITY_NAME, "City"),
                x509.NameAttribute(NameOID.ORGANIZATION_NAME, "AR-Test"),
                x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
            ])
            
            cert = x509.CertificateBuilder().subject_name(
                subject
            ).issuer_name(
                issuer
            ).public_key(
                private_key.public_key()
            ).serial_number(
                x509.random_serial_number()
            ).not_valid_before(
                datetime.datetime.utcnow()
            ).not_valid_after(
                datetime.datetime.utcnow() + datetime.timedelta(days=365)
            ).add_extension(
                x509.SubjectAlternativeName([
                    x509.DNSName("localhost"),
                    x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
                ]),
                critical=False,
            ).sign(private_key, hashes.SHA256())
            
            # Write certificate
            with open(cert_file, 'wb') as f:
                f.write(cert.public_bytes(serialization.Encoding.PEM))
            
            # Write private key
            with open(key_file, 'wb') as f:
                f.write(private_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption()
                ))
            
            print("✅ Certificate created successfully using Python cryptography")
            return cert_file, key_file
            
        except ImportError:
            print("❌ Error: Neither OpenSSL nor cryptography library available")
            print("💡 Install cryptography: pip install cryptography")
            print("💡 Or install OpenSSL and add it to PATH")
            sys.exit(1)

def get_local_ip():
    """Get the local IP address"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"

def main():
    # Change to the directory containing the HTML file
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Create certificate
    cert_file, key_file = create_self_signed_cert()
    
    PORT = 8443  # Standard HTTPS port alternative
    local_ip = get_local_ip()
    
    # Try different ports if 8443 is busy
    for port in range(8443, 8453):
        try:
            httpd = socketserver.TCPServer(("", port), ARHTTPSRequestHandler)
            PORT = port
            break
        except OSError:
            continue
    else:
        print("Could not find an available port between 8443-8452")
        sys.exit(1)

    # Wrap with SSL
    try:
        context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        context.load_cert_chain(cert_file, key_file)
        httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
        
        print(f"🔒 HTTPS AR Server started!")
        print(f"📱 Local access: https://localhost:{PORT}/artest.html")
        print(f"📱 Network access: https://{local_ip}:{PORT}/artest.html")
        print(f"")
        print(f"🔐 IMPORTANT - Certificate Warnings:")
        print(f"   Your browser will show a security warning because this is a self-signed certificate.")
        print(f"   This is NORMAL and SAFE for local testing.")
        print(f"")
        print(f"📱 To access from your phone:")
        print(f"   1. Make sure your phone is on the same WiFi network")
        print(f"   2. Open your phone's browser")
        print(f"   3. Go to: https://{local_ip}:{PORT}/artest.html")
        print(f"   4. ⚠️  You'll see a security warning - click 'Advanced' then 'Proceed to {local_ip}' (or similar)")
        print(f"   5. 📸 Allow camera access when prompted")
        print(f"")
        print(f"🛑 Press Ctrl+C to stop the server")
        print(f"📂 Serving files from: {os.getcwd()}")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print(f"\n🛑 HTTPS Server stopped")
            
    except Exception as e:
        print(f"❌ Failed to start HTTPS server: {e}")
        print(f"💡 Try running as administrator or check certificate files")
        sys.exit(1)

if __name__ == "__main__":
    main()

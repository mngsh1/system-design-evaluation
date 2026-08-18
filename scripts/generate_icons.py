#!/usr/bin/env python3
"""
Generates crisp PNG icons (16x16, 48x48, 128x128) for the Chrome Extension
using only the Python standard library (struct + zlib).
"""
import os
import struct
import zlib
import math

def make_png(width, height, get_pixel_rgba):
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # Filter type: None
        for x in range(width):
            r, g, b, a = get_pixel_rgba(x, y, width, height)
            raw_data.extend([r, g, b, a])
    
    compressed = zlib.compress(raw_data, 9)
    
    def chunk(chunk_type, data):
        length = struct.pack('>I', len(data))
        crc = struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff)
        return length + chunk_type + data + crc

    png = bytearray(b'\x89PNG\r\n\x1a\n')
    # IHDR: width, height, bit depth (8), color type (6 = RGBA), compression, filter, interlace
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png.extend(chunk(b'IHDR', ihdr))
    png.extend(chunk(b'IDAT', compressed))
    png.extend(chunk(b'IEND', b''))
    return bytes(png)

def icon_pixel(x, y, w, h):
    # Normalized coordinates [-1, 1]
    nx = (x / (w - 1)) * 2 - 1
    ny = (y / (h - 1)) * 2 - 1
    
    # Background rounded squircle / hexagon
    dist_sq = nx**4 + ny**4
    if dist_sq > 0.75:
        # Anti-aliased outer edge
        edge = (dist_sq - 0.75) / 0.15
        if edge >= 1.0:
            return 0, 0, 0, 0
        alpha = int((1.0 - edge) * 255)
    else:
        alpha = 255
    
    # Background gradient: Dark tech slate to deep navy
    bg_r = int(12 + (ny + 1) * 8)
    bg_g = int(16 + (ny + 1) * 14)
    bg_b = int(28 + (ny + 1) * 22)
    
    # Draw architecture node diagram icon inside
    # Central node: (0, 0)
    # Surrounding nodes: (-0.45, -0.3), (0.45, -0.3), (0, 0.45)
    nodes = [
        (0.0, -0.05, 0.18, (6, 182, 212)),      # Cyan central hub
        (-0.45, -0.35, 0.14, (99, 102, 241)),  # Indigo top-left
        (0.45, -0.35, 0.14, (139, 92, 246)),   # Purple top-right
        (0.0, 0.48, 0.14, (16, 185, 129)),     # Emerald bottom DB
    ]
    
    # Check lines between nodes
    line_hit = False
    lines = [
        ((-0.45, -0.35), (0.0, -0.05)),
        ((0.45, -0.35), (0.0, -0.05)),
        ((0.0, -0.05), (0.0, 0.48))
    ]
    for (p1x, p1y), (p2x, p2y) in lines:
        # Distance from point to line segment
        dx = p2x - p1x
        dy = p2y - p1y
        length_sq = dx*dx + dy*dy
        t = max(0, min(1, ((nx - p1x)*dx + (ny - p1y)*dy) / length_sq))
        proj_x = p1x + t * dx
        proj_y = p1y + t * dy
        dist_to_line = math.sqrt((nx - proj_x)**2 + (ny - proj_y)**2)
        if dist_to_line < 0.045:
            line_hit = True
            break
            
    if line_hit:
        return 99, 102, 241, alpha
        
    for cx, cy, radius, (nr, ng, nb) in nodes:
        d = math.sqrt((nx - cx)**2 + (ny - cy)**2)
        if d <= radius:
            # Highlight center of node
            ratio = d / radius
            hr = int(nr * (1.2 - ratio * 0.4))
            hg = int(ng * (1.2 - ratio * 0.4))
            hb = int(nb * (1.2 - ratio * 0.4))
            return min(255, hr), min(255, hg), min(255, hb), alpha
            
    return bg_r, bg_g, bg_b, alpha

def generate_all_icons(output_dir="icons"):
    os.makedirs(output_dir, exist_ok=True)
    sizes = [16, 48, 128]
    for size in sizes:
        png_data = make_png(size, size, icon_pixel)
        filepath = os.path.join(output_dir, f"icon-{size}.png")
        with open(filepath, "wb") as f:
            f.write(png_data)
        print(f"Generated {filepath} ({size}x{size}px, {len(png_data)} bytes)")

if __name__ == "__main__":
    generate_all_icons()

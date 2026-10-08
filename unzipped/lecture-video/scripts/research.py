#!/usr/bin/env python3
"""
Research helper for lecture-video skill.
Extracts and structures content from URLs using the mb browser.

Usage:
    python3 research.py <url> <output_file>
    
Example:
    python3 research.py "https://en.wikipedia.org/wiki/Calculus" research_output.md
"""

import subprocess
import sys
import json
import re


def scrape_url(url: str) -> str:
    """Navigate to URL and extract text content using mb."""
    # Navigate
    subprocess.run(["mb", "go", url], capture_output=True, text=True, timeout=30)
    import time
    time.sleep(3)
    
    # Get text
    result = subprocess.run(["mb", "text"], capture_output=True, text=True, timeout=15)
    return result.stdout.strip()


def clean_content(raw_text: str) -> str:
    """Remove navigation, ads, and other noise from scraped content."""
    lines = raw_text.split('\n')
    cleaned = []
    skip_patterns = [
        r'^(Skip|Sign in|Subscribe|Share|Save|Menu|Navigation|Cookie|Accept|Reject)',
        r'^\d+ views',
        r'^(Sponsored|Ad|Advertisement)',
        r'^(Privacy|Terms|Copyright)',
    ]
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if any(re.match(p, line, re.IGNORECASE) for p in skip_patterns):
            continue
        if len(line) < 3:
            continue
        cleaned.append(line)
    
    return '\n'.join(cleaned)


def structure_content(content: str, url: str) -> str:
    """Structure the extracted content into a markdown research document."""
    output = f"# Research: {url}\n\n"
    output += "## Extracted Content\n\n"
    output += content[:15000]  # Cap at 15k chars to keep manageable
    output += "\n\n---\n"
    output += f"*Source: {url}*\n"
    return output


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 research.py <url> <output_file>")
        sys.exit(1)
    
    url = sys.argv[1]
    output_file = sys.argv[2]
    
    print(f"Scraping: {url}")
    raw = scrape_url(url)
    
    print("Cleaning content...")
    cleaned = clean_content(raw)
    
    print("Structuring...")
    structured = structure_content(cleaned, url)
    
    with open(output_file, 'w') as f:
        f.write(structured)
    
    print(f"Research saved to: {output_file}")
    print(f"Content length: {len(cleaned)} chars")


if __name__ == "__main__":
    main()

#!/usr/bin/env node
/**
 * Phase 6 - build the dashboard for deploy. Copies index.html + the latest
 * data/data.json into dashboard/dist/ (fetch needs same-folder files).
 * Used as the Cloudflare Pages build command for the dashboard project.
 */
import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('dashboard/dist', { recursive: true });
cpSync('dashboard/index.html', 'dashboard/dist/index.html');
cpSync('data/data.json', 'dashboard/dist/data.json');
console.log('Dashboard built -> dashboard/dist/ (index.html + data.json)');

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'apk-static-handler',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const cleanUrl = (req.url || '').split('?')[0];
            if (cleanUrl === '/download/SABAA-AI.apk' || cleanUrl === '/app/SABAA-AI.apk' || cleanUrl.endsWith('.apk')) {
              // Set headers removing any 403 restrictions and guaranteeing APK MIME type
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', '*');
              res.setHeader('Content-Type', 'application/vnd.android.package-archive');
              res.setHeader('Content-Disposition', 'attachment; filename="SABAA-AI.apk"');

              if (req.method === 'OPTIONS') {
                res.statusCode = 204;
                return res.end();
              }

              const rootDir = process.cwd();
              const candidates = [
                path.resolve(rootDir, 'public/download/SABAA-AI.apk'),
                path.resolve(rootDir, 'public/app/SABAA-AI.apk'),
                path.resolve(rootDir, 'android/app/src/main/assets/public/download/SABAA-AI.apk'),
                path.resolve(rootDir, 'android/app/src/main/assets/public/app/Sabaa-AI-Solution-v1.0.0-release.apk'),
              ];

              for (const cand of candidates) {
                if (fs.existsSync(cand)) {
                  const stat = fs.statSync(cand);
                  if (stat.size > 0) {
                    res.setHeader('Content-Length', stat.size.toString());
                    res.setHeader('Accept-Ranges', 'bytes');
                    if (req.method === 'HEAD') {
                      res.statusCode = 200;
                      return res.end();
                    }
                    const stream = fs.createReadStream(cand);
                    res.statusCode = 200;
                    return stream.pipe(res);
                  }
                }
              }
            }
            next();
          });
        },
      },
    ],
    assetsInclude: ['**/*.apk'],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      fs: {
        strict: false,
        allow: ['.', 'public', 'android'],
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

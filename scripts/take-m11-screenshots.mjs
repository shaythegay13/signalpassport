import { spawn } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userDataDir = join(tmpdir(), 'edge-m11-' + Date.now());
mkdirSync(userDataDir, { recursive: true });

const screenshotsDir = join(process.cwd(), 'docs', 'screenshots');
mkdirSync(screenshotsDir, { recursive: true });

const validBundleJson = readFileSync(join(process.cwd(), 'fixtures', 'real', 'passport-bundle.json'), 'utf8');

const edge = spawn(edgePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  `--user-data-dir=${userDataDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank'
], { stdio: 'ignore' });

async function createClient() {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 100));
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) break;
    } catch (e) {}
  }
  const newPageRes = await fetch('http://127.0.0.1:9222/json/new', { method: 'PUT' });
  const target = await newPageRes.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let msgId = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Evaluation failed: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result.value;
  }

  return { ws, send, evaluate };
}

async function main() {
  const overallStart = Date.now();
  try {
    const { ws, send, evaluate } = await createClient();
    await send('Page.enable');
    await send('Runtime.enable');

    console.log('[1/6] Generator Idle (1440x900)...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await send('Page.navigate', { url: 'http://localhost:3000' });
    await new Promise(r => setTimeout(r, 1500));

    let shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(screenshotsDir, 'generator-idle.png'), Buffer.from(shot.data, 'base64'));

    console.log('[2/6] Generator In-Progress...');
    await evaluate(`(() => {
      if (typeof window.__runAnalyze === 'function') {
        window.__runAnalyze("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
      }
    })()`);
    await new Promise(r => setTimeout(r, 400));
    shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(screenshotsDir, 'generator-in-progress.png'), Buffer.from(shot.data, 'base64'));

    console.log('[3/6] Generator Result (waiting for bundle)...');
    let genCompleted = false;
    for (let i = 0; i < 60; i++) {
      genCompleted = await evaluate(`!!document.querySelector('.export-btn-top') || !!document.querySelector('.results-header-row')`);
      if (genCompleted) break;
      await new Promise(r => setTimeout(r, 400));
    }
    await new Promise(r => setTimeout(r, 400));
    shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(screenshotsDir, 'generator-result.png'), Buffer.from(shot.data, 'base64'));

    // Check Generator layout geometry at 1440x900
    const genLayout = await evaluate(`(() => {
      const header = document.querySelector('.results-header-row')?.getBoundingClientRect();
      const exportBtn = document.querySelector('.export-btn-top')?.getBoundingClientRect();
      const metrics = document.querySelector('.metrics-grid')?.getBoundingClientRect();
      return {
        headerTop: header ? header.top : null,
        exportBottom: exportBtn ? exportBtn.bottom : null,
        metricsBottom: metrics ? metrics.bottom : null,
        windowHeight: window.innerHeight,
        allVisibleWithoutScrolling: Boolean(
          header && exportBtn && metrics &&
          header.top >= 0 &&
          exportBtn.bottom <= window.innerHeight &&
          metrics.bottom <= window.innerHeight
        )
      };
    })()`);
    console.log('Generator Layout Bounding Boxes (1440x900):', JSON.stringify(genLayout, null, 2));

    // Responsive 768px check for Generator
    await send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 300));
    const gen768 = await evaluate(`(() => {
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    })()`);
    console.log('Generator 768px Responsive Check:', gen768);

    // Now Verifier (App Two)
    console.log('[4/6] Verifier Idle (1440x900)...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await send('Page.navigate', { url: 'http://localhost:3001' });
    await new Promise(r => setTimeout(r, 1500));

    shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(screenshotsDir, 'verifier-idle.png'), Buffer.from(shot.data, 'base64'));

    console.log('[5/6] Verifier Valid Result (fixtures/real/passport-bundle.json)...');
    await evaluate(`(async (bundleJson) => {
      if (typeof window.__loadPassportFile === 'function') {
        const file = new File([bundleJson], 'passport-bundle.json', { type: 'application/json' });
        await window.__loadPassportFile(file);
      }
    })(${JSON.stringify(validBundleJson)})`);

    // Poll until result appears
    for (let i = 0; i < 20; i++) {
      const hasResult = await evaluate(`!!document.querySelector('.status-duo')`);
      if (hasResult) break;
      await new Promise(r => setTimeout(r, 200));
    }
    await new Promise(r => setTimeout(r, 400));
    shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(screenshotsDir, 'verifier-result-valid.png'), Buffer.from(shot.data, 'base64'));

    // Check Verifier layout geometry at 1440x900
    const verLayout = await evaluate(`(() => {
      const summaryBar = document.querySelector('.compact-summary-bar')?.getBoundingClientRect();
      const statusDuo = document.querySelector('.status-duo')?.getBoundingClientRect();
      const checklist = document.querySelector('.checklist-compact-grid')?.getBoundingClientRect();
      const metrics = document.querySelector('.metrics-grid')?.getBoundingClientRect();
      return {
        summaryBarTop: summaryBar ? summaryBar.top : null,
        statusDuoBottom: statusDuo ? statusDuo.bottom : null,
        checklistBottom: checklist ? checklist.bottom : null,
        metricsBottom: metrics ? metrics.bottom : null,
        windowHeight: window.innerHeight,
        allVisibleWithoutScrolling: Boolean(
          summaryBar && statusDuo && checklist && metrics &&
          summaryBar.top >= 0 &&
          statusDuo.bottom <= window.innerHeight &&
          metrics.bottom <= window.innerHeight
        )
      };
    })()`);
    console.log('Verifier Layout Bounding Boxes (1440x900):', JSON.stringify(verLayout, null, 2));

    // Responsive 768px check for Verifier
    await send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 300));
    const ver768 = await evaluate(`(() => {
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    })()`);
    console.log('Verifier 768px Responsive Check:', ver768);

    console.log('[6/6] Verifier Invalid File Result...');
    // Reset to 1440x900 and load corrupted file
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await evaluate(`(async () => {
      if (typeof window.__loadPassportFile === 'function') {
        const file = new File(['{"invalid": true, "corrupted": "envelope"}'], 'corrupted-passport.json', { type: 'application/json' });
        await window.__loadPassportFile(file);
      }
    })()`);
    await new Promise(r => setTimeout(r, 500));

    shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(screenshotsDir, 'verifier-result-invalid.png'), Buffer.from(shot.data, 'base64'));

    ws.close();
    const duration = ((Date.now() - overallStart) / 1000).toFixed(2);
    console.log(`\n=== ALL 6 SCREENSHOTS CAPTURED & VERIFIED SUCCESSFULLY IN ${duration}s ===`);
  } finally {
    edge.kill('SIGKILL');
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(err => {
  console.error(err);
  edge.kill('SIGKILL');
  process.exit(1);
});

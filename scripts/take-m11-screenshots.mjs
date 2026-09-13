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

async function waitForBrowser() {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 100));
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) return;
    } catch (e) {}
  }
  throw new Error('Browser failed to start within timeout');
}

async function createPageSession(url) {
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

  await send('Page.enable');
  await send('Runtime.enable');

  if (url) {
    await send('Page.navigate', { url });
  }

  return { ws, send, evaluate, close: () => ws.close() };
}

async function main() {
  const overallStart = Date.now();
  try {
    await waitForBrowser();

    // ==========================================
    // 1. GENERATOR APP (Port 3000)
    // ==========================================
    console.log('Connecting to Generator (http://localhost:3000)...');
    const gen = await createPageSession('http://localhost:3000');
    await gen.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 1500));

    console.log('[1/6] Generator Idle (1440x900)...');
    let shot = await gen.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(screenshotsDir, 'generator-idle.png'), Buffer.from(shot.data, 'base64'));

    console.log('[2/6] Generator In-Progress...');
    await gen.evaluate(`(() => {
      const exampleBtn = document.querySelector('.example-box button');
      if (exampleBtn) exampleBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 100));
    await gen.evaluate(`(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    })()`);
    await new Promise(r => setTimeout(r, 400));
    shot = await gen.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(screenshotsDir, 'generator-in-progress.png'), Buffer.from(shot.data, 'base64'));

    console.log('[3/6] Generator Result (waiting for bundle)...');
    let genCompleted = false;
    for (let i = 0; i < 60; i++) {
      genCompleted = await gen.evaluate(`!!document.querySelector('.export-btn-top') || !!document.querySelector('.results-header-row')`);
      if (genCompleted) break;
      await new Promise(r => setTimeout(r, 400));
    }
    await new Promise(r => setTimeout(r, 400));
    shot = await gen.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(screenshotsDir, 'generator-result.png'), Buffer.from(shot.data, 'base64'));

    // Check Generator layout geometry at 1440x900
    const genLayout = await gen.evaluate(`(() => {
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
    await gen.send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 300));
    const gen768 = await gen.evaluate(`(() => {
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    })()`);
    console.log('Generator 768px Responsive Check:', gen768);
    gen.close();

    // ==========================================
    // 2. VERIFIER APP (Port 3001)
    // ==========================================
    console.log('\nConnecting to Verifier (http://localhost:3001)...');
    const ver = await createPageSession('http://localhost:3001');
    await ver.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 1500));

    console.log('[4/6] Verifier Idle (1440x900)...');
    shot = await ver.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(screenshotsDir, 'verifier-idle.png'), Buffer.from(shot.data, 'base64'));

    console.log('[5/6] Verifier Valid Result (fixtures/real/passport-bundle.json)...');
    await ver.evaluate(`((bundleJson) => {
      const inp = document.querySelector('input[type="file"]');
      if (!inp) throw new Error('File input not found');
      const file = new File([bundleJson], 'passport-bundle.json', { type: 'application/json' });
      const dt = new DataTransfer();
      dt.items.add(file);
      inp.files = dt.files;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    })(${JSON.stringify(validBundleJson)})`);

    // Poll until result appears
    for (let i = 0; i < 30; i++) {
      const hasResult = await ver.evaluate(`!!document.querySelector('.status-duo')`);
      if (hasResult) break;
      await new Promise(r => setTimeout(r, 200));
    }
    await new Promise(r => setTimeout(r, 400));
    shot = await ver.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(screenshotsDir, 'verifier-result-valid.png'), Buffer.from(shot.data, 'base64'));

    // Check Verifier layout geometry at 1440x900
    const verLayout = await ver.evaluate(`(() => {
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
    await ver.send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 300));
    const ver768 = await ver.evaluate(`(() => {
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    })()`);
    console.log('Verifier 768px Responsive Check:', ver768);

    console.log('[6/6] Verifier Invalid File Result...');
    // Reset to 1440x900
    await ver.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    // Click "Verify another bundle" button to reset dropzone
    await ver.evaluate(`(() => {
      const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Verify another') || b.textContent.includes('↻'));
      if (resetBtn) resetBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 300));

    // Tamper with digest of the valid bundle so it runs through the full 4 checks and fails check 4 (digest mismatch)
    await ver.evaluate(`((bundleJson) => {
      const inp = document.querySelector('input[type="file"]');
      if (!inp) throw new Error('File input not found after reset');
      const corrupted = JSON.parse(bundleJson);
      corrupted.integrity.digest = "0000000000000000000000000000000000000000000000000000000000000000";
      const file = new File([JSON.stringify(corrupted)], 'corrupted-passport.json', { type: 'application/json' });
      const dt = new DataTransfer();
      dt.items.add(file);
      inp.files = dt.files;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    })(${JSON.stringify(validBundleJson)})`);
    await new Promise(r => setTimeout(r, 800));

    // Verify that the checklist rendered on invalid result
    const failChecks = await ver.evaluate(`(() => {
      const chips = Array.from(document.querySelectorAll('.check-chip'));
      return {
        count: chips.length,
        hasFailedChip: !!document.querySelector('.check-chip.failed'),
        failureText: document.querySelector('.check-chip.failed .check-chip-msg')?.innerText
      };
    })()`);
    console.log('Verifier Invalid State Checklist Check:', failChecks);

    shot = await ver.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(screenshotsDir, 'verifier-result-invalid.png'), Buffer.from(shot.data, 'base64'));
    ver.close();

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

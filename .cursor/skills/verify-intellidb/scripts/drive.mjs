#!/usr/bin/env node
// CDP driver for the IntelliDB Electron renderer.
// Usage:
//   node drive.mjs eval "<js expression>"
//   node drive.mjs click "<css selector>"        (real mouse events — required for Radix)
//   node $D fill "<css selector>" "<text>"       (React-safe value set)
//   node drive.mjs screenshot "<file>.png"
//   node drive.mjs pick                          (dump interactive elements)
// Env: INTELLIDB_CDP_PORT (default 9222)

const PORT = process.env.INTELLIDB_CDP_PORT || '9222';

async function findPageWsUrl() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const targets = await res.json();
  const pages = targets.filter((t) => t.type === 'page' && !t.url.startsWith('devtools'));
  if (pages.length === 0) {
    throw new Error(`no page target on :${PORT}. Targets: ${JSON.stringify(targets.map((t) => ({ type: t.type, url: t.url })))}`);
  }
  return pages[0].webSocketDebuggerUrl;
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let nextId = 1;
    ws.onopen = () => resolve({
      send(method, params = {}) {
        const id = nextId++;
        return new Promise((res, rej) => {
          pending.set(id, { res, rej });
          ws.send(JSON.stringify({ id, method, params }));
        });
      },
      close: () => ws.close(),
    });
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(`${msg.error.message} (code ${msg.error.code})`)) : res(msg.result);
      }
    };
    ws.onerror = (e) => reject(new Error(`WebSocket error: ${e.message || e}`));
  });
}

async function withPage(fn) {
  const wsUrl = await findPageWsUrl();
  const page = await connect(wsUrl);
  try {
    return await fn(page);
  } finally {
    page.close();
  }
}

async function evalIn(page, expression) {
  const result = await page.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const desc = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
    throw new Error(`eval failed: ${desc}`);
  }
  return result.result.value;
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) {
    console.error('usage: drive.mjs eval|click|fill|screenshot|pick ...');
    process.exit(2);
  }

  if (cmd === 'eval') {
    const [expression] = args;
    if (!expression) fail('eval needs an expression');
    const value = await withPage((page) => evalIn(page, expression));
    print(value);
    return;
  }

  if (cmd === 'screenshot') {
    const [outPath] = args;
    if (!outPath) fail('screenshot needs an output path');
    await withPage(async (page) => {
      await page.send('Page.enable');
      await page.send('Page.bringToFront');
      const shot = await page.send('Page.captureScreenshot', { format: 'png' });
      const { writeFileSync } = await import('node:fs');
      writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
      console.log(`saved ${outPath}`);
    });
    return;
  }

  if (cmd === 'hover') {
    const [selector] = args;
    if (!selector) fail('hover needs a css selector');
    await withPage(async (page) => {
      const rect = await evalIn(page, `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`);
      if (!rect) fail(`element not found: ${selector}`);
      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y });
      console.log(`hovered ${selector} at (${rect.x}, ${rect.y})`);
    });
    return;
  }

  if (cmd === 'click') {
    const [selector] = args;
    if (!selector) fail('click needs a css selector');
    await withPage(async (page) => {
      // scroll into view and get viewport coords
      const rect = await evalIn(page, `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`);
      if (!rect) fail(`element not found: ${selector}`);
      await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
      await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
      console.log(`clicked ${selector} at (${rect.x}, ${rect.y})`);
    });
    return;
  }

  if (cmd === 'rightclick') {
    const [selector] = args;
    if (!selector) fail('rightclick needs a css selector');
    await withPage(async (page) => {
      const rect = await evalIn(page, `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`);
      if (!rect) fail(`element not found: ${selector}`);
      await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'right', clickCount: 1 });
      await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'right', clickCount: 1 });
      console.log(`right-clicked ${selector} at (${rect.x}, ${rect.y})`);
    });
    return;
  }

  if (cmd === 'fill') {
    const [selector, text] = args;
    if (!selector || text === undefined) fail('fill needs a selector and text');
    await withPage(async (page) => {
      await evalIn(page, `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error('element not found: ${selector.replace(/'/g, "\\'")}');
        el.focus();
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(text)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.blur();
        return el.value;
      })()`);
      console.log(`filled ${selector}`);
    });
    return;
  }

  if (cmd === 'pick') {
    const dump = await withPage((page) => evalIn(page, `(() => {
      const els = document.querySelectorAll('button, a, input, select, textarea, [role="menuitem"], [role="checkbox"], [aria-label]');
      return [...els].slice(0, 80).map((el) => ({
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        ariaLabel: el.getAttribute('aria-label') || undefined,
        role: el.getAttribute('role') || undefined,
        type: el.getAttribute('type') || undefined,
        text: (el.textContent || '').trim().slice(0, 60) || undefined,
      })).filter((e) => e.id || e.ariaLabel || e.text);
    })()`));
    for (const el of dump) {
      console.log(`${el.tag}${el.id ? `#${el.id}` : ''}${el.ariaLabel ? `[aria-label="${el.ariaLabel}"]` : ''}${el.role ? `[role=${el.role}]` : ''}${el.type ? `[type=${el.type}]` : ''} ${el.text ? `— "${el.text}"` : ''}`);
    }
    return;
  }

  fail(`unknown command: ${cmd}`);
}

function print(value) {
  if (value === undefined) console.log('undefined');
  else if (typeof value === 'string') console.log(value);
  else console.log(JSON.stringify(value, null, 2));
}

function fail(message) {
  console.error(`drive: ${message}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(`drive: ${err.message}`);
  process.exit(1);
});

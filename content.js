/*
 * SN Case Layout (IDCI)
 * Improves the layout of ticket forms in the ServiceNow Service Operations Workspace:
 *  - Hide "Description (HTML)" on the left and show it as a readable card at the bottom of the activity stream
 *  - Hide "Additional comments" / "Work notes" on the left
 *  - Depending on the ticket type, move sections or single fields into custom tabs in the centre
 *    (configured in CFG.layouts)
 *  - Hide the "Email" tab
 *  - Initial width of the left pane and pre-selected activity filter
 *  - Keep the required workspace preferences (ribbon, sidebar, activity expansion, lazy loading)
 *    and optionally the English UI language
 *  - Optional dark theme (toggled by clicking the extension icon)
 *
 * Runs in the MAIN world (access to component properties such as .value / .table).
 */
(() => {
  'use strict';
  if (window.__sowCaseLayout) return;
  window.__sowCaseLayout = true;

  const CFG = {
    descField: 'u_description_html',
    // always hide on the left (if present)
    hideFields: ['u_description_html', 'comments', 'work_notes'],
    hideComposeTabs: ['email'],
    descTitle: 'Customer request (Description)',
    interval: 700,
    // Defaults – can be overridden per user in the extension popup (stored in chrome.storage.sync,
    // passed in by bridge.js via <html data-sowcl-config>)
    // Initial width of the left form pane in px (applied once per record page; still resizable; 0 = off)
    leftPaneWidth: 360,
    // Post types pre-selected in the activity stream filter (applied once per record page)
    activityFilter: true,
    activityPostTypes: ['Additional comments', 'Attachments', 'Relationship changes', 'Work notes'],
    // Workspace user preferences (profile picture → Preferences → Workspace) the layout relies on.
    // Checked once per page load and corrected via ServiceNow's own setPreference API (own preferences only).
    enforcePrefs: true,
    // The layout matches English labels (sections, post types) → optionally enforce English UI language
    enforceEnglish: true,
    workspacePrefs: {
      'workspace.showRibbon': 'true', // Show the ribbon
      'workspace.showAgentAssist': 'false', // Show the sidebar
      'activity.expand_by_default': 'true', // Expand activity stream items by default
      'workspace.lazyLoading.enabled': 'false', // Lazy load workspace pages
    },
    /*
     * Per table (see URL /now/sow/record/<table>/…):
     *   tabs:          additional tabs in the centre; per tab "sections" (headings as RegExp)
     *                  and/or "fields" (field names) – these are moved from the left into the tab
     *   replaceNative: true = hide the native input in the centre (e.g. email composer),
     *                  only the custom tabs are shown
     *   hideFields:    additional fields to hide on the left
     */
    layouts: {
      sn_customerservice_unibe_case: {
        tabs: [{ label: 'Closure', sections: [/^closure information$/i] }],
      },
      incident: {
        tabs: [{ label: 'Resolution', sections: [/^cause$/i, /^resolution$/i] }],
      },
      problem: {
        tabs: [{ label: 'Analysis & Resolution', sections: [/^analysis information$/i, /^resolution information$/i] }],
      },
      sc_request: {
        tabs: [],
      },
      u_id_task: {
        replaceNative: true,
        tabs: [
          { label: 'Additional comments', fields: ['u_comments_html'] },
          { label: 'Work notes', fields: ['u_work_notes_html'] },
          { label: 'Resolution', sections: [/^resolution information$/i] },
        ],
      },
    },
  };

  const STYLE_ID = 'ext-sowcl-style';

  /* ---------- Helpers ---------- */

  // All elements matching selector – including (nested) shadow roots
  function deepQueryAll(selector, root = document, out = []) {
    root.querySelectorAll(selector).forEach((e) => out.push(e));
    root.querySelectorAll('*').forEach((e) => {
      if (e.shadowRoot) deepQueryAll(selector, e.shadowRoot, out);
    });
    return out;
  }

  function ensureStyle(root, css, id = STYLE_ID) {
    if (!root) return;
    let s = root.getElementById ? root.getElementById(id) : root.querySelector('#' + id);
    if (!s) {
      s = document.createElement('style');
      s.id = id;
      root.appendChild(s);
    }
    if (s.textContent !== css) s.textContent = css;
  }

  // Minimal sanitizer for displaying the description HTML
  function sanitize(html) {
    const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
    doc.querySelectorAll('script,iframe,object,embed,link,meta,base,form').forEach((n) => n.remove());
    doc.querySelectorAll('*').forEach((n) => {
      [...n.attributes].forEach((a) => {
        const name = a.name.toLowerCase();
        const val = (a.value || '').trim().toLowerCase();
        if (name.startsWith('on')) n.removeAttribute(a.name);
        else if ((name === 'href' || name === 'src' || name === 'xlink:href') && val.startsWith('javascript:')) n.removeAttribute(a.name);
      });
      if (n.tagName === 'A') {
        n.setAttribute('target', '_blank');
        n.setAttribute('rel', 'noopener noreferrer');
      }
    });
    return doc.body.firstElementChild.innerHTML;
  }

  // snabbdom/Seismic keeps patching elements after they have been moved. To prevent a later
  // removeChild/insertBefore on the original parent from throwing, these are made tolerant.
  function makeParentTolerant(parent) {
    if (!parent || parent.__sowclTolerant) return;
    parent.__sowclTolerant = true;
    const origRemove = parent.removeChild;
    const origInsert = parent.insertBefore;
    parent.removeChild = function (child) {
      if (child && child.parentNode !== this) {
        if (child.parentNode) child.parentNode.removeChild(child);
        return child;
      }
      return origRemove.call(this, child);
    };
    parent.insertBefore = function (node, ref) {
      if (ref && ref.parentNode !== this) ref = null;
      return origInsert.call(this, node, ref);
    };
  }


  /* ---------- CSS ---------- */

  const COMPOSE_CSS = `
    .input-options { position: relative; }
    .ext-sowcl-tabs { display: flex; gap: 24px; align-items: flex-start; z-index: 1; }
    .ext-sowcl-tabs.-overlay { position: absolute; top: 0; left: 0; }
    .ext-sowcl-tabs.-standalone { grid-column: 1 / 2; padding-bottom: 4px; }
    .ext-sowcl-tab {
      background: none; border: 0; cursor: pointer; position: relative;
      font: inherit; font-family: Lato, Arial, sans-serif; font-size: 16px;
      color: rgb(var(--now-color_text--primary, 16, 23, 26)); height: 32px; padding: 0; margin: 0;
      white-space: nowrap;
    }
    .ext-sowcl-tab:hover,
    .ext-sowcl-tab.is-active { color: rgb(var(--now-color_selection--primary-2, 45, 117, 36)); }
    .ext-sowcl-tab.is-active::after {
      content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 2px;
      background: rgb(var(--now-color_selection--primary-2, 45, 117, 36));
    }
    .ext-sowcl-panel { display: none; padding: 8px 0 12px; }
    .ext-sowcl-panel.is-active { display: block; }
    .ext-sowcl-active .input-wrapper > .input-control { display: none !important; }
    /* Stacked compose view (no native tabs): our tab bar switches between native inputs and panels */
    .ext-sowcl-stacked .input-wrapper > .input-control:not(.ext-sowcl-show) { display: none !important; }
    .ext-sowcl-stacked .input-wrapper > .input-control.ext-sowcl-show { display: block !important; }
    .ext-sowcl-tab .req { color: rgb(var(--now-color_alert--critical-3, 182, 28, 45)); margin-left: 2px; }
    .ext-sowcl-hide-email .input-wrapper > .input-control:has(now-email-client-mini-composer-connected) { display: none !important; }

    /* Recreate the layout of moved form sections/fields */
    .ext-sowcl-panel .sn-section { margin: 0 0 16px; }
    .ext-sowcl-panel .heading-level { margin: 0 0 8px; font-size: 1rem; font-weight: 600; }
    .ext-sowcl-panel .sn-section-header { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
    .ext-sowcl-panel .sn-section-form-row { display: flex; flex-wrap: wrap; gap: 0 24px; }
    .ext-sowcl-panel .sn-section-form-column { flex: 1 1 260px; min-width: 0; }
    .ext-sowcl-panel .sn-section-form-column > *,
    .ext-sowcl-panel > [name] { display: block; margin-bottom: 12px; }
  `;

  const TABS_CSS = (hidden) => `
    ${hidden.map((id) => `button.now-tab[data-itemid="${id}"]`).join(',')} { display: none !important; }
    :host(.ext-sowcl-active) .now-tab.is-selected { color: rgb(var(--now-color_text--primary, 16, 23, 26)) !important; }
    :host(.ext-sowcl-active) .now-tab.is-selected::after { background: transparent !important; }
  `;

  const ACTIVITY_CSS = `
    .ext-sowcl-desc {
      margin: 16px 16px 24px; border: 1px solid rgb(var(--now-color_border--secondary, 205, 211, 214)); border-radius: 8px;
      background: rgb(var(--now-color_background--primary, 255, 255, 255)); box-shadow: 0 1px 2px rgba(0,0,0,.06);
    }
    .ext-sowcl-desc > header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; border-bottom: 1px solid rgb(var(--now-color_border--tertiary, 225, 229, 231));
      font-family: Lato, Arial, sans-serif; font-weight: 700; font-size: 15px; color: rgb(var(--now-color_text--primary, 16, 23, 26));
      cursor: pointer; user-select: none;
    }
    .ext-sowcl-desc > header .chev { transition: transform .15s; font-size: 12px; }
    .ext-sowcl-desc.collapsed > header .chev { transform: rotate(-90deg); }
    .ext-sowcl-desc.collapsed > .body { display: none; }
    .ext-sowcl-desc > .body {
      padding: 12px 14px; overflow-x: auto; font-size: 14px; line-height: 1.5;
      color: rgb(var(--now-color_text--primary, 16, 23, 26)); word-break: break-word;
    }
    .ext-sowcl-desc > .body img { max-width: 100%; height: auto; }
    .ext-sowcl-desc > .body table { border-collapse: collapse; max-width: 100%; }
    .ext-sowcl-desc > .body .empty { color: rgb(var(--now-color_text--tertiary, 110, 118, 122)); font-style: italic; }
    :host-context(html[data-sowcl-dark]) .ext-sowcl-desc > .body * { color: inherit !important; background-color: transparent !important; }
  `;


  /* ---------- Main logic per record page ---------- */

  const FIELD_SEL = '.sn-section-form-column > [name]';

  const sectionTitle = (sec) => {
    const h = sec.querySelector('.sn-section-header');
    return h ? (h.textContent || '').trim() : '';
  };

  const isShown = (el) => getComputedStyle(el).display !== 'none';

  // Pick the layout by the form's table (fallback: URL, then existing sections)
  function resolveLayout(form) {
    const table = typeof form.table === 'string' ? form.table : '';
    if (CFG.layouts[table]) return CFG.layouts[table];
    const m = location.pathname.match(/\/record\/([^/]+)\//);
    if (m && form.offsetParent && CFG.layouts[m[1]]) return CFG.layouts[m[1]];
    const titles = [...form.shadowRoot.querySelectorAll('section.sn-section')].map(sectionTitle);
    return Object.values(CFG.layouts).find((l) =>
      (l.tabs || []).some((t) => (t.sections || []).some((re) => titles.some((ti) => re.test(ti))))) || null;
  }

  function processForm(form) {
    const fsr = form.shadowRoot;
    if (!fsr || !fsr.querySelector('.sn-form-column-layout-sections')) return;
    const layout = resolveLayout(form) || { tabs: [] };

    const container =
      form.closest('now-resizable-panes#item-details_resizable_panes') ||
      form.closest('now-resizable-panes') ||
      form.parentElement;
    if (!container) return;

    // 1) Hide fields on the left
    [...CFG.hideFields, ...(layout.hideFields || [])].forEach((n) => {
      const el = fsr.querySelector(`${FIELD_SEL.replace('[name]', `[name="${n}"]`)}`);
      if (!el) return;
      const row = el.closest('.sn-section-form-row');
      if (row) row.__sowclTouched = true;
      if (el.style.display !== 'none') el.style.setProperty('display', 'none', 'important');
    });

    // 2) Description card in the activity stream (only if the field exists)
    const descEl = fsr.querySelector(`[name="${CFG.descField}"]`);
    const activity = container.querySelector('now-activity-stream-connected');
    if (descEl && activity && activity.shadowRoot) renderDescription(activity.shadowRoot, descEl);

    // 3) Tabs in the centre
    const compose = container.querySelector('now-activity-stream-compose-connected');
    if (compose && compose.shadowRoot) setupTabs(compose.shadowRoot, fsr, layout);

    // 4) Collapse empty rows/sections on the left
    tidyForm(fsr);

    // 5) Assignee badge in the header (with "Assign to me")
    renderAssignee(form, fsr);

    // 6) Initial pane width and activity filter (once per record page)
    initPaneWidth(container);
    if (activity && activity.shadowRoot) initActivityFilter(activity);
  }

  // User settings from the popup (fallback: CFG defaults). The raw string doubles as a version
  // marker: when the settings change, width and filter are applied again to open records.
  function userConfig() {
    const raw = document.documentElement.getAttribute('data-sowcl-config') || '';
    if (userConfig.raw !== raw) {
      userConfig.raw = raw;
      let c = {};
      try { c = raw ? JSON.parse(raw) : {}; } catch (e) { c = {}; }
      userConfig.value = {
        paneWidth: Number.isFinite(c.paneWidth) ? c.paneWidth : CFG.leftPaneWidth,
        filterEnabled: typeof c.filterEnabled === 'boolean' ? c.filterEnabled : CFG.activityFilter,
        postTypes: Array.isArray(c.postTypes) ? c.postTypes : CFG.activityPostTypes,
        enforcePrefs: typeof c.enforcePrefs === 'boolean' ? c.enforcePrefs : CFG.enforcePrefs,
        enforceEnglish: typeof c.enforceEnglish === 'boolean' ? c.enforceEnglish : CFG.enforceEnglish,
      };
    }
    return userConfig.value;
  }

  // Set the left pane to the configured width once; afterwards the user can resize it freely
  function initPaneWidth(panes) {
    const width = userConfig().paneWidth;
    if (!width || panes.__sowclSized === userConfig.raw || !panes.shadowRoot) return;
    const left = panes.shadowRoot.querySelector('.left-pane');
    const right = panes.shadowRoot.querySelector('.right-pane');
    const total = panes.getBoundingClientRect().width;
    if (!left || !right || !total) return; // not visible yet (background workspace tab)
    panes.__sowclSized = userConfig.raw;
    const divider = total - left.getBoundingClientRect().width - right.getBoundingClientRect().width;
    const rightPx = total - width - divider;
    if (rightPx < 275) return; // window too narrow – keep ServiceNow's default
    right.style.width = `${((rightPx / total) * 100).toFixed(4)}%`;
  }

  // Pre-select the configured post types once; one checkbox per tick so the stream can reload
  function initActivityFilter(activity) {
    const cfg = userConfig();
    if (!cfg.filterEnabled || activity.__sowclFiltered === userConfig.raw) return;
    const panel = activity.shadowRoot.querySelector('sn-pill-panel');
    const boxes = panel && panel.shadowRoot ? [...panel.shadowRoot.querySelectorAll('now-checkbox')] : [];
    if (!boxes.length || boxes.some((b) => !b.shadowRoot || !b.shadowRoot.querySelector('input'))) return;
    const wanted = cfg.postTypes.map((t) => String(t).toLowerCase());
    const next = boxes.find((b) => {
      const lab = b.shadowRoot.querySelector('label');
      const label = ((lab && lab.textContent) || '').trim().toLowerCase();
      return wanted.includes(label) !== !!b.checked;
    });
    if (next) next.shadowRoot.querySelector('input').click();
    else activity.__sowclFiltered = userConfig.raw;
  }

  // Rows with hidden/moved fields have a fixed min-height → remove it;
  // hide rows and sections without any visible field entirely
  function tidyForm(fsr) {
    const parent = fsr.querySelector('.sn-form-column-layout-sections');
    fsr.querySelectorAll('.sn-section-form-row').forEach((row) => {
      if (!row.__sowclTouched) return;
      if (row.style.minHeight !== '0px') row.style.setProperty('min-height', '0px', 'important');
      const visible = [...row.querySelectorAll(FIELD_SEL)].some(isShown);
      setHidden(row, !visible);
    });
    parent.querySelectorAll(':scope > section.sn-section').forEach((sec) => {
      if (!sec.querySelector('.sn-section-form-row[style*="min-height"]')) return; // untouched section
      const visible = [...sec.querySelectorAll(FIELD_SEL)].some(isShown);
      setHidden(sec, !visible);
    });
  }

  function setHidden(el, hidden) {
    const is = el.style.display === 'none';
    if (hidden && !is) el.style.setProperty('display', 'none', 'important');
    else if (!hidden && is) el.style.removeProperty('display');
  }

  function renderDescription(asr, descEl) {
    ensureStyle(asr, ACTIVITY_CSS);
    const host = asr.querySelector('.sn-as') || asr;
    let card = asr.querySelector('.ext-sowcl-desc');
    if (!card) {
      card = document.createElement('section');
      card.className = 'ext-sowcl-desc';
      card.innerHTML = `<header><span>${CFG.descTitle}</span><span class="chev">▼</span></header><div class="body"></div>`;
      card.querySelector('header').addEventListener('click', () => card.classList.toggle('collapsed'));
    }
    if (card.parentNode !== host || host.lastElementChild !== card) host.appendChild(card);

    const raw = typeof descEl.value === 'string' ? descEl.value : '';
    if (card.__raw !== raw) {
      card.__raw = raw;
      const body = card.querySelector('.body');
      body.innerHTML = raw.trim() ? sanitize(raw) : '<span class="empty">No description available.</span>';
    }
  }

  function setupTabs(csr, fsr, layout) {
    ensureStyle(csr, COMPOSE_CSS);
    const containerEl = csr.querySelector('.compose-container');
    const options = csr.querySelector('.input-options');
    const wrapper = csr.querySelector('.input-wrapper');
    if (!containerEl || !options || !wrapper) return;
    const nativeTabs = options.querySelector('now-tabs');
    if (nativeTabs && nativeTabs.shadowRoot) ensureStyle(nativeTabs.shadowRoot, TABS_CSS(CFG.hideComposeTabs));

    // Hide the email composer also in the stacked view (where there is no tab to hide)
    containerEl.classList.toggle('ext-sowcl-hide-email', CFG.hideComposeTabs.includes('email'));

    const tabs = layout.tabs || [];
    if (!tabs.length) return;
    // Modes: 'replace' = only custom tabs (e.g. ID task); 'tabs' = custom tabs next to the native ones;
    // 'stacked' = ServiceNow shows the compose inputs stacked without tabs (e.g. when a journal field
    // becomes mandatory after changing the service) → our tab bar takes over and switches between
    // the native inputs (work notes, comments) and the custom panels
    const mode = layout.replaceNative ? 'replace' : nativeTabs ? 'tabs' : 'stacked';
    if (csr.__sowclMode !== mode) {
      // ServiceNow re-renders the compose area when switching views and the centre pane jumps
      // down – scroll it back to the top (not on the very first render)
      if (csr.__sowclMode) keepCentreAtTop(csr.host);
      csr.__sowclMode = mode;
      csr.__sowclActive = mode === 'replace' ? 0 : null;
      csr.__sowclStackKey = null;
    }
    const replace = mode === 'replace';
    csr.__sowclReplace = replace;
    containerEl.classList.toggle('ext-sowcl-stacked', mode === 'stacked');

    // Tab bar
    let bar = options.querySelector(':scope > .ext-sowcl-tabs');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'ext-sowcl-tabs';
      bar.setAttribute('role', 'tablist');
      options.prepend(bar);
    }
    bar.classList.toggle('-overlay', mode === 'tabs');
    bar.classList.toggle('-standalone', mode !== 'tabs');
    if (mode === 'tabs' && bar.previousElementSibling !== nativeTabs) nativeTabs.insertAdjacentElement('afterend', bar);

    // Entries: in stacked mode first the native inputs (key n<i>), then the custom tabs (key c<i>).
    // "required" = the tab contains a mandatory field that is still empty.
    const entries = [];
    if (mode === 'stacked') {
      stackedInputs(wrapper).forEach((ctl, i) => {
        const f = ctl.querySelector('[name]');
        const name = f ? f.getAttribute('name') : '';
        entries.push({ key: `n${i}`, label: NATIVE_LABELS[name] || name || `Input ${i + 1}`, required: needsInput(ctl) });
      });
    }
    tabs.forEach((t, i) => {
      const panel = wrapper.querySelector(`:scope > .ext-sowcl-panel[data-idx="${i}"]`);
      entries.push({ key: `c${i}`, label: t.label, required: !!panel && needsInput(panel) });
    });

    // Jump to a tab as soon as it starts to require input (once per change, so the user can
    // still navigate away). In 'tabs' mode only custom tabs can be selected this way.
    const prev = csr.__sowclNeeds || {};
    const needs = {};
    entries.forEach((e) => { needs[e.key] = e.required; });
    csr.__sowclNeeds = needs;
    const jump = entries.find((e) => e.required && !prev[e.key]);
    if (jump && Object.keys(prev).length) keepCentreAtTop(csr.host);
    if (jump) {
      csr.__sowclStackKey = jump.key;
      csr.__sowclActive = jump.key[0] === 'c' ? Number(jump.key.slice(1)) : null;
    }
    const labels = entries.map((e) => `${e.key}:${e.label}:${e.required}`).join('|');
    if (bar.__labels !== labels) {
      bar.__labels = labels;
      bar.textContent = '';
      entries.forEach((e) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ext-sowcl-tab';
        b.setAttribute('role', 'tab');
        b.dataset.key = e.key;
        b.textContent = e.label;
        if (e.required) {
          const r = document.createElement('span');
          r.className = 'req';
          r.textContent = '*';
          r.title = 'Mandatory field still empty';
          b.appendChild(r);
        }
        b.addEventListener('click', () => {
          csr.__sowclStackKey = e.key;
          setActive(csr, e.key[0] === 'c' ? Number(e.key.slice(1)) : null);
        });
        bar.appendChild(b);
      });
    }
    if (mode === 'tabs') positionBar(options, nativeTabs, bar);

    // Click on a native tab → leave the custom tabs
    if (nativeTabs && !nativeTabs.__sowclBound) {
      nativeTabs.__sowclBound = true;
      nativeTabs.addEventListener('click', () => { if (!csr.__sowclReplace) setActive(csr, null); }, true);
    }

    // Panels
    const panels = tabs.map((t, i) => {
      let p = wrapper.querySelector(`:scope > .ext-sowcl-panel[data-idx="${i}"]`);
      if (!p) {
        p = document.createElement('div');
        p.className = 'ext-sowcl-panel';
        p.dataset.idx = String(i);
        p.setAttribute('role', 'tabpanel');
        wrapper.appendChild(p);
      }
      return p;
    });

    // Move sections/fields from the left into the panels (other sections stay on the left)
    const sectionsParent = fsr.querySelector('.sn-form-column-layout-sections');
    tabs.forEach((t, i) => {
      const panel = panels[i];
      if (t.sections && t.sections.length) {
        const move = [...sectionsParent.querySelectorAll(':scope > section.sn-section')]
          .filter((sec) => t.sections.some((re) => re.test(sectionTitle(sec))));
        if (move.length) {
          makeParentTolerant(sectionsParent);
          move.forEach((sec) => panel.appendChild(sec));
        }
        // Order as configured
        const rank = (sec) => t.sections.findIndex((re) => re.test(sectionTitle(sec)));
        const inPanel = [...panel.querySelectorAll(':scope > section.sn-section')];
        const sorted = [...inPanel].sort((a, b) => rank(a) - rank(b));
        if (sorted.some((sec, k) => sec !== inPanel[k])) sorted.forEach((sec) => panel.appendChild(sec));
      }
      (t.fields || []).forEach((name) => {
        const el = sectionsParent.querySelector(FIELD_SEL.replace('[name]', `[name="${name}"]`));
        if (!el) return;
        const col = el.parentElement;
        const row = el.closest('.sn-section-form-row');
        if (row) row.__sowclTouched = true;
        makeParentTolerant(col);
        panel.appendChild(el);
      });
    });

    // ServiceNow renders fields outside the visible form area lazily ("defer").
    // After moving, the form can no longer detect their visibility → force rendering.
    panels.forEach((p) => p.querySelectorAll('[name][defer]').forEach((f) => {
      f.removeAttribute('defer');
      try { f.defer = false; } catch (e) { /* ignore */ }
    }));

    applyActive(csr);
  }

  // Keep the centre pane scrolled to the top for a short moment (ServiceNow scrolls it down while
  // re-rendering). Stops as soon as the user scrolls or clicks.
  function keepCentreAtTop(compose) {
    const scroller = compose && compose.closest('now-stackable-side-by-side-panel');
    if (!scroller) return;
    let stop = false;
    const cancel = () => { stop = true; };
    scroller.addEventListener('wheel', cancel, { once: true, passive: true });
    scroller.addEventListener('pointerdown', cancel, { once: true });
    scroller.addEventListener('keydown', cancel, { once: true });
    const until = performance.now() + 2000;
    const step = () => {
      if (stop || performance.now() > until) return;
      if (scroller.scrollTop !== 0) scroller.scrollTop = 0;
      requestAnimationFrame(step);
    };
    step();
  }

  const NATIVE_LABELS = { work_notes: 'Work notes', comments: 'Additional comments' };

  // True if the element (or a field inside it) is a visible mandatory field without a value
  function needsInput(root) {
    const fields = root.matches && root.matches('[name]') ? [root] : [...root.querySelectorAll('[name]')];
    return fields.filter((f) => f.tagName.includes('-')).some((f) => {
      try {
        if (!(f.required === true || f.mandatory === true)) return false;
        if (f.visible === false || f.readonly === true || f.style.display === 'none') return false;
        return fieldIsEmpty(f);
      } catch (e) {
        return false;
      }
    });
  }

  function deepFind(root, selector) {
    if (!root) return null;
    const hit = root.querySelector(selector);
    if (hit) return hit;
    for (const el of root.querySelectorAll('*')) {
      const r = el.shadowRoot && deepFind(el.shadowRoot, selector);
      if (r) return r;
    }
    return null;
  }

  // Reads what the user actually sees in the field (the *-connected wrappers do not expose a value)
  function fieldIsEmpty(f) {
    const sr = f.shadowRoot;
    if (!sr) return false;
    const frame = deepFind(sr, 'iframe'); // rich-text editor (TinyMCE)
    if (frame) {
      try {
        const body = frame.contentDocument && frame.contentDocument.body;
        if (body) return !body.textContent.trim() && !body.querySelector('img,table');
      } catch (e) { /* cross-origin – fall through */ }
    }
    const select = deepFind(sr, 'now-select');
    if (select && select.shadowRoot) {
      const trigger = select.shadowRoot.querySelector('.now-select-trigger, button');
      const text = (trigger ? trigger.textContent : '').replace(/\([^)]*\)\s*$/, '').trim();
      return !text || /^--\s*none\s*--$/i.test(text);
    }
    const input = deepFind(sr, 'textarea, input:not([type="hidden"]):not([type="checkbox"])');
    if (input) return !String(input.value || '').trim();
    return false; // unknown field type – never force a jump
  }

  // Native compose inputs in the stacked view (without the hidden email composer)
  function stackedInputs(wrapper) {
    return [...wrapper.querySelectorAll(':scope > .input-control')]
      .filter((c) => !c.querySelector('now-email-client-mini-composer-connected'));
  }

  // Place the custom tab bar right next to the last visible native tab
  function positionBar(options, nativeTabs, bar) {
    const sr = nativeTabs.shadowRoot;
    if (!sr) return;
    const visible = [...sr.querySelectorAll('button.now-tab, [role="tab"]')]
      .filter((b) => b.offsetParent !== null && b.getBoundingClientRect().width > 0);
    if (!visible.length) return;
    const o = options.getBoundingClientRect();
    const left = Math.round(Math.max(...visible.map((b) => b.getBoundingClientRect().right)) - o.left + 24);
    const top = Math.round(visible[0].getBoundingClientRect().top - o.top);
    if (bar.style.left !== left + 'px') bar.style.left = left + 'px';
    if (bar.style.top !== top + 'px') bar.style.top = top + 'px';
  }

  // idx = index of the custom tab, or null for the native input
  function setActive(csr, idx) {
    csr.__sowclActive = idx;
    applyActive(csr);
  }

  // State is kept on the shadow root because the framework may rewrite class attributes
  function applyActive(csr) {
    const idx = csr.__sowclActive == null ? null : csr.__sowclActive;
    const c = csr.querySelector('.compose-container');
    const nativeTabs = csr.querySelector('.input-options now-tabs');
    if (!c) return;
    const stacked = csr.__sowclMode === 'stacked';
    // active key: custom tab c<i>, or (stacked only) native input n<i>; default = first entry
    let key = idx !== null ? `c${idx}` : null;
    if (stacked) {
      key = csr.__sowclStackKey || key || 'n0';
      const wrapper = csr.querySelector('.input-wrapper');
      if (wrapper) stackedInputs(wrapper).forEach((ctl, i) => ctl.classList.toggle('ext-sowcl-show', key === `n${i}`));
    }
    const on = idx !== null && !stacked;
    c.classList.toggle('ext-sowcl-active', on);
    if (nativeTabs) nativeTabs.classList.toggle('ext-sowcl-active', on);
    csr.querySelectorAll('.ext-sowcl-tabs > .ext-sowcl-tab').forEach((b) => {
      const active = b.dataset.key === key;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', String(active));
    });
    csr.querySelectorAll('.input-wrapper > .ext-sowcl-panel').forEach((p) => {
      p.classList.toggle('is-active', Number(p.dataset.idx) === idx);
    });
  }

  /* ---------- Dark theme ----------
   * Next Experience defines all colours as RGB-triplet variables on :root (style#global-theme).
   * They apply across all shadow DOMs. For the dark theme, neutral colours are inverted in
   * lightness; accent and chrome colours are mapped to the Tailwind "cyan" palette.
   * Status colours (ok/warning/critical) remain unchanged.
   * Active as soon as <html data-sowcl-dark> is set (toggled via the extension icon).
   */
  const DARK_EXCLUDE = /chrome|unified-nav|polaris-header|navigator|toolbar-nav|canvas-toolbar/;
  const DARK_STYLE_ID = 'ext-sowcl-dark';
  let darkSig = '';

  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }

  function hsl2rgb(h, s, l) {
    if (!s) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((x) => Math.round(x * 255));
  }

  // Tailwind CSS – "cyan" colour palette
  const CYAN = {
    50: '236,254,255', 100: '207,250,254', 200: '165,243,252', 300: '103,232,249', 400: '34,211,238',
    500: '6,182,212', 600: '8,145,178', 700: '14,116,144', 800: '21,94,117', 900: '22,78,99', 950: '8,51,68',
  };
  // Status/data colours keep their meaning (green = ok, red = critical …)
  const STATUS = /positive|success|warning|critical|alert|moderate|destructive|error|info|presence|grouped|high|low|chart|viz|visuali|avatar|tag|badge|highlight/;
  // Fixed mapping for the "chrome" areas (header, workspace tabs, left navigation)
  const CHROME_FIXED = {
    '--now-unified-nav_header--background-color': CYAN[950],
    '--now-color_chrome--brand-10': CYAN[950],
    '--now-navigation-page_tabs_container--primary--background-color': CYAN[900],
    '--now-toolbar-nav--background-color-start': CYAN[950],
    '--now-toolbar-nav--background-color-middle': CYAN[950],
    '--now-toolbar-nav--background-color-end': CYAN[900],
    // left navigation bar (not defined in the theme, would otherwise fall back to inverted neutrals)
    '--now-canvas-toolbar-button--color': CYAN[200],
    '--now-canvas-toolbar-button--color--focus': CYAN[50],
    '--now-canvas-toolbar-button--background-color--hover': CYAN[800],
    '--now-canvas-toolbar-button--background-color--active': CYAN[700],
    '--now-canvas-toolbar-button--border-color--active': CYAN[300],
    '--now-canvas-toolbar-overflow-menu-background-color--hover': CYAN[800],
    '--now-canvas-toolbar-overflow-item--background-color--active': CYAN[700],
    '--now-canvas-toolbar-overflow-item--color--active': CYAN[50],
  };

  function isAccentForeground(name) {
    return /button|actionable/.test(name) && /primary|brand|positive|destructive|critical/.test(name) &&
      /--color/.test(name) && !/background|border|divider|shadow|fill|surface|backdrop|highlight/.test(name);
  }

  const isBgName = (n) => /background|-bg|fill|surface|gradient|border|divider|backdrop|shadow|start|middle|end$/.test(n);
  const isStateName = (n) => /hover|active|selected|opened|pinned|pressed|focus/.test(n);

  // Chrome areas: dark cyan backgrounds, light text/icons
  function chromeColor(name, s, l) {
    if (CHROME_FIXED[name]) return CHROME_FIXED[name];
    if (isBgName(name)) {
      if (isStateName(name)) return l > 0.6 ? CYAN[700] : CYAN[800];
      return l < 0.2 ? CYAN[950] : CYAN[900];
    }
    if (s < 0.3 && l > 0.7) return null; // white/light text stays
    return l > 0.5 ? CYAN[100] : CYAN[300];
  }

  // Accent colours (green/blue/teal) in the work area → cyan
  function accentColor(name, l) {
    if (/--color/.test(name) && !isBgName(name) && !/--now-color[_-]/.test(name)) {
      return l > 0.75 ? CYAN[200] : CYAN[400]; // text, links, active tabs: light & readable
    }
    if (l < 0.2) return CYAN[800];
    if (l < 0.45) return CYAN[600]; // buttons, pills (white text stays readable)
    if (l < 0.65) return CYAN[500];
    return CYAN[300];
  }

  function darkValue(name, rgb) {
    const [h, s, l] = rgb2hsl(...rgb);
    const hue = h * 360;
    if (DARK_EXCLUDE.test(name) || CHROME_FIXED[name]) return chromeColor(name, s, l);
    const accent = s > 0.3 && l > 0.2 && l < 0.8;
    if (accent) {
      if (STATUS.test(name)) return null;
      return hue >= 60 && hue <= 215 ? accentColor(name, l) : null;
    }
    if (isAccentForeground(name)) return null; // e.g. white text on a primary button
    // neutral colour: invert lightness, tint slightly towards cyan
    const [r, g, b] = hsl2rgb(s < 0.12 ? 190 / 360 : h, Math.min(s, 0.18), 0.08 + (1 - l) * 0.86);
    return `${r},${g},${b}`;
  }

  function buildDarkTheme() {
    const themeEl = document.getElementById('global-theme');
    const sheet = themeEl && themeEl.sheet;
    if (!sheet) return;
    let rule;
    try { rule = [...sheet.cssRules].find((r) => r.selectorText === ':root'); } catch (e) { return; }
    if (!rule) return;
    const sig = rule.style.length + ':' + rule.cssText.length;
    if (sig === darkSig && document.getElementById(DARK_STYLE_ID)) return;
    darkSig = sig;

    const decl = [];
    for (const name of rule.style) {
      const m = rule.style.getPropertyValue(name).trim().match(/^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/);
      if (!m) continue;
      const v = darkValue(name, [+m[1], +m[2], +m[3]]);
      if (v) decl.push(`${name}:${v}`);
    }
    // set fixed chrome colours even if the theme does not define the variable
    const seen = new Set(decl.map((d) => d.split(':')[0]));
    Object.entries(CHROME_FIXED).forEach(([n, v]) => { if (!seen.has(n)) decl.push(`${n}:${v}`); });
    let st = document.getElementById(DARK_STYLE_ID);
    if (!st) {
      st = document.createElement('style');
      st.id = DARK_STYLE_ID;
      document.head.appendChild(st);
    }
    st.textContent = `html[data-sowcl-dark]:root{color-scheme:dark;${decl.join(';')}}`;
  }

  // Rich-text editors (TinyMCE) run in iframes – the variables do not apply there
  function themeEditorIframes(dark) {
    const cs = getComputedStyle(document.documentElement);
    const bg = cs.getPropertyValue('--now-color_background--primary').trim() || '255,255,255';
    const fg = cs.getPropertyValue('--now-color_text--primary').trim() || '16,23,26';
    const css = `html,body{background:rgb(${bg}) !important;color:rgb(${fg}) !important;} a{color:rgb(34,211,238);}`;
    deepQueryAll('iframe').forEach((f) => {
      let doc;
      try { doc = f.contentDocument; } catch (e) { return; }
      if (!doc || !doc.head) return;
      let st = doc.getElementById(DARK_STYLE_ID);
      if (!dark) { if (st) st.remove(); return; }
      if (!st) {
        st = doc.createElement('style');
        st.id = DARK_STYLE_ID;
        doc.head.appendChild(st);
      }
      if (st.textContent !== css) st.textContent = css;
    });
  }

  function applyDark() {
    const dark = document.documentElement.hasAttribute('data-sowcl-dark');
    if (dark) buildDarkTheme();
    themeEditorIframes(dark);
  }

  /* ---------- Assignee badge ---------- */

  const ASSIGNEE_CSS = `
    .tabset-tabs { position: relative; }
    .ext-sowcl-assignee {
      position: absolute; right: 16px; top: 50%; transform: translateY(-50%); z-index: 2;
      display: flex; align-items: center; gap: 10px; max-width: 60%;
      padding: 3px 4px 3px 12px; border-radius: 999px;
      background: rgb(var(--now-color_background--secondary, 244, 245, 245));
      border: 1px solid rgb(var(--now-color_border--secondary, 205, 211, 214));
      font-family: Lato, Arial, sans-serif; font-size: 14px; color: rgb(var(--now-color_text--primary, 16, 23, 26));
      white-space: nowrap;
    }
    .ext-sowcl-assignee .lbl { color: rgb(var(--now-color_text--secondary, 82, 95, 102)); }
    .ext-sowcl-assignee .who { font-weight: 700; overflow: hidden; text-overflow: ellipsis; }
    .ext-sowcl-assignee .grp { color: rgb(var(--now-color_text--secondary, 82, 95, 102)); overflow: hidden; text-overflow: ellipsis; }
    .ext-sowcl-assignee.-none .who { color: rgb(var(--now-color_alert--warning-3, 184, 107, 0)); }
    .ext-sowcl-assignee.-me .who { color: rgb(var(--now-color_selection--primary-2, 45, 117, 36)); }
    .ext-sowcl-assignee button {
      font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; border-radius: 999px; padding: 3px 12px;
      border: 1px solid rgb(var(--now-color_selection--primary-2, 45, 117, 36));
      background: rgb(var(--now-color_selection--primary-2, 45, 117, 36)); color: #fff;
    }
    .ext-sowcl-assignee button[disabled] { opacity: .6; cursor: default; }
    .ext-sowcl-assignee button[hidden] { display: none; }
  `;

  function renderAssignee(form, fsr) {
    const assigned = fsr.querySelector('.sn-section-form-column > [name="assigned_to"]');
    const tabset = form.closest('now-uxf-tab-set');
    const bar = tabset && tabset.shadowRoot && tabset.shadowRoot.querySelector('.tabset-tabs');
    if (!assigned || !bar) return;
    ensureStyle(tabset.shadowRoot, ASSIGNEE_CSS);
    let badge = bar.querySelector(':scope > .ext-sowcl-assignee');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'ext-sowcl-assignee';
      badge.innerHTML = '<span class="lbl">Assigned to</span><span class="who"></span><span class="grp"></span><button type="button">Assign to me</button>';
      badge.querySelector('button').addEventListener('click', () => assignToMe(form, fsr, badge));
      bar.appendChild(badge);
    }
    const group = fsr.querySelector('.sn-section-form-column > [name="assignment_group"]');
    const me = window.NOW && window.NOW.user && window.NOW.user.userID;
    const value = assigned.value || '';
    const name = assigned.displayValue || '';
    const groupName = (group && group.displayValue) || '';
    const isMe = !!value && value === me;
    const who = badge.querySelector('.who');
    const grp = badge.querySelector('.grp');
    const btn = badge.querySelector('button');
    if (who.textContent !== (name || 'Unassigned')) who.textContent = name || 'Unassigned';
    const g = groupName ? `· ${groupName}` : '';
    if (grp.textContent !== g) grp.textContent = g;
    badge.classList.toggle('-none', !value);
    badge.classList.toggle('-me', isMe);
    btn.hidden = isMe || !me;
    if (!badge.__busy) btn.disabled = false;
  }

  // Assign the record to the current user via the Table API; the workspace picks up the change
  // through its record watcher. Warns if the user is not a member of the assignment group.
  async function assignToMe(form, fsr, badge) {
    const btn = badge.querySelector('button');
    const me = window.NOW && window.NOW.user && window.NOW.user.userID;
    const token = window.g_ck;
    const table = form.table;
    const sysId = form.sysId;
    if (!me || !token || !table || !sysId) return;
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json', 'X-UserToken': token };
    badge.__busy = true;
    btn.disabled = true;
    try {
      const group = fsr.querySelector('.sn-section-form-column > [name="assignment_group"]');
      const groupId = group && group.value;
      if (groupId) {
        const q = encodeURIComponent(`group=${groupId}^user=${me}`);
        const r = await fetch(`/api/now/table/sys_user_grmember?sysparm_limit=1&sysparm_fields=sys_id&sysparm_query=${q}`, { headers });
        const member = r.ok && ((await r.json()).result || []).length > 0;
        if (!member && !window.confirm(`You are not a member of the assignment group "${group.displayValue || ''}". Assign the ticket to yourself anyway?`)) return;
      }
      const res = await fetch(`/api/now/table/${encodeURIComponent(table)}/${encodeURIComponent(sysId)}?sysparm_fields=assigned_to`, {
        method: 'PATCH', headers, body: JSON.stringify({ assigned_to: me }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      btn.textContent = 'Assigned ✓';
      setTimeout(() => { btn.textContent = 'Assign to me'; }, 4000);
    } catch (e) {
      console.warn('[SN Case Layout] assign to me failed:', e);
      window.alert('Could not assign the ticket to you. Please use the "Assigned to" field instead.');
    } finally {
      badge.__busy = false;
      btn.disabled = false;
    }
  }

  /* ---------- Predefined "My lists" ---------- */

  // Requests come from the popup via bridge.js (window.postMessage). Only preset ids are accepted;
  // the list definitions themselves come from lists.js, never from the message.
  async function addMyLists(ids) {
    const presets = (window.SNCL_LISTS || []).filter((l) => ids.includes(l.id));
    const token = window.g_ck;
    if (!token) throw new Error('ServiceNow session not ready – reload the page and try again.');
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json', 'X-UserToken': token };
    const api = '/api/now/table/sys_ux_my_list';
    const q = encodeURIComponent('sys_created_by=javascript:gs.getUserName()');
    const res = await fetch(`${api}?sysparm_fields=title,table&sysparm_limit=500&sysparm_query=${q}`, { headers });
    if (!res.ok) throw new Error(`Could not read your lists (HTTP ${res.status}).`);
    const existing = (await res.json()).result || [];
    const results = {};
    for (const l of presets) {
      if (existing.some((e) => e.title === l.title && e.table === l.table)) { results[l.id] = 'exists'; continue; }
      // ServiceNow ignores the field values on insert, so: create an empty list, then set the
      // table first (the condition depends on it) and finally condition, columns and order.
      try {
        const created = await fetch(`${api}?sysparm_fields=sys_id`, { method: 'POST', headers, body: '{}' });
        if (!created.ok) throw new Error(`create ${created.status}`);
        const sysId = (await created.json()).result.sys_id;
        const patch = async (body) => {
          const r = await fetch(`${api}/${sysId}?sysparm_fields=title,table,condition`, { method: 'PATCH', headers, body: JSON.stringify(body) });
          if (!r.ok) throw new Error(`update ${r.status}`);
          return (await r.json()).result;
        };
        await patch({ title: l.title, table: l.table, active: 'true' });
        const done = await patch({ condition: l.condition, columns: l.columns, order: String(l.order) });
        results[l.id] = done.table === l.table && done.condition === l.condition ? 'added' : 'incomplete';
      } catch (e) {
        results[l.id] = `error (${e.message})`;
      }
    }
    return results;
  }

  window.addEventListener('message', async (ev) => {
    const d = ev.data;
    if (ev.source !== window || !d || d.type !== 'sncl:add-lists' || !Array.isArray(d.ids)) return;
    let reply;
    try { reply = { ok: true, results: await addMyLists(d.ids.map(String)) }; } catch (e) { reply = { ok: false, error: e.message }; }
    window.postMessage({ type: 'sncl:add-lists:result', nonce: d.nonce, ...reply }, location.origin);
  });

  /* ---------- Workspace preferences ---------- */

  let prefsState = 'idle'; // idle → running → done

  const SET_PREF = 'mutation($name: String!, $value: String!) { GlideDomain_Mutation { user { ' +
    'setPreference(name: $name, value: $value) { name value } } } }';

  // Make sure the user's workspace preferences (and optionally the UI language) match the
  // recommended values. Runs once per page load; reads via the Table API and writes through
  // ServiceNow's own setPreference mutation (the same one the Preferences dialog uses).
  async function syncWorkspacePrefs() {
    if (prefsState !== 'idle') return;
    // wait until bridge.js has passed in the user's settings, so a disabled option is respected
    if (!document.documentElement.hasAttribute('data-sowcl-config')) return;
    const cfg = userConfig();
    const wanted = {
      ...(cfg.enforcePrefs ? CFG.workspacePrefs : {}),
      ...(cfg.enforceEnglish ? { 'user.language': 'en' } : {}),
    };
    if (!Object.keys(wanted).length) { prefsState = 'done'; return; }
    const token = window.g_ck;
    const userId = window.NOW && window.NOW.user && window.NOW.user.userID;
    if (!token || !userId) return; // session not ready yet – try again on the next tick
    prefsState = 'running';
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json', 'X-UserToken': token };
    const api = '/api/now/table/sys_user_preference';
    const names = Object.keys(wanted);
    let changed = 0;
    try {
      const q = `user=${userId}^nameIN${names.join(',')}`;
      const res = await fetch(`${api}?sysparm_fields=sys_id,name,value&sysparm_query=${encodeURIComponent(q)}`, { headers });
      if (!res.ok) throw new Error(`read ${res.status}`);
      const rows = (await res.json()).result || [];
      for (const name of names) {
        const row = rows.find((r) => r.name === name);
        if (row && row.value === wanted[name]) continue;
        const r = await fetch('/api/now/graphql', {
          method: 'POST',
          headers,
          body: JSON.stringify({ query: SET_PREF, variables: { name, value: wanted[name] } }),
        });
        const body = r.ok ? await r.json() : null;
        if (!body || body.errors) throw new Error(`write ${name} ${r.status}`);
        changed++;
      }
    } catch (e) {
      console.warn('[SN Case Layout] workspace preferences could not be updated:', e);
    }
    prefsState = 'done';
    if (changed) showReloadNotice();
  }

  function showReloadNotice() {
    if (document.getElementById('ext-sowcl-notice')) return;
    const n = document.createElement('div');
    n.id = 'ext-sowcl-notice';
    n.setAttribute('role', 'status');
    n.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;max-width:340px;padding:12px 14px;' +
      'border-radius:8px;background:#083344;color:#ecfeff;border:1px solid #155e75;box-shadow:0 6px 24px rgba(0,0,0,.35);' +
      'font:13px/1.4 Lato,Arial,sans-serif;display:flex;gap:12px;align-items:center;';
    n.innerHTML = '<span>SN Case Layout adjusted your ServiceNow preferences (workspace settings / language). Reload the page to apply them.</span>';
    const btn = (label, primary, fn) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = `font:inherit;cursor:pointer;border-radius:6px;padding:4px 10px;white-space:nowrap;border:1px solid ${primary ? '#0891b2' : '#155e75'};background:${primary ? '#0891b2' : 'transparent'};color:#ecfeff;`;
      b.addEventListener('click', fn);
      n.appendChild(b);
    };
    btn('Reload', true, () => location.reload());
    btn('Later', false, () => n.remove());
    document.body.appendChild(n);
  }

  /* ---------- Loop ---------- */

  function tick() {
    try {
      deepQueryAll('now-record-form-section-column-layout').forEach(processForm);
      syncWorkspacePrefs();
      applyDark();
    } catch (e) {
      console.warn('[SN Case Layout]', e);
    }
  }

  setInterval(tick, CFG.interval);
  tick();
  // React immediately when the dark theme is toggled
  new MutationObserver(applyDark).observe(document.documentElement, { attributes: true, attributeFilter: ['data-sowcl-dark'] });
})();

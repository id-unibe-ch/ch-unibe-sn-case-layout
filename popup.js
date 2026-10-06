// Settings popup (also used as the options page). Changes are saved immediately and
// applied to open ServiceNow tabs via chrome.storage.onChanged (see bridge.js).
const $ = (id) => document.getElementById(id);
const typesBox = $('postTypes');

SNCL_POST_TYPES.forEach((t) => {
  const l = document.createElement('label');
  l.innerHTML = '<input type="checkbox"><span></span>';
  l.querySelector('input').value = t;
  l.querySelector('span').textContent = t;
  typesBox.appendChild(l);
});
const typeInputs = () => [...typesBox.querySelectorAll('input')];

function render(s) {
  $('dark').checked = !!s.dark;
  $('descriptionAtBottom').checked = !!s.descriptionAtBottom;
  $('paneWidth').value = s.paneWidth;
  $('filterEnabled').checked = !!s.filterEnabled;
  $('enforcePrefs').checked = !!s.enforcePrefs;
  $('enforceEnglish').checked = !!s.enforceEnglish;
  typeInputs().forEach((i) => { i.checked = s.postTypes.includes(i.value); });
  updateState();
}

function updateState() {
  const on = $('filterEnabled').checked;
  const any = typeInputs().some((i) => i.checked);
  typesBox.classList.toggle('disabled', !on);
  const hint = $('filterHint');
  hint.classList.toggle('warn', on && !any);
  hint.textContent = on && !any ? 'Select at least one post type.' : 'Applied when a record opens.';
}

let timer;
function save() {
  updateState();
  const postTypes = typeInputs().filter((i) => i.checked).map((i) => i.value);
  const filterEnabled = $('filterEnabled').checked;
  if (filterEnabled && !postTypes.length) return; // don't save an empty filter
  let paneWidth = Math.round(Number($('paneWidth').value));
  if (!Number.isFinite(paneWidth) || paneWidth < 0) paneWidth = 0;
  chrome.storage.sync.set({ dark: $('dark').checked, descriptionAtBottom: $('descriptionAtBottom').checked, paneWidth, filterEnabled, postTypes, enforcePrefs: $('enforcePrefs').checked, enforceEnglish: $('enforceEnglish').checked }, () => {
    $('status').textContent = 'Saved';
    clearTimeout(timer);
    timer = setTimeout(() => { $('status').textContent = ''; }, 1500);
  });
}

document.addEventListener('change', save);
$('paneWidth').addEventListener('input', () => { clearTimeout(save.t); save.t = setTimeout(save, 400); });
$('reset').addEventListener('click', () => { render(SNCL_DEFAULTS); save(); });

chrome.storage.sync.get(SNCL_DEFAULTS, render);

// ---- Predefined lists ----
const listsBox = $('lists');
SNCL_LISTS.forEach((l) => {
  const lab = document.createElement('label');
  lab.innerHTML = '<input type="checkbox" checked><span></span><span class="state"></span>';
  lab.querySelector('input').value = l.id;
  lab.querySelector('span').textContent = l.title;
  listsBox.appendChild(lab);
});
// list checkboxes must not trigger the settings auto-save
listsBox.addEventListener('change', (e) => e.stopPropagation());

$('addLists').addEventListener('click', async () => {
  const boxes = [...listsBox.querySelectorAll('input')];
  const ids = boxes.filter((b) => b.checked).map((b) => b.value);
  const hint = $('listsHint');
  if (!ids.length) { hint.textContent = 'Select at least one list.'; return; }
  const btn = $('addLists');
  btn.disabled = true;
  hint.textContent = 'Adding…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'sncl:add-lists', ids });
    if (!res || !res.ok) throw new Error((res && res.error) || 'No answer');
    boxes.forEach((b) => {
      const st = b.parentElement.querySelector('.state');
      const r = res.results[b.value];
      if (!r) return;
      st.textContent = r === 'added' ? 'added' : r === 'exists' ? 'already there' : r;
      st.className = 'state ' + (r === 'added' || r === 'exists' ? 'ok' : 'err');
    });
    hint.textContent = 'Done. Reload the ServiceNow list page to see new lists.';
  } catch (e) {
    hint.textContent = /Receiving end does not exist|Could not establish/.test(e.message)
      ? 'Please open a ServiceNow workspace tab (serviceportal.unibe.ch) and try again.'
      : e.message;
  } finally {
    btn.disabled = false;
  }
});

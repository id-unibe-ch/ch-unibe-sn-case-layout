# SN Case Layout (IDCI)

A Chrome extension for the University of Bern ServiceNow **Service Operations Workspace**
(`serviceportal.unibe.ch`). It gives tickets a cleaner layout, adds a few time-saving helpers and
an optional dark theme.

**Install:** [SN Case Layout (IDCI) in the Chrome Web Store](https://chromewebstore.google.com/detail/sn-case-layout-idci/hapjgjpceoadbbjcjojdlifecmekhnig)

## Getting started

1. Install the extension from the Chrome Web Store link above.
2. Pin it: click the puzzle icon in the Chrome toolbar and pin **SN Case Layout**.
3. Open the Service Operations Workspace on `serviceportal.unibe.ch`.
4. On the first load, the extension may adjust a few of your ServiceNow preferences (see
   [Workspace preferences](#workspace-preferences)). A notice appears in the bottom right corner –
   click **Reload** to apply them.
5. Optional: open the extension's settings (click its icon) and import the predefined lists
   (see [My lists](#my-lists)).

All settings are saved automatically and follow your Chrome profile (Chrome sync).

## What it does

### Tickets (Incident, UniBe Case, ID Task, …)

- **Customer request in the activity stream** – the original description is shown as an entry at
  the bottom (or top, see settings) of the activity stream instead of a form field.
- **Tidy form** – "Additional comments" and "Work notes" are removed from the left form; you write
  them in the centre.
- **Compose tabs in the same order everywhere** – *Work notes*, *Reply to customer*, *Email*,
  followed by ticket-specific tabs such as *Resolution* (Incident, ID Task) or *Closure*
  (UniBe Case). Fields of those sections are moved from the left form into these tabs.
- **"Reply to customer"** – the tab ServiceNow calls "Additional comments". Everything you post
  there is visible to the customer; *Work notes* stay internal.
- **Start tab** – every ticket opens in the same tab (Work notes or Reply to customer, see settings).
- **Mandatory fields** – if a moved field becomes mandatory and is still empty, its tab is marked
  with a red `*` and selected automatically.
- **Assigned-to badge** – next to the form tabs you see who the ticket is assigned to and in which
  group. **Assign to me** opens a list of your assignment groups:
  - pick the current group (marked *current*) to assign the ticket to yourself, or
  - pick another group to move the ticket and assign it to yourself in one step. The work note
    `[moved to <group>]` is added automatically.

### Lists

- **Customer replies at a glance** – rows of tickets where the caller acted last get a green
  background. The bar on the left shows how long the caller has been waiting (age of *Updated*):
  - 🟢 green: up to 2 days
  - 🟡 yellow: 3–10 days
  - 🔴 red: more than 10 days
- **Wrapped column text** – long values (e.g. short description) wrap to at most 2 lines.
- **Grouped lists open expanded** – when a list is grouped (e.g. by assignment group), all groups
  are expanded the first time you open it. You can still collapse them.

### My lists

The settings contain a set of predefined lists. Click **Add selected to My lists** to create them
under *Lists → My lists → Created by me*. They are named `SN: …` and shown under three headings:

| Heading | Lists |
|---|---|
| **My work** | All tickets assigned to me; Incidents, UniBe Cases and ID Tasks – *Assigned to me* / *Unassigned* |
| **My groups work** | Incidents, UniBe Cases and ID Tasks – *Open in my groups* / *Closed in my groups* |
| **Other** | Problems, Changes, Approvals, KB Articles |

- The filters use "Me" and "One of my groups", so they work for everyone.
- **Group lists** – lists are grouped by assignment group ("All tickets" by ticket type). Turn the
  switch off before importing to get them without grouping.
- Importing again is safe: existing lists are skipped, only their grouping and position are
  updated. The ServiceNow page reloads automatically afterwards.
- **Remove SN: lists** deletes all of your lists whose name starts with `SN: ` (click twice to
  confirm). Your own lists are not touched.

### Dark theme

An optional dark theme for the workspace. Classic UI pages (`/now/nav/ui/classic/…`) always use
the light theme, because they don't render correctly in dark mode.

## Settings

Click the extension icon to open the settings.

| Setting | Default | Description |
|---|---|---|
| Dark theme | on | Dark colours for the workspace. |
| Customer request at bottom | on | Position of the original request in the activity stream (off = top). |
| Show Email tab | off | Shows the email composer next to Work notes / Reply to customer. |
| Start in tab | Work notes | Tab selected when a ticket opens. |
| Highlight customer replies | on | Colours list rows where the caller acted last (see [Lists](#lists)). |
| Left pane – Initial width | 360 px | Width of the left form when a ticket opens; you can still drag the divider. `0` = ServiceNow default. |
| Activity filter – Preset post types | on | Post types pre-selected in the activity stream filter when a ticket opens. |
| Keep recommended settings | on | Keeps the workspace preferences the layout needs (see below). |
| English ServiceNow language | on | The layout relies on English labels. |
| Group lists | on | Grouping of the imported lists (see [My lists](#my-lists)). |

**Reset to defaults** at the bottom restores all settings.

### Workspace preferences

With **Keep recommended settings** on, the extension checks these ServiceNow preferences when
the workspace loads and corrects them if needed (your own preferences only):

- Show the ribbon: on
- Show the sidebar: off
- Expand activity stream items: on
- Lazy load workspace pages: off
- Wrap column text in lists: on
- Theme: Coral (default variant)

With **English ServiceNow language** on, your ServiceNow language is set to English.
After a change you'll see a notice – click **Reload**.

## Troubleshooting

- **The layout doesn't change** – reload the ServiceNow page. Make sure the theme is *Coral* and
  the language is *English* (or turn on the two options under *Workspace preferences*).
- **"Please open a ServiceNow workspace tab…" when importing lists** – the import runs in the
  active tab. Switch to a `serviceportal.unibe.ch` tab and open the settings again.
- **A classic UI page looks wrong** – classic pages always use the light theme; reload the page if
  it was opened before the extension was updated.

## Privacy

The extension only runs on `https://serviceportal.unibe.ch/now/*`. It talks to ServiceNow with your
own session (to read ticket flags, set your preferences, create your lists and assign tickets) and
stores your settings in Chrome sync storage. No data is sent anywhere else.

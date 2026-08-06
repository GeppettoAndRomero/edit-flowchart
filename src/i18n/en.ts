import type { ToolContent } from './types';

export const en: ToolContent = {
  htmlLang: 'en',

  meta: {
    title: 'Edit a Mermaid Flowchart in a GUI — Lossless Code Round Trip | runlocally',
    description:
      'Load Mermaid flowchart code, edit its structure with forms and lists, and write it back as code. Lines you never touch come back byte-for-byte identical, including comments and syntax this tool doesn’t understand. Entirely client-side.',
    ogTitle: 'Edit a Mermaid Flowchart in a GUI — Lossless Code Round Trip',
    ogDescription:
      'Structural GUI editing for Mermaid flowchart code: add, remove, and relabel nodes and edges, then export code with untouched lines preserved exactly. Runs entirely in your browser.',
  },

  hero: {
    h1: 'Edit a Mermaid Flowchart',
    tagline:
      'Load flowchart code, edit its structure in a GUI, and get code back — untouched lines come back byte-for-byte identical.',
  },

  intro: {
    h2: 'A structural editor that never rewrites what you didn’t touch',
    paras: [
      'This tool reads Mermaid flowchart code (the graph / flowchart syntax used by mermaid.live and many documentation tools), lets you edit its structure with an inspector — add or remove nodes and edges, change a label or a shape, move a node between groups, change the diagram direction — and writes the result back out as code.',
      'It keeps a line-by-line record of the source you loaded. A line you never edit is written back exactly as it was, terminator and all — comments, styling directives, and syntax this tool doesn’t model (chained arrows, semicolon-separated statements, non-Latin node ids, and more) all pass through untouched instead of being silently reformatted or dropped.',
      'It doesn’t draw diagrams from scratch or export images — for a plain “type code, see a live SVG preview, export as SVG/PNG” tool, see the sibling draw-flowchart. This tool is specifically for restructuring an existing flowchart’s code through a GUI and getting clean code back.',
    ],
  },

  privacy: {
    h2: 'Why your flowchart never leaves your device',
    lead: 'Privacy here is structural, not a promise. There is no upload step because there is no server to upload to:',
    points: [
      'Parsing, editing, and rendering all happen in your browser.',
      'The page is served as static files and makes no request carrying your flowchart text.',
      'There is no shareable-link feature that would encode your diagram into a URL.',
      'The source is open and anyone can read it (MIT).',
      'It works offline, which is only possible because nothing leaves the device.',
    ],
    note: "If you want to check for yourself, open your browser's Network panel while editing — no request carries your flowchart text.",
    sourceLinkText: 'Read the source.',
  },

  howto: {
    h2: 'How to use it',
    steps: [
      {
        h3: 'Load your flowchart',
        p: 'Paste Mermaid flowchart code, drop a .mmd/.mermaid/.md/.txt file, or click “Load sample”. Pasting text copied from an AI chat response automatically extracts the code from a ```mermaid block.',
      },
      {
        h3: 'Edit the structure',
        p: 'Select a node or edge from the lists (or click it in the preview, when that mapping is available) to edit its label, shape, or connections. Add nodes and edges, move a node into or out of a subgraph group, or change the overall direction from the toolbar.',
      },
      {
        h3: 'Check the result',
        p: 'The preview and the code pane both update live. If a line can’t be parsed, editing is paused with the error shown — the last working preview stays visible while you fix it in the code pane, which is always editable directly.',
      },
      {
        h3: 'Export the code',
        p: 'Copy the code, copy it as a fenced ```mermaid block, download the .mmd file, or use “Copy for AI” to get a ready-to-paste before/after instruction for an AI chat — see below.',
      },
    ],
  },

  faqHeading: 'FAQ',
  faq: [
    {
      q: 'Is my flowchart uploaded anywhere?',
      a: 'No. Parsing, editing, and rendering all happen entirely in your browser. There is no server component and no shareable-link feature, so your flowchart text has no path off your device.',
    },
    {
      q: 'What does "byte-identical round trip" actually mean?',
      a: 'If you load a file and export it again without changing anything, the output is byte-for-byte the same file — same whitespace, same comments, same line endings. When you do make an edit, only the line(s) that edit actually touches are rewritten; every other line is untouched.',
    },
    {
      q: 'What happens to syntax this tool doesn’t understand?',
      a: 'It’s kept exactly as written and still shown in the preview, but it isn’t editable through the GUI — things like classDef/style/linkStyle/click directives, chained arrows (A --> B --> C), and a few other constructs. The summary at the bottom of the editor reports how many lines fall into this category. You can still edit them directly in the code pane.',
    },
    {
      q: 'Can I drag nodes around to reposition them?',
      a: 'No, and this is deliberate, not a missing feature. Mermaid’s flowchart syntax has no way to record a node’s position — layout is always automatic — so a dragged position could never be written back into the code. Every editing feature here corresponds to something that actually exists in the text format.',
    },
    {
      q: 'Can I rename a node’s id?',
      a: 'No — only its label. Renaming an id could silently break a reference to it in a line this tool doesn’t otherwise touch (an unsupported click or style directive, for example), so it’s out of scope. You can edit ids directly in the code pane, where you can see and fix any such reference yourself.',
    },
    {
      q: 'What is "Copy for AI" for?',
      a: 'It copies the flowchart code as it was when you loaded it and the code as it is now, as two labeled, fenced code blocks, ready to paste into an AI chat as a change instruction. This is aimed at a specific workflow: describe a UI’s structure as a flowchart (containers as subgraphs, components as nodes), edit it here, and hand the before/after to an AI as the diff.',
    },
    {
      q: 'Does it work offline?',
      a: 'Yes. It is a PWA. After the first visit it is cached, so it works without a network connection. You can also install it to your home screen.',
    },
  ],

  footer: {
    openSourceLabel: 'Open source (MIT)',
    partOf: 'part of',
    brandTail: '— small tools that run locally on your device.',
    colophon:
      "Built and maintained by Geppetto. Some code is written with AI assistance; all review and decisions are the maintainer's.",
    securityText: 'Security',
  },

  related: {
    h2: 'Related tools',
    blogLinkText: 'Read the technical notes',
  },
};

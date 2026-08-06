import type { ToolContent } from './types';

export const de: ToolContent = {
  htmlLang: 'de',

  meta: {
    title: 'Mermaid-Flowchart im GUI bearbeiten — Code-Roundtrip ohne Verluste | runlocally',
    description:
      'Mermaid-Flowchart-Code laden, die Struktur über Formulare und Listen bearbeiten und als Code wieder exportieren. Unveränderte Zeilen kommen byte-identisch zurück — inklusive Kommentaren und Syntax, die dieses Tool nicht kennt. Läuft vollständig im Browser.',
    ogTitle: 'Mermaid-Flowchart im GUI bearbeiten — Code-Roundtrip ohne Verluste',
    ogDescription:
      'Strukturelle GUI-Bearbeitung von Mermaid-Flowchart-Code: Knoten und Kanten hinzufügen, entfernen, umbenennen — unangetastete Zeilen bleiben byte-identisch. Läuft vollständig im Browser.',
  },

  hero: {
    h1: 'Mermaid-Flowchart bearbeiten',
    tagline: 'Flowchart-Code laden, die Struktur im GUI bearbeiten und als Code zurückerhalten — unangetastete Zeilen bleiben byte-identisch.',
  },

  intro: {
    h2: 'Ein Struktur-Editor, der nie umschreibt, was du nicht angefasst hast',
    paras: [
      'Dieses Tool liest Mermaid-Flowchart-Code (die graph- / flowchart-Syntax, die mermaid.live und viele Doku-Tools verwenden), lässt dich die Struktur über einen Inspektor bearbeiten — Knoten und Kanten hinzufügen oder entfernen, Label oder Form ändern, einen Knoten zwischen Subgraph-Gruppen verschieben, die Gesamtrichtung ändern — und schreibt das Ergebnis wieder als Code heraus.',
      'Die geladene Quelle wird zeilenweise erfasst. Eine Zeile, die du nie bearbeitest, wird exakt so zurückgeschrieben, wie sie war — inklusive Zeilenende. Kommentare, Style-Direktiven und Syntax, die dieses Tool nicht modelliert (verkettete Pfeile, semikolongetrennte Statements, nicht-lateinische Knoten-IDs und mehr), laufen unangetastet durch, statt still umformatiert oder verworfen zu werden.',
      'Es zeichnet keine Diagramme von Grund auf und exportiert keine Bilder — für ein einfaches „Code tippen, live SVG-Vorschau sehen, als SVG/PNG exportieren“ gibt es das Schwester-Tool draw-flowchart. Dieses Tool ist speziell dafür da, den Code eines bestehenden Flowcharts über ein GUI umzustrukturieren und sauberen Code zurückzubekommen.',
    ],
  },

  privacy: {
    h2: 'Warum dein Flowchart dein Gerät nie verlässt',
    lead: 'Datenschutz ist hier strukturell, kein Versprechen. Es gibt keinen Upload-Schritt, weil es keinen Server gibt, an den hochgeladen werden könnte:',
    points: [
      'Parsen, Bearbeiten und Rendern passieren vollständig im Browser.',
      'Die Seite wird als statische Dateien ausgeliefert und sendet keine Anfrage mit deinem Flowchart-Text.',
      'Es gibt keine Funktion für Freigabe-Links, die dein Diagramm in eine URL kodieren würde.',
      'Der Quellcode ist offen und für jeden einsehbar (MIT).',
      'Es funktioniert offline — das ist nur möglich, weil nichts das Gerät verlässt.',
    ],
    note: 'Wer es selbst nachprüfen möchte: Öffne beim Bearbeiten das Netzwerk-Panel deines Browsers — keine Anfrage enthält deinen Flowchart-Text.',
    sourceLinkText: 'Quellcode ansehen.',
  },

  howto: {
    h2: 'So funktioniert’s',
    steps: [
      {
        h3: 'Flowchart laden',
        p: 'Mermaid-Flowchart-Code einfügen, eine .mmd-/.mermaid-/.md-/.txt-Datei hineinziehen oder auf „Beispiel laden“ klicken. Wird ein aus einem KI-Chat kopierter Text eingefügt, wird der Code automatisch aus einem ```mermaid-Block extrahiert.',
      },
      {
        h3: 'Struktur bearbeiten',
        p: 'Knoten oder Kante aus den Listen auswählen (oder, wenn die Zuordnung verfügbar ist, direkt in der Vorschau anklicken), um Label, Form oder Verbindungen zu bearbeiten. Über die Werkzeugleiste lassen sich Knoten und Kanten hinzufügen, ein Knoten in eine Subgraph-Gruppe verschieben oder die Gesamtrichtung ändern.',
      },
      {
        h3: 'Ergebnis prüfen',
        p: 'Vorschau und Code-Feld werden live aktualisiert. Lässt sich eine Zeile nicht parsen, wird die Bearbeitung pausiert und der Fehler angezeigt — die letzte funktionierende Vorschau bleibt sichtbar, während du im direkt bearbeitbaren Code-Feld korrigierst.',
      },
      {
        h3: 'Code exportieren',
        p: 'Code kopieren, als ```mermaid-Block mit Codezaun kopieren, als .mmd herunterladen, oder mit „Für KI kopieren“ eine fertige Vorher/Nachher-Anweisung für einen KI-Chat erzeugen (siehe unten).',
      },
    ],
  },

  faqHeading: 'Häufige Fragen',
  faq: [
    {
      q: 'Wird mein Flowchart irgendwohin hochgeladen?',
      a: 'Nein. Parsen, Bearbeiten und Rendern passieren vollständig im Browser. Es gibt weder eine Server-Komponente noch eine Freigabe-Link-Funktion — dein Flowchart-Text hat also keinen Weg, das Gerät zu verlassen.',
    },
    {
      q: 'Was bedeutet „byte-identischer Roundtrip“ konkret?',
      a: 'Lädst du eine Datei und exportierst sie ohne Änderung wieder, ist die Ausgabe byte-für-byte identisch mit der Originaldatei — gleiche Leerzeichen, gleiche Kommentare, gleiche Zeilenenden. Nimmst du eine Änderung vor, wird nur die tatsächlich betroffene Zeile umgeschrieben; alle anderen bleiben unangetastet.',
    },
    {
      q: 'Was passiert mit Syntax, die dieses Tool nicht versteht?',
      a: 'Sie wird exakt so beibehalten, wie sie geschrieben wurde, und erscheint auch in der Vorschau — ist aber im GUI nicht bearbeitbar. Dazu zählen etwa classDef-/style-/linkStyle-/click-Direktiven oder verkettete Pfeile (A --> B --> C). Die Zusammenfassung unten im Editor zeigt, wie viele Zeilen darunterfallen. Bearbeiten lassen sie sich weiterhin direkt im Code-Feld.',
    },
    {
      q: 'Kann ich Knoten per Drag & Drop neu positionieren?',
      a: 'Nein, und das ist Absicht, kein fehlendes Feature. Mermaids Flowchart-Syntax kennt keine Möglichkeit, eine Position zu speichern — das Layout wird immer automatisch berechnet —, eine gezogene Position ließe sich also nie in den Code zurückschreiben. Jede Bearbeitungsfunktion hier entspricht etwas, das im Textformat tatsächlich existiert.',
    },
    {
      q: 'Kann ich die ID eines Knotens umbenennen?',
      a: 'Nein — nur sein Label. Eine ID-Umbenennung könnte einen Verweis darauf in einer Zeile, die dieses Tool sonst nicht anfasst (etwa eine nicht unterstützte click- oder style-Direktive), unbemerkt zerstören, deshalb ist das außerhalb des Umfangs. IDs lassen sich direkt im Code-Feld bearbeiten, wo du jeden betroffenen Verweis selbst sehen und korrigieren kannst.',
    },
    {
      q: 'Wofür ist „Für KI kopieren“?',
      a: 'Es kopiert den Code so, wie er beim Laden war, und den aktuellen Code als zwei beschriftete, eingezäunte Codeblöcke — bereit zum Einfügen in einen KI-Chat als Änderungsanweisung. Gedacht ist das für einen bestimmten Workflow: die Struktur einer UI als Flowchart beschreiben (Container als Subgraph, Komponenten als Knoten), hier bearbeiten und das Vorher/Nachher als Diff an eine KI übergeben.',
    },
    {
      q: 'Funktioniert es offline?',
      a: 'Ja. Es ist eine PWA. Nach dem ersten Besuch wird es zwischengespeichert und funktioniert dann auch ohne Netzwerkverbindung. Du kannst es auch auf dem Startbildschirm installieren.',
    },
  ],

  footer: {
    openSourceLabel: 'Open Source (MIT)',
    partOf: 'Teil von',
    brandTail: '— kleine Tools, die lokal auf deinem Gerät laufen.',
    colophon:
      'Entwickelt und gepflegt von Geppetto. Ein Teil des Codes ist mit KI-Unterstützung entstanden; Review und Entscheidungen liegen vollständig beim Maintainer.',
    securityText: 'Sicherheit',
  },

  related: {
    h2: 'Ähnliche Tools',
    blogLinkText: 'Technische Hintergründe lesen',
  },
};

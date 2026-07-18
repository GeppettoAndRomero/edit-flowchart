import type { ToolContent } from './types';

export const es: ToolContent = {
  htmlLang: 'es',

  meta: {
    title: 'Editar un diagrama de flujo Mermaid en un GUI — código sin pérdidas | runlocally',
    description:
      'Carga código de un diagrama de flujo Mermaid, edita su estructura con formularios y listas, y expórtalo de nuevo como código. Las líneas que no tocas vuelven idénticas byte a byte, incluidos comentarios y sintaxis que esta herramienta no entiende. Todo ocurre en tu navegador.',
    ogTitle: 'Editar un diagrama de flujo Mermaid en un GUI — código sin pérdidas',
    ogDescription:
      'Edición estructural con GUI de código de diagramas de flujo Mermaid: añade, elimina y renombra nodos y conexiones, y exporta código con las líneas no tocadas preservadas exactamente. Funciona enteramente en tu navegador.',
  },

  hero: {
    h1: 'Editar un diagrama de flujo Mermaid',
    tagline: 'Carga código de un diagrama de flujo, edita su estructura en un GUI y recibe código de vuelta: las líneas que no tocas quedan idénticas byte a byte.',
  },

  intro: {
    h2: 'Un editor estructural que nunca reescribe lo que no tocaste',
    paras: [
      'Esta herramienta lee código de diagramas de flujo Mermaid (la sintaxis graph / flowchart que usan mermaid.live y muchas herramientas de documentación), te deja editar su estructura con un inspector — añadir o quitar nodos y conexiones, cambiar una etiqueta o una forma, mover un nodo entre grupos subgraph, cambiar la dirección del diagrama — y escribe el resultado de vuelta como código.',
      'Mantiene un registro línea por línea del origen que cargaste. Una línea que nunca editas se escribe de vuelta exactamente igual, terminador incluido: comentarios, directivas de estilo y sintaxis que esta herramienta no modela (flechas encadenadas, sentencias separadas por punto y coma, ids de nodo no latinos, y más) pasan sin tocarse, en lugar de reformatearse o eliminarse en silencio.',
      'No dibuja diagramas desde cero ni exporta imágenes — si buscas algo simple de "escribe código, ve una vista previa SVG en vivo, exporta como SVG/PNG", esa es la herramienta hermana draw-flowchart. Esta herramienta es específicamente para reestructurar el código de un diagrama de flujo existente a través de un GUI y recuperar código limpio.',
    ],
  },

  privacy: {
    h2: 'Por qué tu diagrama nunca sale de tu dispositivo',
    lead: 'Aquí la privacidad es estructural, no una promesa. No hay paso de subida porque no hay servidor al que subir nada:',
    points: [
      'El análisis, la edición y el renderizado ocurren enteramente en tu navegador.',
      'La página se sirve como archivos estáticos y no hace ninguna petición que lleve el texto de tu diagrama.',
      'No existe una función de enlace compartible que codifique tu diagrama en una URL.',
      'El código fuente es abierto y cualquiera puede leerlo (MIT).',
      'Funciona sin conexión, algo que solo es posible porque nada sale del dispositivo.',
    ],
    note: 'Si quieres comprobarlo tú mismo, abre el panel de red de tu navegador mientras editas: ninguna petición lleva el texto de tu diagrama.',
    sourceLinkText: 'Ver el código fuente.',
  },

  howto: {
    h2: 'Cómo se usa',
    steps: [
      {
        h3: 'Carga tu diagrama de flujo',
        p: 'Pega código de un diagrama de flujo Mermaid, suelta un archivo .mmd/.mermaid/.md/.txt, o haz clic en "Cargar ejemplo". Si pegas texto copiado de la respuesta de una IA, el código se extrae automáticamente de un bloque ```mermaid.',
      },
      {
        h3: 'Edita la estructura',
        p: 'Selecciona un nodo o una conexión en las listas (o haz clic en la vista previa, cuando esa correspondencia esté disponible) para editar su etiqueta, forma o conexiones. Añade nodos y conexiones, mueve un nodo dentro o fuera de un grupo subgraph, o cambia la dirección general desde la barra de herramientas.',
      },
      {
        h3: 'Revisa el resultado',
        p: 'La vista previa y el panel de código se actualizan en vivo. Si una línea no se puede analizar, la edición se pausa y se muestra el error — la última vista previa que funcionó permanece visible mientras la corriges directamente en el panel de código, siempre editable.',
      },
      {
        h3: 'Exporta el código',
        p: 'Copia el código, cópialo como bloque ```mermaid, descarga el archivo .mmd, o usa "Copiar para IA" para obtener una instrucción antes/después lista para pegar en un chat de IA — ver más abajo.',
      },
    ],
  },

  faqHeading: 'Preguntas frecuentes',
  faq: [
    {
      q: '¿Se sube mi diagrama a algún sitio?',
      a: 'No. El análisis, la edición y el renderizado ocurren enteramente en tu navegador. No hay componente de servidor ni función de enlace compartible, así que el texto de tu diagrama no tiene forma de salir de tu dispositivo.',
    },
    {
      q: '¿Qué significa exactamente "ida y vuelta idéntica byte a byte"?',
      a: 'Si cargas un archivo y lo exportas de nuevo sin cambiar nada, la salida es exactamente el mismo archivo, byte a byte: mismos espacios, mismos comentarios, mismos finales de línea. Cuando sí haces un cambio, solo se reescribe la línea o líneas que ese cambio realmente afecta; el resto queda intacto.',
    },
    {
      q: '¿Qué pasa con la sintaxis que esta herramienta no entiende?',
      a: 'Se mantiene tal cual está escrita y sigue mostrándose en la vista previa, pero no es editable desde el GUI — cosas como las directivas classDef/style/linkStyle/click, flechas encadenadas (A --> B --> C), y algunas otras construcciones. El resumen al final del editor indica cuántas líneas caen en esta categoría. Aun así puedes editarlas directamente en el panel de código.',
    },
    {
      q: '¿Puedo arrastrar los nodos para reposicionarlos?',
      a: 'No, y esto es deliberado, no una carencia. La sintaxis de diagramas de flujo de Mermaid no tiene forma de registrar la posición de un nodo — el diseño siempre es automático —, así que una posición arrastrada nunca podría escribirse de vuelta en el código. Cada función de edición aquí corresponde a algo que realmente existe en el formato de texto.',
    },
    {
      q: '¿Puedo renombrar el id de un nodo?',
      a: 'No, solo su etiqueta. Renombrar un id podría romper en silencio una referencia a él en una línea que esta herramienta no toca (una directiva click o style no soportada, por ejemplo), así que queda fuera del alcance. Puedes editar los ids directamente en el panel de código, donde puedes ver y corregir tú mismo cualquier referencia de ese tipo.',
    },
    {
      q: '¿Para qué sirve "Copiar para IA"?',
      a: 'Copia el código del diagrama tal como estaba al cargarlo y el código tal como está ahora, como dos bloques de código etiquetados y delimitados, listos para pegar en un chat de IA como instrucción de cambio. Está pensado para un flujo de trabajo concreto: describir la estructura de una interfaz como un diagrama de flujo (contenedores como subgraph, componentes como nodos), editarla aquí, y entregarle a una IA el antes/después como la diferencia.',
    },
    {
      q: '¿Funciona sin conexión?',
      a: 'Sí. Es una PWA. Después de la primera visita queda en caché, así que funciona sin conexión a internet. También puedes instalarla en tu pantalla de inicio.',
    },
  ],

  footer: {
    openSourceLabel: 'Código abierto (MIT)',
    partOf: 'parte de',
    brandTail: '— pequeñas herramientas que funcionan localmente en tu dispositivo.',
    colophon:
      'Creado y mantenido por Geppetto. Parte del código está escrito con asistencia de IA; toda revisión y decisión es responsabilidad del mantenedor.',
    securityText: 'Seguridad',
  },
};

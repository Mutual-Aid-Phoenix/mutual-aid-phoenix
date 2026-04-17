---
title: Declaración de Accesibilidad
description: Nuestro compromiso con la accesibilidad y cómo reportar barreras.
last_updated: 2026-04-17
---

Ayuda Mutua en Phoenix está construido para ser usable por la mayor cantidad de personas posible, incluyendo quienes usan lectores de pantalla, teclado, control por voz o pantallas de alto contraste. Apuntamos a cumplir con **WCAG 2.2 Nivel AA**.

Si algo en este sitio te impide hacer lo que necesitas, queremos saberlo. Tu reporte nos ayuda a mejorar el sitio para todos.

## Cómo reportar una barrera

- Usa la [página de Contacto](/es/contact/) para enviarnos un mensaje. Puedes enviar comentarios sin dejar tu nombre ni correo electrónico.
- Si prefieres, abre un issue en nuestro [repositorio de GitHub](https://github.com/kyle-smith/mutual-aid-phoenix/issues/new).

Cuando nos contactes, nos ayuda saber:

- En qué página estabas y qué intentabas hacer.
- La tecnología de asistencia que usabas (lector de pantalla, teclado, control por voz, magnificador, etc.).
- El navegador y sistema operativo, si los conoces.

Responderemos tan pronto como un voluntario pueda hacerlo. No hay un plazo de respuesta garantizado — este es un proyecto comunitario — pero los reportes de accesibilidad van al principio de la cola.

## Lo que hemos incorporado

- **Navegación con teclado primero**: todos los elementos interactivos — filtros, búsqueda, marcadores del mapa, selector de idioma, botón de tema — se alcanzan y operan con teclado.
- **Enlaces de salto**: un enlace "Saltar al contenido principal" es el primer elemento enfocable en cada página. La página del mapa agrega un enlace "Saltar el mapa" para que quien usa teclado pueda saltarse el lienzo del mapa.
- **Foco visible**: cada elemento enfocable muestra un anillo de foco de alto contraste.
- **Estructura semántica**: jerarquía de encabezados correcta, regiones de referencia (`<header>`, `<nav>`, `<main>`, `<footer>`) y controles de formulario con etiquetas.
- **Accesibilidad del mapa**: los marcadores tienen nombres accesibles ("Nevera comunitaria — Nevera de ejemplo"); los diálogos emergentes atrapan el foco y se cierran con `Esc`; un botón prominente **Ver como lista** da a cualquier persona una salida en un clic. Un bloque `<noscript>` dirige a la vista de lista cuando JavaScript no está disponible.
- **Paridad en la vista de lista**: todos los recursos del mapa también están en la [Vista de lista](/es/list/), con la misma información, búsqueda de texto completo y filtros.
- **Indicador de listados desactualizados**: los recursos no verificados en los últimos 90 días aparecen atenuados y marcados para que puedas juzgar la confianza de un vistazo.
- **Color y contraste**: el texto cumple con las proporciones de contraste WCAG AA en los temas claro y oscuro. El color nunca es la única forma de transmitir información — los filtros, las etiquetas y los indicadores también usan texto.
- **Respeta las preferencias del usuario**: el selector de tema usa por defecto la configuración del sistema operativo (`prefers-color-scheme`). No usamos cookies de seguimiento.
- **Idioma**: cada página está disponible en español e inglés. El selector de idioma te mantiene en la misma página al cambiar.
- **Texto adaptable**: los diseños se reordenan al 200% de zoom y respetan las preferencias de tamaño de texto del navegador.

## Limitaciones conocidas

- **El mapa interactivo requiere JavaScript.** Mitigamos esto con una Vista de lista con paridad que funciona sin JS, un mensaje `<noscript>` dentro del mapa, y el botón prominente **Ver como lista**.
- **Los diálogos emergentes de los marcadores** han sido probados manualmente con VoiceOver y NVDA, pero aún no han pasado por una auditoría independiente completa.
- **Algunos listados enviados por voluntarios** pueden tener notas de accesibilidad incompletas (acceso para sillas de ruedas, disponibilidad de baños, etc.). Pedimos a los editores que las completen; reporta las omisiones vía Contacto.
- **El rendimiento de los mosaicos del mapa** en móviles antiguos puede ser lento en la primera carga mientras se descargan ~20 MB de mosaicos vectoriales. La vista de lista es la opción más rápida en conexiones limitadas.

## Pruebas

Antes de cada lanzamiento ejecutamos:

- `axe-core` CLI contra cada página en ambos idiomas.
- Recorrido manual solo con teclado.
- Pruebas manuales con lectores de pantalla: VoiceOver (Safari) y NVDA (Firefox).
- Auditorías de Lighthouse apuntando a ≥90 en la categoría de Accesibilidad.

Las auditorías automatizadas en el navegador están en el plan (consulta nuestro [plan de implementación](https://github.com/kyle-smith/mutual-aid-phoenix/blob/main/PLAN.md)). Hasta entonces, los reportes de las personas que usan el sitio son nuestra mejor señal.

## Estándares y alcance

- **Objetivo:** WCAG 2.2 Nivel AA, más criterios AAA seleccionados cuando sea práctico.
- **Alcance:** todas las páginas bajo `mutual-aid-phoenix.pages.dev`, en inglés y español.
- **Fuera de alcance:** contenido embebido de terceros (por ejemplo, mosaicos del mapa servidos por OpenStreetMap/Protomaps, enlaces a indicaciones de Google Maps que se abren en una pestaña nueva). Enlazamos a estos porque son útiles, pero no podemos garantizar su accesibilidad.

Esta declaración fue revisada por última vez en la fecha indicada arriba.

# Rondas

Puntajes de 1 a 10 contra `bar.md`, a criterio del crítico, mirando las capturas de cada ronda. Son una estimación, no una medición.

| Ronda | Objeto | Curva | Giro | Luz | Material | Sombra | Interacción | Mayor problema | Arreglo |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 6 | 6 | 5 | 5 | 7 | — | Todo gris y lavado; imágenes recortadas | Sin mapeo de tonos de cine, luz que llega a 1, imágenes con su proporción |
| 2 | 7 | 6 | 6 | 6 | 7 | 7 | — | El libro abierto se ve plano; transparencia que parece error | Más curva y sombra en la costura, transparencia casi imperceptible, imagen a sangre |
| 3 | 7 | 8 | 6 | 7 | 7 | 7 | — | La hoja que gira no proyecta sombra; cita repetida | Sombra proyectada hacia el lado contrario a la luz; sin cita repetida |
| 4 | 7 | 8 | 7 | 8 | 7 | 7 | 5 | El asomo de la tapa no se nota | Asomo 3 veces más marcado; costura según cuánto está abierto |
| 5 | 8 | 8 | 7 | 8 | 7 | 7 | 7 | La contratapa interior parece un panel pegado | Misma sombra de costura en la contratapa |
| 6 | 8 | 8 | 7 | 8 | 8 | 7 | 7 | Un arrastre podía saltear páginas | Un arrastre pasa como mucho una página |
| 7 | 8 | 8 | 7 | 8 | 8 | 7 | 8 | Memoria de video alta en celular | Texturas al 70% en pantallas chicas |

## Medido

- 75 cuadros por segundo en escritorio y en celular emulado (CPU 4 veces más lenta), en Chrome headless.
- Sin errores en la consola en ninguno de los cuatro casos de `check.mjs`.
- Interacción probada con eventos reales: etiqueta "Abrir" sobre la tapa, clic abre el libro, clic en un caso llama a `onOpen`, flechas del teclado, arrastre de una página.

## No verificado

- Teléfonos y GPUs reales.
- El peso en producción dentro del sitio (en la maqueta, three viene sin minificar).

## Lo que todavía está por debajo de la referencia

- **Giro (7):** la hoja se curva de forma pareja; en la referencia el papel hace una onda más viva al soltarlo. Haría falta una simulación con algo de rebote en la punta.
- **Sombra (7):** es un degradé fijo; no cambia de forma cuando el libro se inclina.

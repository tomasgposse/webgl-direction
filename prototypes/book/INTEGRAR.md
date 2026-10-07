# Integrar el libro en el portfolio

El libro es un módulo independiente: `book.js`. No depende de React ni de Next; solo de `three`.

## 1. Copiar

- `book.js` → `src/components/book/book.js`
- `three` ya está instalado en el proyecto.
- Las imágenes ya están en `public/` (portadas de los casos y `public/tomi/tomi.png`). Las tipografías ya las carga el sitio: pasale los nombres de familia reales que usa Next (`var(--font-boska)` resuelve a un nombre generado; usá el que aparece en `getComputedStyle(document.body).fontFamily`, o cargalas con `FontFace` antes de crear el libro).

## 2. Un componente cliente

```tsx
"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function WorksBook({ lang, data }: { lang: "es" | "en"; data: BookData }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    let book: { destroy(): void } | undefined;
    let cancelled = false;
    import("./book/book.js").then(async ({ createBook, canUseWebGL }) => {
      if (cancelled || !ref.current || !canUseWebGL()) return; // queda la alternativa
      book = await createBook(ref.current, {
        data,
        fonts: { display: "<familia de Boska>", text: "<familia de Switzer>" },
        theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
        onOpen: (slug) => router.push(`/${lang}/trabajo/${slug}`),
      });
    });
    return () => { cancelled = true; book?.destroy(); };
  }, [lang, data, router]);
  return <div ref={ref} className="relative h-[min(78svh,820px)]" tabIndex={0} role="group" aria-label="..." />;
}
```

- Cargalo con `next/dynamic` y `ssr: false`, o con el `import()` de adentro como arriba, para que three no frene la primera carga.
- `data` sale de `src/content/work.ts`: título, `summary` como `lead`, `kind`, la portada y `slug`. La forma exacta está en el `index.html` de esta carpeta.
- El tema: el sitio cambia `data-theme` en `<html>`. Escuchalo con un `MutationObserver` y llamá a `book.setTheme(next)`.

## 3. La alternativa

Sin WebGL o con movimiento reducido activado, el libro igual funciona: con movimiento reducido salta de página sin animar. Si preferís no mostrarlo en esos casos, renderizá el personaje actual (`Portrait`) en su lugar cuando `canUseWebGL()` dé falso o cuando `prefers-reduced-motion` esté activo.

## 4. Probar

```bash
node <skill>/scripts/check.mjs http://localhost:3000/es --selector "canvas"
```

Y pasarle `?debug` a la URL si querés usar `capture-states.mjs` con los estados `cover`, `peek`, `turning`, `spread-1`…`closing`.

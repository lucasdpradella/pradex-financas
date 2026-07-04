import { useState, useEffect } from "react";
import { DESKTOP_MIN } from "./theme";

// Detecta viewport >=1024px via matchMedia, com listener de resize/rotação.
// Usado porque o shell desktop é uma ÁRVORE de layout diferente (sidebar +
// top-bar + grid), não só troca de estilos — precisa condicionar o render.
export function useIsDesktop() {
  const query = `(min-width: ${DESKTOP_MIN}px)`;
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e) => setIsDesktop(e.matches);
    // Sincroniza caso o viewport tenha mudado entre o render inicial e o efeito.
    setIsDesktop(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler); // Safari antigo
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, [query]);

  return isDesktop;
}

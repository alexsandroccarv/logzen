/* ==========================================================================
   LogZen — Arrastar e soltar para reordenar (issue #7). Implementado com
   Pointer Events (não HTML5 Drag and Drop) para funcionar em toque no
   celular, não só com mouse. Genérico: liga um `pointerdown` numa raiz
   estável (sobrevive a re-renderizações do conteúdo) e move o item
   arrastado diretamente no DOM, trocando de lugar com o vizinho sob o
   dedo/cursor.
   ========================================================================== */
window.LogZenReorder = (function () {
    const CLASSES_ARRASTANDO = ['opacity-60', 'shadow-lg', 'relative', 'z-10'];

    // root: elemento estável onde o pointerdown é escutado (delegação).
    // itemSelector: seletor de cada linha/bloco arrastável.
    // handleSelector: seletor da alça (o que precisa ser tocado para iniciar).
    // groupSelector: se definido, um item só troca de posição com outro que
    //   tenha o mesmo ancestral mais próximo casando esse seletor (ex.: não
    //   deixa um item "vazar" para a categoria vizinha).
    // getId: (elemento) => id usado para persistir a ordem final.
    // onReorder: (idsNaNovaOrdem, elementoDoGrupo) => void.
    function ativar(root, { itemSelector, handleSelector, groupSelector, getId, onReorder }) {
        let dragEl = null;
        let grupoAtual = null;

        function onPointerMove(e) {
            if (!dragEl) return;
            e.preventDefault();
            const alvo = document.elementFromPoint(e.clientX, e.clientY);
            const sobreItem = alvo && alvo.closest(itemSelector);
            if (!sobreItem || sobreItem === dragEl) return;
            if (sobreItem.parentNode !== dragEl.parentNode) return; // não sai do grupo
            const rect = sobreItem.getBoundingClientRect();
            const antes = e.clientY < rect.top + rect.height / 2;
            sobreItem.parentNode.insertBefore(dragEl, antes ? sobreItem : sobreItem.nextSibling);
        }

        function finalizar() {
            if (!dragEl) return;
            dragEl.classList.remove(...CLASSES_ARRASTANDO);
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', finalizar);
            document.removeEventListener('pointercancel', finalizar);
            const lista = Array.from(dragEl.parentNode.querySelectorAll(`:scope > ${itemSelector}`)).map(getId);
            const grupo = grupoAtual;
            dragEl = null;
            grupoAtual = null;
            onReorder(lista, grupo);
        }

        root.addEventListener('pointerdown', (e) => {
            const handle = e.target.closest(handleSelector);
            if (!handle || !root.contains(handle)) return;
            const item = handle.closest(itemSelector);
            if (!item) return;
            e.preventDefault();
            dragEl = item;
            grupoAtual = groupSelector ? item.closest(groupSelector) : root;
            try { handle.setPointerCapture(e.pointerId); } catch (err) { /* ignora se não suportado */ }
            item.classList.add(...CLASSES_ARRASTANDO);
            document.addEventListener('pointermove', onPointerMove, { passive: false });
            document.addEventListener('pointerup', finalizar);
            document.addEventListener('pointercancel', finalizar);
        });
    }

    // Aplica uma ordem salva a uma lista de objetos (via `getId`), mantendo
    // no fim — na ordem original entre si — os que não estão na lista salva
    // (itens/categorias novos, ainda não posicionados manualmente).
    function aplicarOrdem(lista, getId, ordemSalva) {
        if (!ordemSalva || !ordemSalva.length) return lista;
        const indice = new Map(ordemSalva.map((id, i) => [id, i]));
        return [...lista].sort((a, b) => {
            const ia = indice.has(getId(a)) ? indice.get(getId(a)) : Infinity;
            const ib = indice.has(getId(b)) ? indice.get(getId(b)) : Infinity;
            return ia - ib;
        });
    }

    return { ativar, aplicarOrdem };
})();

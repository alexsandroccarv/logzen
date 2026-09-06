/* ==========================================================================
   LogZen — Catálogo em tempo de execução: itens padrão (logzen-items.js)
   mesclados com itens customizados pelo usuário (issue #2), guardados
   localmente. Itens customizados podem ser adicionados/removidos por
   categoria; os itens padrão do catálogo não são editáveis por aqui.
   ========================================================================== */
window.LogZenCatalog = (function () {
    const STORAGE_KEY = 'logzen:custom-items:v1';
    const ORDEM_KEY = 'logzen:ordem:v1';
    const DIACRITICOS = /[̀-ͯ]/g;

    function readOrdem() {
        try {
            const raw = localStorage.getItem(ORDEM_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function writeOrdem(ordem) {
        try { localStorage.setItem(ORDEM_KEY, JSON.stringify(ordem)); }
        catch (e) { /* storage indisponível — segue sem persistir */ }
    }

    // Ordem customizada (arrastar e soltar — issue #7), separada do
    // catálogo. Itens/categorias ainda não posicionados manualmente ficam
    // no fim, na ordem padrão.
    function getOrdemCategorias() {
        return readOrdem().categorias || [];
    }

    function setOrdemCategorias(ids) {
        const ordem = readOrdem();
        ordem.categorias = ids;
        writeOrdem(ordem);
    }

    function getOrdemItens(categoriaId) {
        const ordem = readOrdem();
        return (ordem.itens && ordem.itens[categoriaId]) || [];
    }

    function setOrdemItens(categoriaId, ids) {
        const ordem = readOrdem();
        if (!ordem.itens) ordem.itens = {};
        ordem.itens[categoriaId] = ids;
        writeOrdem(ordem);
    }

    function slug(nome) {
        return String(nome).toLowerCase().normalize('NFD').replace(DIACRITICOS, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item';
    }

    function readCustom() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function writeCustom(all) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); }
        catch (e) { /* storage indisponível — segue sem persistir */ }
    }

    // Gera um id único (dentro da categoria) a partir do nome do item.
    function idUnico(categoriaId, nome) {
        const base = slug(nome);
        const cat = getCategorias().find((c) => c.id === categoriaId);
        const existentes = new Set((cat ? cat.itens : []).map((i) => i.id));
        if (!existentes.has(base)) return base;
        let n = 2;
        while (existentes.has(`${base}-${n}`)) n += 1;
        return `${base}-${n}`;
    }

    function addCustomItem(categoriaId, dados) {
        const all = readCustom();
        if (!all[categoriaId]) all[categoriaId] = [];
        const item = {
            id: idUnico(categoriaId, dados.nome),
            nome: dados.nome,
            tipo: dados.tipo,
            custom: true,
        };
        if (dados.unidade) item.unidade = dados.unidade;
        if (dados.passoRapido) item.passoRapido = dados.passoRapido;
        if (dados.tipo === 'tags') item.opcoes = dados.opcoes || [];
        if (dados.tipo === 'escala') item.max = 5;
        all[categoriaId].push(item);
        writeCustom(all);
        return item;
    }

    // Edita nome/unidade/opções de um item customizado — issue #6. O `id`
    // nunca muda (mesmo que o nome mude), e o `tipo` não é editável aqui,
    // para que o histórico já salvo (guardado pelo id) continue válido.
    function updateCustomItem(categoriaId, itemId, dados) {
        const all = readCustom();
        const lista = all[categoriaId];
        const item = lista && lista.find((i) => i.id === itemId);
        if (!item) return;
        item.nome = dados.nome;
        if (item.tipo === 'contador' || item.tipo === 'contador-inverso') {
            if (dados.unidade) item.unidade = dados.unidade;
            else delete item.unidade;
        }
        if (item.tipo === 'tags') item.opcoes = dados.opcoes || [];
        writeCustom(all);
    }

    function removeCustomItem(categoriaId, itemId) {
        const all = readCustom();
        if (!all[categoriaId]) return;
        all[categoriaId] = all[categoriaId].filter((i) => i.id !== itemId);
        writeCustom(all);
    }

    // Catálogo completo (padrão + customizado), na ordem escolhida pelo
    // usuário (issue #7), para renderização.
    function getCategorias() {
        const custom = readCustom();
        const base = window.LOGZEN_CATEGORIES.map((cat) => ({
            ...cat,
            itens: [...cat.itens, ...(custom[cat.id] || [])],
        }));
        const categorias = window.LogZenReorder.aplicarOrdem(base, (c) => c.id, getOrdemCategorias());
        return categorias.map((cat) => ({
            ...cat,
            itens: window.LogZenReorder.aplicarOrdem(cat.itens, (i) => i.id, getOrdemItens(cat.id)),
        }));
    }

    return {
        getCategorias, addCustomItem, updateCustomItem, removeCustomItem,
        getOrdemCategorias, setOrdemCategorias, getOrdemItens, setOrdemItens,
    };
})();

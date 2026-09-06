/* ==========================================================================
   LogZen — Catálogo em tempo de execução: itens padrão (logzen-items.js)
   mesclados com itens customizados pelo usuário (issue #2), guardados
   localmente. Desde a issue #8, TODO item é editável/excluível — inclusive
   os do catálogo de fábrica: editar grava um "patch" (nome/unidade/opções)
   por cima do original, e excluir apenas marca o id como escondido. O
   arquivo logzen-items.js nunca é modificado; o `id` de um item nunca
   muda, então o histórico salvo por data continua válido mesmo depois de
   editado ou "excluído".
   ========================================================================== */
window.LogZenCatalog = (function () {
    const STORAGE_KEY = 'logzen:custom-items:v1';
    const ORDEM_KEY = 'logzen:ordem:v1';
    const OVERRIDES_KEY = 'logzen:item-overrides:v1';
    const HIDDEN_KEY = 'logzen:item-hidden:v1';
    const DIACRITICOS = /[̀-ͯ]/g;

    function readOverrides() {
        try {
            const raw = localStorage.getItem(OVERRIDES_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function writeOverrides(o) {
        try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o)); }
        catch (e) { /* storage indisponível — segue sem persistir */ }
    }

    function readHidden() {
        try {
            const raw = localStorage.getItem(HIDDEN_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function writeHidden(h) {
        try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(h)); }
        catch (e) { /* storage indisponível — segue sem persistir */ }
    }

    // O item (com esse id, nessa categoria) veio do catálogo de fábrica?
    function itemPadraoOriginal(categoriaId, itemId) {
        const cat = window.LOGZEN_CATEGORIES.find((c) => c.id === categoriaId);
        return cat && cat.itens.find((i) => i.id === itemId);
    }

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

    // Gera um id único (dentro da categoria) a partir do nome do item. Evita
    // reaproveitar até o id de um item padrão escondido (issue #8) — senão
    // um item novo colidiria com o histórico antigo guardado sob esse id.
    function idUnico(categoriaId, nome) {
        const base = slug(nome);
        const catAtual = getCategorias().find((c) => c.id === categoriaId);
        const catOriginal = window.LOGZEN_CATEGORIES.find((c) => c.id === categoriaId);
        const existentes = new Set([
            ...(catAtual ? catAtual.itens.map((i) => i.id) : []),
            ...(catOriginal ? catOriginal.itens.map((i) => i.id) : []),
        ]);
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

    // Edita nome/unidade/opções de QUALQUER item (padrão ou customizado —
    // issue #8). O `id` nunca muda (mesmo que o nome mude), e o `tipo` não
    // é editável aqui, para que o histórico já salvo (guardado pelo id)
    // continue válido.
    function updateItem(categoriaId, itemId, dados) {
        const original = itemPadraoOriginal(categoriaId, itemId);
        if (original) {
            const overrides = readOverrides();
            if (!overrides[categoriaId]) overrides[categoriaId] = {};
            const patch = { nome: dados.nome };
            if (original.tipo === 'contador' || original.tipo === 'contador-inverso') {
                patch.unidade = dados.unidade || '';
            }
            if (original.tipo === 'tags') patch.opcoes = dados.opcoes || [];
            overrides[categoriaId][itemId] = patch;
            writeOverrides(overrides);
            return;
        }
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

    // Remove QUALQUER item da tela (padrão ou customizado — issue #8). Um
    // item padrão só é escondido (o código-fonte do catálogo nunca muda);
    // um item customizado é removido do armazenamento. Em ambos os casos,
    // os registros já salvos por data continuam intactos — só o item deixa
    // de aparecer.
    function removeItem(categoriaId, itemId) {
        if (itemPadraoOriginal(categoriaId, itemId)) {
            const hidden = readHidden();
            if (!hidden[categoriaId]) hidden[categoriaId] = [];
            if (!hidden[categoriaId].includes(itemId)) hidden[categoriaId].push(itemId);
            writeHidden(hidden);
            return;
        }
        const all = readCustom();
        if (!all[categoriaId]) return;
        all[categoriaId] = all[categoriaId].filter((i) => i.id !== itemId);
        writeCustom(all);
    }

    // Catálogo completo (padrão — com edições/exclusões aplicadas por cima —
    // + customizado), na ordem escolhida pelo usuário (issue #7).
    function getCategorias() {
        const custom = readCustom();
        const overrides = readOverrides();
        const hidden = readHidden();
        const base = window.LOGZEN_CATEGORIES.map((cat) => {
            const escondidos = new Set(hidden[cat.id] || []);
            const patches = overrides[cat.id] || {};
            const padrao = cat.itens
                .filter((item) => !escondidos.has(item.id))
                .map((item) => (patches[item.id] ? { ...item, ...patches[item.id] } : item));
            return { ...cat, itens: [...padrao, ...(custom[cat.id] || [])] };
        });
        const categorias = window.LogZenReorder.aplicarOrdem(base, (c) => c.id, getOrdemCategorias());
        return categorias.map((cat) => ({
            ...cat,
            itens: window.LogZenReorder.aplicarOrdem(cat.itens, (i) => i.id, getOrdemItens(cat.id)),
        }));
    }

    return {
        getCategorias, addCustomItem, updateItem, removeItem,
        getOrdemCategorias, setOrdemCategorias, getOrdemItens, setOrdemItens,
    };
})();

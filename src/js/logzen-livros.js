/* ==========================================================================
   LogZen — Livros (issue #14): registro de livros lidos, com busca de
   metadados (capa, autor, editora, páginas) via Google Books API — gratuita
   e sem chave em volume baixo. Se ela não encontrar nada (ou falhar, ex.:
   cota anônima esgotada), cai automaticamente para a Open Library API
   (issue #24) — segunda fonte, também sem chave. Chave própria opcional da
   Google Books (issue #27), colada em Configurações → Livros e guardada só
   no localStorage, para fugir da cota anônima compartilhada por IP/rede.
   A busca aceita título ou ISBN (10 ou 13 dígitos, com ou sem hífen) — o
   código detecta automaticamente qual é o caso. Os resultados das duas
   fontes são normalizados para o mesmo formato antes de exibir. Fallback de
   registro manual sempre disponível. Leitura tem início e fim (fim em
   branco = ainda lendo). Editar um livro já registrado (issue #28) reabre o
   formulário preenchido com os dados atuais — salvar atualiza o mesmo
   registro (mesmo `id`), sem criar um duplicado.
   ========================================================================== */
window.LogZenLivros = (function () {
    const ENTRIES_KEY = 'logzen:livros:v1';
    const APIKEY_KEY = 'logzen:google-books-key:v1';

    // Open Library usa códigos de 3 letras (ISO 639-2); Google Books usa
    // 2 letras (ISO 639-1) — o mapa cobre os dois formatos.
    const IDIOMA_LABEL = {
        eng: 'Inglês', por: 'Português', spa: 'Espanhol', fre: 'Francês', fra: 'Francês',
        ger: 'Alemão', deu: 'Alemão', ita: 'Italiano', jpn: 'Japonês', chi: 'Chinês',
        zho: 'Chinês', rus: 'Russo', ara: 'Árabe', kor: 'Coreano', dut: 'Holandês', nld: 'Holandês',
        en: 'Inglês', pt: 'Português', es: 'Espanhol', fr: 'Francês', de: 'Alemão',
        it: 'Italiano', ja: 'Japonês', zh: 'Chinês', ru: 'Russo', ar: 'Árabe', ko: 'Coreano', nl: 'Holandês',
    };

    function readEntries() {
        try {
            const raw = localStorage.getItem(ENTRIES_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function writeEntries(lista) {
        try { localStorage.setItem(ENTRIES_KEY, JSON.stringify(lista)); }
        catch (e) { /* storage indisponível — segue sem persistir */ }
    }

    // Lidos/em leitura mais recentes primeiro (por início da leitura).
    function listar() {
        return readEntries().slice().sort((a, b) =>
            (b.dataInicio || '').localeCompare(a.dataInicio || '') || (b.criadoEm || 0) - (a.criadoEm || 0));
    }

    function salvar(entrada) {
        const lista = readEntries();
        lista.push(entrada);
        writeEntries(lista);
    }

    function remover(id) {
        writeEntries(readEntries().filter((e) => e.id !== id));
    }

    function obter(id) {
        return readEntries().find((e) => e.id === id);
    }

    function atualizar(id, dados) {
        const lista = readEntries();
        const item = lista.find((e) => e.id === id);
        if (!item) return;
        Object.assign(item, dados);
        writeEntries(lista);
    }

    function labelIdioma(codigo) {
        if (!codigo) return '';
        return IDIOMA_LABEL[codigo] || codigo;
    }

    // Chave opcional da Google Books (issue #27): sem ela, a busca usa a cota
    // anônima (compartilhada por IP/rede, sujeita a esgotar); com ela, o
    // usuário passa a ter cota própria. Colada em Configurações → Livros,
    // guardada só neste navegador — nunca embutida no código publicado.
    function getApiKey() {
        try { return localStorage.getItem(APIKEY_KEY) || ''; }
        catch (e) { return ''; }
    }

    function setApiKey(key) {
        try {
            if (key) localStorage.setItem(APIKEY_KEY, key);
            else localStorage.removeItem(APIKEY_KEY);
        } catch (e) { /* storage indisponível — segue sem persistir */ }
    }

    // Aceita ISBN-10 (9 dígitos + dígito verificador, que pode ser X) ou
    // ISBN-13 (13 dígitos), com ou sem hífen/espaço.
    function pareceIsbn(query) {
        const limpo = query.replace(/[-\s]/g, '');
        return /^(?:\d{9}[\dXx]|\d{13})$/.test(limpo);
    }

    async function buscarOpenLibrary(query) {
        const isbn = pareceIsbn(query);
        const url = isbn
            ? `https://openlibrary.org/search.json?isbn=${encodeURIComponent(query.replace(/[-\s]/g, ''))}&fields=key,title,author_name,first_publish_year,cover_i,publisher,number_of_pages_median,language&limit=10`
            : `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=key,title,author_name,first_publish_year,cover_i,publisher,number_of_pages_median,language&limit=10`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Falha ao conectar com a Open Library.');
        const dados = await resp.json();
        return (dados.docs || []).filter((d) => d.title).map((item) => ({
            id: `ol:${item.key}`,
            titulo: item.title,
            autor: (item.author_name || []).join(', '),
            ano: item.first_publish_year || '',
            capa: item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` : '',
            editora: (item.publisher || [])[0] || '',
            paginas: item.number_of_pages_median || '',
            idioma: labelIdioma((item.language || [])[0]),
            fonte: 'Open Library',
        }));
    }

    async function buscarGoogleBooks(query) {
        const termo = pareceIsbn(query) ? `isbn:${query.replace(/[-\s]/g, '')}` : query;
        const key = getApiKey();
        const chaveParam = key ? `&key=${encodeURIComponent(key)}` : '';
        const resp = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(termo)}&maxResults=10${chaveParam}`);
        if (resp.status === 429) {
            const err = new Error(key
                ? 'Cota da sua chave do Google Books esgotada por hoje.'
                : 'Cota anônima do Google Books esgotada (comum em redes compartilhadas) — configure sua própria chave em Configurações → Livros.');
            err.cotaEsgotada = true;
            throw err;
        }
        if (!resp.ok) throw new Error('Falha ao conectar com o Google Books.');
        const dados = await resp.json();
        return (dados.items || []).filter((it) => it.volumeInfo && it.volumeInfo.title).map((it) => {
            const v = it.volumeInfo;
            const capa = v.imageLinks ? (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail || '') : '';
            return {
                id: `gb:${it.id}`,
                titulo: v.title,
                autor: (v.authors || []).join(', '),
                ano: (v.publishedDate || '').slice(0, 4),
                capa: capa.replace(/^http:/, 'https:'),
                editora: v.publisher || '',
                paginas: v.pageCount || '',
                idioma: labelIdioma(v.language),
                fonte: 'Google Books',
            };
        });
    }

    // Tenta a Google Books primeiro; se não achar nada (ou falhar — a cota
    // anônima do Google Books é por IP e pode ser consumida por outros
    // usuários da mesma rede/operadora, então falha de vez em quando), cai
    // para a Open Library — segunda fonte, também sem exigir chave.
    async function buscarPorTitulo(query) {
        let resultados = [];
        let erroGoogleBooks = null;
        try { resultados = await buscarGoogleBooks(query); } catch (e) { erroGoogleBooks = e; }
        if (resultados.length) return resultados;
        try {
            const viaOpenLibrary = await buscarOpenLibrary(query);
            // Guarda o motivo específico (ex.: cota esgotada) para a UI avisar
            // com precisão, em vez do genérico "não encontrou nada".
            if (erroGoogleBooks) viaOpenLibrary.avisoGoogleBooks = erroGoogleBooks.message;
            return viaOpenLibrary;
        } catch (e) {
            // As duas fontes falharam — se o motivo foi cota esgotada, essa
            // mensagem já é específica o bastante; senão, avisa que as duas
            // tentativas falharam, em vez de só repetir o erro da Open Library.
            if (erroGoogleBooks && erroGoogleBooks.cotaEsgotada) throw erroGoogleBooks;
            if (erroGoogleBooks) throw new Error('Google Books e Open Library falharam — tente de novo em instantes, ou registre manualmente.');
            throw e;
        }
    }

    return { listar, salvar, remover, obter, atualizar, labelIdioma, buscarPorTitulo, getApiKey, setApiKey };
})();

(function () {
    const $ = (sel, ctx) => (ctx || document).querySelector(sel);

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function gerarId() {
        return `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    }

    let root = null;
    // Entrada em construção (resultado de busca escolhido, ou manual) antes
    // de ser salva — estado só em memória, não persiste até "Salvar".
    let rascunho = null;
    // Id do livro em edição (issue #28), ou null quando o rascunho é um
    // registro novo — controla se o submit chama salvar() ou atualizar().
    let editandoId = null;

    function estrelasBtns(valorAtual) {
        return Array.from({ length: 5 }, (_, i) => i + 1).map((n) => `
            <button type="button" data-action="estrela" data-n="${n}" aria-pressed="${n <= valorAtual}" aria-label="${n} de 5 estrelas"
                class="text-2xl leading-none ${n <= valorAtual ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}">
                <i aria-hidden="true" class="fa-solid fa-star"></i>
            </button>`).join('');
    }

    function renderResultadoBusca(item) {
        return `
        <button type="button" data-action="selecionar-resultado" data-id="${escapeHtml(item.id)}"
            class="w-full flex items-center gap-3 p-2 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left">
            ${item.capa
                ? `<img src="${escapeHtml(item.capa)}" alt="" class="w-10 h-14 object-cover rounded shrink-0 bg-gray-100 dark:bg-gray-700">`
                : `<div class="w-10 h-14 rounded shrink-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400"><i aria-hidden="true" class="fa-solid fa-book"></i></div>`}
            <div class="min-w-0">
                <p class="font-medium truncate">${escapeHtml(item.titulo)}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml([item.autor, item.ano].filter(Boolean).join(' · '))}</p>
            </div>
        </button>`;
    }

    function renderRascunho() {
        if (!rascunho) return '';
        const hoje = window.LogZenData.todayKey();
        const cabecalho = rascunho.manual
            ? `
            <div>
                <label class="block text-xs font-medium mb-1">Título</label>
                <input type="text" data-field="titulo" required maxlength="150" value="${escapeHtml(rascunho.titulo)}" placeholder="Nome do livro"
                    class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
            </div>
            <div>
                <label class="block text-xs font-medium mb-1">Autor</label>
                <input type="text" data-field="autor" maxlength="150" value="${escapeHtml(rascunho.autor || '')}" placeholder="Nome do autor"
                    class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
            </div>`
            : `
            <div class="flex gap-3">
                ${rascunho.capa
                    ? `<img src="${escapeHtml(rascunho.capa)}" alt="" class="w-16 h-24 object-cover rounded shrink-0 bg-gray-100 dark:bg-gray-700">`
                    : `<div class="w-16 h-24 rounded shrink-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400"><i aria-hidden="true" class="fa-solid fa-book text-xl"></i></div>`}
                <div class="min-w-0 flex-1">
                    <p class="font-semibold truncate">${escapeHtml(rascunho.titulo)}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(rascunho.autor || '')}</p>
                </div>
            </div>`;
        return `
        <form data-form-rascunho class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            ${cabecalho}
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-medium mb-1">Editora</label>
                    <input type="text" data-field="editora" maxlength="100" value="${escapeHtml(rascunho.editora || '')}"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Idioma</label>
                    <input type="text" data-field="idioma" maxlength="40" placeholder="ex.: Português" value="${escapeHtml(rascunho.idioma || '')}"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
                <div class="col-span-2">
                    <label class="block text-xs font-medium mb-1">Páginas</label>
                    <input type="number" data-field="paginas" min="1" value="${escapeHtml(rascunho.paginas || '')}"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-medium mb-1">Início da leitura</label>
                    <input type="date" data-field="dataInicio" value="${rascunho.dataInicio}" max="${hoje}"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Fim da leitura</label>
                    <input type="date" data-field="dataFim" value="${rascunho.dataFim || ''}" max="${hoje}" placeholder="ainda lendo"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
            </div>
            <div>
                <label class="block text-xs font-medium mb-1">Minhas estrelas</label>
                <div class="flex gap-1" data-estrelas>${estrelasBtns(rascunho.estrelas)}</div>
            </div>
            <div>
                <label class="block text-xs font-medium mb-1">Minha opinião</label>
                <textarea data-field="opiniao" rows="3" maxlength="500" placeholder="O que achou?"
                    class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">${escapeHtml(rascunho.opiniao || '')}</textarea>
            </div>
            <div class="flex items-center gap-2">
                <button type="submit" class="px-3 py-1.5 rounded bg-brand-600 dark:bg-accent-600 text-white text-sm font-semibold hover:bg-brand-700">${editandoId ? 'Salvar alterações' : 'Salvar'}</button>
                <button type="button" data-action="cancelar-rascunho" class="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Cancelar</button>
            </div>
        </form>`;
    }

    function renderPainelAdicionar() {
        if (rascunho) return renderRascunho();
        return `
        <div class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-3">
            <button type="button" data-action="toggle-add-livro" class="text-sm font-medium text-brand-700 dark:text-accent-400 hover:underline flex items-center gap-1">
                <i aria-hidden="true" class="fa-solid fa-plus"></i> Registrar livro
            </button>
            <div data-add-livro-body hidden class="space-y-3">
                <form data-form-busca class="flex items-center gap-2">
                    <input type="text" data-field="busca" placeholder="Título do livro ou ISBN…"
                        class="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    <button type="submit" class="px-3 py-2 rounded bg-brand-600 dark:bg-accent-600 text-white text-sm font-semibold hover:bg-brand-700 shrink-0">Buscar</button>
                </form>
                <p data-busca-status class="text-xs text-gray-500 dark:text-gray-400 hidden"></p>
                <div data-resultados-busca class="space-y-2"></div>
                <button type="button" data-action="adicionar-manual" class="text-xs font-medium text-brand-700 dark:text-accent-400 hover:underline">
                    Ou adicionar sem buscar
                </button>
            </div>
        </div>`;
    }

    function renderEntrada(e) {
        const capa = e.capa
            ? `<img src="${escapeHtml(e.capa)}" alt="" class="w-14 h-20 object-cover rounded shrink-0 bg-gray-100 dark:bg-gray-700">`
            : `<div class="w-14 h-20 rounded shrink-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400"><i aria-hidden="true" class="fa-solid fa-book"></i></div>`;
        const detalhes = [e.editora, e.idioma, e.paginas ? `${e.paginas} pág.` : ''].filter(Boolean).join(' · ');
        const fmt = (d) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
        let periodo = '';
        if (e.dataInicio && e.dataFim) periodo = `Lido de ${fmt(e.dataInicio)} a ${fmt(e.dataFim)}`;
        else if (e.dataInicio) periodo = `Lendo desde ${fmt(e.dataInicio)}`;
        else if (e.dataFim) periodo = `Concluído em ${fmt(e.dataFim)}`;
        const estrelas = Array.from({ length: 5 }, (_, i) => i + 1)
            .map((n) => `<i aria-hidden="true" class="fa-solid fa-star ${n <= e.estrelas ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'} text-sm"></i>`).join('');
        return `
        <div data-livro-entrada data-id="${e.id}" class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex gap-3">
            ${capa}
            <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                        <p class="font-semibold truncate">${escapeHtml(e.titulo)}</p>
                        ${e.autor ? `<p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(e.autor)}</p>` : ''}
                        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(detalhes)}</p>
                        ${periodo ? `<p class="text-xs font-medium text-brand-700 dark:text-accent-400 truncate">${escapeHtml(periodo)}</p>` : ''}
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                        <button type="button" data-action="editar-livro" aria-label="Editar ${escapeHtml(e.titulo)}"
                            class="w-7 h-7 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-accent-950/40 flex items-center justify-center">
                            <i aria-hidden="true" class="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button type="button" data-action="remover-livro" aria-label="Remover ${escapeHtml(e.titulo)}"
                            class="w-7 h-7 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center">
                            <i aria-hidden="true" class="fa-solid fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
                <div class="mt-1">${estrelas}</div>
                ${e.opiniao ? `<p class="text-sm mt-1">${escapeHtml(e.opiniao)}</p>` : ''}
            </div>
        </div>`;
    }

    function render() {
        if (!root) return;
        const entradas = window.LogZenLivros.listar();
        const listaHtml = entradas.length
            ? entradas.map(renderEntrada).join('')
            : '<p class="text-xs text-gray-500 dark:text-gray-400">Nenhum livro registrado ainda.</p>';
        root.innerHTML = renderPainelAdicionar() + `<div data-livros-lista class="space-y-3">${listaHtml}</div>`;
    }

    function wire(rootEl) {
        rootEl.addEventListener('click', async (e) => {
            const toggleBtn = e.target.closest('[data-action="toggle-add-livro"]');
            if (toggleBtn) {
                const body = toggleBtn.nextElementSibling;
                body.hidden = !body.hidden;
                return;
            }

            const manualBtn = e.target.closest('[data-action="adicionar-manual"]');
            if (manualBtn) {
                rascunho = {
                    manual: true, titulo: '', autor: '', capa: '', editora: '', idioma: '', paginas: '',
                    dataInicio: window.LogZenData.todayKey(), dataFim: '', estrelas: 0, opiniao: '',
                };
                render();
                return;
            }

            const selecionarBtn = e.target.closest('[data-action="selecionar-resultado"]');
            if (selecionarBtn) {
                const resultados = rootEl.__ultimaBusca || [];
                const item = resultados.find((d) => d.id === selecionarBtn.dataset.id);
                if (!item) return;
                rascunho = {
                    manual: false,
                    titulo: item.titulo,
                    autor: item.autor,
                    capa: item.capa,
                    editora: item.editora,
                    idioma: item.idioma,
                    paginas: item.paginas,
                    dataInicio: window.LogZenData.todayKey(),
                    dataFim: '',
                    estrelas: 0,
                    opiniao: '',
                };
                render();
                return;
            }

            const cancelarBtn = e.target.closest('[data-action="cancelar-rascunho"]');
            if (cancelarBtn) {
                rascunho = null;
                editandoId = null;
                render();
                return;
            }

            const editarBtn = e.target.closest('[data-action="editar-livro"]');
            if (editarBtn) {
                const card = editarBtn.closest('[data-livro-entrada]');
                const entrada = window.LogZenLivros.obter(card.dataset.id);
                if (!entrada) return;
                rascunho = { ...entrada, manual: true };
                editandoId = entrada.id;
                render();
                return;
            }

            const estrelaBtn = e.target.closest('[data-estrelas] button[data-action="estrela"]');
            if (estrelaBtn && rascunho) {
                const n = parseInt(estrelaBtn.dataset.n, 10);
                rascunho.estrelas = rascunho.estrelas === n ? 0 : n;
                const grupo = estrelaBtn.closest('[data-estrelas]');
                grupo.querySelectorAll('button[data-action="estrela"]').forEach((b) => {
                    const bn = parseInt(b.dataset.n, 10);
                    const ativo = bn <= rascunho.estrelas;
                    b.setAttribute('aria-pressed', ativo);
                    b.classList.toggle('text-amber-400', ativo);
                    b.classList.toggle('text-gray-300', !ativo);
                    b.classList.toggle('dark:text-gray-600', !ativo);
                });
                return;
            }

            const removerBtn = e.target.closest('[data-action="remover-livro"]');
            if (removerBtn) {
                const card = removerBtn.closest('[data-livro-entrada]');
                const titulo = card.querySelector('p.font-semibold').textContent;
                if (!window.confirm(`Remover "${titulo}" da lista?`)) return;
                window.LogZenLivros.remover(card.dataset.id);
                if (editandoId === card.dataset.id) { rascunho = null; editandoId = null; }
                render();
                return;
            }
        });

        rootEl.addEventListener('submit', async (e) => {
            const buscaForm = e.target.closest('form[data-form-busca]');
            if (buscaForm) {
                e.preventDefault();
                const query = buscaForm.querySelector('[data-field="busca"]').value.trim();
                if (!query) return;
                const resultadosEl = rootEl.querySelector('[data-resultados-busca]');
                const status = rootEl.querySelector('[data-busca-status]');
                try {
                    if (status) { status.textContent = 'Buscando…'; status.classList.remove('hidden'); }
                    const resultados = await window.LogZenLivros.buscarPorTitulo(query);
                    rootEl.__ultimaBusca = resultados;
                    if (resultadosEl) {
                        resultadosEl.innerHTML = resultados.length
                            ? resultados.map(renderResultadoBusca).join('')
                            : '';
                    }
                    if (status) {
                        if (!resultados.length) { status.textContent = 'Nada encontrado.'; status.classList.remove('hidden'); }
                        else if (resultados.avisoGoogleBooks) {
                            status.textContent = `${resultados.avisoGoogleBooks} Resultados via Open Library.`;
                            status.classList.remove('hidden');
                        } else if (resultados[0].fonte === 'Open Library') {
                            status.textContent = 'O Google Books não encontrou nada — resultados via Open Library.';
                            status.classList.remove('hidden');
                        } else {
                            status.classList.add('hidden');
                        }
                    }
                } catch (err) {
                    if (resultadosEl) resultadosEl.innerHTML = '';
                    if (status) { status.textContent = err.message; status.classList.remove('hidden'); }
                }
                return;
            }

            const rascunhoForm = e.target.closest('form[data-form-rascunho]');
            if (rascunhoForm && rascunho) {
                e.preventDefault();
                if (rascunho.manual) {
                    const titulo = rascunhoForm.querySelector('[data-field="titulo"]').value.trim();
                    if (!titulo) return;
                    rascunho.titulo = titulo;
                    rascunho.autor = rascunhoForm.querySelector('[data-field="autor"]').value.trim();
                }
                rascunho.editora = rascunhoForm.querySelector('[data-field="editora"]').value.trim();
                rascunho.idioma = rascunhoForm.querySelector('[data-field="idioma"]').value.trim();
                rascunho.paginas = rascunhoForm.querySelector('[data-field="paginas"]').value.trim();
                rascunho.dataInicio = rascunhoForm.querySelector('[data-field="dataInicio"]').value || '';
                rascunho.dataFim = rascunhoForm.querySelector('[data-field="dataFim"]').value || '';
                rascunho.opiniao = rascunhoForm.querySelector('[data-field="opiniao"]').value.trim();
                const entrada = { ...rascunho };
                delete entrada.manual;
                if (editandoId) {
                    window.LogZenLivros.atualizar(editandoId, entrada);
                    editandoId = null;
                } else {
                    entrada.id = gerarId();
                    entrada.criadoEm = Date.now();
                    window.LogZenLivros.salvar(entrada);
                }
                rascunho = null;
                render();
            }
        });
    }

    function init() {
        root = $('#livrosRoot');
        if (root) {
            render();
            wire(root);
        }

        const apiKeyInput = $('#googleBooksApiKeyInput');
        if (apiKeyInput) {
            apiKeyInput.value = window.LogZenLivros.getApiKey();
            apiKeyInput.addEventListener('change', () => {
                window.LogZenLivros.setApiKey(apiKeyInput.value.trim());
            });
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

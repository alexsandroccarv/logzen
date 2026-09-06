/* ==========================================================================
   LogZen — Filmes e séries (issue #11): registro do que foi assistido, com
   busca de metadados (pôster, duração, prêmios) via OMDb API e avaliação
   pessoal (estrelas + opinião). Site estático, sem backend — por isso a
   chave da OMDb é a do PRÓPRIO usuário (colada em Configurações → Filmes,
   guardada só no localStorage), nunca embutida no código publicado.
   Sem chave configurada, o registro manual (sem busca) continua funcionando.
   ========================================================================== */
window.LogZenFilmes = (function () {
    const ENTRIES_KEY = 'logzen:filmes:v1';
    const APIKEY_KEY = 'logzen:omdb-key:v1';

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

    // Mais recente assistido primeiro.
    function listar() {
        return readEntries().slice().sort((a, b) =>
            (b.assistidoEm || '').localeCompare(a.assistidoEm || '') || (b.criadoEm || 0) - (a.criadoEm || 0));
    }

    function salvar(entrada) {
        const lista = readEntries();
        lista.push(entrada);
        writeEntries(lista);
    }

    function remover(id) {
        writeEntries(readEntries().filter((e) => e.id !== id));
    }

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

    async function buscarPorTitulo(query) {
        const key = getApiKey();
        if (!key) throw new Error('Configure sua chave da OMDb API em Configurações → Filmes.');
        const resp = await fetch(`https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&s=${encodeURIComponent(query)}`);
        if (!resp.ok) throw new Error('Falha ao conectar com a OMDb API.');
        const dados = await resp.json();
        if (dados.Response === 'False') throw new Error(dados.Error || 'Nada encontrado.');
        return dados.Search || [];
    }

    async function buscarDetalhes(imdbID) {
        const key = getApiKey();
        if (!key) throw new Error('Configure sua chave da OMDb API em Configurações → Filmes.');
        const resp = await fetch(`https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&i=${encodeURIComponent(imdbID)}&plot=short`);
        if (!resp.ok) throw new Error('Falha ao conectar com a OMDb API.');
        const dados = await resp.json();
        if (dados.Response === 'False') throw new Error(dados.Error || 'Não encontrado.');
        return dados;
    }

    return { listar, salvar, remover, getApiKey, setApiKey, buscarPorTitulo, buscarDetalhes };
})();

(function () {
    const $ = (sel, ctx) => (ctx || document).querySelector(sel);
    const TIPO_LABEL = { movie: 'Filme', series: 'Série', episode: 'Episódio' };

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function gerarId() {
        return `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    }

    let root = null;
    // Entrada em construção (resultado de busca escolhido, ou manual) antes
    // de ser salva — estado só em memória, não persiste até "Salvar".
    let rascunho = null;

    function estrelasBtns(valorAtual) {
        return Array.from({ length: 5 }, (_, i) => i + 1).map((n) => `
            <button type="button" data-action="estrela" data-n="${n}" aria-pressed="${n <= valorAtual}" aria-label="${n} de 5 estrelas"
                class="text-2xl leading-none ${n <= valorAtual ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}">
                <i aria-hidden="true" class="fa-solid fa-star"></i>
            </button>`).join('');
    }

    function renderResultadoBusca(item) {
        const poster = item.Poster && item.Poster !== 'N/A' ? item.Poster : '';
        return `
        <button type="button" data-action="selecionar-resultado" data-imdbid="${escapeHtml(item.imdbID)}"
            class="w-full flex items-center gap-3 p-2 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left">
            ${poster
                ? `<img src="${escapeHtml(poster)}" alt="" class="w-10 h-14 object-cover rounded shrink-0 bg-gray-100 dark:bg-gray-700">`
                : `<div class="w-10 h-14 rounded shrink-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400"><i aria-hidden="true" class="fa-solid fa-film"></i></div>`}
            <div class="min-w-0">
                <p class="font-medium truncate">${escapeHtml(item.Title)}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(item.Year || '')} · ${escapeHtml(TIPO_LABEL[item.Type] || item.Type || '')}</p>
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
                <input type="text" data-field="titulo" required maxlength="120" value="${escapeHtml(rascunho.titulo)}" placeholder="Nome do filme ou série"
                    class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
            </div>
            <div>
                <label class="block text-xs font-medium mb-1">Tipo</label>
                <select data-field="tipo" class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    <option value="movie" ${rascunho.tipo !== 'series' ? 'selected' : ''}>Filme</option>
                    <option value="series" ${rascunho.tipo === 'series' ? 'selected' : ''}>Série</option>
                </select>
            </div>`
            : `
            <div class="flex gap-3">
                ${rascunho.poster
                    ? `<img src="${escapeHtml(rascunho.poster)}" alt="" class="w-16 h-24 object-cover rounded shrink-0 bg-gray-100 dark:bg-gray-700">`
                    : `<div class="w-16 h-24 rounded shrink-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400"><i aria-hidden="true" class="fa-solid fa-film text-xl"></i></div>`}
                <div class="min-w-0 flex-1">
                    <p class="font-semibold truncate">${escapeHtml(rascunho.titulo)}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml([rascunho.ano, rascunho.tempo, rascunho.genero].filter(Boolean).join(' · '))}</p>
                    ${rascunho.premios ? `<p class="text-xs text-amber-600 dark:text-amber-400 mt-1"><i aria-hidden="true" class="fa-solid fa-trophy mr-1"></i>${escapeHtml(rascunho.premios)}</p>` : ''}
                </div>
            </div>`;
        return `
        <form data-form-rascunho class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            ${cabecalho}
            <div>
                <label class="block text-xs font-medium mb-1">Assistido em</label>
                <input type="date" data-field="assistidoEm" value="${rascunho.assistidoEm}" max="${hoje}"
                    class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
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
                <button type="submit" class="px-3 py-1.5 rounded bg-brand-600 dark:bg-accent-600 text-white text-sm font-semibold hover:bg-brand-700">Salvar</button>
                <button type="button" data-action="cancelar-rascunho" class="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Cancelar</button>
            </div>
        </form>`;
    }

    function renderPainelAdicionar() {
        if (rascunho) return renderRascunho();
        const temChave = !!window.LogZenFilmes.getApiKey();
        return `
        <div class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-3">
            <button type="button" data-action="toggle-add-filme" class="text-sm font-medium text-brand-700 dark:text-accent-400 hover:underline flex items-center gap-1">
                <i aria-hidden="true" class="fa-solid fa-plus"></i> Registrar filme/série
            </button>
            <div data-add-filme-body hidden class="space-y-3">
                ${temChave ? `
                <form data-form-busca class="flex items-center gap-2">
                    <input type="text" data-field="busca" placeholder="Título do filme ou série…"
                        class="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    <button type="submit" class="px-3 py-2 rounded bg-brand-600 dark:bg-accent-600 text-white text-sm font-semibold hover:bg-brand-700 shrink-0">Buscar</button>
                </form>
                <p data-busca-status class="text-xs text-gray-500 dark:text-gray-400 hidden"></p>
                <div data-resultados-busca class="space-y-2"></div>
                ` : `
                <p class="text-xs text-gray-500 dark:text-gray-400">
                    Configure sua chave da OMDb API em Configurações → Filmes
                    para buscar automaticamente, ou registre manualmente abaixo.
                </p>`}
                <button type="button" data-action="adicionar-manual" class="text-xs font-medium text-brand-700 dark:text-accent-400 hover:underline">
                    ${temChave ? 'Ou adicionar sem buscar' : 'Adicionar manualmente'}
                </button>
            </div>
        </div>`;
    }

    function renderEntrada(e) {
        const poster = e.poster
            ? `<img src="${escapeHtml(e.poster)}" alt="" class="w-14 h-20 object-cover rounded shrink-0 bg-gray-100 dark:bg-gray-700">`
            : `<div class="w-14 h-20 rounded shrink-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400"><i aria-hidden="true" class="fa-solid fa-film"></i></div>`;
        const detalhes = [e.ano, e.tempo, e.genero, TIPO_LABEL[e.tipo] || e.tipo].filter(Boolean).join(' · ');
        const estrelas = Array.from({ length: 5 }, (_, i) => i + 1)
            .map((n) => `<i aria-hidden="true" class="fa-solid fa-star ${n <= e.estrelas ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'} text-sm"></i>`).join('');
        const dataFmt = new Date(e.assistidoEm + 'T00:00:00').toLocaleDateString('pt-BR');
        return `
        <div data-filme-entrada data-id="${e.id}" class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex gap-3">
            ${poster}
            <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                        <p class="font-semibold truncate">${escapeHtml(e.titulo)}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(detalhes)} · assistido em ${dataFmt}</p>
                    </div>
                    <button type="button" data-action="remover-filme" aria-label="Remover ${escapeHtml(e.titulo)}"
                        class="w-7 h-7 shrink-0 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
                ${e.premios ? `<p class="text-xs text-amber-600 dark:text-amber-400 mt-1"><i aria-hidden="true" class="fa-solid fa-trophy mr-1"></i>${escapeHtml(e.premios)}</p>` : ''}
                <div class="mt-1">${estrelas}</div>
                ${e.opiniao ? `<p class="text-sm mt-1">${escapeHtml(e.opiniao)}</p>` : ''}
            </div>
        </div>`;
    }

    function render() {
        if (!root) return;
        const entradas = window.LogZenFilmes.listar();
        const listaHtml = entradas.length
            ? entradas.map(renderEntrada).join('')
            : '<p class="text-xs text-gray-500 dark:text-gray-400">Nenhum filme/série registrado ainda.</p>';
        root.innerHTML = renderPainelAdicionar() + `<div data-filmes-lista class="space-y-3">${listaHtml}</div>`;
    }

    function wire(rootEl) {
        rootEl.addEventListener('click', async (e) => {
            const toggleBtn = e.target.closest('[data-action="toggle-add-filme"]');
            if (toggleBtn) {
                const body = toggleBtn.nextElementSibling;
                body.hidden = !body.hidden;
                return;
            }

            const manualBtn = e.target.closest('[data-action="adicionar-manual"]');
            if (manualBtn) {
                rascunho = {
                    manual: true, titulo: '', tipo: 'movie', poster: '', ano: '', tempo: '', genero: '', premios: '',
                    assistidoEm: window.LogZenData.todayKey(), estrelas: 0, opiniao: '',
                };
                render();
                return;
            }

            const selecionarBtn = e.target.closest('[data-action="selecionar-resultado"]');
            if (selecionarBtn) {
                const status = rootEl.querySelector('[data-busca-status]');
                try {
                    if (status) { status.textContent = 'Carregando detalhes…'; status.classList.remove('hidden'); }
                    const d = await window.LogZenFilmes.buscarDetalhes(selecionarBtn.dataset.imdbid);
                    rascunho = {
                        manual: false,
                        titulo: d.Title,
                        tipo: d.Type || 'movie',
                        imdbID: d.imdbID,
                        poster: d.Poster && d.Poster !== 'N/A' ? d.Poster : '',
                        ano: d.Year || '',
                        tempo: d.Runtime && d.Runtime !== 'N/A' ? d.Runtime : '',
                        genero: d.Genre && d.Genre !== 'N/A' ? d.Genre : '',
                        premios: d.Awards && d.Awards !== 'N/A' ? d.Awards : '',
                        assistidoEm: window.LogZenData.todayKey(),
                        estrelas: 0,
                        opiniao: '',
                    };
                    render();
                } catch (err) {
                    if (status) { status.textContent = 'Erro ao buscar detalhes: ' + err.message; status.classList.remove('hidden'); }
                }
                return;
            }

            const cancelarBtn = e.target.closest('[data-action="cancelar-rascunho"]');
            if (cancelarBtn) {
                rascunho = null;
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

            const removerBtn = e.target.closest('[data-action="remover-filme"]');
            if (removerBtn) {
                const card = removerBtn.closest('[data-filme-entrada]');
                const titulo = card.querySelector('p.font-semibold').textContent;
                if (!window.confirm(`Remover "${titulo}" da lista?`)) return;
                window.LogZenFilmes.remover(card.dataset.id);
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
                    const resultados = await window.LogZenFilmes.buscarPorTitulo(query);
                    if (resultadosEl) resultadosEl.innerHTML = resultados.map(renderResultadoBusca).join('');
                    if (status) status.classList.add('hidden');
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
                    rascunho.tipo = rascunhoForm.querySelector('[data-field="tipo"]').value;
                }
                rascunho.assistidoEm = rascunhoForm.querySelector('[data-field="assistidoEm"]').value || window.LogZenData.todayKey();
                rascunho.opiniao = rascunhoForm.querySelector('[data-field="opiniao"]').value.trim();
                const entrada = { ...rascunho, id: gerarId(), criadoEm: Date.now() };
                delete entrada.manual;
                window.LogZenFilmes.salvar(entrada);
                rascunho = null;
                render();
            }
        });
    }

    function init() {
        root = $('#filmesRoot');
        if (root) {
            render();
            wire(root);
        }

        const apiKeyInput = $('#omdbApiKeyInput');
        if (apiKeyInput) {
            apiKeyInput.value = window.LogZenFilmes.getApiKey();
            apiKeyInput.addEventListener('change', () => {
                window.LogZenFilmes.setApiKey(apiKeyInput.value.trim());
                render();
            });
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

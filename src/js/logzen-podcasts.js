/* ==========================================================================
   LogZen — Podcasts (issue #22): assinaturas acompanhadas e episódios
   ouvidos. Busca de assinaturas via iTunes Search API — pública, sem
   exigir chave (como a Open Library em Livros) — trazendo capa, autor/
   apresentador, categoria e link. Cadastro manual sempre disponível.
   Remover uma assinatura não apaga os episódios já registrados: cada
   episódio guarda o nome do podcast como snapshot, independente do id.
   Avaliação em 10 estrelas, em vez de 5 (issue #32), mesma escala usada em
   Vídeos e Livros.
   ========================================================================== */
window.LogZenPodcasts = (function () {
    const PODCASTS_KEY = 'logzen:podcasts:v1';
    const EPISODIOS_KEY = 'logzen:podcast-episodios:v1';

    function readList(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function writeList(key, lista) {
        try { localStorage.setItem(key, JSON.stringify(lista)); }
        catch (e) { /* storage indisponível — segue sem persistir */ }
    }

    function listarPodcasts() {
        return readList(PODCASTS_KEY).slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    }

    function salvarPodcast(p) {
        const lista = readList(PODCASTS_KEY);
        lista.push(p);
        writeList(PODCASTS_KEY, lista);
    }

    function removerPodcast(id) {
        writeList(PODCASTS_KEY, readList(PODCASTS_KEY).filter((p) => p.id !== id));
    }

    function obterPodcast(id) {
        return readList(PODCASTS_KEY).find((p) => p.id === id);
    }

    function atualizarPodcast(id, dados) {
        const lista = readList(PODCASTS_KEY);
        const item = lista.find((p) => p.id === id);
        if (!item) return;
        Object.assign(item, dados);
        writeList(PODCASTS_KEY, lista);
    }

    // Mais recente ouvido primeiro.
    function listarEpisodios() {
        return readList(EPISODIOS_KEY).slice().sort((a, b) =>
            (b.dataOuvido || '').localeCompare(a.dataOuvido || '') || (b.criadoEm || 0) - (a.criadoEm || 0));
    }

    function salvarEpisodio(e) {
        const lista = readList(EPISODIOS_KEY);
        lista.push(e);
        writeList(EPISODIOS_KEY, lista);
    }

    function removerEpisodio(id) {
        writeList(EPISODIOS_KEY, readList(EPISODIOS_KEY).filter((e) => e.id !== id));
    }

    function obterEpisodio(id) {
        return readList(EPISODIOS_KEY).find((e) => e.id === id);
    }

    function atualizarEpisodio(id, dados) {
        const lista = readList(EPISODIOS_KEY);
        const item = lista.find((e) => e.id === id);
        if (!item) return;
        Object.assign(item, dados);
        writeList(EPISODIOS_KEY, lista);
    }

    async function buscarPodcasts(query) {
        const resp = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=podcast&entity=podcast&limit=10`);
        if (!resp.ok) throw new Error('Falha ao conectar com a busca de podcasts.');
        const dados = await resp.json();
        return (dados.results || []).filter((r) => r.collectionName || r.trackName);
    }

    return {
        listarPodcasts, salvarPodcast, removerPodcast, obterPodcast, atualizarPodcast,
        listarEpisodios, salvarEpisodio, removerEpisodio, obterEpisodio, atualizarEpisodio,
        buscarPodcasts,
    };
})();

(function () {
    const $ = (sel, ctx) => (ctx || document).querySelector(sel);

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function gerarId(prefixo) {
        return `${prefixo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    }

    function dataValida(d) {
        return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d + 'T00:00:00').getTime());
    }

    function fmtData(d) {
        return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
    }

    let root = null;
    // Assinaturas: rascunho (busca/manual) + edição, no mesmo padrão de Filmes/Livros.
    let rascunhoPodcast = null;
    let editandoPodcastId = null;
    // Episódios: sem busca externa, só edição.
    let editandoEpisodioId = null;

    function estrelasBtns(valorAtual) {
        return Array.from({ length: 10 }, (_, i) => i + 1).map((n) => `
            <button type="button" data-action="estrela" data-n="${n}" aria-pressed="${n <= valorAtual}" aria-label="${n} de 10 estrelas"
                class="text-xl leading-none ${n <= valorAtual ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}">
                <i aria-hidden="true" class="fa-solid fa-star"></i>
            </button>`).join('');
    }

    /* ---------------------------- Assinaturas ---------------------------- */

    function renderResultadoBusca(item) {
        const capa = item.artworkUrl600 || item.artworkUrl100 || '';
        const nome = item.collectionName || item.trackName || '';
        return `
        <button type="button" data-action="selecionar-podcast" data-collection-id="${escapeHtml(item.collectionId || '')}"
            class="w-full flex items-center gap-3 p-2 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left">
            ${capa
                ? `<img src="${escapeHtml(capa)}" alt="" class="w-10 h-10 object-cover rounded shrink-0 bg-gray-100 dark:bg-gray-700">`
                : `<div class="w-10 h-10 rounded shrink-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400"><i aria-hidden="true" class="fa-solid fa-podcast"></i></div>`}
            <div class="min-w-0">
                <p class="font-medium truncate">${escapeHtml(nome)}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml([item.artistName, item.primaryGenreName].filter(Boolean).join(' · '))}</p>
            </div>
        </button>`;
    }

    function renderFormPodcast() {
        const editando = editandoPodcastId ? window.LogZenPodcasts.obterPodcast(editandoPodcastId) : null;
        const r = rascunhoPodcast || (editando ? { ...editando, manual: true } : null);
        if (!r) {
            return `
            <div class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-3">
                <button type="button" data-action="toggle-add-podcast" class="text-sm font-medium text-brand-700 dark:text-accent-400 hover:underline flex items-center gap-1">
                    <i aria-hidden="true" class="fa-solid fa-plus"></i> Adicionar assinatura
                </button>
                <div data-add-podcast-body hidden class="space-y-3">
                    <form data-form-busca-podcast class="flex items-center gap-2">
                        <input type="text" data-field="busca" placeholder="Nome do podcast…"
                            class="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                        <button type="submit" class="px-3 py-2 rounded bg-brand-600 dark:bg-accent-600 text-white text-sm font-semibold hover:bg-brand-700 shrink-0">Buscar</button>
                    </form>
                    <p data-busca-podcast-status class="text-xs text-gray-500 dark:text-gray-400 hidden"></p>
                    <div data-resultados-busca-podcast class="space-y-2"></div>
                    <button type="button" data-action="adicionar-podcast-manual" class="text-xs font-medium text-brand-700 dark:text-accent-400 hover:underline">
                        Ou adicionar sem buscar
                    </button>
                </div>
            </div>`;
        }
        const cabecalho = r.manual
            ? `
            <div>
                <label class="block text-xs font-medium mb-1">Nome</label>
                <input type="text" data-field="nome" required maxlength="120" value="${escapeHtml(r.nome || '')}" placeholder="Nome do podcast"
                    class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
            </div>
            <div>
                <label class="block text-xs font-medium mb-1">Autor/apresentador (opcional)</label>
                <input type="text" data-field="autor" maxlength="120" value="${escapeHtml(r.autor || '')}"
                    class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
            </div>
            <div>
                <label class="block text-xs font-medium mb-1">Categoria (opcional)</label>
                <input type="text" data-field="categoria" maxlength="60" value="${escapeHtml(r.categoria || '')}"
                    class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
            </div>`
            : `
            <div class="flex gap-3">
                ${r.capa
                    ? `<img src="${escapeHtml(r.capa)}" alt="" class="w-16 h-16 object-cover rounded shrink-0 bg-gray-100 dark:bg-gray-700">`
                    : `<div class="w-16 h-16 rounded shrink-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400"><i aria-hidden="true" class="fa-solid fa-podcast text-xl"></i></div>`}
                <div class="min-w-0 flex-1">
                    <p class="font-semibold truncate">${escapeHtml(r.nome)}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml([r.autor, r.categoria].filter(Boolean).join(' · '))}</p>
                </div>
            </div>`;
        return `
        <form data-form-rascunho-podcast class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            ${editando ? `<p class="text-sm font-medium text-brand-700 dark:text-accent-400 flex items-center gap-1.5"><i aria-hidden="true" class="fa-solid fa-pen"></i> Editando "${escapeHtml(editando.nome)}"</p>` : ''}
            ${cabecalho}
            <div class="flex items-center gap-2">
                <button type="submit" class="px-3 py-1.5 rounded bg-brand-600 dark:bg-accent-600 text-white text-sm font-semibold hover:bg-brand-700">${editando ? 'Salvar alterações' : 'Salvar'}</button>
                <button type="button" data-action="cancelar-rascunho-podcast" class="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Cancelar</button>
            </div>
        </form>`;
    }

    function renderPodcastCard(p) {
        const capa = p.capa
            ? `<img src="${escapeHtml(p.capa)}" alt="" class="w-12 h-12 object-cover rounded shrink-0 bg-gray-100 dark:bg-gray-700">`
            : `<div class="w-12 h-12 rounded shrink-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400"><i aria-hidden="true" class="fa-solid fa-podcast"></i></div>`;
        const detalhes = [p.autor, p.categoria].filter(Boolean).join(' · ');
        return `
        <div data-podcast-card data-id="${p.id}" class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex gap-3">
            ${capa}
            <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                        <p class="font-semibold truncate">${escapeHtml(p.nome)}</p>
                        ${detalhes ? `<p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(detalhes)}</p>` : ''}
                        ${p.link ? `<a href="${escapeHtml(p.link)}" target="_blank" rel="noopener" class="text-xs text-brand-600 dark:text-accent-400 hover:underline">Abrir página do podcast</a>` : ''}
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                        <button type="button" data-action="editar-podcast" aria-label="Editar ${escapeHtml(p.nome)}"
                            class="w-7 h-7 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-accent-950/40 flex items-center justify-center">
                            <i aria-hidden="true" class="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button type="button" data-action="remover-podcast" aria-label="Remover ${escapeHtml(p.nome)}"
                            class="w-7 h-7 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center">
                            <i aria-hidden="true" class="fa-solid fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }

    /* ---------------------------- Episódios ---------------------------- */

    function renderFormEpisodio(podcasts) {
        const editando = editandoEpisodioId ? window.LogZenPodcasts.obterEpisodio(editandoEpisodioId) : null;
        if (!podcasts.length) {
            return `
            <div class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4">
                <p class="text-xs text-gray-500 dark:text-gray-400">Adicione uma assinatura acima antes de registrar um episódio ouvido.</p>
            </div>`;
        }
        const hoje = window.LogZenData.todayKey();
        const v = editando || { podcastId: podcasts[0].id, titulo: '', duracao: '', dataOuvido: hoje, estrelas: 0, opiniao: '' };
        const opcoesPodcast = podcasts.map((p) => `<option value="${p.id}" ${v.podcastId === p.id ? 'selected' : ''}>${escapeHtml(p.nome)}</option>`).join('');
        const cabecalho = editando
            ? `<p class="text-sm font-medium text-brand-700 dark:text-accent-400 flex items-center gap-1.5"><i aria-hidden="true" class="fa-solid fa-pen"></i> Editando "${escapeHtml(editando.titulo)}"</p>`
            : `<button type="button" data-action="toggle-add-episodio" class="text-sm font-medium text-brand-700 dark:text-accent-400 hover:underline flex items-center gap-1">
                   <i aria-hidden="true" class="fa-solid fa-plus"></i> Registrar episódio ouvido
               </button>`;
        return `
        <div class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-3">
            ${cabecalho}
            <form data-form-episodio ${editando ? '' : 'hidden'} class="space-y-3">
                <div>
                    <label class="block text-xs font-medium mb-1">Podcast</label>
                    <select data-field="podcastId" required
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                        ${opcoesPodcast}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Título do episódio</label>
                    <input type="text" data-field="titulo" required maxlength="150" value="${escapeHtml(v.titulo)}" placeholder="Nome do episódio"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-medium mb-1">Duração (opcional)</label>
                        <input type="text" data-field="duracao" maxlength="20" placeholder="ex.: 45 min" value="${escapeHtml(v.duracao || '')}"
                            class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    </div>
                    <div>
                        <label class="block text-xs font-medium mb-1">Ouvido em</label>
                        <input type="date" data-field="dataOuvido" value="${v.dataOuvido || hoje}" max="${hoje}"
                            class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Minhas estrelas</label>
                    <div class="flex flex-wrap gap-1" data-estrelas data-valor="${v.estrelas || 0}">${estrelasBtns(v.estrelas)}</div>
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Minha opinião</label>
                    <textarea data-field="opiniao" rows="2" maxlength="500" placeholder="O que achou?"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">${escapeHtml(v.opiniao || '')}</textarea>
                </div>
                <div class="flex items-center gap-2">
                    <button type="submit" class="px-3 py-1.5 rounded bg-brand-600 dark:bg-accent-600 text-white text-sm font-semibold hover:bg-brand-700">${editando ? 'Salvar alterações' : 'Salvar'}</button>
                    <button type="button" data-action="cancelar-episodio" class="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Cancelar</button>
                </div>
            </form>
        </div>`;
    }

    function renderEpisodioCard(e) {
        const estrelas = Array.from({ length: 10 }, (_, i) => i + 1)
            .map((n) => `<i aria-hidden="true" class="fa-solid fa-star ${n <= e.estrelas ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'} text-xs"></i>`).join('');
        const detalhes = [e.duracao, dataValida(e.dataOuvido) ? `ouvido em ${fmtData(e.dataOuvido)}` : ''].filter(Boolean).join(' · ');
        return `
        <div data-episodio-card data-id="${e.id}" class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                    <span class="inline-block px-2 py-0.5 rounded-full bg-brand-100 dark:bg-gray-700 text-brand-700 dark:text-accent-400 text-xs font-medium mb-1">${escapeHtml(e.podcastNome)}</span>
                    <p class="font-semibold truncate">${escapeHtml(e.titulo)}</p>
                    ${detalhes ? `<p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(detalhes)}</p>` : ''}
                    <div class="mt-1">${estrelas}</div>
                    ${e.opiniao ? `<p class="text-sm mt-1">${escapeHtml(e.opiniao)}</p>` : ''}
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    <button type="button" data-action="editar-episodio" aria-label="Editar ${escapeHtml(e.titulo)}"
                        class="w-7 h-7 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-accent-950/40 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button type="button" data-action="remover-episodio" aria-label="Remover ${escapeHtml(e.titulo)}"
                        class="w-7 h-7 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        </div>`;
    }

    /* ------------------------------- Render ------------------------------- */

    function render() {
        if (!root) return;
        const podcasts = window.LogZenPodcasts.listarPodcasts();
        const episodios = window.LogZenPodcasts.listarEpisodios();
        const podcastsHtml = podcasts.length
            ? podcasts.map(renderPodcastCard).join('')
            : '<p class="text-xs text-gray-500 dark:text-gray-400">Nenhuma assinatura ainda.</p>';
        const episodiosHtml = episodios.length
            ? episodios.map(renderEpisodioCard).join('')
            : '<p class="text-xs text-gray-500 dark:text-gray-400">Nenhum episódio registrado ainda.</p>';
        root.innerHTML = `
            <div class="space-y-3">
                <h3 class="text-sm font-semibold flex items-center gap-2"><i aria-hidden="true" class="fa-solid fa-list text-brand-600 dark:text-accent-400"></i> Minhas assinaturas</h3>
                ${renderFormPodcast()}
                <div data-podcasts-lista class="space-y-3">${podcastsHtml}</div>
            </div>
            <div class="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 class="text-sm font-semibold flex items-center gap-2"><i aria-hidden="true" class="fa-solid fa-headphones text-brand-600 dark:text-accent-400"></i> Episódios ouvidos</h3>
                ${renderFormEpisodio(podcasts)}
                <div data-episodios-lista class="space-y-3">${episodiosHtml}</div>
            </div>`;
    }

    function wire(rootEl) {
        rootEl.addEventListener('click', async (e) => {
            const toggleBtn = e.target.closest('[data-action="toggle-add-podcast"]');
            if (toggleBtn) {
                const body = toggleBtn.nextElementSibling;
                body.hidden = !body.hidden;
                return;
            }

            const manualBtn = e.target.closest('[data-action="adicionar-podcast-manual"]');
            if (manualBtn) {
                rascunhoPodcast = { manual: true, nome: '', autor: '', capa: '', categoria: '', link: '', collectionId: '' };
                render();
                return;
            }

            const selecionarBtn = e.target.closest('[data-action="selecionar-podcast"]');
            if (selecionarBtn) {
                const resultados = rootEl.__ultimaBuscaPodcast || [];
                const item = resultados.find((r) => String(r.collectionId) === selecionarBtn.dataset.collectionId);
                if (!item) return;
                rascunhoPodcast = {
                    manual: false,
                    nome: item.collectionName || item.trackName || '',
                    autor: item.artistName || '',
                    capa: item.artworkUrl600 || item.artworkUrl100 || '',
                    categoria: item.primaryGenreName || '',
                    link: item.collectionViewUrl || '',
                    collectionId: item.collectionId || '',
                };
                render();
                return;
            }

            const cancelarPodcastBtn = e.target.closest('[data-action="cancelar-rascunho-podcast"]');
            if (cancelarPodcastBtn) {
                rascunhoPodcast = null;
                editandoPodcastId = null;
                render();
                return;
            }

            const editarPodcastBtn = e.target.closest('[data-action="editar-podcast"]');
            if (editarPodcastBtn) {
                const card = editarPodcastBtn.closest('[data-podcast-card]');
                editandoPodcastId = card.dataset.id;
                rascunhoPodcast = null;
                render();
                return;
            }

            const removerPodcastBtn = e.target.closest('[data-action="remover-podcast"]');
            if (removerPodcastBtn) {
                const card = removerPodcastBtn.closest('[data-podcast-card]');
                const nome = card.querySelector('p.font-semibold').textContent;
                if (!window.confirm(`Remover a assinatura "${nome}"? Os episódios já registrados continuam guardados.`)) return;
                window.LogZenPodcasts.removerPodcast(card.dataset.id);
                if (editandoPodcastId === card.dataset.id) editandoPodcastId = null;
                render();
                return;
            }

            const estrelaBtn = e.target.closest('[data-estrelas] button[data-action="estrela"]');
            if (estrelaBtn) {
                const grupo = estrelaBtn.closest('[data-estrelas]');
                const atual = grupo.querySelectorAll('[aria-pressed="true"]').length;
                const n = parseInt(estrelaBtn.dataset.n, 10);
                const novo = atual === n ? 0 : n;
                grupo.dataset.valor = novo;
                grupo.querySelectorAll('button[data-action="estrela"]').forEach((b) => {
                    const bn = parseInt(b.dataset.n, 10);
                    const ativo = bn <= novo;
                    b.setAttribute('aria-pressed', ativo);
                    b.classList.toggle('text-amber-400', ativo);
                    b.classList.toggle('text-gray-300', !ativo);
                    b.classList.toggle('dark:text-gray-600', !ativo);
                });
                return;
            }

            const toggleEpisodioBtn = e.target.closest('[data-action="toggle-add-episodio"]');
            if (toggleEpisodioBtn) {
                const form = toggleEpisodioBtn.nextElementSibling;
                form.hidden = !form.hidden;
                return;
            }

            const cancelarEpisodioBtn = e.target.closest('[data-action="cancelar-episodio"]');
            if (cancelarEpisodioBtn) {
                if (editandoEpisodioId) {
                    editandoEpisodioId = null;
                    render();
                } else {
                    const form = cancelarEpisodioBtn.closest('form[data-form-episodio]');
                    form.reset();
                    form.hidden = true;
                }
                return;
            }

            const editarEpisodioBtn = e.target.closest('[data-action="editar-episodio"]');
            if (editarEpisodioBtn) {
                const card = editarEpisodioBtn.closest('[data-episodio-card]');
                editandoEpisodioId = card.dataset.id;
                render();
                return;
            }

            const removerEpisodioBtn = e.target.closest('[data-action="remover-episodio"]');
            if (removerEpisodioBtn) {
                const card = removerEpisodioBtn.closest('[data-episodio-card]');
                const titulo = card.querySelector('p.font-semibold').textContent;
                if (!window.confirm(`Remover o episódio "${titulo}"?`)) return;
                window.LogZenPodcasts.removerEpisodio(card.dataset.id);
                if (editandoEpisodioId === card.dataset.id) editandoEpisodioId = null;
                render();
                return;
            }
        });

        rootEl.addEventListener('submit', async (e) => {
            const buscaForm = e.target.closest('form[data-form-busca-podcast]');
            if (buscaForm) {
                e.preventDefault();
                const query = buscaForm.querySelector('[data-field="busca"]').value.trim();
                if (!query) return;
                const resultadosEl = rootEl.querySelector('[data-resultados-busca-podcast]');
                const status = rootEl.querySelector('[data-busca-podcast-status]');
                try {
                    if (status) { status.textContent = 'Buscando…'; status.classList.remove('hidden'); }
                    const resultados = await window.LogZenPodcasts.buscarPodcasts(query);
                    rootEl.__ultimaBuscaPodcast = resultados;
                    if (resultadosEl) {
                        resultadosEl.innerHTML = resultados.length ? resultados.map(renderResultadoBusca).join('') : '';
                    }
                    if (status) {
                        if (resultados.length) status.classList.add('hidden');
                        else { status.textContent = 'Nada encontrado.'; status.classList.remove('hidden'); }
                    }
                } catch (err) {
                    if (resultadosEl) resultadosEl.innerHTML = '';
                    if (status) { status.textContent = err.message; status.classList.remove('hidden'); }
                }
                return;
            }

            const rascunhoForm = e.target.closest('form[data-form-rascunho-podcast]');
            if (rascunhoForm) {
                e.preventDefault();
                const editando = editandoPodcastId ? window.LogZenPodcasts.obterPodcast(editandoPodcastId) : null;
                const base = rascunhoPodcast || (editando ? { ...editando } : null);
                if (!base) return;
                if (base.manual || editando) {
                    const nome = rascunhoForm.querySelector('[data-field="nome"]').value.trim();
                    if (!nome) return;
                    base.nome = nome;
                    base.autor = rascunhoForm.querySelector('[data-field="autor"]').value.trim();
                    base.categoria = rascunhoForm.querySelector('[data-field="categoria"]').value.trim();
                }
                const dados = { ...base };
                delete dados.manual;
                if (editandoPodcastId) {
                    window.LogZenPodcasts.atualizarPodcast(editandoPodcastId, dados);
                    editandoPodcastId = null;
                } else {
                    window.LogZenPodcasts.salvarPodcast({ ...dados, id: gerarId('pd'), criadoEm: Date.now() });
                }
                rascunhoPodcast = null;
                render();
                return;
            }

            const episodioForm = e.target.closest('form[data-form-episodio]');
            if (episodioForm) {
                e.preventDefault();
                const titulo = episodioForm.querySelector('[data-field="titulo"]').value.trim();
                if (!titulo) return;
                const podcastId = episodioForm.querySelector('[data-field="podcastId"]').value;
                const podcast = window.LogZenPodcasts.obterPodcast(podcastId);
                const grupoEstrelas = episodioForm.querySelector('[data-estrelas]');
                const dados = {
                    podcastId,
                    podcastNome: podcast ? podcast.nome : (editandoEpisodioId && window.LogZenPodcasts.obterEpisodio(editandoEpisodioId).podcastNome) || '',
                    titulo,
                    duracao: episodioForm.querySelector('[data-field="duracao"]').value.trim(),
                    dataOuvido: episodioForm.querySelector('[data-field="dataOuvido"]').value || window.LogZenData.todayKey(),
                    estrelas: grupoEstrelas ? parseInt(grupoEstrelas.dataset.valor || '0', 10) : 0,
                    opiniao: episodioForm.querySelector('[data-field="opiniao"]').value.trim(),
                };
                if (editandoEpisodioId) {
                    window.LogZenPodcasts.atualizarEpisodio(editandoEpisodioId, dados);
                    editandoEpisodioId = null;
                } else {
                    window.LogZenPodcasts.salvarEpisodio({ ...dados, id: gerarId('ep'), criadoEm: Date.now() });
                }
                render();
            }
        });
    }

    function init() {
        root = $('#podcastsRoot');
        if (root) {
            render();
            wire(root);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

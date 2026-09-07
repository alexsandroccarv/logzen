/* ==========================================================================
   LogZen — Vídeos (issue #11): registro de filmes, séries, shows e
   palestras assistidos, com busca de metadados (pôster, duração, prêmios)
   via OMDb API e avaliação pessoal (estrelas + opinião). Site estático,
   sem backend — por isso a chave da OMDb é a do PRÓPRIO usuário (colada em
   Configurações → Vídeos, guardada só no localStorage), nunca embutida no
   código publicado. Sem chave configurada, o registro manual (sem busca)
   continua funcionando. Seção renomeada de "Filmes" para "Vídeos" (issue
   #30) — nomes internos (módulo, ids, chaves de armazenamento) preservados
   para não perder dados já salvos. Temporada, Episódio e Duração do
   episódio só aparecem para o tipo Série (issue #30).
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
        if (!key) throw new Error('Configure sua chave da OMDb API em Configurações → Vídeos.');
        const resp = await fetch(`https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&s=${encodeURIComponent(query)}`);
        if (!resp.ok) throw new Error('Falha ao conectar com a OMDb API.');
        const dados = await resp.json();
        if (dados.Response === 'False') throw new Error(dados.Error || 'Nada encontrado.');
        return dados.Search || [];
    }

    async function buscarDetalhes(imdbID) {
        const key = getApiKey();
        if (!key) throw new Error('Configure sua chave da OMDb API em Configurações → Vídeos.');
        const resp = await fetch(`https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&i=${encodeURIComponent(imdbID)}&plot=short`);
        if (!resp.ok) throw new Error('Falha ao conectar com a OMDb API.');
        const dados = await resp.json();
        if (dados.Response === 'False') throw new Error(dados.Error || 'Não encontrado.');
        return dados;
    }

    // Reconhece um link do YouTube colado no campo de busca (watch/youtu.be/
    // shorts/embed) e devolve o id do vídeo, ou null se não for um link
    // reconhecido.
    function extrairYoutubeId(texto) {
        const m = String(texto).match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
        return m ? m[1] : null;
    }

    // Metadados de um vídeo via oEmbed do YouTube — público, sem exigir
    // chave (diferente da OMDb), então funciona mesmo sem a chave da OMDb
    // configurada. Traz só título/miniatura/canal (não há duração/gênero).
    async function buscarYoutube(url) {
        const resp = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        if (!resp.ok) throw new Error('Vídeo do YouTube não encontrado (link inválido ou privado).');
        return resp.json();
    }

    return {
        listar, salvar, remover, obter, atualizar, getApiKey, setApiKey,
        buscarPorTitulo, buscarDetalhes, extrairYoutubeId, buscarYoutube,
    };
})();

(function () {
    const $ = (sel, ctx) => (ctx || document).querySelector(sel);
    const TIPO_LABEL = { movie: 'Filme', series: 'Série', episode: 'Episódio', show: 'Show', palestra: 'Palestra' };
    const LOCAL_LABEL = { tv_aberta: 'TV aberta', cinema: 'Cinema', streaming: 'Streaming', youtube: 'YouTube' };
    const SERVICOS_STREAMING = ['Netflix', 'Mubi', 'HBO Max', 'Amazon Prime Video', 'Apple TV+', 'Disney+', 'Globoplay', 'Star+', 'Paramount+', 'Outro'];

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
    // id do registro em edição (null = rascunho é uma entrada nova).
    let editandoId = null;

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

    function renderLocalCampos(r) {
        const streamingHidden = r.local !== 'streaming' ? 'hidden' : '';
        const servicoOutroHidden = r.servico !== 'outro' ? 'hidden' : '';
        return `
        <div>
            <label class="block text-xs font-medium mb-1">Onde assistiu</label>
            <select data-field="local" required
                class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                <option value="" ${!r.local ? 'selected' : ''} disabled>Selecione…</option>
                <option value="tv_aberta" ${r.local === 'tv_aberta' ? 'selected' : ''}>TV aberta</option>
                <option value="cinema" ${r.local === 'cinema' ? 'selected' : ''}>Cinema</option>
                <option value="streaming" ${r.local === 'streaming' ? 'selected' : ''}>Streaming</option>
                <option value="youtube" ${r.local === 'youtube' ? 'selected' : ''}>YouTube</option>
            </select>
        </div>
        <div data-streaming-campos ${streamingHidden}>
            <label class="block text-xs font-medium mb-1">Serviço de streaming</label>
            <select data-field="servico"
                class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                <option value="">Selecione…</option>
                ${SERVICOS_STREAMING.map((s) => {
                    const valor = s === 'Outro' ? 'outro' : s;
                    return `<option value="${escapeHtml(valor)}" ${r.servico === valor ? 'selected' : ''}>${escapeHtml(s)}</option>`;
                }).join('')}
            </select>
            <input type="text" data-field="servicoOutro" ${servicoOutroHidden} maxlength="60" placeholder="Nome do serviço" value="${escapeHtml(r.servicoOutro || '')}"
                class="mt-2 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
        </div>`;
    }

    function renderEpisodioCampos(r) {
        const hidden = r.tipo !== 'series' ? 'hidden' : '';
        return `
        <div data-episodio-campos ${hidden} class="grid grid-cols-2 gap-3">
            <div>
                <label class="block text-xs font-medium mb-1">Temporada</label>
                <input type="number" data-field="temporada" min="1" value="${escapeHtml(r.temporada || '')}"
                    class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
            </div>
            <div>
                <label class="block text-xs font-medium mb-1">Episódio</label>
                <input type="number" data-field="episodio" min="1" value="${escapeHtml(r.episodio || '')}"
                    class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
            </div>
            <div class="col-span-2">
                <label class="block text-xs font-medium mb-1">Título do episódio (opcional)</label>
                <input type="text" data-field="episodioTitulo" maxlength="120" value="${escapeHtml(r.episodioTitulo || '')}"
                    class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
            </div>
            <div class="col-span-2">
                <label class="block text-xs font-medium mb-1">Duração do episódio</label>
                <input type="text" data-field="tempo" maxlength="30" placeholder="ex.: 42 min" value="${escapeHtml(r.tempo || '')}"
                    class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
            </div>
        </div>`;
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
                    <option value="movie" ${!rascunho.tipo || rascunho.tipo === 'movie' ? 'selected' : ''}>Filme</option>
                    <option value="series" ${rascunho.tipo === 'series' ? 'selected' : ''}>Série</option>
                    <option value="show" ${rascunho.tipo === 'show' ? 'selected' : ''}>Show</option>
                    <option value="palestra" ${rascunho.tipo === 'palestra' ? 'selected' : ''}>Palestra</option>
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
            ${renderEpisodioCampos(rascunho)}
            ${renderLocalCampos(rascunho)}
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
                <button type="submit" class="px-3 py-1.5 rounded bg-brand-600 dark:bg-accent-600 text-white text-sm font-semibold hover:bg-brand-700">${editandoId ? 'Salvar alterações' : 'Salvar'}</button>
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
                <i aria-hidden="true" class="fa-solid fa-plus"></i> Registrar vídeo
            </button>
            <div data-add-filme-body hidden class="space-y-3">
                <form data-form-busca class="flex items-center gap-2">
                    <input type="text" data-field="busca" placeholder="Título do filme/série/show, ou cole um link do YouTube…"
                        class="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    <button type="submit" class="px-3 py-2 rounded bg-brand-600 dark:bg-accent-600 text-white text-sm font-semibold hover:bg-brand-700 shrink-0">Buscar</button>
                </form>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                    ${temChave
                        ? 'Busca por título via OMDb, ou cole um link do YouTube para trazer os dados direto de lá (sem precisar de chave).'
                        : 'Sem chave da OMDb configurada a busca por título não funciona, mas colar um link do YouTube funciona igual. Configure sua chave em Configurações → Vídeos para também buscar por título, ou registre manualmente abaixo.'}
                </p>
                <p data-busca-status class="text-xs text-gray-500 dark:text-gray-400 hidden"></p>
                <div data-resultados-busca class="space-y-2"></div>
                <button type="button" data-action="adicionar-manual" class="text-xs font-medium text-brand-700 dark:text-accent-400 hover:underline">
                    Ou adicionar sem buscar
                </button>
            </div>
        </div>`;
    }

    function renderEntrada(e) {
        const poster = e.poster
            ? `<img src="${escapeHtml(e.poster)}" alt="" class="w-14 h-20 object-cover rounded shrink-0 bg-gray-100 dark:bg-gray-700">`
            : `<div class="w-14 h-20 rounded shrink-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400"><i aria-hidden="true" class="fa-solid fa-film"></i></div>`;
        const localTexto = e.local
            ? (LOCAL_LABEL[e.local] || e.local) + (e.local === 'streaming' && e.servico ? ` (${e.servico})` : '')
            : '';
        const detalhes = [e.ano, e.tipo !== 'series' ? e.tempo : '', e.genero, TIPO_LABEL[e.tipo] || e.tipo, localTexto].filter(Boolean).join(' · ');
        const episodioTexto = e.tipo === 'series' && (e.temporada || e.episodio)
            ? `T${e.temporada || '?'}E${e.episodio || '?'}${e.episodioTitulo ? ': ' + e.episodioTitulo : ''}${e.tempo ? ' · ' + e.tempo : ''}`
            : '';
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
                        ${episodioTexto ? `<p class="text-xs font-medium text-brand-700 dark:text-accent-400 truncate">${escapeHtml(episodioTexto)}</p>` : ''}
                        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(detalhes)} · assistido em ${dataFmt}</p>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                        <button type="button" data-action="editar-filme" aria-label="Editar ${escapeHtml(e.titulo)}"
                            class="w-7 h-7 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-accent-950/40 flex items-center justify-center">
                            <i aria-hidden="true" class="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button type="button" data-action="remover-filme" aria-label="Remover ${escapeHtml(e.titulo)}"
                            class="w-7 h-7 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center">
                            <i aria-hidden="true" class="fa-solid fa-trash text-xs"></i>
                        </button>
                    </div>
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
            : '<p class="text-xs text-gray-500 dark:text-gray-400">Nenhum vídeo registrado ainda.</p>';
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
                    local: '', servico: '', servicoOutro: '', temporada: '', episodio: '', episodioTitulo: '',
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
                        local: '', servico: '', servicoOutro: '', temporada: '', episodio: '', episodioTitulo: '',
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
                editandoId = null;
                render();
                return;
            }

            const editarBtn = e.target.closest('[data-action="editar-filme"]');
            if (editarBtn) {
                const card = editarBtn.closest('[data-filme-entrada]');
                const entrada = window.LogZenFilmes.obter(card.dataset.id);
                if (!entrada) return;
                // Serviço "Outro" não fica salvo como "outro" — o texto digitado
                // é salvo direto. Se não bater com nenhum serviço da lista,
                // reconstrói o estado do select em "Outro" + o texto no campo.
                const servicoConhecido = SERVICOS_STREAMING.includes(entrada.servico);
                const eraOutro = entrada.local === 'streaming' && entrada.servico && !servicoConhecido;
                rascunho = {
                    ...entrada,
                    manual: true,
                    servico: eraOutro ? 'outro' : (entrada.servico || ''),
                    servicoOutro: eraOutro ? entrada.servico : '',
                };
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

            const removerBtn = e.target.closest('[data-action="remover-filme"]');
            if (removerBtn) {
                const card = removerBtn.closest('[data-filme-entrada]');
                const titulo = card.querySelector('p.font-semibold').textContent;
                if (!window.confirm(`Remover "${titulo}" da lista?`)) return;
                window.LogZenFilmes.remover(card.dataset.id);
                if (editandoId === card.dataset.id) { rascunho = null; editandoId = null; }
                render();
                return;
            }
        });

        rootEl.addEventListener('change', (e) => {
            const localSelect = e.target.closest('[data-field="local"]');
            if (localSelect) {
                const campos = localSelect.closest('form').querySelector('[data-streaming-campos]');
                if (campos) campos.hidden = localSelect.value !== 'streaming';
                return;
            }
            const servicoSelect = e.target.closest('[data-field="servico"]');
            if (servicoSelect) {
                const outroInput = servicoSelect.closest('[data-streaming-campos]').querySelector('[data-field="servicoOutro"]');
                if (outroInput) outroInput.hidden = servicoSelect.value !== 'outro';
                return;
            }
            const tipoSelect = e.target.closest('[data-field="tipo"]');
            if (tipoSelect) {
                const campos = tipoSelect.closest('form').querySelector('[data-episodio-campos]');
                if (campos) campos.hidden = tipoSelect.value !== 'series';
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

                const youtubeId = window.LogZenFilmes.extrairYoutubeId(query);
                if (youtubeId) {
                    try {
                        if (status) { status.textContent = 'Buscando no YouTube…'; status.classList.remove('hidden'); }
                        const d = await window.LogZenFilmes.buscarYoutube(query);
                        if (resultadosEl) resultadosEl.innerHTML = '';
                        if (status) status.classList.add('hidden');
                        rascunho = {
                            manual: false,
                            titulo: d.title || '',
                            tipo: 'show',
                            imdbID: '',
                            poster: d.thumbnail_url || '',
                            ano: '',
                            tempo: '',
                            genero: d.author_name || '',
                            premios: '',
                            assistidoEm: window.LogZenData.todayKey(),
                            estrelas: 0,
                            opiniao: '',
                            local: 'youtube', servico: '', servicoOutro: '', temporada: '', episodio: '', episodioTitulo: '',
                        };
                        render();
                    } catch (err) {
                        if (status) { status.textContent = err.message; status.classList.remove('hidden'); }
                    }
                    return;
                }

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
                rascunho.local = rascunhoForm.querySelector('[data-field="local"]').value;
                if (rascunho.local === 'streaming') {
                    const servicoVal = rascunhoForm.querySelector('[data-field="servico"]').value;
                    rascunho.servico = servicoVal === 'outro'
                        ? rascunhoForm.querySelector('[data-field="servicoOutro"]').value.trim()
                        : servicoVal;
                } else {
                    rascunho.servico = '';
                }
                delete rascunho.servicoOutro;
                if (rascunho.tipo === 'series') {
                    rascunho.temporada = rascunhoForm.querySelector('[data-field="temporada"]').value.trim();
                    rascunho.episodio = rascunhoForm.querySelector('[data-field="episodio"]').value.trim();
                    rascunho.episodioTitulo = rascunhoForm.querySelector('[data-field="episodioTitulo"]').value.trim();
                    rascunho.tempo = rascunhoForm.querySelector('[data-episodio-campos] [data-field="tempo"]').value.trim();
                } else {
                    rascunho.temporada = '';
                    rascunho.episodio = '';
                    rascunho.episodioTitulo = '';
                }
                const entrada = { ...rascunho };
                delete entrada.manual;
                if (editandoId) {
                    window.LogZenFilmes.atualizar(editandoId, entrada);
                    editandoId = null;
                } else {
                    entrada.id = gerarId();
                    entrada.criadoEm = Date.now();
                    window.LogZenFilmes.salvar(entrada);
                }
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

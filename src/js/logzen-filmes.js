/* ==========================================================================
   LogZen — Vídeos (issue #11): registro de filmes, séries, shows e
   palestras assistidos, com busca de metadados (pôster, duração, prêmios)
   e avaliação pessoal (estrelas + opinião). Site estático, sem backend —
   por isso as chaves de API são do PRÓPRIO usuário (coladas em
   Configurações → Vídeos, guardadas só no localStorage), nunca embutidas
   no código publicado. Sem nenhuma fonte configurada/habilitada, o
   registro manual (sem busca) continua funcionando. Seção renomeada de
   "Filmes" para "Vídeos" (issue #30) — nomes internos (módulo, ids, chaves
   de armazenamento) preservados para não perder dados já salvos.

   Três fontes de busca (issue #31), tentadas em ordem configurável até uma
   achar resultado — cada uma normalizada para o mesmo formato antes de
   exibir (mesmo princípio do multi-fonte de Livros):
     - TMDb: filmes e séries, chave própria gratuita, inclui runtime por
       episódio.
     - OMDb: filmes e séries, chave própria gratuita (fonte original).
     - TVmaze: só séries, sem exigir chave nenhuma.
   Fonte desabilitada ou sem chave configurada (quando exigida) é pulada
   silenciosamente na cadeia, sem gerar erro.

   Avaliação em 10 estrelas, em vez de 5 (issue #32), mesma escala usada em
   Livros e Podcasts. Ao registrar/editar uma série, mostra as
   temporadas/episódios já registrados do mesmo título — ajuda a lembrar o
   que já foi visto e evitar duplicar (issue #32).

   Séries separadas de Filmes em duas sub-abas (issue #43): em Séries, os
   episódios de um mesmo título são agrupados num "card do show" (pôster/
   ano/gênero de uma entrada de referência — de preferência a que tem
   pôster) com a lista completa de episódios embaixo (nome, duração, data
   assistida, estrelas), reaproveitando editar-filme/remover-filme por
   episódio. Cada card ganha um formulário rápido para adicionar mais um
   episódio sem buscar de novo. "Registrar vídeo" (busca/manual) continua
   sendo o caminho para um filme novo ou o primeiro episódio de uma série.

   Busca automática de episódio (issue #45): cada entrada guarda de qual
   fonte (tmdb/tvmaze/omdb) e de qual id do show ela veio (serieFonte/
   serieRefId) — ao preencher temporada + episódio, tanto no formulário
   principal quanto no formulário rápido do card de série, busca título e
   duração do episódio direto na fonte e preenche os campos (continuam
   editáveis). Séries manuais (sem busca) não têm fonte conhecida, então
   nada é buscado — comportamento igual ao de antes.

   Card de série recolhido por padrão (issue #46): só o resumo (pôster,
   título, ano/gênero, contagem de episódios) fica sempre visível; a lista
   completa de episódios e o formulário de adicionar continuam dentro do
   mesmo card, só escondidos até o clique — senão a tela lota rápido com
   várias séries cadastradas.
   ========================================================================== */
window.LogZenFilmes = (function () {
    const ENTRIES_KEY = 'logzen:filmes:v1';
    const APIKEY_KEY = 'logzen:omdb-key:v1';
    const TMDB_APIKEY_KEY = 'logzen:tmdb-key:v1';
    const FONTES_ORDEM_KEY = 'logzen:filmes:fontes-ordem:v1';
    const FONTES_HABILITADAS_KEY = 'logzen:filmes:fontes-habilitadas:v1';
    const FONTES_PADRAO = ['tmdb', 'omdb', 'tvmaze'];

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

    // Temporadas/episódios já registrados para o mesmo título de série
    // (issue #32) — casa por título (sem diferenciar maiúsculas/minúsculas),
    // já que as 3 fontes de busca nem sempre compartilham um id em comum.
    // Exclui a própria entrada quando editando, para não listar a si mesma.
    function listarEpisodios(titulo, excluirId) {
        const alvo = String(titulo || '').trim().toLowerCase();
        if (!alvo) return [];
        return readEntries()
            .filter((e) => e.tipo === 'series' && e.id !== excluirId
                && String(e.titulo || '').trim().toLowerCase() === alvo
                && (e.temporada || e.episodio))
            .map((e) => ({ temporada: e.temporada, episodio: e.episodio, episodioTitulo: e.episodioTitulo }))
            .sort((a, b) => (parseInt(a.temporada, 10) || 0) - (parseInt(b.temporada, 10) || 0)
                || (parseInt(a.episodio, 10) || 0) - (parseInt(b.episodio, 10) || 0));
    }

    function atualizar(id, dados) {
        const lista = readEntries();
        const item = lista.find((e) => e.id === id);
        if (!item) return;
        Object.assign(item, dados);
        writeEntries(lista);
    }

    // Agrupa todas as entradas de série por título (sem diferenciar
    // maiúsculas/minúsculas — issue #43), cada grupo trazendo os dados do
    // show (pôster/ano/gênero — de preferência de uma entrada vinda de
    // busca, que tem pôster; senão a mais recente) e a lista completa de
    // episódios já registrados, ordenada por temporada/episódio. Usado
    // para separar Séries de Filmes e mostrar o "card do show" com todos
    // os episódios embaixo, em vez de uma dica de texto só.
    function listarGruposSeries() {
        const todas = readEntries().filter((e) => e.tipo === 'series');
        const grupos = new Map();
        todas.forEach((e) => {
            const chave = String(e.titulo || '').trim().toLowerCase();
            if (!chave) return;
            if (!grupos.has(chave)) grupos.set(chave, []);
            grupos.get(chave).push(e);
        });
        return Array.from(grupos.values()).map((episodios) => {
            const ordenados = episodios.slice().sort((a, b) =>
                (parseInt(a.temporada, 10) || 0) - (parseInt(b.temporada, 10) || 0)
                || (parseInt(a.episodio, 10) || 0) - (parseInt(b.episodio, 10) || 0)
                || (a.criadoEm || 0) - (b.criadoEm || 0));
            const comPoster = episodios.find((e) => e.poster);
            const referencia = comPoster || episodios.slice().sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0))[0];
            return {
                titulo: referencia.titulo, poster: referencia.poster, ano: referencia.ano,
                genero: referencia.genero, episodios: ordenados,
                // Fonte/id do show na fonte (issue #45) — de preferência da
                // própria referência (que já é, de preferência, a que tem
                // pôster, ou seja, a que veio de busca); permite buscar
                // título/duração de novos episódios sem repetir a busca.
                fonte: referencia.serieFonte || '', fonteId: referencia.serieRefId || '',
            };
        }).sort((a, b) => {
            const ua = Math.max(0, ...a.episodios.map((e) => e.criadoEm || 0));
            const ub = Math.max(0, ...b.episodios.map((e) => e.criadoEm || 0));
            return ub - ua;
        });
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

    function getTmdbApiKey() {
        try { return localStorage.getItem(TMDB_APIKEY_KEY) || ''; }
        catch (e) { return ''; }
    }

    function setTmdbApiKey(key) {
        try {
            if (key) localStorage.setItem(TMDB_APIKEY_KEY, key);
            else localStorage.removeItem(TMDB_APIKEY_KEY);
        } catch (e) { /* storage indisponível — segue sem persistir */ }
    }

    // Ordem de consulta entre as fontes (issue #31) — array com as 3 sempre
    // presentes; a primeira habilitada/configurada que achar resultado é
    // usada. Guardado separado de "habilitadas" para não perder a posição
    // escolhida ao desabilitar e reabilitar uma fonte depois.
    function getFontesOrdem() {
        try {
            const raw = localStorage.getItem(FONTES_ORDEM_KEY);
            const arr = raw ? JSON.parse(raw) : null;
            if (Array.isArray(arr) && arr.length === FONTES_PADRAO.length && FONTES_PADRAO.every((f) => arr.includes(f))) return arr;
        } catch (e) { /* ignora e usa padrão */ }
        return FONTES_PADRAO.slice();
    }

    function setFontesOrdem(ordem) {
        try { localStorage.setItem(FONTES_ORDEM_KEY, JSON.stringify(ordem)); }
        catch (e) { /* storage indisponível — segue sem persistir */ }
    }

    function getFontesHabilitadas() {
        try {
            const raw = localStorage.getItem(FONTES_HABILITADAS_KEY);
            const obj = raw ? JSON.parse(raw) : null;
            if (obj && typeof obj === 'object') {
                return { tmdb: obj.tmdb !== false, omdb: obj.omdb !== false, tvmaze: obj.tvmaze !== false };
            }
        } catch (e) { /* ignora e usa padrão */ }
        return { tmdb: true, omdb: true, tvmaze: true };
    }

    function setFonteHabilitada(fonte, habilitada) {
        const atual = getFontesHabilitadas();
        atual[fonte] = !!habilitada;
        try { localStorage.setItem(FONTES_HABILITADAS_KEY, JSON.stringify(atual)); }
        catch (e) { /* storage indisponível — segue sem persistir */ }
    }

    async function buscarOmdbLista(query) {
        const key = getApiKey();
        const resp = await fetch(`https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&s=${encodeURIComponent(query)}`);
        if (!resp.ok) throw new Error('Falha ao conectar com a OMDb API.');
        const dados = await resp.json();
        if (dados.Response === 'False') return [];
        return (dados.Search || []).map((it) => ({
            id: `omdb-${it.imdbID}`, fonte: 'omdb', refId: it.imdbID,
            tipo: it.Type === 'series' ? 'series' : 'movie',
            titulo: it.Title, ano: it.Year || '',
            poster: it.Poster && it.Poster !== 'N/A' ? it.Poster : '',
        }));
    }

    async function buscarDetalhesOmdb(imdbID) {
        const key = getApiKey();
        const resp = await fetch(`https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&i=${encodeURIComponent(imdbID)}&plot=short`);
        if (!resp.ok) throw new Error('Falha ao conectar com a OMDb API.');
        const dados = await resp.json();
        if (dados.Response === 'False') throw new Error(dados.Error || 'Não encontrado.');
        return {
            titulo: dados.Title, tipo: dados.Type === 'series' ? 'series' : 'movie', imdbID: dados.imdbID,
            poster: dados.Poster && dados.Poster !== 'N/A' ? dados.Poster : '',
            ano: dados.Year || '', tempo: dados.Runtime && dados.Runtime !== 'N/A' ? dados.Runtime : '',
            genero: dados.Genre && dados.Genre !== 'N/A' ? dados.Genre : '',
            premios: dados.Awards && dados.Awards !== 'N/A' ? dados.Awards : '',
        };
    }

    async function buscarTmdbLista(query) {
        const key = getTmdbApiKey();
        const resp = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}&language=pt-BR`);
        if (!resp.ok) throw new Error('Falha ao conectar com a TMDb API.');
        const dados = await resp.json();
        return (dados.results || [])
            .filter((it) => it.media_type === 'movie' || it.media_type === 'tv')
            .map((it) => ({
                id: `tmdb-${it.media_type}-${it.id}`, fonte: 'tmdb', refId: it.id, mediaType: it.media_type,
                tipo: it.media_type === 'tv' ? 'series' : 'movie',
                titulo: it.title || it.name || '',
                ano: (it.release_date || it.first_air_date || '').slice(0, 4),
                poster: it.poster_path ? `https://image.tmdb.org/t/p/w200${it.poster_path}` : '',
            }));
    }

    async function buscarDetalhesTmdb(id, mediaType) {
        const key = getTmdbApiKey();
        const caminho = mediaType === 'tv' ? 'tv' : 'movie';
        const resp = await fetch(`https://api.themoviedb.org/3/${caminho}/${encodeURIComponent(id)}?api_key=${encodeURIComponent(key)}&language=pt-BR`);
        if (!resp.ok) throw new Error('Falha ao conectar com a TMDb API.');
        const d = await resp.json();
        const tempoMin = mediaType === 'tv' ? (d.episode_run_time || [])[0] : d.runtime;
        return {
            titulo: d.title || d.name || '', tipo: mediaType === 'tv' ? 'series' : 'movie',
            poster: d.poster_path ? `https://image.tmdb.org/t/p/w200${d.poster_path}` : '',
            ano: (d.release_date || d.first_air_date || '').slice(0, 4),
            tempo: tempoMin ? `${tempoMin} min` : '',
            genero: (d.genres || []).map((g) => g.name).join(', '),
            premios: '',
        };
    }

    // TVmaze já traz tudo na busca (sem chave) — sem chamada extra de
    // detalhes, o objeto normalizado vai junto no próprio resultado.
    async function buscarTvmazeLista(query) {
        const resp = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
        if (!resp.ok) throw new Error('Falha ao conectar com a TVmaze API.');
        const dados = await resp.json();
        return (dados || []).map((r) => {
            const show = r.show || {};
            const detalhes = {
                titulo: show.name || '', tipo: 'series',
                poster: show.image ? (show.image.medium || show.image.original || '') : '',
                ano: show.premiered ? show.premiered.slice(0, 4) : '',
                tempo: show.runtime ? `${show.runtime} min` : '',
                genero: (show.genres || []).join(', '),
                premios: '',
            };
            return {
                id: `tvmaze-${show.id}`, fonte: 'tvmaze', refId: show.id, tipo: 'series',
                titulo: detalhes.titulo, ano: detalhes.ano, poster: detalhes.poster, detalhes,
            };
        });
    }

    // Tenta as fontes habilitadas/configuradas na ordem escolhida em
    // Configurações → Vídeos, até uma achar resultado. Fonte sem chave
    // (quando exige) ou desabilitada é pulada silenciosamente.
    async function buscarPorTitulo(query) {
        const ordem = getFontesOrdem();
        const habilitadas = getFontesHabilitadas();
        let ultimoErro = null;
        let algumaTentativa = false;
        for (const fonte of ordem) {
            if (!habilitadas[fonte]) continue;
            if (fonte === 'omdb' && !getApiKey()) continue;
            if (fonte === 'tmdb' && !getTmdbApiKey()) continue;
            algumaTentativa = true;
            try {
                const resultados = fonte === 'tmdb' ? await buscarTmdbLista(query)
                    : fonte === 'tvmaze' ? await buscarTvmazeLista(query)
                    : await buscarOmdbLista(query);
                if (resultados.length) return resultados;
            } catch (e) { ultimoErro = e; }
        }
        if (ultimoErro) throw ultimoErro;
        if (!algumaTentativa) throw new Error('Nenhuma fonte de busca habilitada/configurada — configure em Configurações → Vídeos, ou registre manualmente.');
        throw new Error('Nada encontrado.');
    }

    // Busca os detalhes completos de um resultado já normalizado (issue
    // #31) — despacha para a fonte de origem; TVmaze não precisa de nova
    // chamada, os dados já vieram completos na busca.
    async function buscarDetalhesPorResultado(item) {
        if (item.fonte === 'omdb') return buscarDetalhesOmdb(item.refId);
        if (item.fonte === 'tmdb') return buscarDetalhesTmdb(item.refId, item.mediaType);
        if (item.fonte === 'tvmaze') return item.detalhes;
        return null;
    }

    // Título e duração de um episódio específico (temporada + número), por
    // fonte (issue #45) — usado para preencher automaticamente ao escolher
    // o episódio de uma série já vinda de busca (o id do show na fonte fica
    // guardado na própria entrada como serieFonte/serieRefId).
    async function buscarDetalhesEpisodioTmdb(seriesId, temporada, episodio) {
        const key = getTmdbApiKey();
        const resp = await fetch(`https://api.themoviedb.org/3/tv/${encodeURIComponent(seriesId)}/season/${encodeURIComponent(temporada)}/episode/${encodeURIComponent(episodio)}?api_key=${encodeURIComponent(key)}&language=pt-BR`);
        if (!resp.ok) throw new Error('Episódio não encontrado na TMDb.');
        const d = await resp.json();
        if (d.success === false) throw new Error(d.status_message || 'Episódio não encontrado na TMDb.');
        return { episodioTitulo: d.name || '', tempo: d.runtime ? `${d.runtime} min` : '' };
    }

    async function buscarDetalhesEpisodioTvmaze(showId, temporada, episodio) {
        const resp = await fetch(`https://api.tvmaze.com/shows/${encodeURIComponent(showId)}/episodebynumber?season=${encodeURIComponent(temporada)}&number=${encodeURIComponent(episodio)}`);
        if (!resp.ok) throw new Error('Episódio não encontrado na TVmaze.');
        const d = await resp.json();
        return { episodioTitulo: d.name || '', tempo: d.runtime ? `${d.runtime} min` : '' };
    }

    async function buscarDetalhesEpisodioOmdb(imdbID, temporada, episodio) {
        const key = getApiKey();
        const resp = await fetch(`https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&i=${encodeURIComponent(imdbID)}&Season=${encodeURIComponent(temporada)}&Episode=${encodeURIComponent(episodio)}`);
        if (!resp.ok) throw new Error('Falha ao conectar com a OMDb API.');
        const d = await resp.json();
        if (d.Response === 'False') throw new Error(d.Error || 'Episódio não encontrado na OMDb.');
        return { episodioTitulo: d.Title || '', tempo: d.Runtime && d.Runtime !== 'N/A' ? d.Runtime : '' };
    }

    // Despacha para a fonte guardada na entrada/grupo (serieFonte/
    // serieRefId) — null quando a série é manual (sem fonte conhecida) ou
    // sem chave configurada para essa fonte, e quem chamou decide o que
    // fazer (não tenta buscar).
    async function buscarDetalhesEpisodio(fonte, refId, temporada, episodio) {
        if (!fonte || !refId) return null;
        if (fonte === 'tmdb') {
            if (!getTmdbApiKey()) throw new Error('Chave da TMDb não configurada (Configurações → Vídeos).');
            return buscarDetalhesEpisodioTmdb(refId, temporada, episodio);
        }
        if (fonte === 'tvmaze') return buscarDetalhesEpisodioTvmaze(refId, temporada, episodio);
        if (fonte === 'omdb') {
            if (!getApiKey()) throw new Error('Chave da OMDb não configurada (Configurações → Vídeos).');
            return buscarDetalhesEpisodioOmdb(refId, temporada, episodio);
        }
        return null;
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
        listar, salvar, remover, obter, atualizar, listarEpisodios, listarGruposSeries, getApiKey, setApiKey,
        getTmdbApiKey, setTmdbApiKey, getFontesOrdem, setFontesOrdem,
        getFontesHabilitadas, setFonteHabilitada,
        buscarPorTitulo, buscarDetalhesPorResultado, buscarDetalhesEpisodio, extrairYoutubeId, buscarYoutube,
    };
})();

(function () {
    const $ = (sel, ctx) => (ctx || document).querySelector(sel);
    const TIPO_LABEL = { movie: 'Filme', series: 'Série', episode: 'Episódio', show: 'Show', palestra: 'Palestra' };
    const LOCAL_LABEL = { tv_aberta: 'TV aberta', cinema: 'Cinema', streaming: 'Streaming', youtube: 'YouTube' };
    const SERVICOS_STREAMING = ['Netflix', 'Mubi', 'HBO Max', 'Amazon Prime Video', 'Apple TV+', 'Disney+', 'Globoplay', 'Star+', 'Paramount+', 'Outro'];
    const FONTES_LABEL = { tmdb: 'TMDb', omdb: 'OMDb', tvmaze: 'TVmaze' };
    const FONTES_LABEL_CONFIG = { tmdb: 'TMDb', omdb: 'OMDb', tvmaze: 'TVmaze (sem chave)' };

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
    // Sub-aba ativa dentro de Vídeos (issue #43) — só em memória, volta
    // para "filmes" a cada visita/recarregamento.
    let subTab = 'filmes';
    // Cards de série expandidos (issue #46) — chave = título normalizado.
    // Recolhido por padrão: com vários títulos, cada um listando todos os
    // episódios já assistidos, a tela lotaria rápido. Guardado em memória
    // (sobrevive a re-renders dentro da sessão, mas não a um recarregamento)
    // para não fechar o card sozinho a cada ação (editar, remover, adicionar
    // episódio).
    const seriesExpandidas = new Set();

    function estrelasBtns(valorAtual) {
        return Array.from({ length: 10 }, (_, i) => i + 1).map((n) => `
            <button type="button" data-action="estrela" data-n="${n}" aria-pressed="${n <= valorAtual}" aria-label="${n} de 10 estrelas"
                class="text-xl leading-none ${n <= valorAtual ? 'text-clay-600 dark:text-clay-400' : 'text-paper-300 dark:text-paper-700'}">
                <i aria-hidden="true" class="fa-solid fa-star"></i>
            </button>`).join('');
    }

    function renderResultadoBusca(item) {
        return `
        <button type="button" data-action="selecionar-resultado" data-id="${escapeHtml(item.id)}"
            class="w-full flex items-center gap-3 p-2 rounded-xl border border-paper-200 dark:border-paper-800 hover:bg-paper-50 dark:hover:bg-paper-800 text-left">
            ${item.poster
                ? `<img src="${escapeHtml(item.poster)}" alt="" class="w-10 h-14 object-cover rounded-lg shrink-0 bg-paper-100 dark:bg-paper-800">`
                : `<div class="w-10 h-14 rounded shrink-0 bg-paper-100 dark:bg-paper-800 flex items-center justify-center text-ink-300"><i aria-hidden="true" class="fa-solid fa-film"></i></div>`}
            <div class="min-w-0">
                <p class="font-medium truncate">${escapeHtml(item.titulo)}</p>
                <p class="text-xs text-ink-400">${escapeHtml(item.ano || '')} · ${escapeHtml(TIPO_LABEL[item.tipo] || item.tipo || '')} · ${escapeHtml(FONTES_LABEL[item.fonte] || item.fonte)}</p>
            </div>
        </button>`;
    }

    function renderFontesConfig() {
        const ordem = window.LogZenFilmes.getFontesOrdem();
        const habilitadas = window.LogZenFilmes.getFontesHabilitadas();
        return ordem.map((fonte, i) => `
            <div class="flex items-center gap-2 p-2 rounded-xl border border-paper-200 dark:border-paper-800">
                <input type="checkbox" data-action="toggle-fonte" data-fonte="${fonte}" ${habilitadas[fonte] ? 'checked' : ''}
                    class="rounded border-paper-300 dark:border-paper-700 accent-sage-600 dark:accent-sage-400 focus:ring-sage-400">
                <span class="flex-1 text-sm">${escapeHtml(FONTES_LABEL_CONFIG[fonte] || fonte)}</span>
                <button type="button" data-action="mover-fonte" data-fonte="${fonte}" data-dir="-1" ${i === 0 ? 'disabled' : ''}
                    aria-label="Mover ${escapeHtml(FONTES_LABEL[fonte])} para cima"
                    class="w-7 h-7 rounded-full text-ink-300 hover:text-sage-700 hover:bg-sage-50 dark:hover:bg-sage-900/40 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none">
                    <i aria-hidden="true" class="fa-solid fa-chevron-up text-xs"></i>
                </button>
                <button type="button" data-action="mover-fonte" data-fonte="${fonte}" data-dir="1" ${i === ordem.length - 1 ? 'disabled' : ''}
                    aria-label="Mover ${escapeHtml(FONTES_LABEL[fonte])} para baixo"
                    class="w-7 h-7 rounded-full text-ink-300 hover:text-sage-700 hover:bg-sage-50 dark:hover:bg-sage-900/40 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none">
                    <i aria-hidden="true" class="fa-solid fa-chevron-down text-xs"></i>
                </button>
            </div>`).join('');
    }

    function wireFontesConfig(container) {
        container.addEventListener('change', (e) => {
            const chk = e.target.closest('[data-action="toggle-fonte"]');
            if (chk) window.LogZenFilmes.setFonteHabilitada(chk.dataset.fonte, chk.checked);
        });
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="mover-fonte"]');
            if (!btn) return;
            const ordem = window.LogZenFilmes.getFontesOrdem();
            const idx = ordem.indexOf(btn.dataset.fonte);
            const novoIdx = idx + parseInt(btn.dataset.dir, 10);
            if (idx === -1 || novoIdx < 0 || novoIdx >= ordem.length) return;
            [ordem[idx], ordem[novoIdx]] = [ordem[novoIdx], ordem[idx]];
            window.LogZenFilmes.setFontesOrdem(ordem);
            container.innerHTML = renderFontesConfig();
        });
    }

    function renderLocalCampos(r) {
        const streamingHidden = r.local !== 'streaming' ? 'hidden' : '';
        const servicoOutroHidden = r.servico !== 'outro' ? 'hidden' : '';
        return `
        <div>
            <label class="block text-xs font-medium mb-1">Onde assistiu</label>
            <select data-field="local" required
                class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
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
                class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
                <option value="">Selecione…</option>
                ${SERVICOS_STREAMING.map((s) => {
                    const valor = s === 'Outro' ? 'outro' : s;
                    return `<option value="${escapeHtml(valor)}" ${r.servico === valor ? 'selected' : ''}>${escapeHtml(s)}</option>`;
                }).join('')}
            </select>
            <input type="text" data-field="servicoOutro" ${servicoOutroHidden} maxlength="60" placeholder="Nome do serviço" value="${escapeHtml(r.servicoOutro || '')}"
                class="mt-2 w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
        </div>`;
    }

    // Texto (sem a tag <p>) da lista de episódios já registrados do mesmo
    // título — usado tanto no render inicial quanto na atualização pontual
    // ao editar o título (sem precisar re-renderizar o formulário inteiro,
    // o que perderia campos ainda não persistidos em `rascunho`).
    function textoEpisodiosExistentes(titulo) {
        const existentes = window.LogZenFilmes.listarEpisodios(titulo, editandoId);
        if (!existentes.length) return '';
        return `<i aria-hidden="true" class="fa-solid fa-list-ol mr-1"></i>Já registrados: ${existentes.map((ep) => escapeHtml(`T${ep.temporada || '?'}E${ep.episodio || '?'}`)).join(', ')}`;
    }

    function renderEpisodioCampos(r) {
        const hidden = r.tipo !== 'series' ? 'hidden' : '';
        const textoExistentes = textoEpisodiosExistentes(r.titulo);
        return `
        <div data-episodio-campos ${hidden} class="grid grid-cols-2 gap-3">
            <p data-episodios-existentes class="col-span-2 text-xs text-ink-400" ${textoExistentes ? '' : 'hidden'}>${textoExistentes}</p>
            <div>
                <label class="block text-xs font-medium mb-1">Temporada</label>
                <input type="number" data-field="temporada" min="1" value="${escapeHtml(r.temporada || '')}"
                    class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
            </div>
            <div>
                <label class="block text-xs font-medium mb-1">Episódio</label>
                <input type="number" data-field="episodio" min="1" value="${escapeHtml(r.episodio || '')}"
                    class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
            </div>
            <p data-busca-episodio-status class="col-span-2 text-xs text-ink-400" hidden></p>
            <div class="col-span-2">
                <label class="block text-xs font-medium mb-1">Título do episódio (opcional)</label>
                <input type="text" data-field="episodioTitulo" maxlength="120" value="${escapeHtml(r.episodioTitulo || '')}"
                    class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
            </div>
            <div class="col-span-2">
                <label class="block text-xs font-medium mb-1">Duração do episódio</label>
                <input type="text" data-field="tempo" maxlength="30" placeholder="ex.: 42 min" value="${escapeHtml(r.tempo || '')}"
                    class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
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
                    class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
            </div>
            <div>
                <label class="block text-xs font-medium mb-1">Tipo</label>
                <select data-field="tipo" class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
                    <option value="movie" ${!rascunho.tipo || rascunho.tipo === 'movie' ? 'selected' : ''}>Filme</option>
                    <option value="series" ${rascunho.tipo === 'series' ? 'selected' : ''}>Série</option>
                    <option value="show" ${rascunho.tipo === 'show' ? 'selected' : ''}>Show</option>
                    <option value="palestra" ${rascunho.tipo === 'palestra' ? 'selected' : ''}>Palestra</option>
                </select>
            </div>`
            : `
            <div class="flex gap-3">
                ${rascunho.poster
                    ? `<img src="${escapeHtml(rascunho.poster)}" alt="" class="w-16 h-24 object-cover rounded-lg shrink-0 bg-paper-100 dark:bg-paper-800">`
                    : `<div class="w-16 h-24 rounded shrink-0 bg-paper-100 dark:bg-paper-800 flex items-center justify-center text-ink-300"><i aria-hidden="true" class="fa-solid fa-film text-xl"></i></div>`}
                <div class="min-w-0 flex-1">
                    <p class="font-medium truncate">${escapeHtml(rascunho.titulo)}</p>
                    <p class="text-xs text-ink-400">${escapeHtml([rascunho.ano, rascunho.tempo, rascunho.genero].filter(Boolean).join(' · '))}</p>
                    ${rascunho.premios ? `<p class="text-xs text-clay-600 dark:text-clay-400 mt-1"><i aria-hidden="true" class="fa-solid fa-trophy mr-1"></i>${escapeHtml(rascunho.premios)}</p>` : ''}
                </div>
            </div>`;
        return `
        <form data-form-rascunho class="rounded-2xl bg-paper-50 dark:bg-paper-700 shadow-sm p-4 space-y-3">
            ${cabecalho}
            ${renderEpisodioCampos(rascunho)}
            ${renderLocalCampos(rascunho)}
            <div>
                <label class="block text-xs font-medium mb-1">Assistido em</label>
                <input type="date" data-field="assistidoEm" value="${rascunho.assistidoEm}" max="${hoje}"
                    class="px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
            </div>
            <div>
                <label class="block text-xs font-medium mb-1">Minhas estrelas</label>
                <div class="flex flex-wrap gap-1" data-estrelas data-valor="${rascunho.estrelas || 0}">${estrelasBtns(rascunho.estrelas)}</div>
            </div>
            <div>
                <label class="block text-xs font-medium mb-1">Minha opinião</label>
                <textarea data-field="opiniao" rows="3" maxlength="500" placeholder="O que achou?"
                    class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">${escapeHtml(rascunho.opiniao || '')}</textarea>
            </div>
            <div class="flex items-center gap-2">
                <button type="submit" class="px-3 py-1.5 rounded-xl bg-sage-600 dark:bg-sage-700 text-white text-sm font-medium hover:bg-sage-700">${editandoId ? 'Salvar alterações' : 'Salvar'}</button>
                <button type="button" data-action="cancelar-rascunho" class="px-3 py-1.5 rounded-xl border border-paper-300 dark:border-paper-700 text-sm hover:bg-paper-100 dark:hover:bg-paper-700">Cancelar</button>
            </div>
        </form>`;
    }

    function renderPainelAdicionar() {
        if (rascunho) return renderRascunho();
        const habilitadas = window.LogZenFilmes.getFontesHabilitadas();
        const algumaFonteAtiva = (habilitadas.tmdb && window.LogZenFilmes.getTmdbApiKey())
            || (habilitadas.omdb && window.LogZenFilmes.getApiKey())
            || habilitadas.tvmaze;
        return `
        <div class="rounded-2xl border border-dashed border-paper-300 dark:border-paper-700 p-4 space-y-3">
            <button type="button" data-action="toggle-add-filme" class="text-sm font-medium text-sage-700 dark:text-sage-400 hover:underline flex items-center gap-1">
                <i aria-hidden="true" class="fa-solid fa-plus"></i> Registrar vídeo
            </button>
            <div data-add-filme-body hidden class="space-y-3">
                <form data-form-busca class="flex items-center gap-2">
                    <input type="text" data-field="busca" placeholder="Título do filme/série/show, ou cole um link do YouTube…"
                        class="flex-1 px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
                    <button type="submit" class="px-3 py-2 rounded-xl bg-sage-600 dark:bg-sage-700 text-white text-sm font-medium hover:bg-sage-700 shrink-0">Buscar</button>
                </form>
                <p class="text-xs text-ink-400">
                    ${algumaFonteAtiva
                        ? 'Busca por título nas fontes habilitadas (Configurações → Vídeos), ou cole um link do YouTube para trazer os dados direto de lá (sem precisar de chave).'
                        : 'Nenhuma fonte de busca habilitada/configurada — configure em Configurações → Vídeos, cole um link do YouTube (funciona sem chave), ou registre manualmente abaixo.'}
                </p>
                <p data-busca-status class="text-xs text-ink-400 hidden"></p>
                <div data-resultados-busca class="space-y-2"></div>
                <button type="button" data-action="adicionar-manual" class="text-xs font-medium text-sage-700 dark:text-sage-400 hover:underline">
                    Ou adicionar sem buscar
                </button>
            </div>
        </div>`;
    }

    function renderEntrada(e) {
        const poster = e.poster
            ? `<img src="${escapeHtml(e.poster)}" alt="" class="w-14 h-20 object-cover rounded-lg shrink-0 bg-paper-100 dark:bg-paper-800">`
            : `<div class="w-14 h-20 rounded shrink-0 bg-paper-100 dark:bg-paper-800 flex items-center justify-center text-ink-300"><i aria-hidden="true" class="fa-solid fa-film"></i></div>`;
        const localTexto = e.local
            ? (LOCAL_LABEL[e.local] || e.local) + (e.local === 'streaming' && e.servico ? ` (${e.servico})` : '')
            : '';
        const detalhes = [e.ano, e.tipo !== 'series' ? e.tempo : '', e.genero, TIPO_LABEL[e.tipo] || e.tipo, localTexto].filter(Boolean).join(' · ');
        const episodioTexto = e.tipo === 'series' && (e.temporada || e.episodio)
            ? `T${e.temporada || '?'}E${e.episodio || '?'}${e.episodioTitulo ? ': ' + e.episodioTitulo : ''}${e.tempo ? ' · ' + e.tempo : ''}`
            : '';
        const estrelas = Array.from({ length: 10 }, (_, i) => i + 1)
            .map((n) => `<i aria-hidden="true" class="fa-solid fa-star ${n <= e.estrelas ? 'text-clay-600 dark:text-clay-400' : 'text-paper-300 dark:text-paper-700'} text-xs"></i>`).join('');
        const dataFmt = new Date(e.assistidoEm + 'T00:00:00').toLocaleDateString('pt-BR');
        return `
        <div data-filme-entrada data-id="${e.id}" class="rounded-2xl bg-paper-50 dark:bg-paper-700 shadow-sm p-3 flex gap-3">
            ${poster}
            <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                        <p class="font-medium truncate">${escapeHtml(e.titulo)}</p>
                        ${episodioTexto ? `<p class="text-xs font-medium text-sage-700 dark:text-sage-400 truncate">${escapeHtml(episodioTexto)}</p>` : ''}
                        <p class="text-xs text-ink-400 truncate">${escapeHtml(detalhes)} · assistido em ${dataFmt}</p>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                        <button type="button" data-action="editar-filme" aria-label="Editar ${escapeHtml(e.titulo)}"
                            class="w-7 h-7 rounded-full text-ink-300 hover:text-sage-700 hover:bg-sage-50 dark:hover:bg-sage-900/40 flex items-center justify-center">
                            <i aria-hidden="true" class="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button type="button" data-action="remover-filme" aria-label="Remover ${escapeHtml(e.titulo)}"
                            class="w-7 h-7 rounded-full text-ink-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center">
                            <i aria-hidden="true" class="fa-solid fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
                ${e.premios ? `<p class="text-xs text-clay-600 dark:text-clay-400 mt-1"><i aria-hidden="true" class="fa-solid fa-trophy mr-1"></i>${escapeHtml(e.premios)}</p>` : ''}
                <div class="mt-1">${estrelas}</div>
                ${e.opiniao ? `<p class="text-sm mt-1">${escapeHtml(e.opiniao)}</p>` : ''}
            </div>
        </div>`;
    }

    // Alterna entre "Filmes" (filmes, shows, palestras) e "Séries" —
    // issue #43. Cada pílula troca o subTab e refaz a tela inteira; é um
    // estado leve, sem custo re-renderizar tudo a cada clique.
    function renderSubTabsHtml() {
        const pill = (ativo) => ativo
            ? 'bg-sage-600 dark:bg-sage-700 text-white'
            : 'text-ink-400 hover:bg-paper-100 dark:hover:bg-paper-800';
        return `
        <div class="flex gap-2">
            <button type="button" data-action="sub-tab" data-subtab="filmes" role="tab" aria-selected="${subTab === 'filmes'}"
                class="px-3 py-1.5 rounded-full text-sm font-medium ${pill(subTab === 'filmes')}">
                <i aria-hidden="true" class="fa-solid fa-film mr-1"></i> Filmes
            </button>
            <button type="button" data-action="sub-tab" data-subtab="series" role="tab" aria-selected="${subTab === 'series'}"
                class="px-3 py-1.5 rounded-full text-sm font-medium ${pill(subTab === 'series')}">
                <i aria-hidden="true" class="fa-solid fa-tv mr-1"></i> Séries
            </button>
        </div>`;
    }

    function renderFilmesSecao() {
        const entradas = window.LogZenFilmes.listar().filter((e) => e.tipo !== 'series');
        const listaHtml = entradas.length
            ? entradas.map(renderEntrada).join('')
            : '<p class="text-xs text-ink-400">Nenhum filme registrado ainda.</p>';
        return `<div data-filmes-lista class="space-y-3 mt-3">${listaHtml}</div>`;
    }

    // Uma linha por episódio já registrado, dentro do card do show (issue
    // #43) — reaproveita editar-filme/remover-filme (mesmos data-action e
    // data-filme-entrada/data-id de sempre), então editar reabre o
    // formulário completo (data assistida, estrelas, opinião) sem
    // precisar de nenhuma lógica nova.
    function renderEpisodioLinha(e) {
        const temEstrelas = e.estrelas > 0;
        const dataFmt = e.assistidoEm ? new Date(e.assistidoEm + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        const detalhes = [e.tempo, dataFmt ? `assistido em ${dataFmt}` : ''].filter(Boolean).join(' · ');
        return `
        <div data-filme-entrada data-id="${e.id}" class="py-2.5 flex items-start justify-between gap-2">
            <div class="min-w-0">
                <p class="text-sm font-medium truncate">T${escapeHtml(e.temporada || '?')}E${escapeHtml(e.episodio || '?')}${e.episodioTitulo ? ': ' + escapeHtml(e.episodioTitulo) : ''}</p>
                ${detalhes ? `<p class="text-xs text-ink-400">${escapeHtml(detalhes)}</p>` : ''}
                ${temEstrelas ? `<p class="text-xs text-clay-600 dark:text-clay-400 mt-0.5"><i aria-hidden="true" class="fa-solid fa-star text-[10px] mr-0.5"></i>${e.estrelas}/10</p>` : ''}
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button type="button" data-action="editar-filme" aria-label="Editar episódio T${escapeHtml(e.temporada || '?')}E${escapeHtml(e.episodio || '?')}"
                    class="w-7 h-7 rounded-full text-ink-300 hover:text-sage-700 hover:bg-sage-50 dark:hover:bg-sage-900/40 flex items-center justify-center">
                    <i aria-hidden="true" class="fa-solid fa-pen text-xs"></i>
                </button>
                <button type="button" data-action="remover-filme" aria-label="Remover episódio T${escapeHtml(e.temporada || '?')}E${escapeHtml(e.episodio || '?')}"
                    class="w-7 h-7 rounded-full text-ink-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center">
                    <i aria-hidden="true" class="fa-solid fa-trash text-xs"></i>
                </button>
            </div>
        </div>`;
    }

    // Formulário rápido para registrar mais um episódio assistido de uma
    // série já cadastrada (issue #43) — sem precisar buscar de novo: os
    // dados do show (título/pôster/ano/gênero) vêm do grupo, só pede o
    // que muda por episódio.
    function renderFormAddEpisodio(grupo) {
        const chave = escapeHtml(grupo.titulo.trim().toLowerCase());
        const hoje = window.LogZenData.todayKey();
        return `
        <div class="mt-3 pt-3 border-t border-paper-200 dark:border-paper-800">
            <button type="button" data-action="toggle-add-episodio-serie" class="text-xs font-medium text-sage-700 dark:text-sage-400 hover:underline flex items-center gap-1">
                <i aria-hidden="true" class="fa-solid fa-plus"></i> Adicionar episódio assistido
            </button>
            <form data-form-add-episodio-serie data-titulo-chave="${chave}" hidden class="space-y-3 pt-3">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-medium mb-1">Temporada</label>
                        <input type="number" data-field="temporada" min="1" required
                            class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
                    </div>
                    <div>
                        <label class="block text-xs font-medium mb-1">Episódio</label>
                        <input type="number" data-field="episodio" min="1" required
                            class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
                    </div>
                    <p data-busca-episodio-status class="col-span-2 text-xs text-ink-400" hidden></p>
                    <div class="col-span-2">
                        <label class="block text-xs font-medium mb-1">Título do episódio (opcional)</label>
                        <input type="text" data-field="episodioTitulo" maxlength="120"
                            class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
                    </div>
                    <div class="col-span-2">
                        <label class="block text-xs font-medium mb-1">Duração (opcional)</label>
                        <input type="text" data-field="tempo" maxlength="30" placeholder="ex.: 42 min"
                            class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Assistido em</label>
                    <input type="date" data-field="assistidoEm" value="${hoje}" max="${hoje}"
                        class="px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Minhas estrelas</label>
                    <div class="flex flex-wrap gap-1" data-estrelas data-valor="0">${estrelasBtns(0)}</div>
                </div>
                <div class="flex items-center gap-2">
                    <button type="submit" class="px-3 py-1.5 rounded-xl bg-sage-600 dark:bg-sage-700 text-white text-sm font-medium hover:bg-sage-700">Salvar episódio</button>
                    <button type="button" data-action="cancelar-add-episodio-serie" class="px-3 py-1.5 rounded-xl border border-paper-300 dark:border-paper-700 text-sm hover:bg-paper-100 dark:hover:bg-paper-700">Cancelar</button>
                </div>
            </form>
        </div>`;
    }

    // Card do show: pôster/ano/gênero + lista completa de episódios já
    // registrados + formulário rápido para adicionar mais um (issue #43).
    // Recolhido por padrão (issue #46) — só o resumo fica sempre visível;
    // a lista de episódios e o formulário de adicionar ficam escondidos
    // dentro do próprio card até o usuário clicar para expandir, senão a
    // tela lota rápido com várias séries cadastradas.
    function renderGrupoSerie(grupo) {
        const chaveRaw = grupo.titulo.trim().toLowerCase();
        const chave = escapeHtml(chaveRaw);
        const expandido = seriesExpandidas.has(chaveRaw);
        const poster = grupo.poster
            ? `<img src="${escapeHtml(grupo.poster)}" alt="" class="w-16 h-24 object-cover rounded-lg shrink-0 bg-paper-100 dark:bg-paper-800">`
            : `<div class="w-16 h-24 rounded-lg shrink-0 bg-paper-100 dark:bg-paper-800 flex items-center justify-center text-ink-300"><i aria-hidden="true" class="fa-solid fa-tv text-xl"></i></div>`;
        const detalhes = [grupo.ano, grupo.genero].filter(Boolean).join(' · ');
        const total = grupo.episodios.length;
        return `
        <div data-grupo-serie data-titulo-chave="${chave}" class="rounded-2xl bg-paper-50 dark:bg-paper-700 shadow-sm p-4">
            <button type="button" data-action="toggle-grupo-serie" aria-expanded="${expandido}"
                class="w-full flex gap-3 text-left">
                ${poster}
                <div class="min-w-0 flex-1">
                    <p class="font-medium truncate">${escapeHtml(grupo.titulo)}</p>
                    ${detalhes ? `<p class="text-xs text-ink-400">${escapeHtml(detalhes)}</p>` : ''}
                    <p class="text-xs text-sage-700 dark:text-sage-400 mt-1">${total} episódio${total === 1 ? '' : 's'} registrado${total === 1 ? '' : 's'}</p>
                </div>
                <i aria-hidden="true" class="fa-solid ${expandido ? 'fa-chevron-up' : 'fa-chevron-down'} text-ink-300 text-xs self-center shrink-0"></i>
            </button>
            <div ${expandido ? '' : 'hidden'}>
                <div class="mt-2 divide-y divide-paper-200 dark:divide-paper-800">
                    ${grupo.episodios.map(renderEpisodioLinha).join('')}
                </div>
                ${renderFormAddEpisodio(grupo)}
            </div>
        </div>`;
    }

    function renderSeriesSecao() {
        const grupos = window.LogZenFilmes.listarGruposSeries();
        if (!grupos.length) return '<p class="text-xs text-ink-400 mt-3">Nenhuma série registrada ainda.</p>';
        return `<div data-series-lista class="space-y-4 mt-3">${grupos.map(renderGrupoSerie).join('')}</div>`;
    }

    function render() {
        if (!root) return;
        root.innerHTML = renderPainelAdicionar() + renderSubTabsHtml()
            + (subTab === 'series' ? renderSeriesSecao() : renderFilmesSecao());
    }

    // Busca automaticamente título e duração do episódio (issue #45) assim
    // que temporada + episódio estão preenchidos, desde que a série tenha
    // uma fonte conhecida (fonte/refId — veio de busca, não é manual). Não
    // trava o formulário em caso de erro (sem chave, episódio não achado,
    // falha de rede): só mostra o aviso, os campos continuam editáveis.
    async function tentarBuscarEpisodio(form, fonte, refId) {
        if (!fonte || !refId) return;
        const temporada = (form.querySelector('[data-field="temporada"]') || {}).value;
        const episodio = (form.querySelector('[data-field="episodio"]') || {}).value;
        if (!temporada || !episodio) return;
        const statusEl = form.querySelector('[data-busca-episodio-status]');
        try {
            if (statusEl) { statusEl.textContent = 'Buscando título e duração do episódio…'; statusEl.hidden = false; }
            const d = await window.LogZenFilmes.buscarDetalhesEpisodio(fonte, refId, temporada, episodio);
            if (d) {
                const tituloInput = form.querySelector('[data-field="episodioTitulo"]');
                if (tituloInput && d.episodioTitulo) tituloInput.value = d.episodioTitulo;
                const tempoInput = form.querySelector('[data-field="tempo"]');
                if (tempoInput && d.tempo) tempoInput.value = d.tempo;
            }
            if (statusEl) statusEl.hidden = true;
        } catch (err) {
            if (statusEl) { statusEl.textContent = err.message; statusEl.hidden = false; }
        }
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
                const resultados = rootEl.__ultimaBusca || [];
                const item = resultados.find((r) => r.id === selecionarBtn.dataset.id);
                if (!item) return;
                const status = rootEl.querySelector('[data-busca-status]');
                try {
                    if (status) { status.textContent = 'Carregando detalhes…'; status.classList.remove('hidden'); }
                    const d = await window.LogZenFilmes.buscarDetalhesPorResultado(item);
                    rascunho = {
                        manual: false,
                        titulo: d.titulo,
                        tipo: d.tipo || 'movie',
                        imdbID: d.imdbID || '',
                        poster: d.poster || '',
                        ano: d.ano || '',
                        tempo: d.tempo || '',
                        genero: d.genero || '',
                        premios: d.premios || '',
                        // Guardado para buscar título/duração de episódios
                        // depois, sem repetir a busca (issue #45).
                        serieFonte: item.fonte,
                        serieRefId: item.refId,
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

            // Genérico (não depende de `rascunho`): o valor escolhido fica em
            // data-valor no próprio contêiner — tanto o rascunho principal
            // quanto o formulário rápido de "adicionar episódio" (issue #43)
            // usam o mesmo [data-estrelas], cada um lido no submit.
            const estrelaBtn = e.target.closest('[data-estrelas] button[data-action="estrela"]');
            if (estrelaBtn) {
                const grupo = estrelaBtn.closest('[data-estrelas]');
                const n = parseInt(estrelaBtn.dataset.n, 10);
                const atual = parseInt(grupo.dataset.valor || '0', 10);
                const novo = atual === n ? 0 : n;
                grupo.dataset.valor = novo;
                grupo.querySelectorAll('button[data-action="estrela"]').forEach((b) => {
                    const bn = parseInt(b.dataset.n, 10);
                    const ativo = bn <= novo;
                    b.setAttribute('aria-pressed', ativo);
                    b.classList.toggle('text-clay-600', ativo);
                    b.classList.toggle('dark:text-clay-400', ativo);
                    b.classList.toggle('text-paper-300', !ativo);
                    b.classList.toggle('dark:text-paper-700', !ativo);
                });
                return;
            }

            const removerBtn = e.target.closest('[data-action="remover-filme"]');
            if (removerBtn) {
                const card = removerBtn.closest('[data-filme-entrada]');
                const titulo = card.querySelector('p.font-medium').textContent;
                if (!window.confirm(`Remover "${titulo}" da lista?`)) return;
                window.LogZenFilmes.remover(card.dataset.id);
                if (editandoId === card.dataset.id) { rascunho = null; editandoId = null; }
                render();
                return;
            }

            const subTabBtn = e.target.closest('[data-action="sub-tab"]');
            if (subTabBtn) {
                subTab = subTabBtn.dataset.subtab;
                render();
                return;
            }

            // Expande/recolhe o card do show (issue #46) — a lista de
            // episódios e o formulário de adicionar ficam escondidos dentro
            // do próprio card até o clique.
            const toggleGrupoBtn = e.target.closest('[data-action="toggle-grupo-serie"]');
            if (toggleGrupoBtn) {
                const chave = toggleGrupoBtn.closest('[data-grupo-serie]').dataset.tituloChave;
                if (seriesExpandidas.has(chave)) seriesExpandidas.delete(chave);
                else seriesExpandidas.add(chave);
                render();
                return;
            }

            const toggleEpisodioBtn = e.target.closest('[data-action="toggle-add-episodio-serie"]');
            if (toggleEpisodioBtn) {
                const form = toggleEpisodioBtn.nextElementSibling;
                form.hidden = !form.hidden;
                return;
            }

            const cancelarEpisodioBtn = e.target.closest('[data-action="cancelar-add-episodio-serie"]');
            if (cancelarEpisodioBtn) {
                const form = cancelarEpisodioBtn.closest('form[data-form-add-episodio-serie]');
                form.reset();
                const estrelasEl = form.querySelector('[data-estrelas]');
                if (estrelasEl) {
                    estrelasEl.dataset.valor = '0';
                    estrelasEl.querySelectorAll('button[data-action="estrela"]').forEach((b) => {
                        b.setAttribute('aria-pressed', 'false');
                        b.classList.remove('text-clay-600', 'dark:text-clay-400');
                        b.classList.add('text-paper-300', 'dark:text-paper-700');
                    });
                }
                form.hidden = true;
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
                return;
            }

            // Temporada/episódio preenchidos — busca automática de título e
            // duração do episódio (issue #45), tanto no formulário rápido de
            // cada card de série quanto no formulário principal.
            const epField = e.target.closest('[data-field="temporada"], [data-field="episodio"]');
            if (epField) {
                const addEpisodioForm = epField.closest('form[data-form-add-episodio-serie]');
                if (addEpisodioForm) {
                    const chave = addEpisodioForm.dataset.tituloChave;
                    const grupo = window.LogZenFilmes.listarGruposSeries().find((g) => g.titulo.trim().toLowerCase() === chave);
                    if (grupo) tentarBuscarEpisodio(addEpisodioForm, grupo.fonte, grupo.fonteId);
                    return;
                }
                const rascunhoFormEl = epField.closest('form[data-form-rascunho]');
                if (rascunhoFormEl && rascunho && rascunho.tipo === 'series') {
                    tentarBuscarEpisodio(rascunhoFormEl, rascunho.serieFonte, rascunho.serieRefId);
                    return;
                }
                return;
            }
            // Recalcula "já registrados" (issue #32) ao mudar o título de uma
            // entrada manual de série — atualização pontual do parágrafo, em
            // vez de um render() completo, que perderia tipo/temporada/
            // episódio ainda não persistidos em `rascunho` (só gravados no
            // submit).
            const tituloInput = e.target.closest('[data-field="titulo"]');
            if (tituloInput && rascunho) {
                rascunho.titulo = tituloInput.value;
                const painel = tituloInput.closest('form').querySelector('[data-episodios-existentes]');
                if (painel) {
                    const texto = textoEpisodiosExistentes(rascunho.titulo);
                    painel.innerHTML = texto;
                    painel.hidden = !texto;
                }
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
                    rootEl.__ultimaBusca = resultados;
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
                const estrelasEl = rascunhoForm.querySelector('[data-estrelas]');
                rascunho.estrelas = estrelasEl ? parseInt(estrelasEl.dataset.valor || '0', 10) : 0;
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
                return;
            }

            // Adicionar mais um episódio a uma série já cadastrada, sem
            // buscar de novo (issue #43) — dados do show vêm do grupo já
            // agrupado por título; só pede o que muda por episódio.
            const addEpisodioForm = e.target.closest('form[data-form-add-episodio-serie]');
            if (addEpisodioForm) {
                e.preventDefault();
                const temporada = addEpisodioForm.querySelector('[data-field="temporada"]').value.trim();
                const episodio = addEpisodioForm.querySelector('[data-field="episodio"]').value.trim();
                if (!temporada || !episodio) return;
                const chave = addEpisodioForm.dataset.tituloChave;
                const grupo = window.LogZenFilmes.listarGruposSeries().find((g) => g.titulo.trim().toLowerCase() === chave);
                if (!grupo) return;
                const estrelasEl = addEpisodioForm.querySelector('[data-estrelas]');
                const entrada = {
                    id: gerarId(),
                    criadoEm: Date.now(),
                    tipo: 'series',
                    titulo: grupo.titulo,
                    poster: grupo.poster || '',
                    ano: grupo.ano || '',
                    genero: grupo.genero || '',
                    premios: '',
                    temporada,
                    episodio,
                    episodioTitulo: addEpisodioForm.querySelector('[data-field="episodioTitulo"]').value.trim(),
                    tempo: addEpisodioForm.querySelector('[data-field="tempo"]').value.trim(),
                    assistidoEm: addEpisodioForm.querySelector('[data-field="assistidoEm"]').value || window.LogZenData.todayKey(),
                    estrelas: estrelasEl ? parseInt(estrelasEl.dataset.valor || '0', 10) : 0,
                    opiniao: '',
                    local: '', servico: '',
                };
                window.LogZenFilmes.salvar(entrada);
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

        const tmdbApiKeyInput = $('#tmdbApiKeyInput');
        if (tmdbApiKeyInput) {
            tmdbApiKeyInput.value = window.LogZenFilmes.getTmdbApiKey();
            tmdbApiKeyInput.addEventListener('change', () => {
                window.LogZenFilmes.setTmdbApiKey(tmdbApiKeyInput.value.trim());
                render();
            });
        }

        const fontesContainer = $('#fontesVideosLista');
        if (fontesContainer) {
            fontesContainer.innerHTML = renderFontesConfig();
            wireFontesConfig(fontesContainer);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

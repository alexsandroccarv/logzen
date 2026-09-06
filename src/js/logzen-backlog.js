/* ==========================================================================
   LogZen — Backlog (issue #20): lista de coisas para fazer, sem data fixa.
   Cada tarefa pode ter projeto (opcional), ação, prazo início/fim
   (opcionais) e descrição. "Enviar para hoje" cria um objetivo do dia
   (logzen-data.js) a partir da tarefa, respeitando o limite de 10 itens
   da regra 1-3-5 — a tarefa então some da lista ativa e aparece em
   "Enviados" (arquivo), com opção de desfazer. 100% local, mesmo padrão
   dos demais módulos.
   ========================================================================== */
window.LogZenBacklog = (function () {
    const ENTRIES_KEY = 'logzen:backlog:v1';

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

    // Pendentes: prazo fim mais próximo primeiro; sem prazo, no fim.
    function listarPendentes() {
        return readEntries().filter((t) => !t.enviado).sort((a, b) => {
            if (!a.prazoFim && !b.prazoFim) return (b.criadoEm || 0) - (a.criadoEm || 0);
            if (!a.prazoFim) return 1;
            if (!b.prazoFim) return -1;
            return a.prazoFim.localeCompare(b.prazoFim) || (b.criadoEm || 0) - (a.criadoEm || 0);
        });
    }

    // Enviados: mais recente primeiro.
    function listarEnviados() {
        return readEntries().filter((t) => t.enviado).sort((a, b) =>
            (b.enviadoEm || '').localeCompare(a.enviadoEm || '') || (b.criadoEm || 0) - (a.criadoEm || 0));
    }

    function salvar(tarefa) {
        const lista = readEntries();
        lista.push(tarefa);
        writeEntries(lista);
    }

    function remover(id) {
        writeEntries(readEntries().filter((t) => t.id !== id));
    }

    function obter(id) {
        return readEntries().find((t) => t.id === id);
    }

    // Projetos já usados (pendentes ou enviadas), para popular o seletor do
    // formulário e agrupar a lista — sem duplicar, em ordem alfabética.
    function listarProjetos() {
        const nomes = new Set(readEntries().map((t) => (t.projeto || '').trim()).filter(Boolean));
        return Array.from(nomes).sort((a, b) => a.localeCompare(b));
    }

    function atualizar(id, dados) {
        const lista = readEntries();
        const item = lista.find((t) => t.id === id);
        if (!item) return;
        Object.assign(item, dados);
        writeEntries(lista);
    }

    function marcarEnviado(id, enviadoEm) {
        const lista = readEntries();
        const item = lista.find((t) => t.id === id);
        if (!item) return;
        item.enviado = true;
        item.enviadoEm = enviadoEm || window.LogZenData.todayKey();
        writeEntries(lista);
    }

    function desmarcarEnviado(id) {
        const lista = readEntries();
        const item = lista.find((t) => t.id === id);
        if (!item) return;
        item.enviado = false;
        item.enviadoEm = '';
        writeEntries(lista);
    }

    return { listarPendentes, listarEnviados, salvar, remover, obter, atualizar, marcarEnviado, desmarcarEnviado, listarProjetos };
})();

(function () {
    const $ = (sel, ctx) => (ctx || document).querySelector(sel);

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function gerarId() {
        return `bl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    }

    // Só aceita "YYYY-MM-DD" válido — mesma defesa contra "Invalid Date"
    // já aplicada em Entregas (issue #19).
    function dataValida(d) {
        return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d + 'T00:00:00').getTime());
    }

    function fmtData(d) {
        return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
    }

    let root = null;
    let editandoId = null;

    // Select com os projetos já usados + "Outro" para digitar um novo — em
    // vez de um campo livre, evita variações do mesmo projeto por causa de
    // digitação (ex.: "Casa Nova" vs "casa nova").
    function renderCampoProjeto(v) {
        const projetos = window.LogZenBacklog.listarProjetos();
        const projetoConhecido = !v.projeto || projetos.includes(v.projeto);
        const outroHidden = projetoConhecido ? 'hidden' : '';
        return `
        <div>
            <label class="block text-xs font-medium mb-1">Projeto (opcional)</label>
            <select data-field="projeto"
                class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                <option value="" ${!v.projeto ? 'selected' : ''}>Sem projeto</option>
                ${projetos.map((p) => `<option value="${escapeHtml(p)}" ${v.projeto === p ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
                <option value="__outro__" ${!projetoConhecido ? 'selected' : ''}>Outro (novo projeto)…</option>
            </select>
            <input type="text" data-field="projetoOutro" ${outroHidden} maxlength="80" placeholder="Nome do novo projeto" value="${!projetoConhecido ? escapeHtml(v.projeto) : ''}"
                class="mt-2 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
        </div>`;
    }

    function renderForm() {
        const editando = editandoId ? window.LogZenBacklog.obter(editandoId) : null;
        const v = editando || { projeto: '', acao: '', prazoInicio: '', prazoFim: '', descricao: '' };
        const cabecalho = editando
            ? `<p class="text-sm font-medium text-brand-700 dark:text-accent-400 flex items-center gap-1.5">
                   <i aria-hidden="true" class="fa-solid fa-pen"></i> Editando "${escapeHtml(editando.acao)}"
               </p>`
            : `<button type="button" data-action="toggle-add-backlog" class="text-sm font-medium text-brand-700 dark:text-accent-400 hover:underline flex items-center gap-1">
                   <i aria-hidden="true" class="fa-solid fa-plus"></i> Adicionar tarefa
               </button>`;
        return `
        <div class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-3">
            ${cabecalho}
            <form data-form-backlog ${editando ? '' : 'hidden'} class="space-y-3">
                ${renderCampoProjeto(v)}
                <div>
                    <label class="block text-xs font-medium mb-1">Ação</label>
                    <input type="text" data-field="acao" required maxlength="150" placeholder="O que precisa ser feito?" value="${escapeHtml(v.acao)}"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-medium mb-1">Prazo início (opcional)</label>
                        <input type="date" data-field="prazoInicio" value="${v.prazoInicio || ''}"
                            class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    </div>
                    <div>
                        <label class="block text-xs font-medium mb-1">Prazo fim (opcional)</label>
                        <input type="date" data-field="prazoFim" value="${v.prazoFim || ''}"
                            class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Descrição (opcional)</label>
                    <textarea data-field="descricao" rows="2" maxlength="500" placeholder="Detalhes, contexto…"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">${escapeHtml(v.descricao || '')}</textarea>
                </div>
                <div class="flex items-center gap-2">
                    <button type="submit" class="px-3 py-1.5 rounded bg-brand-600 dark:bg-accent-600 text-white text-sm font-semibold hover:bg-brand-700">${editando ? 'Salvar alterações' : 'Salvar'}</button>
                    <button type="button" data-action="cancelar-backlog" class="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Cancelar</button>
                </div>
            </form>
        </div>`;
    }

    function linhaPrazo(t) {
        const ini = dataValida(t.prazoInicio) ? fmtData(t.prazoInicio) : '';
        const fim = dataValida(t.prazoFim) ? fmtData(t.prazoFim) : '';
        if (ini && fim) return `De ${ini} a ${fim}`;
        if (ini) return `A partir de ${ini}`;
        if (fim) return `Até ${fim}`;
        return '';
    }

    function renderTarefa(t) {
        const prazo = linhaPrazo(t);
        return `
        <div data-backlog-tarefa data-id="${t.id}" class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                    <p class="font-semibold truncate">${escapeHtml(t.acao)}</p>
                    ${prazo ? `<p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(prazo)}</p>` : ''}
                    ${t.descricao ? `<p class="text-sm mt-1">${escapeHtml(t.descricao)}</p>` : ''}
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    <button type="button" data-action="enviar-backlog" aria-label="Enviar '${escapeHtml(t.acao)}' para hoje" title="Enviar para Objetivos do dia"
                        class="w-7 h-7 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-accent-950/40 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-solid fa-paper-plane text-xs"></i>
                    </button>
                    <button type="button" data-action="editar-backlog" aria-label="Editar ${escapeHtml(t.acao)}"
                        class="w-7 h-7 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-accent-950/40 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button type="button" data-action="remover-backlog" aria-label="Remover ${escapeHtml(t.acao)}"
                        class="w-7 h-7 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        </div>`;
    }

    function renderEnviada(t) {
        return `
        <div data-backlog-enviada data-id="${t.id}" class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                    <p class="font-semibold truncate">${escapeHtml(t.acao)}</p>
                    ${dataValida(t.enviadoEm) ? `<p class="text-xs font-medium text-green-700 dark:text-green-400">Enviada para hoje em ${escapeHtml(fmtData(t.enviadoEm))}</p>` : ''}
                    ${t.descricao ? `<p class="text-sm mt-1">${escapeHtml(t.descricao)}</p>` : ''}
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    <button type="button" data-action="editar-backlog" aria-label="Editar ${escapeHtml(t.acao)}"
                        class="w-7 h-7 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-accent-950/40 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button type="button" data-action="desfazer-backlog" aria-label="Desfazer envio de ${escapeHtml(t.acao)}" title="Voltar para o backlog"
                        class="w-7 h-7 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-accent-950/40 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-solid fa-rotate-left text-xs"></i>
                    </button>
                    <button type="button" data-action="remover-backlog" aria-label="Remover ${escapeHtml(t.acao)}"
                        class="w-7 h-7 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        </div>`;
    }

    // Agrupa por projeto (ordem alfabética; "Sem projeto" sempre por
    // último), preservando a ordenação já aplicada à lista recebida.
    function agruparPorProjeto(lista) {
        const grupos = new Map();
        lista.forEach((t) => {
            const chave = t.projeto || '';
            if (!grupos.has(chave)) grupos.set(chave, []);
            grupos.get(chave).push(t);
        });
        const nomes = Array.from(grupos.keys()).filter(Boolean).sort((a, b) => a.localeCompare(b));
        const ordenado = nomes.map((nome) => ({ projeto: nome, tarefas: grupos.get(nome) }));
        if (grupos.has('')) ordenado.push({ projeto: '', tarefas: grupos.get('') });
        return ordenado;
    }

    function renderListaAgrupada(lista, renderItemFn) {
        return agruparPorProjeto(lista).map((g) => `
            <div data-grupo-projeto="${escapeHtml(g.projeto)}">
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                    <i aria-hidden="true" class="fa-solid fa-folder"></i> ${g.projeto ? escapeHtml(g.projeto) : 'Sem projeto'}
                </p>
                <div class="space-y-3 mb-3">${g.tarefas.map(renderItemFn).join('')}</div>
            </div>`).join('');
    }

    function render() {
        if (!root) return;
        const pendentes = window.LogZenBacklog.listarPendentes();
        const enviadas = window.LogZenBacklog.listarEnviados();
        const listaHtml = pendentes.length
            ? renderListaAgrupada(pendentes, renderTarefa)
            : '<p class="text-xs text-gray-500 dark:text-gray-400">Nenhuma tarefa no backlog ainda.</p>';
        const enviadasHtml = `
        <details class="rounded-lg border border-gray-200 dark:border-gray-700">
            <summary class="px-3 py-2 text-sm font-medium cursor-pointer select-none">
                <i aria-hidden="true" class="fa-solid fa-paper-plane mr-1"></i> Enviadas (${enviadas.length})
            </summary>
            <div class="p-3 pt-0">
                ${enviadas.length ? renderListaAgrupada(enviadas, renderEnviada) : '<p class="text-xs text-gray-500 dark:text-gray-400">Nenhuma tarefa enviada ainda.</p>'}
            </div>
        </details>`;
        root.innerHTML = renderForm()
            + `<div data-backlog-lista class="space-y-3">${listaHtml}</div>`
            + enviadasHtml;
    }

    function wire(rootEl) {
        rootEl.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('[data-action="toggle-add-backlog"]');
            if (toggleBtn) {
                const form = toggleBtn.nextElementSibling;
                form.hidden = !form.hidden;
                return;
            }

            const cancelarBtn = e.target.closest('[data-action="cancelar-backlog"]');
            if (cancelarBtn) {
                if (editandoId) {
                    editandoId = null;
                    render();
                } else {
                    const form = cancelarBtn.closest('form[data-form-backlog]');
                    form.reset();
                    form.hidden = true;
                }
                return;
            }

            const editarBtn = e.target.closest('[data-action="editar-backlog"]');
            if (editarBtn) {
                const card = editarBtn.closest('[data-backlog-tarefa], [data-backlog-enviada]');
                editandoId = card.dataset.id;
                render();
                return;
            }

            const removerBtn = e.target.closest('[data-action="remover-backlog"]');
            if (removerBtn) {
                const card = removerBtn.closest('[data-backlog-tarefa], [data-backlog-enviada]');
                const acao = card.querySelector('p.font-semibold').textContent;
                if (!window.confirm(`Remover "${acao}" do backlog?`)) return;
                window.LogZenBacklog.remover(card.dataset.id);
                if (editandoId === card.dataset.id) editandoId = null;
                render();
                return;
            }

            const desfazerBtn = e.target.closest('[data-action="desfazer-backlog"]');
            if (desfazerBtn) {
                const card = desfazerBtn.closest('[data-backlog-enviada]');
                window.LogZenBacklog.desmarcarEnviado(card.dataset.id);
                render();
                return;
            }

            const enviarBtn = e.target.closest('[data-action="enviar-backlog"]');
            if (enviarBtn) {
                const card = enviarBtn.closest('[data-backlog-tarefa]');
                const tarefa = window.LogZenBacklog.obter(card.dataset.id);
                if (!tarefa) return;
                const limite = window.LogZenData.LIMITE_OBJETIVOS_DIA;
                const hojeKey = window.LogZenData.todayKey();
                const lista = window.LogZenData.getObjetivos(hojeKey);
                if (lista.length >= limite) {
                    window.alert(`Objetivos do dia já tem o máximo de ${limite} itens — conclua ou remova algum antes de enviar mais.`);
                    return;
                }
                const texto = tarefa.projeto ? `[${tarefa.projeto}] ${tarefa.acao}` : tarefa.acao;
                const idObjetivo = `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
                lista.push({ id: idObjetivo, texto, feito: false });
                window.LogZenData.setObjetivos(hojeKey, lista);
                window.LogZenBacklog.marcarEnviado(card.dataset.id, hojeKey);
                render();
                return;
            }
        });

        rootEl.addEventListener('change', (e) => {
            const projetoSelect = e.target.closest('[data-field="projeto"]');
            if (projetoSelect) {
                const outroInput = projetoSelect.closest('div').querySelector('[data-field="projetoOutro"]');
                if (outroInput) outroInput.hidden = projetoSelect.value !== '__outro__';
            }
        });

        rootEl.addEventListener('submit', (e) => {
            const form = e.target.closest('form[data-form-backlog]');
            if (!form) return;
            e.preventDefault();
            const acao = form.querySelector('[data-field="acao"]').value.trim();
            if (!acao) return;
            const projetoSel = form.querySelector('[data-field="projeto"]').value;
            const projeto = projetoSel === '__outro__'
                ? form.querySelector('[data-field="projetoOutro"]').value.trim()
                : projetoSel;
            const dados = {
                projeto,
                acao,
                prazoInicio: form.querySelector('[data-field="prazoInicio"]').value || '',
                prazoFim: form.querySelector('[data-field="prazoFim"]').value || '',
                descricao: form.querySelector('[data-field="descricao"]').value.trim(),
            };
            if (editandoId) {
                window.LogZenBacklog.atualizar(editandoId, dados);
                editandoId = null;
            } else {
                window.LogZenBacklog.salvar({ id: gerarId(), criadoEm: Date.now(), ...dados });
            }
            render();
        });
    }

    function init() {
        root = $('#backlogRoot');
        if (root) {
            render();
            wire(root);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

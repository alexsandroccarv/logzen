/* ==========================================================================
   LogZen — Entregas (issue #15): controle de compras aguardando entrega —
   nome, data da compra, previsão de entrega, loja/e-commerce, número de
   rastreio e observações. Sem integração externa (cada transportadora tem
   seu próprio rastreamento, sem API unificada) — cadastro 100% manual,
   guardado só no localStorage, no mesmo padrão dos demais módulos.
   ========================================================================== */
window.LogZenEntregas = (function () {
    const ENTRIES_KEY = 'logzen:entregas:v1';

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

    // Aguardando entrega: previsão mais próxima (ou mais atrasada) primeiro;
    // sem previsão, no fim.
    function listarPendentes() {
        return readEntries().filter((e) => !e.entregue).sort((a, b) => {
            if (!a.dataPrevisao && !b.dataPrevisao) return (b.criadoEm || 0) - (a.criadoEm || 0);
            if (!a.dataPrevisao) return 1;
            if (!b.dataPrevisao) return -1;
            return a.dataPrevisao.localeCompare(b.dataPrevisao) || (b.criadoEm || 0) - (a.criadoEm || 0);
        });
    }

    // Arquivo (já entregues): entrega mais recente primeiro.
    function listarArquivadas() {
        return readEntries().filter((e) => e.entregue).sort((a, b) =>
            (b.dataEntrega || '').localeCompare(a.dataEntrega || '') || (b.criadoEm || 0) - (a.criadoEm || 0));
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

    // Atualiza os dados cadastrais de uma entrega já existente (nome, datas,
    // loja, rastreio, observações) sem mexer no estado de entregue/arquivo.
    function atualizar(id, dados) {
        const lista = readEntries();
        const item = lista.find((e) => e.id === id);
        if (!item) return;
        Object.assign(item, dados);
        writeEntries(lista);
    }

    // Marca como entregue (move para o arquivo) ou desfaz, voltando a
    // "aguardando entrega" — o registro nunca é apagado, só muda de estado.
    function marcarEntregue(id, dataEntrega) {
        const lista = readEntries();
        const item = lista.find((e) => e.id === id);
        if (!item) return;
        item.entregue = true;
        item.dataEntrega = dataEntrega || window.LogZenData.todayKey();
        writeEntries(lista);
    }

    function desmarcarEntregue(id) {
        const lista = readEntries();
        const item = lista.find((e) => e.id === id);
        if (!item) return;
        item.entregue = false;
        item.dataEntrega = '';
        writeEntries(lista);
    }

    return { listarPendentes, listarArquivadas, salvar, remover, obter, atualizar, marcarEntregue, desmarcarEntregue };
})();

(function () {
    const $ = (sel, ctx) => (ctx || document).querySelector(sel);

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function gerarId() {
        return `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    }

    let root = null;
    // id da entrega em edição (null = nenhuma edição em andamento, e o
    // formulário serve para cadastrar uma entrega nova).
    let editandoId = null;

    function renderForm() {
        const hoje = window.LogZenData.todayKey();
        const editando = editandoId ? window.LogZenEntregas.obter(editandoId) : null;
        const v = editando || { nome: '', dataCompra: hoje, dataPrevisao: '', loja: '', rastreio: '', observacoes: '' };
        const cabecalho = editando
            ? `<p class="text-sm font-medium text-brand-700 dark:text-accent-400 flex items-center gap-1.5">
                   <i aria-hidden="true" class="fa-solid fa-pen"></i> Editando "${escapeHtml(editando.nome)}"
               </p>`
            : `<button type="button" data-action="toggle-add-entrega" class="text-sm font-medium text-brand-700 dark:text-accent-400 hover:underline flex items-center gap-1">
                   <i aria-hidden="true" class="fa-solid fa-plus"></i> Registrar entrega
               </button>`;
        return `
        <div class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-3">
            ${cabecalho}
            <form data-form-entrega ${editando ? '' : 'hidden'} class="space-y-3">
                <div>
                    <label class="block text-xs font-medium mb-1">Nome</label>
                    <input type="text" data-field="nome" required maxlength="150" placeholder="O que você comprou?" value="${escapeHtml(v.nome)}"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-medium mb-1">Data da compra</label>
                        <input type="date" data-field="dataCompra" value="${v.dataCompra || hoje}" max="${hoje}"
                            class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    </div>
                    <div>
                        <label class="block text-xs font-medium mb-1">Previsão de entrega</label>
                        <input type="date" data-field="dataPrevisao" value="${v.dataPrevisao || ''}"
                            class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Loja/e-commerce</label>
                    <input type="text" data-field="loja" maxlength="100" placeholder="ex.: Amazon, Mercado Livre…" value="${escapeHtml(v.loja || '')}"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Número de rastreio</label>
                    <input type="text" data-field="rastreio" maxlength="60" placeholder="ex.: BR123456789BR" value="${escapeHtml(v.rastreio || '')}"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Observações</label>
                    <textarea data-field="observacoes" rows="2" maxlength="500" placeholder="Opcional"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">${escapeHtml(v.observacoes || '')}</textarea>
                </div>
                <div class="flex items-center gap-2">
                    <button type="submit" class="px-3 py-1.5 rounded bg-brand-600 dark:bg-accent-600 text-white text-sm font-semibold hover:bg-brand-700">${editando ? 'Salvar alterações' : 'Salvar'}</button>
                    <button type="button" data-action="cancelar-entrega" class="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Cancelar</button>
                </div>
            </form>
        </div>`;
    }

    function fmtData(d) {
        return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
    }

    function renderEntrada(e) {
        const hoje = window.LogZenData.todayKey();
        let previsaoHtml = '';
        if (e.dataPrevisao) {
            const atrasada = e.dataPrevisao < hoje;
            previsaoHtml = `<p class="text-xs font-medium ${atrasada ? 'text-red-600 dark:text-red-400' : 'text-brand-700 dark:text-accent-400'} truncate">
                ${atrasada ? 'Atrasada — previsão era' : 'Previsão de entrega:'} ${escapeHtml(fmtData(e.dataPrevisao))}</p>`;
        }
        const detalhes = [e.loja, e.rastreio].filter(Boolean).join(' · ');
        return `
        <div data-entrega-entrada data-id="${e.id}" class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                    <p class="font-semibold truncate">${escapeHtml(e.nome)}</p>
                    ${detalhes ? `<p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(detalhes)}</p>` : ''}
                    ${e.dataCompra ? `<p class="text-xs text-gray-500 dark:text-gray-400">Comprado em ${escapeHtml(fmtData(e.dataCompra))}</p>` : ''}
                    ${previsaoHtml}
                    ${e.observacoes ? `<p class="text-sm mt-1">${escapeHtml(e.observacoes)}</p>` : ''}
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    <button type="button" data-action="editar-entrega" aria-label="Editar ${escapeHtml(e.nome)}"
                        class="w-7 h-7 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-accent-950/40 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button type="button" data-action="remover-entrega" aria-label="Remover ${escapeHtml(e.nome)}"
                        class="w-7 h-7 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
            <div class="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <label class="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input type="checkbox" data-action="marcar-entregue" class="rounded border-gray-300 dark:border-gray-600">
                    Entregue
                </label>
                <div data-confirmar-entrega hidden class="flex items-center gap-2 mt-2">
                    <input type="date" data-field="dataEntrega" value="${hoje}" max="${hoje}"
                        class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400">
                    <button type="button" data-action="confirmar-entrega" class="px-2 py-1 rounded bg-brand-600 dark:bg-accent-600 text-white text-xs font-semibold hover:bg-brand-700">Confirmar</button>
                    <button type="button" data-action="cancelar-entregue" class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs hover:bg-gray-100 dark:hover:bg-gray-700">Cancelar</button>
                </div>
            </div>
        </div>`;
    }

    function renderArquivada(e) {
        const detalhes = [e.loja, e.rastreio].filter(Boolean).join(' · ');
        return `
        <div data-entrega-arquivada data-id="${e.id}" class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                    <p class="font-semibold truncate">${escapeHtml(e.nome)}</p>
                    ${detalhes ? `<p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(detalhes)}</p>` : ''}
                    ${e.dataEntrega ? `<p class="text-xs font-medium text-green-700 dark:text-green-400">Entregue em ${escapeHtml(fmtData(e.dataEntrega))}</p>` : ''}
                    ${e.observacoes ? `<p class="text-sm mt-1">${escapeHtml(e.observacoes)}</p>` : ''}
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    <button type="button" data-action="editar-entrega" aria-label="Editar ${escapeHtml(e.nome)}"
                        class="w-7 h-7 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-accent-950/40 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button type="button" data-action="desfazer-entrega" aria-label="Desfazer entrega de ${escapeHtml(e.nome)}" title="Voltar para aguardando entrega"
                        class="w-7 h-7 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-accent-950/40 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-solid fa-rotate-left text-xs"></i>
                    </button>
                    <button type="button" data-action="remover-entrega" aria-label="Remover ${escapeHtml(e.nome)}"
                        class="w-7 h-7 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        </div>`;
    }

    function render() {
        if (!root) return;
        const pendentes = window.LogZenEntregas.listarPendentes();
        const arquivadas = window.LogZenEntregas.listarArquivadas();
        const listaHtml = pendentes.length
            ? pendentes.map(renderEntrada).join('')
            : '<p class="text-xs text-gray-500 dark:text-gray-400">Nenhuma entrega aguardando no momento.</p>';
        const arquivoHtml = `
        <details class="rounded-lg border border-gray-200 dark:border-gray-700">
            <summary class="px-3 py-2 text-sm font-medium cursor-pointer select-none">
                <i aria-hidden="true" class="fa-solid fa-box-archive mr-1"></i> Arquivo (${arquivadas.length} entregue${arquivadas.length === 1 ? '' : 's'})
            </summary>
            <div class="p-3 pt-0 space-y-3">
                ${arquivadas.length ? arquivadas.map(renderArquivada).join('') : '<p class="text-xs text-gray-500 dark:text-gray-400">Nenhuma entrega arquivada ainda.</p>'}
            </div>
        </details>`;
        root.innerHTML = renderForm()
            + `<div data-entregas-lista class="space-y-3">${listaHtml}</div>`
            + arquivoHtml;
    }

    function wire(rootEl) {
        rootEl.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('[data-action="toggle-add-entrega"]');
            if (toggleBtn) {
                const form = toggleBtn.nextElementSibling;
                form.hidden = !form.hidden;
                return;
            }

            const cancelarBtn = e.target.closest('[data-action="cancelar-entrega"]');
            if (cancelarBtn) {
                if (editandoId) {
                    editandoId = null;
                    render();
                } else {
                    const form = cancelarBtn.closest('form[data-form-entrega]');
                    form.reset();
                    form.hidden = true;
                }
                return;
            }

            const editarBtn = e.target.closest('[data-action="editar-entrega"]');
            if (editarBtn) {
                const card = editarBtn.closest('[data-entrega-entrada], [data-entrega-arquivada]');
                editandoId = card.dataset.id;
                render();
                return;
            }

            const removerBtn = e.target.closest('[data-action="remover-entrega"]');
            if (removerBtn) {
                const card = removerBtn.closest('[data-entrega-entrada], [data-entrega-arquivada]');
                const nome = card.querySelector('p.font-semibold').textContent;
                if (!window.confirm(`Remover "${nome}" da lista?`)) return;
                window.LogZenEntregas.remover(card.dataset.id);
                if (editandoId === card.dataset.id) editandoId = null;
                render();
                return;
            }

            const confirmarBtn = e.target.closest('[data-action="confirmar-entrega"]');
            if (confirmarBtn) {
                const card = confirmarBtn.closest('[data-entrega-entrada]');
                const data = card.querySelector('[data-field="dataEntrega"]').value || window.LogZenData.todayKey();
                window.LogZenEntregas.marcarEntregue(card.dataset.id, data);
                render();
                return;
            }

            const cancelarEntregueBtn = e.target.closest('[data-action="cancelar-entregue"]');
            if (cancelarEntregueBtn) {
                const card = cancelarEntregueBtn.closest('[data-entrega-entrada]');
                card.querySelector('[data-action="marcar-entregue"]').checked = false;
                card.querySelector('[data-confirmar-entrega]').hidden = true;
                return;
            }

            const desfazerBtn = e.target.closest('[data-action="desfazer-entrega"]');
            if (desfazerBtn) {
                const card = desfazerBtn.closest('[data-entrega-arquivada]');
                window.LogZenEntregas.desmarcarEntregue(card.dataset.id);
                render();
                return;
            }
        });

        rootEl.addEventListener('change', (e) => {
            const checkbox = e.target.closest('[data-action="marcar-entregue"]');
            if (checkbox) {
                const card = checkbox.closest('[data-entrega-entrada]');
                card.querySelector('[data-confirmar-entrega]').hidden = !checkbox.checked;
            }
        });

        rootEl.addEventListener('submit', (e) => {
            const form = e.target.closest('form[data-form-entrega]');
            if (!form) return;
            e.preventDefault();
            const nome = form.querySelector('[data-field="nome"]').value.trim();
            if (!nome) return;
            const dados = {
                nome,
                dataCompra: form.querySelector('[data-field="dataCompra"]').value || '',
                dataPrevisao: form.querySelector('[data-field="dataPrevisao"]').value || '',
                loja: form.querySelector('[data-field="loja"]').value.trim(),
                rastreio: form.querySelector('[data-field="rastreio"]').value.trim(),
                observacoes: form.querySelector('[data-field="observacoes"]').value.trim(),
            };
            if (editandoId) {
                window.LogZenEntregas.atualizar(editandoId, dados);
                editandoId = null;
            } else {
                window.LogZenEntregas.salvar({ id: gerarId(), criadoEm: Date.now(), ...dados });
            }
            render();
        });
    }

    function init() {
        root = $('#entregasRoot');
        if (root) {
            render();
            wire(root);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

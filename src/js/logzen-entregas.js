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

    // Previsão mais próxima (ou mais atrasada) primeiro; sem previsão, no fim.
    function listar() {
        return readEntries().slice().sort((a, b) => {
            if (!a.dataPrevisao && !b.dataPrevisao) return (b.criadoEm || 0) - (a.criadoEm || 0);
            if (!a.dataPrevisao) return 1;
            if (!b.dataPrevisao) return -1;
            return a.dataPrevisao.localeCompare(b.dataPrevisao) || (b.criadoEm || 0) - (a.criadoEm || 0);
        });
    }

    function salvar(entrada) {
        const lista = readEntries();
        lista.push(entrada);
        writeEntries(lista);
    }

    function remover(id) {
        writeEntries(readEntries().filter((e) => e.id !== id));
    }

    return { listar, salvar, remover };
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

    function renderForm() {
        const hoje = window.LogZenData.todayKey();
        return `
        <div class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-3">
            <button type="button" data-action="toggle-add-entrega" class="text-sm font-medium text-brand-700 dark:text-accent-400 hover:underline flex items-center gap-1">
                <i aria-hidden="true" class="fa-solid fa-plus"></i> Registrar entrega
            </button>
            <form data-form-entrega hidden class="space-y-3">
                <div>
                    <label class="block text-xs font-medium mb-1">Nome</label>
                    <input type="text" data-field="nome" required maxlength="150" placeholder="O que você comprou?"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-medium mb-1">Data da compra</label>
                        <input type="date" data-field="dataCompra" value="${hoje}" max="${hoje}"
                            class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    </div>
                    <div>
                        <label class="block text-xs font-medium mb-1">Previsão de entrega</label>
                        <input type="date" data-field="dataPrevisao"
                            class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Loja/e-commerce</label>
                    <input type="text" data-field="loja" maxlength="100" placeholder="ex.: Amazon, Mercado Livre…"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Número de rastreio</label>
                    <input type="text" data-field="rastreio" maxlength="60" placeholder="ex.: BR123456789BR"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Observações</label>
                    <textarea data-field="observacoes" rows="2" maxlength="500" placeholder="Opcional"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"></textarea>
                </div>
                <div class="flex items-center gap-2">
                    <button type="submit" class="px-3 py-1.5 rounded bg-brand-600 dark:bg-accent-600 text-white text-sm font-semibold hover:bg-brand-700">Salvar</button>
                    <button type="button" data-action="cancelar-entrega" class="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Cancelar</button>
                </div>
            </form>
        </div>`;
    }

    function renderEntrada(e) {
        const fmt = (d) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
        const hoje = window.LogZenData.todayKey();
        let previsaoHtml = '';
        if (e.dataPrevisao) {
            const atrasada = e.dataPrevisao < hoje;
            previsaoHtml = `<p class="text-xs font-medium ${atrasada ? 'text-red-600 dark:text-red-400' : 'text-brand-700 dark:text-accent-400'} truncate">
                ${atrasada ? 'Atrasada — previsão era' : 'Previsão de entrega:'} ${escapeHtml(fmt(e.dataPrevisao))}</p>`;
        }
        const detalhes = [e.loja, e.rastreio].filter(Boolean).join(' · ');
        return `
        <div data-entrega-entrada data-id="${e.id}" class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                    <p class="font-semibold truncate">${escapeHtml(e.nome)}</p>
                    ${detalhes ? `<p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(detalhes)}</p>` : ''}
                    ${e.dataCompra ? `<p class="text-xs text-gray-500 dark:text-gray-400">Comprado em ${escapeHtml(fmt(e.dataCompra))}</p>` : ''}
                    ${previsaoHtml}
                    ${e.observacoes ? `<p class="text-sm mt-1">${escapeHtml(e.observacoes)}</p>` : ''}
                </div>
                <button type="button" data-action="remover-entrega" aria-label="Remover ${escapeHtml(e.nome)}"
                    class="w-7 h-7 shrink-0 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center">
                    <i aria-hidden="true" class="fa-solid fa-trash text-xs"></i>
                </button>
            </div>
        </div>`;
    }

    function render() {
        if (!root) return;
        const entradas = window.LogZenEntregas.listar();
        const listaHtml = entradas.length
            ? entradas.map(renderEntrada).join('')
            : '<p class="text-xs text-gray-500 dark:text-gray-400">Nenhuma entrega registrada ainda.</p>';
        root.innerHTML = renderForm() + `<div data-entregas-lista class="space-y-3">${listaHtml}</div>`;
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
                const form = cancelarBtn.closest('form[data-form-entrega]');
                form.reset();
                form.hidden = true;
                return;
            }

            const removerBtn = e.target.closest('[data-action="remover-entrega"]');
            if (removerBtn) {
                const card = removerBtn.closest('[data-entrega-entrada]');
                const nome = card.querySelector('p.font-semibold').textContent;
                if (!window.confirm(`Remover "${nome}" da lista?`)) return;
                window.LogZenEntregas.remover(card.dataset.id);
                render();
                return;
            }
        });

        rootEl.addEventListener('submit', (e) => {
            const form = e.target.closest('form[data-form-entrega]');
            if (!form) return;
            e.preventDefault();
            const nome = form.querySelector('[data-field="nome"]').value.trim();
            if (!nome) return;
            const entrada = {
                id: gerarId(),
                criadoEm: Date.now(),
                nome,
                dataCompra: form.querySelector('[data-field="dataCompra"]').value || '',
                dataPrevisao: form.querySelector('[data-field="dataPrevisao"]').value || '',
                loja: form.querySelector('[data-field="loja"]').value.trim(),
                rastreio: form.querySelector('[data-field="rastreio"]').value.trim(),
                observacoes: form.querySelector('[data-field="observacoes"]').value.trim(),
            };
            window.LogZenEntregas.salvar(entrada);
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

/* ==========================================================================
   LogZen — Tela "Hoje": renderiza as categorias/itens (logzen-items.js) a
   partir dos dados salvos (logzen-data.js) e liga os inputs (contador,
   contador-inverso, checkbox, escala, tags) via delegação de eventos.
   ========================================================================== */
(function () {
    const $ = (sel, ctx) => (ctx || document).querySelector(sel);

    const CORES_VICIO = [
        'bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300',
        'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300',
        'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300',
    ];
    const corVicio = (v) => CORES_VICIO[v <= 0 ? 0 : (v <= 2 ? 1 : 2)];

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function renderContador(cat, item, dateKey) {
        const valor = window.LogZenData.getItemValue(dateKey, cat.id, item.id, 0);
        return `
        <div class="flex items-center justify-between gap-3 py-3" data-row data-cat="${cat.id}" data-item="${item.id}" data-tipo="contador">
            <span class="font-medium">${escapeHtml(item.nome)}<span class="block text-xs font-normal text-gray-500 dark:text-gray-400">${escapeHtml(item.unidade || '')}</span></span>
            <div class="flex items-center gap-2 shrink-0">
                <button type="button" data-action="dec" aria-label="Diminuir ${escapeHtml(item.nome)}" class="w-9 h-9 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold">−</button>
                <span data-value class="w-10 text-center font-mono text-lg tabular-nums">${valor}</span>
                <button type="button" data-action="inc" aria-label="Aumentar ${escapeHtml(item.nome)}" class="w-9 h-9 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold">+</button>
                ${item.passoRapido ? `<button type="button" data-action="quick" data-amount="${item.passoRapido}" class="px-2 py-1.5 rounded border border-brand-300 dark:border-accent-700 text-brand-700 dark:text-accent-400 text-xs font-semibold hover:bg-brand-50 dark:hover:bg-gray-700">+${item.passoRapido}</button>` : ''}
                ${item.passoLitro ? `<button type="button" data-action="quick" data-amount="${item.passoLitro}" class="px-2 py-1.5 rounded border border-brand-300 dark:border-accent-700 text-brand-700 dark:text-accent-400 text-xs font-semibold hover:bg-brand-50 dark:hover:bg-gray-700">+1L</button>` : ''}
            </div>
        </div>`;
    }

    function renderContadorInverso(cat, item, dateKey) {
        const valor = window.LogZenData.getItemValue(dateKey, cat.id, item.id, 0);
        const streak = window.LogZenData.streakZerado(cat.id, item.id, dateKey);
        return `
        <div data-row data-cat="${cat.id}" data-item="${item.id}" data-tipo="contador-inverso" data-nome="${escapeHtml(item.nome)}" class="rounded-lg border p-3 my-2 transition-colors ${corVicio(valor)}">
            <div class="flex items-center justify-between gap-3">
                <span class="font-medium">${escapeHtml(item.nome)}<span class="block text-xs font-normal opacity-75">${escapeHtml(item.unidade || '')}</span></span>
                <div class="flex items-center gap-2 shrink-0">
                    <button type="button" data-action="dec" aria-label="Diminuir ${escapeHtml(item.nome)}" class="w-9 h-9 rounded-full border border-current/40 hover:bg-black/5 dark:hover:bg-white/10 font-bold">−</button>
                    <span data-value class="w-10 text-center font-mono text-lg tabular-nums">${valor}</span>
                    <button type="button" data-action="inc" aria-label="Aumentar ${escapeHtml(item.nome)}" class="w-9 h-9 rounded-full border border-current/40 hover:bg-black/5 dark:hover:bg-white/10 font-bold">+</button>
                </div>
            </div>
            <p data-streak class="text-xs mt-2 flex items-center gap-1"><i aria-hidden="true" class="fa-solid fa-fire"></i> ${streak} dia(s) sem "${escapeHtml(item.nome)}"</p>
        </div>`;
    }

    function renderCheckbox(cat, item, dateKey) {
        const marcado = !!window.LogZenData.getItemValue(dateKey, cat.id, item.id, false);
        return `
        <label class="flex items-center justify-between gap-3 py-3 cursor-pointer" data-row data-cat="${cat.id}" data-item="${item.id}" data-tipo="checkbox">
            <span class="font-medium">${escapeHtml(item.nome)}</span>
            <input type="checkbox" data-action="checkbox" class="w-5 h-5 accent-brand-600 dark:accent-accent-500" ${marcado ? 'checked' : ''} aria-label="${escapeHtml(item.nome)}">
        </label>`;
    }

    function renderEscala(cat, item, dateKey) {
        const valor = window.LogZenData.getItemValue(dateKey, cat.id, item.id, 0);
        const estrelas = Array.from({ length: item.max || 5 }, (_, i) => i + 1).map((n) => `
            <button type="button" data-action="star" data-n="${n}" aria-pressed="${n <= valor}" aria-label="${n} de ${item.max || 5}"
                class="text-2xl leading-none ${n <= valor ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}">
                <i aria-hidden="true" class="fa-solid fa-star"></i>
            </button>`).join('');
        return `
        <div class="py-3" data-row data-cat="${cat.id}" data-item="${item.id}" data-tipo="escala">
            <p class="font-medium mb-1">${escapeHtml(item.nome)}</p>
            <div class="flex gap-1" role="radiogroup" aria-label="${escapeHtml(item.nome)}">${estrelas}</div>
        </div>`;
    }

    function renderTags(cat, item, dateKey) {
        const selecionadas = window.LogZenData.getItemValue(dateKey, cat.id, item.id, []);
        const pills = (item.opcoes || []).map((tag) => {
            const ativo = selecionadas.includes(tag);
            return `<button type="button" data-action="tag" data-tag="${escapeHtml(tag)}" aria-pressed="${ativo}"
                class="px-3 py-1 rounded-full border text-sm ${ativo ? 'bg-brand-600 dark:bg-accent-600 text-white border-brand-600 dark:border-accent-600' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}">${escapeHtml(tag)}</button>`;
        }).join('');
        return `
        <div class="py-3" data-row data-cat="${cat.id}" data-item="${item.id}" data-tipo="tags">
            <p class="font-medium mb-2">${escapeHtml(item.nome)}</p>
            <div class="flex flex-wrap gap-2">${pills}</div>
        </div>`;
    }

    const RENDERERS = {
        'contador': renderContador,
        'contador-inverso': renderContadorInverso,
        'checkbox': renderCheckbox,
        'escala': renderEscala,
        'tags': renderTags,
    };

    function renderCategoria(cat, dateKey, aberta) {
        const itensHtml = cat.itens.map((item) => (RENDERERS[item.tipo] || (() => ''))(cat, item, dateKey)).join('');
        return `
        <details class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" ${aberta ? 'open' : ''}>
            <summary class="cursor-pointer select-none flex flex-wrap items-center gap-2 px-4 py-3 bg-brand-50 dark:bg-gray-800 font-semibold">
                <i aria-hidden="true" class="fa-solid ${cat.icone} text-brand-600 dark:text-accent-400"></i>
                ${escapeHtml(cat.nome)}
                <span class="text-xs font-normal text-gray-500 dark:text-gray-400">${escapeHtml(cat.descricao)}</span>
            </summary>
            <div class="px-4 divide-y divide-gray-100 dark:divide-gray-700">${itensHtml}</div>
        </details>`;
    }

    function render(root, dateKey) {
        root.innerHTML = window.LOGZEN_CATEGORIES.map((cat, i) => renderCategoria(cat, dateKey, i === 0)).join('');
    }

    function formatarDataExtenso(dateKey) {
        const d = new Date(dateKey + 'T00:00:00');
        return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    }

    function wire(root, dateKey) {
        root.addEventListener('click', (e) => {
            const row = e.target.closest('[data-row]');
            if (!row) return;
            const { cat, item, tipo } = row.dataset;
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;

            if (tipo === 'contador' || tipo === 'contador-inverso') {
                let valor = window.LogZenData.getItemValue(dateKey, cat, item, 0);
                if (action === 'inc') valor += 1;
                else if (action === 'dec') valor = Math.max(0, valor - 1);
                else if (action === 'quick') valor += parseInt(btn.dataset.amount, 10) || 0;
                else return;
                window.LogZenData.setItemValue(dateKey, cat, item, valor);
                row.querySelector('[data-value]').textContent = valor;
                if (tipo === 'contador-inverso') {
                    row.className = row.className.replace(/bg-\S+|dark:bg-\S+|border-\S+|dark:border-\S+|text-\S+|dark:text-\S+/g, '').trim();
                    row.classList.add('rounded-lg', 'border', 'p-3', 'my-2', 'transition-colors', ...corVicio(valor).split(' '));
                    row.querySelector('[data-streak]').textContent =
                        `${window.LogZenData.streakZerado(cat, item, dateKey)} dia(s) sem "${row.dataset.nome}"`;
                }
                return;
            }

            if (tipo === 'escala' && action === 'star') {
                const n = parseInt(btn.dataset.n, 10);
                const atual = window.LogZenData.getItemValue(dateKey, cat, item, 0);
                const novo = atual === n ? 0 : n; // clicar na mesma estrela zera (permite desfazer)
                window.LogZenData.setItemValue(dateKey, cat, item, novo);
                row.querySelectorAll('button[data-action="star"]').forEach((b) => {
                    const bn = parseInt(b.dataset.n, 10);
                    const ativo = bn <= novo;
                    b.setAttribute('aria-pressed', ativo);
                    b.classList.toggle('text-amber-400', ativo);
                    b.classList.toggle('text-gray-300', !ativo);
                    b.classList.toggle('dark:text-gray-600', !ativo);
                });
                return;
            }

            if (tipo === 'tags' && action === 'tag') {
                const ativo = window.LogZenData.toggleTag(dateKey, cat, item, btn.dataset.tag);
                btn.setAttribute('aria-pressed', ativo);
                btn.classList.toggle('bg-brand-600', ativo);
                btn.classList.toggle('dark:bg-accent-600', ativo);
                btn.classList.toggle('text-white', ativo);
                btn.classList.toggle('border-brand-600', ativo);
                btn.classList.toggle('dark:border-accent-600', ativo);
                return;
            }
        });

        root.addEventListener('change', (e) => {
            const row = e.target.closest('[data-row][data-tipo="checkbox"]');
            if (!row || e.target.dataset.action !== 'checkbox') return;
            window.LogZenData.setItemValue(dateKey, row.dataset.cat, row.dataset.item, e.target.checked);
        });
    }

    function wireExportImport(dateKey) {
        const btnExport = $('#logzenExportBtn');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                const blob = new Blob([window.LogZenData.exportJSON()], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `logzen-dados-${dateKey}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            });
        }
        const inputImport = $('#logzenImportInput');
        if (inputImport) {
            inputImport.addEventListener('change', () => {
                const file = inputImport.files && inputImport.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        window.LogZenData.importJSON(String(reader.result));
                        window.location.reload();
                    } catch (e) {
                        window.alert('Arquivo inválido. Selecione um JSON exportado pelo LogZen.');
                    }
                };
                reader.readAsText(file);
            });
        }
    }

    function init() {
        const root = $('#hojeRoot');
        if (!root) return;
        const dateKey = window.LogZenData.todayKey();
        const dataLabel = $('#hojeDataLabel');
        if (dataLabel) dataLabel.textContent = formatarDataExtenso(dateKey);
        render(root, dateKey);
        wire(root, dateKey);
        wireExportImport(dateKey);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

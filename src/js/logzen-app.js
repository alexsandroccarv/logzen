/* ==========================================================================
   LogZen — Tela "Hoje": renderiza o catálogo (logzen-catalog.js: itens
   padrão + customizados, issue #2) a partir dos dados salvos
   (logzen-data.js) e liga os inputs (contador, contador-inverso, checkbox,
   escala, tags), o formulário de novo item por categoria e a nota do dia,
   via delegação de eventos.
   ========================================================================== */
(function () {
    const $ = (sel, ctx) => (ctx || document).querySelector(sel);

    const CORES_VICIO = [
        'bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300',
        'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300',
        'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300',
    ];
    const corVicio = (v) => CORES_VICIO[v <= 0 ? 0 : (v <= 2 ? 1 : 2)];

    // Dia atualmente exibido na tela "Hoje" — mutável para permitir "passear"
    // pelos registros com as setas (issue #5), sem duplicar a lógica de
    // renderização/eventos por data.
    let dataAtual = window.LogZenData.todayKey();
    let rootEl = null;

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function debounce(fn, wait) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
    }

    // Botão de remover (só para itens customizados — issue #2). Os itens do
    // catálogo padrão (logzen-items.js) não podem ser removidos por aqui.
    function trashBtn(item) {
        if (!item.custom) return '';
        return `<button type="button" data-action="remove-item" aria-label="Remover ${escapeHtml(item.nome)}"
            class="w-7 h-7 shrink-0 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center">
            <i aria-hidden="true" class="fa-solid fa-trash text-xs"></i>
        </button>`;
    }

    // Nota curta por item, fechada por padrão — issue #3. O ícone de lápis
    // muda de cor quando já existe uma nota salva, mesmo com a caixa fechada.
    function notaBtn(item, temNota) {
        return `<button type="button" data-action="toggle-nota" aria-expanded="false" aria-label="Nota sobre ${escapeHtml(item.nome)}"
            class="w-7 h-7 shrink-0 rounded flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 ${temNota ? 'text-brand-600 dark:text-accent-400' : 'text-gray-400'}">
            <i aria-hidden="true" class="fa-solid fa-pen text-xs"></i>
        </button>`;
    }

    function notaBox(cat, item, dateKey) {
        const nota = window.LogZenData.getItemNota(dateKey, cat.id, item.id);
        return `<div data-nota-wrap hidden class="pt-2">
            <textarea data-item-nota rows="2" maxlength="300" placeholder="Nota sobre ${escapeHtml(item.nome)} (opcional)"
                class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">${escapeHtml(nota)}</textarea>
        </div>`;
    }

    function renderContador(cat, item, dateKey) {
        const valor = window.LogZenData.getItemValue(dateKey, cat.id, item.id, 0);
        const temNota = !!window.LogZenData.getItemNota(dateKey, cat.id, item.id);
        return `
        <div class="py-3" data-row data-cat="${cat.id}" data-item="${item.id}" data-tipo="contador" data-nome="${escapeHtml(item.nome)}">
            <div class="flex items-center justify-between gap-3">
                <span class="font-medium">${escapeHtml(item.nome)}<span class="block text-xs font-normal text-gray-500 dark:text-gray-400">${escapeHtml(item.unidade || '')}</span></span>
                <div class="flex items-center gap-2 shrink-0">
                    <button type="button" data-action="dec" aria-label="Diminuir ${escapeHtml(item.nome)}" class="w-9 h-9 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold">−</button>
                    <span data-value class="w-10 text-center font-mono text-lg tabular-nums">${valor}</span>
                    <button type="button" data-action="inc" aria-label="Aumentar ${escapeHtml(item.nome)}" class="w-9 h-9 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold">+</button>
                    ${item.passoRapido ? `<button type="button" data-action="quick" data-amount="${item.passoRapido}" class="px-2 py-1.5 rounded border border-brand-300 dark:border-accent-700 text-brand-700 dark:text-accent-400 text-xs font-semibold hover:bg-brand-50 dark:hover:bg-gray-700">+${item.passoRapido}</button>` : ''}
                    ${item.passoLitro ? `<button type="button" data-action="quick" data-amount="${item.passoLitro}" class="px-2 py-1.5 rounded border border-brand-300 dark:border-accent-700 text-brand-700 dark:text-accent-400 text-xs font-semibold hover:bg-brand-50 dark:hover:bg-gray-700">+1L</button>` : ''}
                    ${notaBtn(item, temNota)}
                    ${trashBtn(item)}
                </div>
            </div>
            ${notaBox(cat, item, dateKey)}
        </div>`;
    }

    function renderContadorInverso(cat, item, dateKey) {
        const valor = window.LogZenData.getItemValue(dateKey, cat.id, item.id, 0);
        const streak = window.LogZenData.streakZerado(cat.id, item.id, dateKey);
        const temNota = !!window.LogZenData.getItemNota(dateKey, cat.id, item.id);
        return `
        <div data-row data-cat="${cat.id}" data-item="${item.id}" data-tipo="contador-inverso" data-nome="${escapeHtml(item.nome)}" class="rounded-lg border p-3 my-2 transition-colors ${corVicio(valor)}">
            <div class="flex items-center justify-between gap-3">
                <span class="font-medium">${escapeHtml(item.nome)}<span class="block text-xs font-normal opacity-75">${escapeHtml(item.unidade || '')}</span></span>
                <div class="flex items-center gap-2 shrink-0">
                    <button type="button" data-action="dec" aria-label="Diminuir ${escapeHtml(item.nome)}" class="w-9 h-9 rounded-full border border-current/40 hover:bg-black/5 dark:hover:bg-white/10 font-bold">−</button>
                    <span data-value class="w-10 text-center font-mono text-lg tabular-nums">${valor}</span>
                    <button type="button" data-action="inc" aria-label="Aumentar ${escapeHtml(item.nome)}" class="w-9 h-9 rounded-full border border-current/40 hover:bg-black/5 dark:hover:bg-white/10 font-bold">+</button>
                    ${notaBtn(item, temNota)}
                    ${trashBtn(item)}
                </div>
            </div>
            <p data-streak class="text-xs mt-2 flex items-center gap-1"><i aria-hidden="true" class="fa-solid fa-fire"></i> ${streak} dia(s) sem "${escapeHtml(item.nome)}"</p>
            ${notaBox(cat, item, dateKey)}
        </div>`;
    }

    function renderCheckbox(cat, item, dateKey) {
        const marcado = !!window.LogZenData.getItemValue(dateKey, cat.id, item.id, false);
        const temNota = !!window.LogZenData.getItemNota(dateKey, cat.id, item.id);
        return `
        <div class="py-3" data-row data-cat="${cat.id}" data-item="${item.id}" data-tipo="checkbox" data-nome="${escapeHtml(item.nome)}">
            <div class="flex items-center justify-between gap-3">
                <label class="flex items-center gap-3 flex-1 cursor-pointer">
                    <input type="checkbox" data-action="checkbox" class="w-5 h-5 accent-brand-600 dark:accent-accent-500" ${marcado ? 'checked' : ''} aria-label="${escapeHtml(item.nome)}">
                    <span class="font-medium">${escapeHtml(item.nome)}</span>
                </label>
                <div class="flex items-center gap-2 shrink-0">
                    ${notaBtn(item, temNota)}
                    ${trashBtn(item)}
                </div>
            </div>
            ${notaBox(cat, item, dateKey)}
        </div>`;
    }

    function renderEscala(cat, item, dateKey) {
        const valor = window.LogZenData.getItemValue(dateKey, cat.id, item.id, 0);
        const temNota = !!window.LogZenData.getItemNota(dateKey, cat.id, item.id);
        const estrelas = Array.from({ length: item.max || 5 }, (_, i) => i + 1).map((n) => `
            <button type="button" data-action="star" data-n="${n}" aria-pressed="${n <= valor}" aria-label="${n} de ${item.max || 5}"
                class="text-2xl leading-none ${n <= valor ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}">
                <i aria-hidden="true" class="fa-solid fa-star"></i>
            </button>`).join('');
        return `
        <div class="py-3" data-row data-cat="${cat.id}" data-item="${item.id}" data-tipo="escala" data-nome="${escapeHtml(item.nome)}">
            <div class="flex items-center justify-between gap-3 mb-1">
                <p class="font-medium m-0">${escapeHtml(item.nome)}</p>
                <div class="flex items-center gap-2 shrink-0">
                    ${notaBtn(item, temNota)}
                    ${trashBtn(item)}
                </div>
            </div>
            <div class="flex gap-1" role="radiogroup" aria-label="${escapeHtml(item.nome)}">${estrelas}</div>
            ${notaBox(cat, item, dateKey)}
        </div>`;
    }

    function renderTags(cat, item, dateKey) {
        const selecionadas = window.LogZenData.getItemValue(dateKey, cat.id, item.id, []);
        const temNota = !!window.LogZenData.getItemNota(dateKey, cat.id, item.id);
        const pills = (item.opcoes || []).map((tag) => {
            const ativo = selecionadas.includes(tag);
            return `<button type="button" data-action="tag" data-tag="${escapeHtml(tag)}" aria-pressed="${ativo}"
                class="px-3 py-1 rounded-full border text-sm ${ativo ? 'bg-brand-600 dark:bg-accent-600 text-white border-brand-600 dark:border-accent-600' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}">${escapeHtml(tag)}</button>`;
        }).join('');
        return `
        <div class="py-3" data-row data-cat="${cat.id}" data-item="${item.id}" data-tipo="tags" data-nome="${escapeHtml(item.nome)}">
            <div class="flex items-center justify-between gap-3 mb-2">
                <p class="font-medium m-0">${escapeHtml(item.nome)}</p>
                <div class="flex items-center gap-2 shrink-0">
                    ${notaBtn(item, temNota)}
                    ${trashBtn(item)}
                </div>
            </div>
            <div class="flex flex-wrap gap-2">${pills}</div>
            ${notaBox(cat, item, dateKey)}
        </div>`;
    }

    const RENDERERS = {
        'contador': renderContador,
        'contador-inverso': renderContadorInverso,
        'checkbox': renderCheckbox,
        'escala': renderEscala,
        'tags': renderTags,
    };

    const TIPOS_LABEL = {
        'contador': 'Contador (quanto mais, melhor)',
        'contador-inverso': 'Contador invertido (quanto menos, melhor)',
        'checkbox': 'Sim/Não',
        'escala': 'Escala de 1 a 5 estrelas',
        'tags': 'Tags (múltipla escolha)',
    };

    function renderFormularioNovoItem(cat) {
        const opcoesTipo = Object.entries(TIPOS_LABEL)
            .map(([valor, label]) => `<option value="${valor}">${escapeHtml(label)}</option>`).join('');
        return `
        <div class="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700">
            <button type="button" data-action="toggle-add-form" class="text-sm font-medium text-brand-700 dark:text-accent-400 hover:underline flex items-center gap-1 py-1">
                <i aria-hidden="true" class="fa-solid fa-plus"></i> Adicionar item
            </button>
            <form data-add-item-form data-cat="${cat.id}" hidden class="space-y-2 pt-2">
                <div>
                    <label class="block text-xs font-medium mb-1">Nome</label>
                    <input type="text" data-field="nome" required maxlength="60" placeholder="ex.: Corrida"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Tipo de input</label>
                    <select data-field="tipo" class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                        ${opcoesTipo}
                    </select>
                </div>
                <div data-field-group="unidade">
                    <label class="block text-xs font-medium mb-1">Unidade (opcional)</label>
                    <input type="text" data-field="unidade" maxlength="30" placeholder="ex.: reps, km, copos"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
                <div data-field-group="opcoes" hidden>
                    <label class="block text-xs font-medium mb-1">Opções (separadas por vírgula)</label>
                    <input type="text" data-field="opcoes" placeholder="ex.: Ansiedade, Foco alto"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
                <div class="flex items-center gap-2 pt-1">
                    <button type="submit" class="px-3 py-1.5 rounded bg-brand-600 dark:bg-accent-600 text-white text-sm font-semibold hover:bg-brand-700">Adicionar</button>
                    <button type="button" data-action="cancel-add-form" class="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Cancelar</button>
                </div>
            </form>
        </div>`;
    }

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
            ${renderFormularioNovoItem(cat)}
        </details>`;
    }

    function renderNota(dateKey) {
        const valor = window.LogZenData.getNota(dateKey);
        return `
        <details class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" ${valor ? 'open' : ''}>
            <summary class="cursor-pointer select-none flex flex-wrap items-center gap-2 px-4 py-3 bg-brand-50 dark:bg-gray-800 font-semibold">
                <i aria-hidden="true" class="fa-solid fa-note-sticky text-brand-600 dark:text-accent-400"></i>
                Nota do dia
                <span class="text-xs font-normal text-gray-500 dark:text-gray-400">Observação livre, opcional.</span>
            </summary>
            <div class="p-4">
                <textarea data-nota rows="3" maxlength="500" placeholder="Como foi o dia?"
                    class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">${escapeHtml(valor)}</textarea>
            </div>
        </details>`;
    }

    function render(root, dateKey) {
        const categorias = window.LogZenCatalog.getCategorias();
        root.innerHTML = renderNota(dateKey) + categorias.map((cat, i) => renderCategoria(cat, dateKey, i === 0)).join('');
    }

    // Recria o HTML (após adicionar/remover item) preservando quais blocos
    // (nota + categorias, sempre nesta ordem) estavam abertos/fechados.
    function reRenderPreservingState(root) {
        const abertos = Array.from(root.querySelectorAll(':scope > details')).map((d) => d.open);
        render(root, dataAtual);
        Array.from(root.querySelectorAll(':scope > details')).forEach((d, i) => {
            if (abertos[i] !== undefined) d.open = abertos[i];
        });
    }

    function formatarDataExtenso(dateKey) {
        const d = new Date(dateKey + 'T00:00:00');
        const texto = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
        return dateKey === window.LogZenData.todayKey() ? `Hoje — ${texto}` : texto;
    }

    // Move `dataAtual` `delta` dias (não deixa passar de hoje) e re-renderiza.
    function irParaDia(delta) {
        const d = new Date(dataAtual + 'T00:00:00');
        d.setDate(d.getDate() + delta);
        const novaChave = window.LogZenData.todayKey(d);
        if (novaChave > window.LogZenData.todayKey()) return;
        dataAtual = novaChave;
        atualizarCabecalho();
        render(rootEl, dataAtual);
    }

    function irParaHoje() {
        dataAtual = window.LogZenData.todayKey();
        atualizarCabecalho();
        render(rootEl, dataAtual);
    }

    function atualizarCabecalho() {
        const dataLabel = $('#hojeDataLabel');
        if (dataLabel) dataLabel.textContent = formatarDataExtenso(dataAtual);
        const hoje = window.LogZenData.todayKey();
        const btnProximo = $('#hojeDiaProximo');
        if (btnProximo) btnProximo.disabled = dataAtual >= hoje;
        const btnVoltar = $('#hojeVoltarHoje');
        if (btnVoltar) btnVoltar.hidden = dataAtual === hoje;
    }

    // Mostra só o campo relevante ao tipo escolhido no formulário de novo item.
    function syncFieldGroups(form) {
        const tipo = form.querySelector('[data-field="tipo"]').value;
        const unidadeGroup = form.querySelector('[data-field-group="unidade"]');
        const opcoesGroup = form.querySelector('[data-field-group="opcoes"]');
        if (unidadeGroup) unidadeGroup.hidden = !(tipo === 'contador' || tipo === 'contador-inverso');
        if (opcoesGroup) opcoesGroup.hidden = tipo !== 'tags';
    }

    const salvarNotaDebounced = debounce((dateKey, valor) => window.LogZenData.setNota(dateKey, valor), 400);

    // Debounce por textarea (cada item tem a sua, independente das demais).
    const timersNotaItem = new WeakMap();
    function salvarNotaItemDebounced(el, dateKey, cat, item) {
        clearTimeout(timersNotaItem.get(el));
        timersNotaItem.set(el, setTimeout(() => {
            const texto = el.value.trim();
            window.LogZenData.setItemNota(dateKey, cat, item, texto);
            const row = el.closest('[data-row]');
            const btn = row && row.querySelector('[data-action="toggle-nota"]');
            if (btn) {
                btn.classList.toggle('text-brand-600', !!texto);
                btn.classList.toggle('dark:text-accent-400', !!texto);
                btn.classList.toggle('text-gray-400', !texto);
            }
        }, 400));
    }

    function wire(root) {
        root.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('[data-action="toggle-add-form"]');
            if (toggleBtn) {
                const form = toggleBtn.nextElementSibling;
                form.hidden = !form.hidden;
                if (!form.hidden) {
                    syncFieldGroups(form);
                    form.querySelector('[data-field="nome"]').focus();
                }
                return;
            }

            const cancelBtn = e.target.closest('[data-action="cancel-add-form"]');
            if (cancelBtn) {
                const form = cancelBtn.closest('form[data-add-item-form]');
                form.reset();
                syncFieldGroups(form);
                form.hidden = true;
                return;
            }

            const notaToggle = e.target.closest('[data-action="toggle-nota"]');
            if (notaToggle) {
                const row = notaToggle.closest('[data-row]');
                const wrap = row.querySelector('[data-nota-wrap]');
                wrap.hidden = !wrap.hidden;
                notaToggle.setAttribute('aria-expanded', String(!wrap.hidden));
                if (!wrap.hidden) wrap.querySelector('textarea').focus();
                return;
            }

            const removeBtn = e.target.closest('[data-action="remove-item"]');
            if (removeBtn) {
                const row = removeBtn.closest('[data-row]');
                if (!row) return;
                const nome = row.dataset.nome || '';
                if (!window.confirm(`Remover "${nome}"? Os registros já salvos para este item continuam guardados, só ele deixa de aparecer na tela.`)) return;
                window.LogZenCatalog.removeCustomItem(row.dataset.cat, row.dataset.item);
                reRenderPreservingState(root);
                return;
            }

            const row = e.target.closest('[data-row]');
            if (!row) return;
            const { cat, item, tipo } = row.dataset;
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;

            if (tipo === 'contador' || tipo === 'contador-inverso') {
                let valor = window.LogZenData.getItemValue(dataAtual, cat, item, 0);
                if (action === 'inc') valor += 1;
                else if (action === 'dec') valor = Math.max(0, valor - 1);
                else if (action === 'quick') valor += parseInt(btn.dataset.amount, 10) || 0;
                else return;
                window.LogZenData.setItemValue(dataAtual, cat, item, valor);
                row.querySelector('[data-value]').textContent = valor;
                if (tipo === 'contador-inverso') {
                    row.className = row.className.replace(/bg-\S+|dark:bg-\S+|border-\S+|dark:border-\S+|text-\S+|dark:text-\S+/g, '').trim();
                    row.classList.add('rounded-lg', 'border', 'p-3', 'my-2', 'transition-colors', ...corVicio(valor).split(' '));
                    row.querySelector('[data-streak]').textContent =
                        `${window.LogZenData.streakZerado(cat, item, dataAtual)} dia(s) sem "${row.dataset.nome}"`;
                }
                return;
            }

            if (tipo === 'escala' && action === 'star') {
                const n = parseInt(btn.dataset.n, 10);
                const atual = window.LogZenData.getItemValue(dataAtual, cat, item, 0);
                const novo = atual === n ? 0 : n; // clicar na mesma estrela zera (permite desfazer)
                window.LogZenData.setItemValue(dataAtual, cat, item, novo);
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
                const ativo = window.LogZenData.toggleTag(dataAtual, cat, item, btn.dataset.tag);
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
            if (e.target.matches('[data-field="tipo"]')) {
                syncFieldGroups(e.target.closest('form[data-add-item-form]'));
                return;
            }
            const row = e.target.closest('[data-row][data-tipo="checkbox"]');
            if (row && e.target.dataset.action === 'checkbox') {
                window.LogZenData.setItemValue(dataAtual, row.dataset.cat, row.dataset.item, e.target.checked);
            }
        });

        root.addEventListener('input', (e) => {
            if (e.target.matches('[data-nota]')) {
                salvarNotaDebounced(dataAtual, e.target.value);
                return;
            }
            if (e.target.matches('[data-item-nota]')) {
                const row = e.target.closest('[data-row]');
                if (!row) return;
                salvarNotaItemDebounced(e.target, dataAtual, row.dataset.cat, row.dataset.item);
            }
        });

        root.addEventListener('submit', (e) => {
            const form = e.target.closest('form[data-add-item-form]');
            if (!form) return;
            e.preventDefault();
            const nome = form.querySelector('[data-field="nome"]').value.trim();
            if (!nome) return;
            const tipo = form.querySelector('[data-field="tipo"]').value;
            const dados = { nome, tipo };
            if (tipo === 'contador' || tipo === 'contador-inverso') {
                const unidade = form.querySelector('[data-field="unidade"]').value.trim();
                if (unidade) dados.unidade = unidade;
            }
            if (tipo === 'tags') {
                dados.opcoes = form.querySelector('[data-field="opcoes"]').value.split(',').map((s) => s.trim()).filter(Boolean);
                if (dados.opcoes.length === 0) {
                    window.alert('Informe ao menos uma opção de tag, separadas por vírgula.');
                    return;
                }
            }
            window.LogZenCatalog.addCustomItem(form.dataset.cat, dados);
            reRenderPreservingState(root);
        });
    }

    function wireExportImport() {
        const btnExport = $('#logzenExportBtn');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                const blob = new Blob([window.LogZenData.exportJSON()], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `logzen-dados-${window.LogZenData.todayKey()}.json`;
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
        rootEl = $('#hojeRoot');
        if (!rootEl) return;
        atualizarCabecalho();
        render(rootEl, dataAtual);
        wire(rootEl);
        wireExportImport();

        const btnAnterior = $('#hojeDiaAnterior');
        if (btnAnterior) btnAnterior.addEventListener('click', () => irParaDia(-1));
        const btnProximo = $('#hojeDiaProximo');
        if (btnProximo) btnProximo.addEventListener('click', () => irParaDia(1));
        const btnVoltar = $('#hojeVoltarHoje');
        if (btnVoltar) btnVoltar.addEventListener('click', irParaHoje);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

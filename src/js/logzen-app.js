/* ==========================================================================
   LogZen — Tela "Hoje": renderiza o catálogo (logzen-catalog.js: itens
   padrão + customizados, issue #2) a partir dos dados salvos
   (logzen-data.js) e liga os inputs (contador, contador-inverso, checkbox,
   escala, tags), o formulário de novo item por categoria e a nota do dia,
   via delegação de eventos.

   Identidade "Sereno" (issue #33): paleta sálvia/argila/anil em vez do
   semáforo vermelho/amarelo/verde, tipografia mais leve (Fraunces nos
   títulos, Karla no resto), categorias como cartões suaves — recolhidas
   por padrão (só a 1ª aberta), em colunas no computador (largura ≥ lg).
   "Objetivos do dia" e "Metas" ficam em destaque no topo (o primeiro à
   esquerda, as metas empilhadas à direita); "Como foi meu dia" fecha a
   tela. Metas (valor-alvo + prazo, só para contador/contador-inverso) são
   definidas/editadas em Itens rastreados — a tela "Hoje" só mostra o
   progresso.
   ========================================================================== */
(function () {
    const $ = (sel, ctx) => (ctx || document).querySelector(sel);

    // Cor por intensidade, não por alarme: 0 hoje = calmo (sálvia), 1-2 =
    // atenção leve (argila), 3+ = atenção mais forte — ainda argila, sem
    // recorrer ao vermelho.
    const CORES_VICIO = [
        'bg-sage-50 dark:bg-sage-900/40 text-sage-800 dark:text-sage-300',
        'bg-clay-50 dark:bg-clay-900/40 text-clay-700 dark:text-clay-300',
        'bg-clay-100 dark:bg-clay-900/60 text-clay-900 dark:text-clay-200',
    ];
    const corVicio = (v) => CORES_VICIO[v <= 0 ? 0 : (v <= 2 ? 1 : 2)];

    // Progresso de uma meta (issue #33): "contador" mira o maior valor já
    // registrado (bater um recorde); "contador-inverso" mira dias seguidos
    // sem o hábito (reaproveita o streak que já existia). Sem meta, ou tipo
    // sem suporte, retorna null (nada a mostrar).
    function progressoMeta(cat, item, dateKey) {
        if (!item.meta) return null;
        const atual = item.tipo === 'contador-inverso'
            ? window.LogZenData.streakZerado(cat.id, item.id, dateKey)
            : item.tipo === 'contador'
                ? window.LogZenData.getMelhorValor(cat.id, item.id)
                : null;
        if (atual === null) return null;
        const alvo = item.meta.valor;
        return { atual, alvo, bateu: atual >= alvo, prazo: item.meta.prazo || '' };
    }

    function formatarPrazo(prazo) {
        if (!prazo) return '';
        return new Date(prazo + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
    }

    // Linha discreta sob um item com meta ativa (contador/contador-inverso).
    // Só exibe o progresso — editar acontece em Itens rastreados.
    function metaStatusHtml(cat, item, dateKey) {
        const p = progressoMeta(cat, item, dateKey);
        if (!p) return '';
        const unidade = item.tipo === 'contador-inverso' ? ' dias seguidos' : '';
        const texto = p.bateu
            ? `Meta batida: ${p.alvo}${unidade}`
            : `Meta: ${p.atual} de ${p.alvo}${unidade}${p.prazo ? ` · até ${formatarPrazo(p.prazo)}` : ''}`;
        return `<p data-meta-status class="text-xs ${p.bateu ? 'text-sage-700 dark:text-sage-400' : 'text-anil-600 dark:text-anil-400'} flex items-center gap-1.5 mt-1.5">
            <i aria-hidden="true" class="fa-solid ${p.bateu ? 'fa-circle-check' : 'fa-bullseye'} text-[10px]"></i>${escapeHtml(texto)}
        </p>`;
    }

    // Depois de um clique em +/−/passo-rápido (que só atualiza o número e a
    // cor no lugar, sem recriar o HTML da categoria inteira — issue #33
    // exige manter esse desempenho), o progresso da meta (texto na própria
    // linha do item + card na coluna "Metas") ficaria desatualizado se não
    // for atualizado à parte aqui.
    function atualizarMetaUI(root, dateKey, catId, itemId, row) {
        const cat = window.LogZenCatalog.getCategorias().find((c) => c.id === catId);
        const item = cat && cat.itens.find((i) => i.id === itemId);
        if (!item || !item.meta) return;
        const metaP = row.querySelector('[data-meta-status]');
        const novoHtml = metaStatusHtml(cat, item, dateKey);
        if (metaP && novoHtml) metaP.outerHTML = novoHtml;
        const metasCol = root.querySelector('[data-metas-col]');
        if (metasCol) metasCol.innerHTML = renderMetas(dateKey);
    }

    // Dia atualmente exibido na tela "Hoje" — mutável para permitir "passear"
    // pelos registros com as setas (issue #5), sem duplicar a lógica de
    // renderização/eventos por data.
    let dataAtual = window.LogZenData.todayKey();
    let rootEl = null;
    let itensConfigRootEl = null;

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function debounce(fn, wait) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
    }

    // Nota curta por item, fechada por padrão — issue #3. O ícone de lápis
    // muda de cor quando já existe uma nota salva, mesmo com a caixa fechada.
    function notaBtn(item, temNota) {
        return `<button type="button" data-action="toggle-nota" aria-expanded="false" aria-label="Nota sobre ${escapeHtml(item.nome)}"
            class="w-7 h-7 shrink-0 rounded-full flex items-center justify-center hover:bg-paper-100 dark:hover:bg-paper-700 ${temNota ? 'text-sage-600 dark:text-sage-400' : 'text-ink-300'}">
            <i aria-hidden="true" class="fa-solid fa-pen text-xs"></i>
        </button>`;
    }

    function notaBox(cat, item, dateKey) {
        const nota = window.LogZenData.getItemNota(dateKey, cat.id, item.id);
        return `<div data-nota-wrap hidden class="pt-2">
            <textarea data-item-nota rows="2" maxlength="300" placeholder="Nota sobre ${escapeHtml(item.nome)} (opcional)"
                class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">${escapeHtml(nota)}</textarea>
        </div>`;
    }

    function renderContador(cat, item, dateKey) {
        const valor = window.LogZenData.getItemValue(dateKey, cat.id, item.id, 0);
        const temNota = !!window.LogZenData.getItemNota(dateKey, cat.id, item.id);
        return `
        <div class="py-3.5" data-row data-cat="${cat.id}" data-item="${item.id}" data-tipo="contador" data-nome="${escapeHtml(item.nome)}">
            <div class="flex items-center justify-between gap-3">
                <span class="font-medium">${escapeHtml(item.nome)}<span class="block text-xs font-normal text-ink-400">${escapeHtml(item.unidade || '')}</span></span>
                <div class="flex items-center gap-2 shrink-0">
                    <div class="flex items-center gap-1 bg-paper-100 dark:bg-paper-800 rounded-full p-1">
                        <button type="button" data-action="dec" aria-label="Diminuir ${escapeHtml(item.nome)}" class="w-8 h-8 rounded-full hover:bg-white dark:hover:bg-paper-700 flex items-center justify-center">−</button>
                        <span data-value class="w-9 text-center font-medium tabular-nums">${valor}</span>
                        <button type="button" data-action="inc" aria-label="Aumentar ${escapeHtml(item.nome)}" class="w-8 h-8 rounded-full hover:bg-white dark:hover:bg-paper-700 flex items-center justify-center">+</button>
                    </div>
                    ${item.passoRapido ? `<button type="button" data-action="quick" data-amount="${item.passoRapido}" class="px-2.5 py-1.5 rounded-full text-sage-700 dark:text-sage-400 bg-sage-50 dark:bg-sage-900/40 text-xs font-semibold">+${item.passoRapido}</button>` : ''}
                    ${item.passoLitro ? `<button type="button" data-action="quick" data-amount="${item.passoLitro}" class="px-2.5 py-1.5 rounded-full text-sage-700 dark:text-sage-400 bg-sage-50 dark:bg-sage-900/40 text-xs font-semibold">+1L</button>` : ''}
                    ${notaBtn(item, temNota)}
                </div>
            </div>
            ${metaStatusHtml(cat, item, dateKey)}
            ${notaBox(cat, item, dateKey)}
        </div>`;
    }

    function renderContadorInverso(cat, item, dateKey) {
        const valor = window.LogZenData.getItemValue(dateKey, cat.id, item.id, 0);
        const streak = window.LogZenData.streakZerado(cat.id, item.id, dateKey);
        const temNota = !!window.LogZenData.getItemNota(dateKey, cat.id, item.id);
        return `
        <div data-row data-cat="${cat.id}" data-item="${item.id}" data-tipo="contador-inverso" data-nome="${escapeHtml(item.nome)}" class="rounded-2xl p-3.5 my-2 transition-colors ${corVicio(valor)}">
            <div class="flex items-center justify-between gap-3">
                <span class="font-medium">${escapeHtml(item.nome)}<span class="block text-xs font-normal opacity-75">${escapeHtml(item.unidade || '')}</span></span>
                <div class="flex items-center gap-2 shrink-0">
                    <div class="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded-full p-1">
                        <button type="button" data-action="dec" aria-label="Diminuir ${escapeHtml(item.nome)}" class="w-8 h-8 rounded-full hover:bg-white/60 dark:hover:bg-white/10 flex items-center justify-center">−</button>
                        <span data-value class="w-9 text-center font-medium tabular-nums">${valor}</span>
                        <button type="button" data-action="inc" aria-label="Aumentar ${escapeHtml(item.nome)}" class="w-8 h-8 rounded-full hover:bg-white/60 dark:hover:bg-white/10 flex items-center justify-center">+</button>
                    </div>
                    ${notaBtn(item, temNota)}
                </div>
            </div>
            <p data-streak class="text-xs mt-2 flex items-center gap-1.5"><i aria-hidden="true" class="fa-solid fa-leaf"></i> ${streak} dia(s) sem "${escapeHtml(item.nome)}"</p>
            ${metaStatusHtml(cat, item, dateKey)}
            ${notaBox(cat, item, dateKey)}
        </div>`;
    }

    function renderCheckbox(cat, item, dateKey) {
        const marcado = !!window.LogZenData.getItemValue(dateKey, cat.id, item.id, false);
        const temNota = !!window.LogZenData.getItemNota(dateKey, cat.id, item.id);
        return `
        <div class="py-3.5" data-row data-cat="${cat.id}" data-item="${item.id}" data-tipo="checkbox" data-nome="${escapeHtml(item.nome)}">
            <div class="flex items-center justify-between gap-3">
                <label class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                    <input type="checkbox" data-action="checkbox" class="w-5 h-5 rounded accent-sage-600 dark:accent-sage-400 shrink-0" ${marcado ? 'checked' : ''} aria-label="${escapeHtml(item.nome)}">
                    <span class="font-medium truncate">${escapeHtml(item.nome)}</span>
                </label>
                ${notaBtn(item, temNota)}
            </div>
            ${notaBox(cat, item, dateKey)}
        </div>`;
    }

    function renderEscala(cat, item, dateKey) {
        const valor = window.LogZenData.getItemValue(dateKey, cat.id, item.id, 0);
        const temNota = !!window.LogZenData.getItemNota(dateKey, cat.id, item.id);
        const estrelas = Array.from({ length: item.max || 5 }, (_, i) => i + 1).map((n) => `
            <button type="button" data-action="star" data-n="${n}" aria-pressed="${n <= valor}" aria-label="${n} de ${item.max || 5}"
                class="text-xl leading-none ${n <= valor ? 'text-clay-600 dark:text-clay-400' : 'text-paper-300 dark:text-paper-700'}">
                <i aria-hidden="true" class="fa-solid fa-star"></i>
            </button>`).join('');
        return `
        <div class="py-3.5" data-row data-cat="${cat.id}" data-item="${item.id}" data-tipo="escala" data-nome="${escapeHtml(item.nome)}">
            <div class="flex items-center justify-between gap-3 mb-1.5">
                <p class="font-medium m-0">${escapeHtml(item.nome)}</p>
                ${notaBtn(item, temNota)}
            </div>
            <div class="flex flex-wrap gap-1" role="radiogroup" aria-label="${escapeHtml(item.nome)}">${estrelas}</div>
            ${notaBox(cat, item, dateKey)}
        </div>`;
    }

    function renderTags(cat, item, dateKey) {
        const selecionadas = window.LogZenData.getItemValue(dateKey, cat.id, item.id, []);
        const temNota = !!window.LogZenData.getItemNota(dateKey, cat.id, item.id);
        const pills = (item.opcoes || []).map((tag) => {
            const ativo = selecionadas.includes(tag);
            return `<button type="button" data-action="tag" data-tag="${escapeHtml(tag)}" aria-pressed="${ativo}"
                class="px-3 py-1 rounded-full text-sm ${ativo ? 'bg-anil-600 text-white' : 'bg-paper-100 dark:bg-paper-800 text-ink-400 hover:text-ink-900 dark:hover:text-ink-50'}">${escapeHtml(tag)}</button>`;
        }).join('');
        return `
        <div class="py-3.5" data-row data-cat="${cat.id}" data-item="${item.id}" data-tipo="tags" data-nome="${escapeHtml(item.nome)}">
            <div class="flex items-center justify-between gap-3 mb-2">
                <p class="font-medium m-0">${escapeHtml(item.nome)}</p>
                ${notaBtn(item, temNota)}
            </div>
            <div class="flex flex-wrap gap-2">${pills}</div>
            ${notaBox(cat, item, dateKey)}
        </div>`;
    }

    // Horário (issue #23): início e fim do dia, ex. "Horário de sono". O
    // valor guardado é um objeto { inicio, fim } (strings "HH:MM"), em vez
    // do escalar único dos outros tipos — cada campo de hora edita sua
    // própria chave, sem mexer na outra.
    function renderHorario(cat, item, dateKey) {
        const valor = window.LogZenData.getItemValue(dateKey, cat.id, item.id, { inicio: '', fim: '' });
        const temNota = !!window.LogZenData.getItemNota(dateKey, cat.id, item.id);
        return `
        <div class="py-3.5" data-row data-cat="${cat.id}" data-item="${item.id}" data-tipo="horario" data-nome="${escapeHtml(item.nome)}">
            <div class="flex items-center justify-between gap-3 mb-2">
                <span class="font-medium">${escapeHtml(item.nome)}</span>
                ${notaBtn(item, temNota)}
            </div>
            <div class="flex items-center gap-3">
                <div>
                    <label class="block text-xs text-ink-400 mb-1">Início</label>
                    <input type="time" data-field="inicio" value="${escapeHtml(valor.inicio || '')}"
                        class="px-2 py-1.5 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
                </div>
                <div>
                    <label class="block text-xs text-ink-400 mb-1">Fim</label>
                    <input type="time" data-field="fim" value="${escapeHtml(valor.fim || '')}"
                        class="px-2 py-1.5 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
                </div>
            </div>
            ${notaBox(cat, item, dateKey)}
        </div>`;
    }

    const RENDERERS = {
        'contador': renderContador,
        'contador-inverso': renderContadorInverso,
        'checkbox': renderCheckbox,
        'escala': renderEscala,
        'tags': renderTags,
        'horario': renderHorario,
    };

    const TIPOS_LABEL = {
        'contador': 'Contador (quanto mais, melhor)',
        'contador-inverso': 'Contador invertido (quanto menos, melhor)',
        'checkbox': 'Sim/Não',
        'escala': 'Escala de 1 a 5 estrelas',
        'tags': 'Tags (múltipla escolha)',
        'horario': 'Horário (início e fim)',
    };

    function renderFormularioNovoItem(cat) {
        const opcoesTipo = Object.entries(TIPOS_LABEL)
            .map(([valor, label]) => `<option value="${valor}">${escapeHtml(label)}</option>`).join('');
        return `
        <div class="px-4 pb-4 pt-2 border-t border-paper-200 dark:border-paper-800">
            <button type="button" data-action="toggle-add-form" class="text-sm font-medium text-sage-700 dark:text-sage-400 hover:underline flex items-center gap-1 py-1">
                <i aria-hidden="true" class="fa-solid fa-plus"></i> Adicionar item
            </button>
            <form data-add-item-form data-cat="${cat.id}" hidden class="space-y-2 pt-2">
                <div>
                    <label class="block text-xs font-medium mb-1">Nome</label>
                    <input type="text" data-field="nome" required maxlength="60" placeholder="ex.: Corrida"
                        class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Tipo de input</label>
                    <select data-field="tipo" class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
                        ${opcoesTipo}
                    </select>
                </div>
                <div data-field-group="unidade">
                    <label class="block text-xs font-medium mb-1">Unidade (opcional)</label>
                    <input type="text" data-field="unidade" maxlength="30" placeholder="ex.: reps, km, copos"
                        class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
                </div>
                <div data-field-group="opcoes" hidden>
                    <label class="block text-xs font-medium mb-1">Opções (separadas por vírgula)</label>
                    <input type="text" data-field="opcoes" placeholder="ex.: Ansiedade, Foco alto"
                        class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
                </div>
                <div class="flex items-center gap-2 pt-1">
                    <button type="submit" class="px-3 py-1.5 rounded-xl bg-sage-600 dark:bg-sage-700 text-white text-sm font-semibold hover:bg-sage-700">Adicionar</button>
                    <button type="button" data-action="cancel-add-form" class="px-3 py-1.5 rounded-xl border border-paper-300 dark:border-paper-700 text-sm hover:bg-paper-100 dark:hover:bg-paper-800">Cancelar</button>
                </div>
            </form>
        </div>`;
    }

    // Categoria como cartão suave (issue #33) — recolhida por padrão (só a
    // 1ª aberta), com `[break-inside:avoid]` para não quebrar ao meio no
    // quadro em colunas do computador (ver render()).
    function renderCategoria(cat, dateKey, aberta) {
        const itensHtml = cat.itens.map((item) => (RENDERERS[item.tipo] || (() => ''))(cat, item, dateKey)).join('');
        return `
        <details data-cat="${cat.id}" class="rounded-2xl bg-paper-50 dark:bg-paper-700 shadow-sm [break-inside:avoid] mb-4" ${aberta ? 'open' : ''}>
            <summary class="cursor-pointer select-none flex flex-wrap items-center gap-2.5 px-4 py-3.5">
                <span class="w-6 h-6 rounded-full bg-sage-100 dark:bg-sage-800 text-sage-700 dark:text-sage-300 flex items-center justify-center shrink-0">
                    <i aria-hidden="true" class="fa-solid ${cat.icone} text-xs"></i>
                </span>
                <span class="font-display font-medium">${escapeHtml(cat.nome)}</span>
                <span class="text-xs font-normal text-ink-400">${escapeHtml(cat.descricao)}</span>
            </summary>
            <div class="px-4 divide-y divide-paper-200 dark:divide-paper-800">${itensHtml}</div>
        </details>`;
    }

    // "Como foi meu dia" (issue #33): fecha o registro do dia com o mesmo
    // destaque de "Objetivos do dia" — cartão sempre visível, não mais um
    // <details> recolhível (era fácil esquecer de abrir).
    function renderNota(dateKey) {
        const valor = window.LogZenData.getNota(dateKey);
        return `
        <div data-cat="__nota__" class="rounded-2xl bg-paper-50 dark:bg-paper-700 shadow-sm p-4 lg:p-5">
            <div class="flex flex-wrap items-baseline gap-2.5 mb-3">
                <span class="w-6 h-6 rounded-full bg-sage-100 dark:bg-sage-800 text-sage-700 dark:text-sage-300 flex items-center justify-center shrink-0">
                    <i aria-hidden="true" class="fa-solid fa-feather text-xs"></i>
                </span>
                <h3 class="font-display text-base font-medium">Como foi meu dia</h3>
                <span class="text-xs font-normal text-ink-400">Observação livre, opcional.</span>
            </div>
            <textarea data-nota rows="3" maxlength="500" placeholder="Como foi o dia?"
                class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">${escapeHtml(valor)}</textarea>
        </div>`;
    }

    // Objetivos do dia (issues #9/#12): tarefas ad-hoc, digitadas na hora —
    // não fazem parte do catálogo de hábitos, ficam só neste bloco no
    // início. Regra 1-3-5 (lista fechada, estilo Bullet Journal): a COR vem
    // da POSIÇÃO na lista, não de um campo separado de prioridade — é por
    // isso que a lista é arrastável (arrastar É como se muda a prioridade).
    // Intensidade de UMA cor por faixa (issue #33), em vez do semáforo
    // vermelho/amarelo/verde de alarme: 1ª = leve destaque em argila, 2ª–4ª
    // e 5ª–9ª = sálvia (mais forte → mais claro), 10ª em diante = neutro.
    const CORES_OBJETIVO = [
        'bg-clay-50 dark:bg-clay-900/40 border-clay-200 dark:border-clay-700',
        'bg-sage-50 dark:bg-sage-900/40 border-sage-200 dark:border-sage-700',
        'bg-sage-50/50 dark:bg-sage-900/20 border-sage-100 dark:border-sage-800',
        'bg-transparent border-paper-200 dark:border-paper-800',
    ];
    function corObjetivoPorPosicao(indice) {
        if (indice === 0) return CORES_OBJETIVO[0];
        if (indice <= 3) return CORES_OBJETIVO[1];
        if (indice <= 8) return CORES_OBJETIVO[2];
        return CORES_OBJETIVO[3];
    }

    function notaBtnObjetivo(o, temNota) {
        return notaBtn({ nome: o.texto }, temNota);
    }

    function notaBoxObjetivo(o, dateKey) {
        const nota = window.LogZenData.getObjetivoNota(dateKey, o.id);
        return `<div data-nota-wrap hidden class="pt-2">
            <textarea data-item-nota rows="2" maxlength="300" placeholder="Nota sobre este objetivo (opcional)"
                class="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">${escapeHtml(nota)}</textarea>
        </div>`;
    }

    // Um objetivo já migrado fica congelado no dia de origem — só um
    // registro histórico, sem checkbox/remover/arrastar.
    function renderObjetivoMigrado(o) {
        return `
        <li data-objetivo-item data-id="${o.id}" class="flex items-center gap-2 px-2 py-2 rounded-xl border border-paper-200 dark:border-paper-800 opacity-60 break-inside-avoid">
            <span class="w-5 h-5 shrink-0 flex items-center justify-center text-ink-300" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></span>
            <span class="flex-1 min-w-0 truncate text-ink-400">${escapeHtml(o.texto)}</span>
            <span class="text-xs text-ink-300 shrink-0">Migrado</span>
        </li>`;
    }

    function renderObjetivoItem(o, indice, dateKey) {
        if (o.migrado) return renderObjetivoMigrado(o);
        const temNota = !!window.LogZenData.getObjetivoNota(dateKey, o.id);
        return `
        <li data-objetivo-item data-id="${o.id}" class="rounded-xl border p-2 break-inside-avoid ${corObjetivoPorPosicao(indice)}">
            <div class="flex items-center gap-2">
                <button type="button" data-objetivo-drag-handle aria-label="Arrastar para reordenar ${escapeHtml(o.texto)}"
                    class="w-7 h-7 -ml-1 shrink-0 rounded-full text-ink-300 hover:text-ink-900 dark:hover:text-ink-50 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none">
                    <i aria-hidden="true" class="fa-solid fa-grip-vertical"></i>
                </button>
                <label class="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <input type="checkbox" data-action="toggle-objetivo" class="w-5 h-5 rounded accent-sage-600 dark:accent-sage-400 shrink-0" ${o.feito ? 'checked' : ''} aria-label="Concluído">
                    <span class="truncate ${o.feito ? 'line-through text-ink-300' : ''}">${escapeHtml(o.texto)}</span>
                </label>
                ${notaBtnObjetivo(o, temNota)}
                <button type="button" data-action="remove-objetivo" aria-label="Remover objetivo" class="w-7 h-7 shrink-0 rounded-full text-ink-300 hover:text-clay-600 hover:bg-clay-50 dark:hover:bg-clay-900/40 flex items-center justify-center">
                    <i aria-hidden="true" class="fa-solid fa-xmark text-xs"></i>
                </button>
            </div>
            ${notaBoxObjetivo(o, dateKey)}
        </li>`;
    }

    // Colore por posição só entre os ATIVOS (não migrados) — um migrado não
    // ocupa vaga na regra 1-3-5, é só histórico do dia de origem.
    function renderListaObjetivos(lista, dateKey) {
        let indiceAtivo = 0;
        return lista.map((o) => {
            if (o.migrado) return renderObjetivoItem(o, -1, dateKey);
            const html = renderObjetivoItem(o, indiceAtivo, dateKey);
            indiceAtivo += 1;
            return html;
        }).join('');
    }

    // Sempre em destaque (issue #33): cartão fixo, não mais um <details>
    // recolhível — é a primeira coisa da tela, junto das Metas (renderMetas,
    // ver render()). Em telas largas, a lista ganha 2 colunas internas.
    function renderObjetivos(dateKey) {
        const lista = window.LogZenData.getObjetivos(dateKey);
        const temAtivos = lista.some((o) => !o.migrado);
        const limite = window.LogZenData.LIMITE_OBJETIVOS_DIA;
        const atingiuLimite = lista.length >= limite;
        return `
        <div data-cat="__objetivos__" class="rounded-2xl bg-paper-50 dark:bg-paper-700 shadow-sm p-4 lg:p-5">
            <div class="flex flex-wrap items-baseline gap-2.5 mb-3.5">
                <span class="w-6 h-6 rounded-full bg-sage-100 dark:bg-sage-800 text-sage-700 dark:text-sage-300 flex items-center justify-center shrink-0">
                    <i aria-hidden="true" class="fa-solid fa-bullseye text-xs"></i>
                </span>
                <h3 class="font-display text-base font-medium">Objetivos do dia</h3>
                <span class="text-xs font-normal text-ink-400">Regra 1-3-5 — arraste para definir a prioridade.</span>
                <span data-objetivos-contador class="text-xs font-normal text-ink-300 ml-auto tabular-nums">${lista.length}/${limite}</span>
            </div>
            <ul data-objetivos-lista class="space-y-2 lg:columns-2 lg:gap-x-4">${renderListaObjetivos(lista, dateKey)}</ul>
            <p data-objetivos-vazio class="text-xs text-ink-400 mt-2 ${temAtivos ? 'hidden' : ''}">Nenhum objetivo ainda — adicione um abaixo, ou envie do Backlog.</p>
            <p data-objetivos-limite class="text-xs text-clay-700 dark:text-clay-400 mt-2 ${atingiuLimite ? '' : 'hidden'}">Limite de ${limite} objetivos atingido — conclua ou remova algum para adicionar outro.</p>
            <form data-add-objetivo-form class="flex items-center gap-2 pt-3" ${atingiuLimite ? 'hidden' : ''}>
                <input type="text" data-field="texto" placeholder="Adicionar objetivo…" maxlength="140"
                    class="flex-1 px-3 py-2 rounded-xl border border-paper-300 dark:border-paper-700 bg-white dark:bg-paper-800 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400">
                <button type="submit" aria-label="Adicionar objetivo" class="w-9 h-9 shrink-0 rounded-full bg-sage-600 dark:bg-sage-700 text-white flex items-center justify-center">
                    <i aria-hidden="true" class="fa-solid fa-plus"></i>
                </button>
            </form>
        </div>`;
    }

    // Metas com prazo por item (issue #33) — contador (bater um recorde) ou
    // contador-inverso (dias seguidos sem o hábito). Editar/remover é
    // sempre em Itens rastreados; aqui só mostra o progresso, empilhado ao
    // lado de Objetivos do dia (ver render()).
    function renderMetaCard(cat, item, p) {
        const unidade = item.tipo === 'contador-inverso' ? ' dias seguidos' : '';
        const pct = p.alvo > 0 ? Math.max(4, Math.min(100, Math.round((p.atual / p.alvo) * 100))) : 0;
        return `
        <div class="rounded-2xl bg-paper-50 dark:bg-paper-700 shadow-sm p-4">
            <div class="flex items-center gap-2 text-xs text-ink-400 mb-2">
                ${p.bateu
                    ? `<i aria-hidden="true" class="fa-solid fa-circle-check text-sage-600 dark:text-sage-400"></i><span>Meta batida · ${escapeHtml(item.nome)}</span>`
                    : `<i aria-hidden="true" class="fa-solid fa-bullseye text-anil-600 dark:text-anil-400"></i><span>Meta · ${escapeHtml(item.nome)}</span>`}
            </div>
            <div class="flex items-baseline gap-1.5 mb-2">
                <b class="font-display text-xl font-semibold">${p.atual}</b><span class="text-xs text-ink-400">de ${p.alvo}${unidade}</span>
            </div>
            <div class="h-1.5 rounded-full bg-paper-200 dark:bg-paper-900 overflow-hidden">
                <div class="h-full rounded-full ${p.bateu ? 'bg-sage-600' : 'bg-anil-600'}" style="width:${pct}%"></div>
            </div>
            <p class="text-xs text-ink-300 mt-2">${p.bateu ? 'Editável em Itens rastreados' : (p.prazo ? `até ${formatarPrazo(p.prazo)}` : 'sem prazo definido')}</p>
        </div>`;
    }

    function renderMetas(dateKey) {
        const categorias = window.LogZenCatalog.getCategorias();
        const cards = [];
        categorias.forEach((cat) => {
            cat.itens.forEach((item) => {
                const p = progressoMeta(cat, item, dateKey);
                if (p) cards.push(renderMetaCard(cat, item, p));
            });
        });
        if (!cards.length) {
            return `
            <div class="rounded-2xl border border-dashed border-paper-300 dark:border-paper-700 p-4 flex items-center text-xs text-ink-400">
                Defina metas com prazo para um item em Configurações → Itens rastreados.
            </div>`;
        }
        // Em linha (não empilhado) abaixo dos Objetivos — evita que uma
        // coluna vertical de metas fique mais alta que o resto da tela.
        return `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">${cards.join('')}</div>`;
    }

    // Mantém o contador "(N/limite)" e a mensagem/formulário de limite
    // sincronizados quando a lista muda por um caminho que só mexe no DOM
    // (inserção/remoção incremental), sem recriar o bloco inteiro.
    function atualizarContadorObjetivos(root, dateKey) {
        const details = root.querySelector('[data-cat="__objetivos__"]');
        if (!details) return;
        const lista = window.LogZenData.getObjetivos(dateKey);
        const limite = window.LogZenData.LIMITE_OBJETIVOS_DIA;
        const contador = details.querySelector('[data-objetivos-contador]');
        if (contador) contador.textContent = `${lista.length}/${limite}`;
        const atingiuLimite = lista.length >= limite;
        const msg = details.querySelector('[data-objetivos-limite]');
        if (msg) msg.classList.toggle('hidden', !atingiuLimite);
        const form = details.querySelector('form[data-add-objetivo-form]');
        if (form) form.hidden = atingiuLimite;
    }

    function gerarIdObjetivo() {
        return `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    }

    // Objetivos (esquerda, mais larga) + Metas (direita, empilhadas) em
    // destaque no topo; abaixo, o quadro de categorias em colunas no
    // desktop (mansonry via CSS columns, sem JS) — issue #33.
    function render(root, dateKey) {
        if (dateKey === window.LogZenData.todayKey()) window.LogZenData.migrarObjetivosPendentes(dateKey);
        const categorias = window.LogZenCatalog.getCategorias();
        root.innerHTML = `
            ${renderObjetivos(dateKey)}
            <div data-metas-col>${renderMetas(dateKey)}</div>
            <div class="columns-1 lg:columns-2 xl:columns-3 gap-4">
                ${categorias.map((cat, i) => renderCategoria(cat, dateKey, i === 0)).join('')}
            </div>
            ${renderNota(dateKey)}
        `;
    }

    // Roda `renderFn` recriando o HTML de `root` mas preservando quais
    // blocos de nível superior (<details>) estavam abertos/fechados — usado
    // para atualizar a tela "Hoje" depois que a lista de itens (issue #6) ou
    // a ordem (issue #7) mudam em Configurações, sem perder o que o usuário
    // tinha aberto. Casa por `data-cat`, não por posição — categorias podem
    // ter sido reordenadas entre a captura e a recriação. As categorias
    // ficam dentro do quadro em colunas (issue #33), não mais filhas diretas
    // de `root` — por isso a busca não usa mais `:scope >`.
    function reRenderComEstado(root, renderFn) {
        const abertos = new Map(
            Array.from(root.querySelectorAll('details[data-cat]')).map((d) => [d.dataset.cat, d.open])
        );
        renderFn();
        root.querySelectorAll('details[data-cat]').forEach((d) => {
            if (abertos.has(d.dataset.cat)) d.open = abertos.get(d.dataset.cat);
        });
    }

    // Atualiza a tela "Hoje" (se já estiver montada) para refletir mudanças
    // no catálogo de itens feitas em Configurações.
    function sincronizarHoje() {
        if (!rootEl) return;
        reRenderComEstado(rootEl, () => render(rootEl, dataAtual));
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

    const timersNotaObjetivo = new WeakMap();
    function salvarNotaObjetivoDebounced(el, dateKey, objetivoId) {
        clearTimeout(timersNotaObjetivo.get(el));
        timersNotaObjetivo.set(el, setTimeout(() => {
            const texto = el.value.trim();
            window.LogZenData.setObjetivoNota(dateKey, objetivoId, texto);
            const li = el.closest('[data-objetivo-item]');
            const btn = li && li.querySelector('[data-action="toggle-nota"]');
            if (btn) {
                btn.classList.toggle('text-brand-600', !!texto);
                btn.classList.toggle('dark:text-accent-400', !!texto);
                btn.classList.toggle('text-gray-400', !texto);
            }
        }, 400));
    }

    // Reaplica a cor por posição (regra 1-3-5) depois que a ordem muda —
    // arrastar (issue #12) ou remover um objetivo desloca os que vinham
    // depois. Itens migrados (sem checkbox) não entram na contagem.
    function recolorirObjetivos(root) {
        const itens = root.querySelectorAll('[data-objetivos-lista] > [data-objetivo-item]');
        let indice = 0;
        itens.forEach((li) => {
            if (!li.querySelector('[data-action="toggle-objetivo"]')) return; // migrado — não recolore
            li.className = li.className.replace(/bg-\S+|dark:bg-\S+|border-\S+|dark:border-\S+/g, '').trim();
            li.classList.add(...corObjetivoPorPosicao(indice).split(' '));
            indice += 1;
        });
    }

    function wire(root) {
        root.addEventListener('click', (e) => {
            const notaToggle = e.target.closest('[data-action="toggle-nota"]');
            if (notaToggle) {
                const row = notaToggle.closest('[data-row], [data-objetivo-item]');
                const wrap = row.querySelector('[data-nota-wrap]');
                wrap.hidden = !wrap.hidden;
                notaToggle.setAttribute('aria-expanded', String(!wrap.hidden));
                if (!wrap.hidden) wrap.querySelector('textarea').focus();
                return;
            }

            const removeObjetivoBtn = e.target.closest('[data-action="remove-objetivo"]');
            if (removeObjetivoBtn) {
                const li = removeObjetivoBtn.closest('[data-objetivo-item]');
                const lista = window.LogZenData.getObjetivos(dataAtual).filter((o) => o.id !== li.dataset.id);
                window.LogZenData.setObjetivos(dataAtual, lista);
                const ul = li.parentElement;
                li.remove();
                recolorirObjetivos(root);
                if (!lista.some((o) => !o.migrado)) {
                    const vazio = ul.parentElement.querySelector('[data-objetivos-vazio]');
                    if (vazio) vazio.classList.remove('hidden');
                }
                atualizarContadorObjetivos(root, dataAtual);
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
                    row.classList.add('rounded-2xl', 'p-3.5', 'my-2', 'transition-colors', ...corVicio(valor).split(' '));
                    row.querySelector('[data-streak]').textContent =
                        `${window.LogZenData.streakZerado(cat, item, dataAtual)} dia(s) sem "${row.dataset.nome}"`;
                }
                atualizarMetaUI(root, dataAtual, cat, item, row);
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
            const objetivoItem = e.target.closest('[data-objetivo-item]');
            if (objetivoItem && e.target.dataset.action === 'toggle-objetivo') {
                const lista = window.LogZenData.getObjetivos(dataAtual);
                const o = lista.find((x) => x.id === objetivoItem.dataset.id);
                if (o) {
                    o.feito = e.target.checked;
                    window.LogZenData.setObjetivos(dataAtual, lista);
                }
                const span = objetivoItem.querySelector('span');
                span.classList.toggle('line-through', e.target.checked);
                span.classList.toggle('text-gray-400', e.target.checked);
                span.classList.toggle('dark:text-gray-500', e.target.checked);
                return;
            }

            const row = e.target.closest('[data-row][data-tipo="checkbox"]');
            if (row && e.target.dataset.action === 'checkbox') {
                window.LogZenData.setItemValue(dataAtual, row.dataset.cat, row.dataset.item, e.target.checked);
                return;
            }

            const rowHorario = e.target.closest('[data-row][data-tipo="horario"]');
            if (rowHorario && (e.target.dataset.field === 'inicio' || e.target.dataset.field === 'fim')) {
                const atual = window.LogZenData.getItemValue(dataAtual, rowHorario.dataset.cat, rowHorario.dataset.item, { inicio: '', fim: '' });
                const novo = { ...atual, [e.target.dataset.field]: e.target.value };
                window.LogZenData.setItemValue(dataAtual, rowHorario.dataset.cat, rowHorario.dataset.item, novo);
            }
        });

        root.addEventListener('input', (e) => {
            if (e.target.matches('[data-nota]')) {
                salvarNotaDebounced(dataAtual, e.target.value);
                return;
            }
            if (e.target.matches('[data-item-nota]')) {
                const objetivoLi = e.target.closest('[data-objetivo-item]');
                if (objetivoLi) {
                    salvarNotaObjetivoDebounced(e.target, dataAtual, objetivoLi.dataset.id);
                    return;
                }
                const row = e.target.closest('[data-row]');
                if (!row) return;
                salvarNotaItemDebounced(e.target, dataAtual, row.dataset.cat, row.dataset.item);
            }
        });

        root.addEventListener('submit', (e) => {
            const form = e.target.closest('form[data-add-objetivo-form]');
            if (!form) return;
            e.preventDefault();
            const limite = window.LogZenData.LIMITE_OBJETIVOS_DIA;
            const lista = window.LogZenData.getObjetivos(dataAtual);
            if (lista.length >= limite) {
                window.alert(`Objetivos do dia já tem o máximo de ${limite} itens — conclua ou remova algum antes de adicionar outro.`);
                return;
            }
            const input = form.querySelector('[data-field="texto"]');
            const texto = input.value.trim();
            if (!texto) return;
            const novo = { id: gerarIdObjetivo(), texto, feito: false };
            const indiceAtivos = lista.filter((o) => !o.migrado).length;
            lista.push(novo);
            window.LogZenData.setObjetivos(dataAtual, lista);
            const container = form.parentElement;
            container.querySelector('[data-objetivos-lista]').insertAdjacentHTML('beforeend', renderObjetivoItem(novo, indiceAtivos, dataAtual));
            const vazio = container.querySelector('[data-objetivos-vazio]');
            if (vazio) vazio.classList.add('hidden');
            atualizarContadorObjetivos(root, dataAtual);
            input.value = '';
            input.focus();
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

    /* =====================================================================
       Gestão de itens (Configurações) — issue #6. Adicionar/editar/excluir
       vive aqui, fora da tela "Hoje". Todo item é editável/excluível,
       inclusive os do catálogo de fábrica (issue #8). Editar nunca muda o
       `id` do item, e excluir só tira da lista — os registros já salvos
       por data continuam no armazenamento local, associados ao mesmo id.
       ===================================================================== */
    // Alça de arrastar (issue #7) — comum a todo item, padrão ou customizado.
    function dragHandle(label) {
        return `<button type="button" data-item-drag-handle aria-label="Arrastar para reordenar ${escapeHtml(label)}"
            class="w-7 h-7 -ml-1 shrink-0 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none">
            <i aria-hidden="true" class="fa-solid fa-grip-vertical"></i>
        </button>`;
    }

    function renderItemConfigRow(cat, item) {
        const detalhe = [TIPOS_LABEL[item.tipo] || item.tipo, item.unidade, (item.opcoes || []).join(', ')]
            .filter(Boolean).join(' · ');
        return `
        <div data-item-row data-cat="${cat.id}" data-item="${item.id}">
            <div class="flex items-center justify-between gap-2 py-3">
                ${dragHandle(item.nome)}
                <div class="min-w-0 flex-1">
                    <p class="font-medium truncate">${escapeHtml(item.nome)}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(detalhe)}</p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    <button type="button" data-action="toggle-edit-item" aria-label="Editar ${escapeHtml(item.nome)}"
                        class="w-8 h-8 rounded text-gray-400 hover:text-brand-600 dark:hover:text-accent-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button type="button" data-action="delete-item" aria-label="Excluir ${escapeHtml(item.nome)}"
                        class="w-8 h-8 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
            ${metaConfigHtml(cat, item)}
            ${renderFormularioEditarItem(cat, item)}
        </div>`;
    }

    // Meta (issue #33): valor-alvo opcional + prazo, só para "contador"
    // (bater recorde) e "contador-inverso" (sequência de dias sem o
    // hábito) — os outros tipos não têm um único número de progresso.
    // Definir/editar/remover só acontece aqui; a tela "Hoje" só mostra o
    // progresso (nunca oferece editar a meta por lá).
    function metaConfigHtml(cat, item) {
        if (item.tipo !== 'contador' && item.tipo !== 'contador-inverso') return '';
        const meta = item.meta;
        const unidade = item.tipo === 'contador-inverso' ? ' dias seguidos' : '';
        const resumo = meta
            ? `${meta.valor}${unidade}${meta.prazo ? ` · até ${escapeHtml(new Date(meta.prazo + 'T00:00:00').toLocaleDateString('pt-BR'))}` : ''}`
            : '';
        return `
        <div data-meta-row class="pb-3 -mt-1">
            <div class="flex items-center gap-2 text-xs">
                ${meta ? `
                <i aria-hidden="true" class="fa-solid fa-bullseye text-brand-600 dark:text-accent-400"></i>
                <span class="text-gray-500 dark:text-gray-400">Meta: ${resumo}</span>
                <button type="button" data-action="toggle-edit-meta" aria-label="Editar meta de ${escapeHtml(item.nome)}"
                    class="w-6 h-6 rounded text-gray-400 hover:text-brand-600 dark:hover:text-accent-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center">
                    <i aria-hidden="true" class="fa-solid fa-pen text-[10px]"></i>
                </button>
                <button type="button" data-action="remove-meta" aria-label="Remover meta de ${escapeHtml(item.nome)}"
                    class="w-6 h-6 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center">
                    <i aria-hidden="true" class="fa-solid fa-trash text-[10px]"></i>
                </button>` : `
                <button type="button" data-action="toggle-add-meta" class="text-brand-700 dark:text-accent-400 hover:underline">
                    <i aria-hidden="true" class="fa-solid fa-plus"></i> Definir meta
                </button>`}
            </div>
            <form data-meta-form data-cat="${cat.id}" data-item="${item.id}" hidden class="flex flex-wrap items-end gap-2 pt-2">
                <div>
                    <label class="block text-xs font-medium mb-1">Valor-alvo${unidade ? ' (dias)' : ''}</label>
                    <input type="number" data-field="valor" min="1" step="1" required value="${meta ? meta.valor : ''}"
                        class="w-24 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Prazo (opcional)</label>
                    <input type="date" data-field="prazo" value="${meta ? meta.prazo || '' : ''}"
                        class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
                <button type="submit" class="px-3 py-1.5 rounded bg-brand-600 dark:bg-accent-600 text-white text-sm font-semibold hover:bg-brand-700">Salvar</button>
                <button type="button" data-action="cancel-meta-form" class="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Cancelar</button>
            </form>
        </div>`;
    }

    function renderFormularioEditarItem(cat, item) {
        const mostraUnidade = item.tipo === 'contador' || item.tipo === 'contador-inverso';
        const mostraOpcoes = item.tipo === 'tags';
        return `
        <form data-edit-item-form data-cat="${cat.id}" data-item="${item.id}" hidden class="pb-3 space-y-2">
            <p class="text-xs text-gray-500 dark:text-gray-400">Tipo: ${escapeHtml(TIPOS_LABEL[item.tipo] || item.tipo)} — não pode ser alterado depois de criado.</p>
            <div>
                <label class="block text-xs font-medium mb-1">Nome</label>
                <input type="text" data-field="nome" required maxlength="60" value="${escapeHtml(item.nome)}"
                    class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
            </div>
            ${mostraUnidade ? `
            <div>
                <label class="block text-xs font-medium mb-1">Unidade (opcional)</label>
                <input type="text" data-field="unidade" maxlength="30" value="${escapeHtml(item.unidade || '')}"
                    class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
            </div>` : ''}
            ${mostraOpcoes ? `
            <div>
                <label class="block text-xs font-medium mb-1">Opções (separadas por vírgula)</label>
                <input type="text" data-field="opcoes" value="${escapeHtml((item.opcoes || []).join(', '))}"
                    class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
            </div>` : ''}
            <div class="flex items-center gap-2 pt-1">
                <button type="submit" class="px-3 py-1.5 rounded bg-brand-600 dark:bg-accent-600 text-white text-sm font-semibold hover:bg-brand-700">Salvar</button>
                <button type="button" data-action="cancel-edit-item" class="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Cancelar</button>
            </div>
        </form>`;
    }

    function renderCategoriaConfig(cat) {
        const itensHtml = cat.itens.map((item) => renderItemConfigRow(cat, item)).join('');
        return `
        <div data-cat-block data-cat="${cat.id}" class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div class="px-4 py-3 bg-brand-50 dark:bg-gray-800 font-semibold flex items-center gap-2">
                <button type="button" data-cat-drag-handle aria-label="Arrastar para reordenar categoria ${escapeHtml(cat.nome)}"
                    class="w-7 h-7 -ml-1 shrink-0 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none">
                    <i aria-hidden="true" class="fa-solid fa-grip-vertical"></i>
                </button>
                <i aria-hidden="true" class="fa-solid ${cat.icone} text-brand-600 dark:text-accent-400"></i>
                <span class="flex-1 min-w-0 truncate">${escapeHtml(cat.nome)}</span>
                ${cat.custom ? `<button type="button" data-action="delete-categoria" aria-label="Excluir categoria ${escapeHtml(cat.nome)}"
                    class="w-8 h-8 shrink-0 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center">
                    <i aria-hidden="true" class="fa-solid fa-trash text-xs"></i>
                </button>` : ''}
            </div>
            <div class="px-4 divide-y divide-gray-100 dark:divide-gray-700" data-cat-items-list>${itensHtml}</div>
            ${renderFormularioNovoItem(cat)}
        </div>`;
    }

    // Adicionar categoria (issue #10): ativa uma sugerida ou cria uma
    // totalmente personalizada. Fica vazia (sem itens) até o usuário
    // adicionar algo a ela, igual às 5 categorias originais.
    function renderFormularioNovaCategoria() {
        const sugeridas = window.LogZenCatalog.getCategoriasSugeridasDisponiveis();
        const opcoesSugeridas = sugeridas.map((c) => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('');
        return `
        <div class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4">
            <button type="button" data-action="toggle-add-categoria-form" class="text-sm font-medium text-brand-700 dark:text-accent-400 hover:underline flex items-center gap-1">
                <i aria-hidden="true" class="fa-solid fa-plus"></i> Adicionar categoria
            </button>
            <form data-add-categoria-form hidden class="space-y-2 pt-3">
                <div>
                    <label class="block text-xs font-medium mb-1">Categoria</label>
                    <select data-field="sugerida" class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                        ${opcoesSugeridas}
                        <option value="__custom__">Outra (personalizada)…</option>
                    </select>
                </div>
                <div data-field-group="nome-custom" hidden>
                    <label class="block text-xs font-medium mb-1">Nome da categoria</label>
                    <input type="text" data-field="nome" maxlength="40" placeholder="ex.: Jardinagem"
                        class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                </div>
                <div class="flex items-center gap-2 pt-1">
                    <button type="submit" class="px-3 py-1.5 rounded bg-brand-600 dark:bg-accent-600 text-white text-sm font-semibold hover:bg-brand-700">Adicionar</button>
                    <button type="button" data-action="cancel-add-categoria-form" class="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Cancelar</button>
                </div>
            </form>
        </div>`;
    }

    // Mostra o campo de nome só quando "Outra (personalizada)" é escolhida.
    function syncFormularioCategoria(form) {
        const grupo = form.querySelector('[data-field-group="nome-custom"]');
        if (grupo) grupo.hidden = form.querySelector('[data-field="sugerida"]').value !== '__custom__';
    }

    function renderItensConfig() {
        if (!itensConfigRootEl) return;
        const categorias = window.LogZenCatalog.getCategorias();
        itensConfigRootEl.innerHTML =
            categorias.map((cat) => renderCategoriaConfig(cat)).join('') +
            renderFormularioNovaCategoria();
    }

    function wireItensConfig(root) {
        root.addEventListener('click', (e) => {
            const toggleAddBtn = e.target.closest('[data-action="toggle-add-form"]');
            if (toggleAddBtn) {
                const form = toggleAddBtn.nextElementSibling;
                form.hidden = !form.hidden;
                if (!form.hidden) {
                    syncFieldGroups(form);
                    form.querySelector('[data-field="nome"]').focus();
                }
                return;
            }

            const cancelAddBtn = e.target.closest('[data-action="cancel-add-form"]');
            if (cancelAddBtn) {
                const form = cancelAddBtn.closest('form[data-add-item-form]');
                form.reset();
                syncFieldGroups(form);
                form.hidden = true;
                return;
            }

            const toggleEditBtn = e.target.closest('[data-action="toggle-edit-item"]');
            if (toggleEditBtn) {
                const form = toggleEditBtn.closest('[data-item-row]').querySelector('form[data-edit-item-form]');
                form.hidden = !form.hidden;
                if (!form.hidden) form.querySelector('[data-field="nome"]').focus();
                return;
            }

            const cancelEditBtn = e.target.closest('[data-action="cancel-edit-item"]');
            if (cancelEditBtn) {
                renderItensConfig(); // descarta edição não salva, recolhendo o formulário
                return;
            }

            const toggleAddMetaBtn = e.target.closest('[data-action="toggle-add-meta"]');
            if (toggleAddMetaBtn) {
                const form = toggleAddMetaBtn.closest('[data-meta-row]').querySelector('form[data-meta-form]');
                form.hidden = !form.hidden;
                if (!form.hidden) form.querySelector('[data-field="valor"]').focus();
                return;
            }

            const toggleEditMetaBtn = e.target.closest('[data-action="toggle-edit-meta"]');
            if (toggleEditMetaBtn) {
                const form = toggleEditMetaBtn.closest('[data-meta-row]').querySelector('form[data-meta-form]');
                form.hidden = !form.hidden;
                if (!form.hidden) form.querySelector('[data-field="valor"]').focus();
                return;
            }

            const cancelMetaBtn = e.target.closest('[data-action="cancel-meta-form"]');
            if (cancelMetaBtn) {
                cancelMetaBtn.closest('form[data-meta-form]').hidden = true;
                return;
            }

            const removeMetaBtn = e.target.closest('[data-action="remove-meta"]');
            if (removeMetaBtn) {
                const row = removeMetaBtn.closest('[data-meta-row]');
                window.LogZenCatalog.removeMeta(row.closest('[data-item-row]').dataset.cat, row.closest('[data-item-row]').dataset.item);
                renderItensConfig();
                sincronizarHoje();
                return;
            }

            const deleteBtn = e.target.closest('[data-action="delete-item"]');
            if (deleteBtn) {
                const row = deleteBtn.closest('[data-item-row]');
                const nome = row.querySelector('p.font-medium').textContent;
                if (!window.confirm(`Excluir "${nome}"? Os registros já salvos para este item continuam guardados — ele só deixa de aparecer na tela e no catálogo.`)) return;
                window.LogZenCatalog.removeItem(row.dataset.cat, row.dataset.item);
                renderItensConfig();
                sincronizarHoje();
                return;
            }

            const toggleAddCatBtn = e.target.closest('[data-action="toggle-add-categoria-form"]');
            if (toggleAddCatBtn) {
                const form = toggleAddCatBtn.nextElementSibling;
                form.hidden = !form.hidden;
                if (!form.hidden) syncFormularioCategoria(form);
                return;
            }

            const cancelAddCatBtn = e.target.closest('[data-action="cancel-add-categoria-form"]');
            if (cancelAddCatBtn) {
                const form = cancelAddCatBtn.closest('form[data-add-categoria-form]');
                form.reset();
                syncFormularioCategoria(form);
                form.hidden = true;
                return;
            }

            const deleteCatBtn = e.target.closest('[data-action="delete-categoria"]');
            if (deleteCatBtn) {
                const catBlock = deleteCatBtn.closest('[data-cat-block]');
                const nome = catBlock.querySelector('span.flex-1').textContent;
                if (!window.confirm(`Excluir a categoria "${nome}"? Os itens e registros dela continuam guardados — ela só deixa de aparecer na tela.`)) return;
                window.LogZenCatalog.removeCategoria(catBlock.dataset.cat);
                renderItensConfig();
                sincronizarHoje();
                return;
            }
        });

        root.addEventListener('change', (e) => {
            if (e.target.matches('[data-field="tipo"]')) syncFieldGroups(e.target.closest('form[data-add-item-form]'));
            if (e.target.matches('[data-field="sugerida"]')) syncFormularioCategoria(e.target.closest('form[data-add-categoria-form]'));
        });

        root.addEventListener('submit', (e) => {
            const addForm = e.target.closest('form[data-add-item-form]');
            if (addForm) {
                e.preventDefault();
                const nome = addForm.querySelector('[data-field="nome"]').value.trim();
                if (!nome) return;
                const tipo = addForm.querySelector('[data-field="tipo"]').value;
                const dados = { nome, tipo };
                if (tipo === 'contador' || tipo === 'contador-inverso') {
                    const unidade = addForm.querySelector('[data-field="unidade"]').value.trim();
                    if (unidade) dados.unidade = unidade;
                }
                if (tipo === 'tags') {
                    dados.opcoes = addForm.querySelector('[data-field="opcoes"]').value.split(',').map((s) => s.trim()).filter(Boolean);
                    if (dados.opcoes.length === 0) {
                        window.alert('Informe ao menos uma opção de tag, separadas por vírgula.');
                        return;
                    }
                }
                window.LogZenCatalog.addCustomItem(addForm.dataset.cat, dados);
                renderItensConfig();
                sincronizarHoje();
                return;
            }

            const editForm = e.target.closest('form[data-edit-item-form]');
            if (editForm) {
                e.preventDefault();
                const nome = editForm.querySelector('[data-field="nome"]').value.trim();
                if (!nome) return;
                const dados = { nome };
                const unidadeEl = editForm.querySelector('[data-field="unidade"]');
                if (unidadeEl) dados.unidade = unidadeEl.value.trim();
                const opcoesEl = editForm.querySelector('[data-field="opcoes"]');
                if (opcoesEl) {
                    dados.opcoes = opcoesEl.value.split(',').map((s) => s.trim()).filter(Boolean);
                    if (dados.opcoes.length === 0) {
                        window.alert('Informe ao menos uma opção de tag, separadas por vírgula.');
                        return;
                    }
                }
                window.LogZenCatalog.updateItem(editForm.dataset.cat, editForm.dataset.item, dados);
                renderItensConfig();
                sincronizarHoje();
                return;
            }

            const metaForm = e.target.closest('form[data-meta-form]');
            if (metaForm) {
                e.preventDefault();
                const valor = parseInt(metaForm.querySelector('[data-field="valor"]').value, 10);
                if (!valor || valor < 1) return;
                const prazo = metaForm.querySelector('[data-field="prazo"]').value;
                window.LogZenCatalog.setMeta(metaForm.dataset.cat, metaForm.dataset.item, { valor, prazo });
                renderItensConfig();
                sincronizarHoje();
                return;
            }

            const catForm = e.target.closest('form[data-add-categoria-form]');
            if (catForm) {
                e.preventDefault();
                const sugerida = catForm.querySelector('[data-field="sugerida"]').value;
                if (sugerida === '__custom__') {
                    const nome = catForm.querySelector('[data-field="nome"]').value.trim();
                    if (!nome) return;
                    window.LogZenCatalog.addCategoria({ nome });
                } else {
                    window.LogZenCatalog.addCategoria({ id: sugerida });
                }
                renderItensConfig();
                sincronizarHoje();
            }
        });
    }

    function init() {
        rootEl = $('#hojeRoot');
        if (!rootEl) return;
        atualizarCabecalho();
        render(rootEl, dataAtual);
        wire(rootEl);
        wireExportImport();

        // Arrastar para reordenar objetivos (issue #12) — a posição na
        // lista É a prioridade (regra 1-3-5), então arrastar muda a cor.
        window.LogZenReorder.ativar(rootEl, {
            itemSelector: '[data-objetivo-item]',
            handleSelector: '[data-objetivo-drag-handle]',
            groupSelector: '[data-objetivos-lista]',
            getId: (el) => el.dataset.id,
            onReorder: (ids) => {
                const atual = window.LogZenData.getObjetivos(dataAtual);
                const porId = new Map(atual.map((o) => [o.id, o]));
                const novaLista = ids.map((id) => porId.get(id)).filter(Boolean);
                window.LogZenData.setObjetivos(dataAtual, novaLista);
                recolorirObjetivos(rootEl);
            },
        });

        // Refaz a tela ao entrar na aba "Hoje" — cobre o caso de um objetivo
        // ter sido enviado do Backlog enquanto o usuário estava em outra aba
        // (issue #20), sem precisar religar nada.
        document.addEventListener('tab:change', (e) => {
            if (e.detail.tab === 'hoje' && rootEl) reRenderComEstado(rootEl, () => render(rootEl, dataAtual));
        });

        const btnAnterior = $('#hojeDiaAnterior');
        if (btnAnterior) btnAnterior.addEventListener('click', () => irParaDia(-1));
        const btnProximo = $('#hojeDiaProximo');
        if (btnProximo) btnProximo.addEventListener('click', () => irParaDia(1));
        const btnVoltar = $('#hojeVoltarHoje');
        if (btnVoltar) btnVoltar.addEventListener('click', irParaHoje);

        itensConfigRootEl = $('#itensConfigRoot');
        if (itensConfigRootEl) {
            renderItensConfig();
            wireItensConfig(itensConfigRootEl);

            // Arrastar para reordenar (issue #7) — ligado uma vez na raiz
            // estável; sobrevive às recriações de HTML feitas por
            // renderItensConfig() (add/editar/excluir item).
            window.LogZenReorder.ativar(itensConfigRootEl, {
                itemSelector: '[data-cat-block]',
                handleSelector: '[data-cat-drag-handle]',
                getId: (el) => el.dataset.cat,
                onReorder: (ids) => {
                    window.LogZenCatalog.setOrdemCategorias(ids);
                    sincronizarHoje();
                },
            });
            window.LogZenReorder.ativar(itensConfigRootEl, {
                itemSelector: '[data-item-row]',
                handleSelector: '[data-item-drag-handle]',
                groupSelector: '[data-cat-block]',
                getId: (el) => el.dataset.item,
                onReorder: (ids, grupo) => {
                    window.LogZenCatalog.setOrdemItens(grupo.dataset.cat, ids);
                    sincronizarHoje();
                },
            });
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

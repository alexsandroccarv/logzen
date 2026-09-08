/* ==========================================================================
   LogZen — Camada de dados (armazenamento 100% local, sem backend — ver
   issue #1). Guarda um registro por dia (chave YYYY-MM-DD) em localStorage,
   namespaced para não colidir com as chaves do chrome.js/layout.js.
   getMelhorValor (issue #33) sustenta as metas de itens "contador": o maior
   valor já registrado em qualquer dia, para bater recordes.
   ========================================================================== */
window.LogZenData = (function () {
    const STORAGE_KEY = 'logzen:entries:v1';
    // Regra 1-3-5 (issue #20): "Objetivos do dia" tem um teto rígido de
    // itens — usado tanto pelo formulário de adicionar quanto pela
    // migração automática abaixo, para nunca passar disso.
    const LIMITE_OBJETIVOS_DIA = 10;

    // Virada do dia na madrugada, não à meia-noite (issue #38) — para quem
    // dorme tarde: com a opção ativa, registros feitos entre meia-noite e
    // 3h da manhã ainda contam para o dia anterior. Configurável em
    // Configurações; desligada por padrão (comportamento de calendário).
    const CORTE_MADRUGADA_KEY = 'logzen:corte-dia-madrugada:v1';
    const HORA_CORTE_MADRUGADA = 3;

    function getCorteMadrugada() {
        try { return localStorage.getItem(CORTE_MADRUGADA_KEY) === '1'; }
        catch (e) { return false; }
    }

    function setCorteMadrugada(ativo) {
        try {
            if (ativo) localStorage.setItem(CORTE_MADRUGADA_KEY, '1');
            else localStorage.removeItem(CORTE_MADRUGADA_KEY);
        } catch (e) { /* storage indisponível — segue sem persistir */ }
    }

    // "Agora", mas se a virada de madrugada estiver ativa e ainda não passou
    // das 3h, devolve ainda o dia anterior — só usado quando `todayKey` é
    // chamado sem data explícita (ou seja, para descobrir "hoje").
    function agoraEfetivo() {
        const agora = new Date();
        if (getCorteMadrugada() && agora.getHours() < HORA_CORTE_MADRUGADA) {
            agora.setDate(agora.getDate() - 1);
        }
        return agora;
    }

    function todayKey(d) {
        const date = d || agoraEfetivo();
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function readAll() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function writeAll(all) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); }
        catch (e) { /* storage indisponível (aba anônima/cota) — segue sem persistir */ }
    }

    function getEntry(dateKey) {
        return readAll()[dateKey] || {};
    }

    function getItemValue(dateKey, categoriaId, itemId, fallback) {
        const entry = getEntry(dateKey);
        const cat = entry[categoriaId];
        const v = cat ? cat[itemId] : undefined;
        return v === undefined ? fallback : v;
    }

    function setItemValue(dateKey, categoriaId, itemId, value) {
        const all = readAll();
        if (!all[dateKey]) all[dateKey] = {};
        if (!all[dateKey][categoriaId]) all[dateKey][categoriaId] = {};
        all[dateKey][categoriaId][itemId] = value;
        writeAll(all);
    }

    function toggleTag(dateKey, categoriaId, itemId, tag) {
        const atuais = getItemValue(dateKey, categoriaId, itemId, []);
        const set = new Set(atuais);
        if (set.has(tag)) set.delete(tag); else set.add(tag);
        setItemValue(dateKey, categoriaId, itemId, Array.from(set));
        return set.has(tag);
    }

    // Streak de dias consecutivos (terminando ontem) em que o item ficou em
    // zero/ausente — usado pelos itens do tipo "contador-inverso" (vícios).
    function streakZerado(categoriaId, itemId, upToDateKey) {
        const all = readAll();
        let streak = 0;
        const cursor = upToDateKey ? new Date(upToDateKey + 'T00:00:00') : agoraEfetivo();
        for (let i = 0; i < 3650; i++) {
            const key = todayKey(cursor);
            const entry = all[key];
            const v = entry && entry[categoriaId] ? entry[categoriaId][itemId] : undefined;
            if (v) break; // qualquer valor "truthy" (>0) interrompe a sequência
            streak += 1;
            cursor.setDate(cursor.getDate() - 1);
        }
        return streak;
    }

    // Maior valor já registrado para um item "contador", em qualquer dia —
    // usado pelas metas (issue #33): o alvo é bater um recorde (ex.: "60
    // abdominais"), não repetir o mesmo valor todo dia.
    function getMelhorValor(categoriaId, itemId) {
        const all = readAll();
        let melhor = 0;
        Object.keys(all).forEach((dateKey) => {
            const entry = all[dateKey];
            const v = entry && entry[categoriaId] ? entry[categoriaId][itemId] : undefined;
            if (typeof v === 'number' && v > melhor) melhor = v;
        });
        return melhor;
    }

    // Início do período (semana começando na segunda-feira, ou mês
    // calendário) que contém `dateKey` — usado pelas metas de ocorrência
    // (issue #35), ex.: "yoga 2x por semana".
    function inicioPeriodo(periodo, dateKey) {
        const d = new Date(dateKey + 'T00:00:00');
        if (periodo === 'mes') return new Date(d.getFullYear(), d.getMonth(), 1);
        const diaSemana = (d.getDay() + 6) % 7; // 0 = segunda … 6 = domingo
        d.setDate(d.getDate() - diaSemana);
        return d;
    }

    // Quantos dias, dentro do período (semana ou mês) que contém
    // `dateKey`, o item teve algum valor "truthy" registrado — usado pelas
    // metas de ocorrência (issue #35) em itens do tipo checkbox. Reinicia
    // sozinho a cada novo período, sem precisar de ação manual.
    function contarOcorrencias(categoriaId, itemId, dateKey, periodo) {
        const all = readAll();
        const fim = new Date(dateKey + 'T00:00:00');
        const cursor = inicioPeriodo(periodo, dateKey);
        let count = 0;
        while (cursor <= fim) {
            const key = todayKey(cursor);
            const entry = all[key];
            const v = entry && entry[categoriaId] ? entry[categoriaId][itemId] : undefined;
            if (v) count += 1;
            cursor.setDate(cursor.getDate() + 1);
        }
        return count;
    }

    function getItemNota(dateKey, categoriaId, itemId) {
        const cat = getEntry(dateKey)[categoriaId];
        return (cat && cat.notas && cat.notas[itemId]) || '';
    }

    function setItemNota(dateKey, categoriaId, itemId, texto) {
        const all = readAll();
        if (!all[dateKey]) all[dateKey] = {};
        if (!all[dateKey][categoriaId]) all[dateKey][categoriaId] = {};
        if (!all[dateKey][categoriaId].notas) all[dateKey][categoriaId].notas = {};
        if (texto) all[dateKey][categoriaId].notas[itemId] = texto;
        else delete all[dateKey][categoriaId].notas[itemId];
        writeAll(all);
    }

    // Objetivos do dia (issue #9): lista de tarefas ad-hoc, digitadas na
    // hora — não fazem parte do catálogo de hábitos (logzen-catalog.js).
    function getObjetivos(dateKey) {
        return getEntry(dateKey).objetivos || [];
    }

    function setObjetivos(dateKey, lista) {
        const all = readAll();
        if (!all[dateKey]) all[dateKey] = {};
        all[dateKey].objetivos = lista;
        writeAll(all);
    }

    // Nota curta por objetivo (issue #12) — mesmo padrão da issue #3, só que
    // sem categoria (objetivos não fazem parte do catálogo de hábitos).
    function getObjetivoNota(dateKey, objetivoId) {
        const entry = getEntry(dateKey);
        return (entry.objetivosNotas && entry.objetivosNotas[objetivoId]) || '';
    }

    function setObjetivoNota(dateKey, objetivoId, texto) {
        const all = readAll();
        if (!all[dateKey]) all[dateKey] = {};
        if (!all[dateKey].objetivosNotas) all[dateKey].objetivosNotas = {};
        if (texto) all[dateKey].objetivosNotas[objetivoId] = texto;
        else delete all[dateKey].objetivosNotas[objetivoId];
        writeAll(all);
    }

    // Migração automática (issue #12, estilo Bullet Journal): ao abrir o dia
    // de hoje, todo objetivo não concluído de um dia anterior que ainda não
    // foi migrado é copiado para hoje; o original fica marcado como
    // "migrado" no dia de origem (congelado, só como registro histórico) —
    // assim não é migrado de novo da próxima vez. Olha até 60 dias para trás.
    // Respeita o limite de objetivos (issue #20): se hoje já estiver cheio,
    // o pendente continua sem migrar (não marca migrado, não perde o
    // registro) — tenta de novo num próximo dia com espaço livre.
    function migrarObjetivosPendentes(hojeKey) {
        const hoje = getObjetivos(hojeKey);
        let mudouHoje = false;
        const cursor = new Date(hojeKey + 'T00:00:00');
        for (let i = 0; i < 60; i += 1) {
            if (hoje.length >= LIMITE_OBJETIVOS_DIA) break;
            cursor.setDate(cursor.getDate() - 1);
            const diaChave = todayKey(cursor);
            const lista = getObjetivos(diaChave);
            if (!lista.length) continue;
            let mudouEsseDia = false;
            lista.forEach((o) => {
                if (hoje.length >= LIMITE_OBJETIVOS_DIA) return;
                if (!o.feito && !o.migrado) {
                    o.migrado = true;
                    mudouEsseDia = true;
                    hoje.push({ id: `${o.id}-m${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`, texto: o.texto, feito: false });
                    mudouHoje = true;
                }
            });
            if (mudouEsseDia) setObjetivos(diaChave, lista);
        }
        if (mudouHoje) setObjetivos(hojeKey, hoje);
        return mudouHoje;
    }

    function getNota(dateKey) {
        return getEntry(dateKey).nota || '';
    }

    function setNota(dateKey, texto) {
        const all = readAll();
        if (!all[dateKey]) all[dateKey] = {};
        all[dateKey].nota = texto;
        writeAll(all);
    }

    function exportJSON() {
        return JSON.stringify(readAll(), null, 2);
    }

    function importJSON(json) {
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === 'object') writeAll(parsed);
    }

    return {
        todayKey, getEntry, getItemValue, setItemValue, toggleTag, streakZerado, getMelhorValor,
        contarOcorrencias,
        getItemNota, setItemNota, getObjetivos, setObjetivos,
        getObjetivoNota, setObjetivoNota, migrarObjetivosPendentes,
        getNota, setNota, exportJSON, importJSON,
        getCorteMadrugada, setCorteMadrugada,
        LIMITE_OBJETIVOS_DIA,
    };
})();

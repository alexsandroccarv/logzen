/* ==========================================================================
   LogZen — Camada de dados (armazenamento 100% local, sem backend — ver
   issue #1). Guarda um registro por dia (chave YYYY-MM-DD) em localStorage,
   namespaced para não colidir com as chaves do chrome.js/layout.js.
   ========================================================================== */
window.LogZenData = (function () {
    const STORAGE_KEY = 'logzen:entries:v1';

    function todayKey(d) {
        const date = d || new Date();
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
        const cursor = upToDateKey ? new Date(upToDateKey + 'T00:00:00') : new Date();
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
    function migrarObjetivosPendentes(hojeKey) {
        const hoje = getObjetivos(hojeKey);
        let mudouHoje = false;
        const cursor = new Date(hojeKey + 'T00:00:00');
        for (let i = 0; i < 60; i += 1) {
            cursor.setDate(cursor.getDate() - 1);
            const diaChave = todayKey(cursor);
            const lista = getObjetivos(diaChave);
            if (!lista.length) continue;
            let mudouEsseDia = false;
            lista.forEach((o) => {
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
        todayKey, getEntry, getItemValue, setItemValue, toggleTag, streakZerado,
        getItemNota, setItemNota, getObjetivos, setObjetivos,
        getObjetivoNota, setObjetivoNota, migrarObjetivosPendentes,
        getNota, setNota, exportJSON, importJSON,
    };
})();
